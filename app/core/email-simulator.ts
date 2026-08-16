import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import valueParser from "postcss-value-parser";
import { DEFAULT_CLIENT_ID, getClientAdapter, type ClientAdapter, type ColorAnchor, type ColorTransformProfile, type EffectiveRule, type ProfileStatus, type RuleApplication } from "./clients/index.ts";

export type DiagnosticLevel = "info" | "warning";

export interface Diagnostic {
  level: DiagnosticLevel;
  title: string;
  detail: string;
  count?: number;
}

export interface SimulationOptions {
  loadRemoteImages: boolean;
  clientId?: string;
}

export interface SimulationResult {
  sourceHtml: string;
  originalPreviewHtml: string;
  /** Compatibility alias for callers created before originalPreviewHtml was named explicitly. */
  originalHtml: string;
  clientLightHtml: string;
  clientDarkHtml: string;
  diagnostics: Diagnostic[];
  stats: {
    strippedElements: number;
    strippedAttributes: number;
    strippedDeclarations: number;
    transformedColors: number;
    preservedDarkColors: number;
    gradients: number;
    remoteImages: number;
    unresolvedCss: number;
    securityRemovedElements: number;
    securityRemovedAttributes: number;
    securityRemovedDeclarations: number;
  };
  ruleApplications: RuleApplication[];
  compatibility: {
    profileId: string;
    catalogCommit: string;
    target: ClientAdapter["compatibility"]["target"];
  };
  profile: {
    id: string;
    label: string;
    status: ProfileStatus;
  };
  client: {
    id: string;
    label: string;
    platform: string;
    target: ClientAdapter["compatibility"]["target"];
  };
}

const SECURITY_REMOVED_ELEMENTS = [
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "base",
  "video",
  "audio",
];

const COLOR_NAMES: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  navy: "#000080",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  purple: "#800080",
  fuchsia: "#ff00ff",
  lime: "#00ff00",
  olive: "#808000",
  yellow: "#ffff00",
  teal: "#008080",
  aqua: "#00ffff",
  orange: "#ffa500",
};

interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

type MutableStats = SimulationResult["stats"] & { ruleCounts?: Record<string, number> };

type ColorRole = "surface" | "text" | "border";

function clamp(value: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

function hslToRgb(h: number, s: number, l: number, a = 1): RGB {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let tuple = [0, 0, 0];
  if (h < 60) tuple = [c, x, 0];
  else if (h < 120) tuple = [x, c, 0];
  else if (h < 180) tuple = [0, c, x];
  else if (h < 240) tuple = [0, x, c];
  else if (h < 300) tuple = [x, 0, c];
  else tuple = [c, 0, x];
  return {
    r: Math.round((tuple[0] + m) * 255),
    g: Math.round((tuple[1] + m) * 255),
    b: Math.round((tuple[2] + m) * 255),
    a,
  };
}

function parseColor(value: string): RGB | null {
  const input = value.trim().toLowerCase();
  const named = COLOR_NAMES[input];
  if (named) return parseColor(named);
  if (input === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = input.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((char) => char + char).join("") : hex;
    if (expanded.length === 6 || expanded.length === 8) {
      return {
        r: Number.parseInt(expanded.slice(0, 2), 16),
        g: Number.parseInt(expanded.slice(2, 4), 16),
        b: Number.parseInt(expanded.slice(4, 6), 16),
        a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      };
    }
  }
  const rgb = input.match(/^rgba?\((.+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      const channel = (part: string) => part.endsWith("%") ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part);
      return {
        r: clamp(channel(parts[0])),
        g: clamp(channel(parts[1])),
        b: clamp(channel(parts[2])),
        a: parts[3] === undefined ? 1 : clamp(Number.parseFloat(parts[3]), 0, 1),
      };
    }
  }
  const hsl = input.match(/^hsla?\((.+)\)$/i);
  if (hsl) {
    const parts = hsl[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      return hslToRgb(
        Number.parseFloat(parts[0]),
        Number.parseFloat(parts[1]),
        Number.parseFloat(parts[2]),
        parts[3] === undefined ? 1 : clamp(Number.parseFloat(parts[3]), 0, 1),
      );
    }
  }
  return null;
}

function linearChannel(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(color: RGB) {
  return 0.2126 * linearChannel(color.r) + 0.7152 * linearChannel(color.g) + 0.0722 * linearChannel(color.b);
}

function mix(color: RGB, target: RGB, amount: number): RGB {
  return {
    r: Math.round(color.r + (target.r - color.r) * amount),
    g: Math.round(color.g + (target.g - color.g) * amount),
    b: Math.round(color.b + (target.b - color.b) * amount),
    a: color.a,
  };
}

function rgbToHsl(color: RGB) {
  const red = color.r / 255;
  const green = color.g / 255;
  const blue = color.b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = max === red ? (green - blue) / delta + (green < blue ? 6 : 0)
    : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  hue *= 60;
  return { h: hue, s: saturation, l: lightness };
}

function baselineInvert(color: RGB, surfaceContext?: "dark" | "light") {
  const value = rgbToHsl(color);
  if (surfaceContext === "dark") {
    const inverse = 1 - value.l;
    return hslToRgb(value.h, value.s * 75, (0.08 + 0.15 * inverse + 0.22 * inverse ** 2) * 100, color.a);
  }
  if (surfaceContext === "light") {
    return hslToRgb(value.h, value.s * 60, (0.58 + 0.37 * (1 - value.l)) * 100, color.a);
  }
  return hslToRgb(value.h, value.s * 70, (0.13 + 0.87 * (1 - value.l)) * 100, color.a);
}

function anchorTransform(color: RGB, anchors: ColorAnchor[], surfaceContext?: "dark" | "light") {
  const parsed = anchors.map((anchor) => ({ source: parseColor(anchor.source)!, target: parseColor(anchor.target)! }));
  const exact = parsed.find((anchor) => ["r", "g", "b"].every((channel) => Math.abs(anchor.source[channel as "r" | "g" | "b"] - color[channel as "r" | "g" | "b"]) <= 2));
  if (exact) return { ...exact.target, a: color.a };
  const baseline = baselineInvert(color, surfaceContext);
  const nearest = parsed
    .map((anchor) => ({
      ...anchor,
      distance: Math.sqrt((anchor.source.r - color.r) ** 2 + (anchor.source.g - color.g) ** 2 + (anchor.source.b - color.b) ** 2),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, Math.min(4, parsed.length));
  const result = { ...baseline };
  for (const channel of ["r", "g", "b"] as const) {
    const baselineWeight = 1 / ((surfaceContext ? 6 : 96) ** 2);
    let total = baseline[channel] * baselineWeight;
    let weights = baselineWeight;
    for (const anchor of nearest) {
      const weight = 1 / Math.max(4, anchor.distance ** 2);
      total += anchor.target[channel] * weight;
      weights += weight;
    }
    result[channel] = Math.round(clamp(total / weights));
  }
  result.a = color.a;
  return result;
}

function formatColor(color: RGB) {
  if (color.a < 0.999) {
    return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${Number(color.a.toFixed(3))})`;
  }
  return `#${[color.r, color.g, color.b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function transformColor(
  color: RGB,
  role: ColorRole,
  stats: MutableStats,
  contextText?: RGB,
  profile: ColorTransformProfile = getClientAdapter(DEFAULT_CLIENT_ID).profile,
) {
  if (color.a === 0) return color;
  const surfaceContext = role === "surface" && contextText ? (luminance(contextText) < 0.5 ? "dark" : "light") : undefined;
  const anchorKey = surfaceContext === "dark" ? "surfaceWithDarkText" : surfaceContext === "light" ? "surfaceWithLightText" : role;
  const anchors = profile.calibration?.method === "anchor-residual-v1" ? profile.calibration.anchors?.[anchorKey] : undefined;
  if (anchors?.length) return anchorTransform(color, anchors, surfaceContext);
  const lightness = luminance(color);
  if (role === "surface") {
    if (lightness <= profile.surface.preserveBelowLuminance) {
      stats.preservedDarkColors += 1;
      return color;
    }
    const amount = lightness > profile.surface.lightThreshold ? profile.surface.lightMix : profile.surface.midMix;
    return mix(color, parseColor(profile.surface.target)!, amount);
  }
  if (role === "text") {
    if (lightness >= profile.text.preserveAboveLuminance) {
      stats.preservedDarkColors += 1;
      return color;
    }
    return mix(color, parseColor(profile.text.target)!, lightness < profile.text.darkThreshold ? profile.text.darkMix : profile.text.midMix);
  }
  if (lightness <= profile.border.darkThreshold) return mix(color, parseColor(profile.border.darkTarget)!, profile.border.darkMix);
  return mix(
    color,
    parseColor(profile.border.lightTarget)!,
    lightness > profile.border.lightThreshold ? profile.border.lightMix : profile.border.midMix,
  );
}

const COLOR_TOKEN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:black|white|red|green|blue|navy|gray|grey|silver|maroon|purple|fuchsia|lime|olive|yellow|teal|aqua|orange|transparent)\b/gi;

function transformColorTokens(
  value: string,
  role: ColorRole,
  stats: MutableStats,
  contextText?: RGB,
  profile: ColorTransformProfile = getClientAdapter(DEFAULT_CLIENT_ID).profile,
) {
  return value.replace(COLOR_TOKEN, (token) => {
    const parsed = parseColor(token);
    if (!parsed || parsed.a === 0) return token;
    const transformed = transformColor(parsed, role, stats, contextText, profile);
    const result = formatColor(transformed);
    if (result.toLowerCase() !== token.toLowerCase()) stats.transformedColors += 1;
    return result;
  });
}

function recordRule(stats: MutableStats, rule: EffectiveRule | undefined, count = 1) {
  if (!rule) return;
  stats.ruleCounts ??= {};
  stats.ruleCounts[rule.id] = (stats.ruleCounts[rule.id] ?? 0) + count;
}

function matchingRule(adapter: ClientAdapter, predicate: (rule: EffectiveRule) => boolean) {
  return adapter.compatibility.rules.find(predicate);
}

function valueFunctions(value: string) {
  const functions: string[] = [];
  valueParser(value).walk((node) => {
    if (node.type === "function") functions.push(node.value.toLowerCase());
  });
  return functions;
}

function valueUrlSchemes(value: string) {
  const schemes: string[] = [];
  valueParser(value).walk((node) => {
    if (node.type !== "function" || node.value.toLowerCase() !== "url") return;
    const raw = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, "$2");
    const scheme = raw.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
    if (scheme) schemes.push(scheme);
  });
  return schemes;
}

function declarationRule(property: string, value: string, adapter: ClientAdapter) {
  const functions = valueFunctions(value);
  const schemes = valueUrlSchemes(value);
  return matchingRule(adapter, (rule) => {
    if (rule.action !== "drop-declaration") return false;
    if (rule.matcher?.property && property === rule.matcher.property) return true;
    if (rule.matcher?.propertyPrefix && property.startsWith(rule.matcher.propertyPrefix)) return true;
    if (rule.matcher?.function && functions.includes(rule.matcher.function)) return true;
    return Boolean(rule.matcher?.urlScheme && schemes.includes(rule.matcher.urlScheme));
  });
}

function processDeclarationContainer(container: postcss.Container, stats: MutableStats, dark: boolean, adapter: ClientAdapter) {
  const contextText = container.nodes?.flatMap((node) => {
    if (node.type !== "decl" || node.prop.toLowerCase() !== "color") return [];
    const token = node.value.match(COLOR_TOKEN)?.[0];
    const parsed = token ? parseColor(token) : null;
    return parsed ? [parsed] : [];
  })[0];
  const allowedProperties = new Set(adapter.compatibility.allowedCssProperties);

  container.each((node) => {
    if (node.type !== "decl") return;
    const property = node.prop.trim().toLowerCase();
    if (valueUrlSchemes(node.value).some((scheme) => ["javascript", "vbscript", "file"].includes(scheme))) {
      stats.securityRemovedDeclarations += 1;
      node.remove();
      return;
    }
    const rule = declarationRule(property, node.value, adapter);
    if (rule) {
      stats.strippedDeclarations += 1;
      recordRule(stats, rule);
      node.remove();
      return;
    }
    if (!allowedProperties.has(property)) {
      stats.strippedDeclarations += 1;
      node.remove();
      return;
    }
    const preservedRule = matchingRule(adapter, (candidate) => {
      if (candidate.action !== "preserve") return false;
      if (candidate.matcher?.property === property) return true;
      if (candidate.matcher?.function && valueFunctions(node.value).includes(candidate.matcher.function)) return true;
      if (candidate.matcher?.keyword && node.value.toLowerCase().includes(candidate.matcher.keyword)) return true;
      return Boolean(candidate.matcher?.declarationImportant && node.important);
    });
    recordRule(stats, preservedRule);
    if (!dark) return;

    const transformedBefore = stats.transformedColors;
    if (property === "color") node.value = transformColorTokens(node.value, "text", stats, undefined, adapter.profile);
    else if (property.includes("border") || property === "outline") node.value = transformColorTokens(node.value, "border", stats, undefined, adapter.profile);
    else if (["background", "background-color", "background-image", "box-shadow", "fill", "stroke"].includes(property)) {
      if (adapter.preserveGradients && valueFunctions(node.value).some((name) => name.endsWith("gradient"))) {
        stats.gradients += 1;
        recordRule(stats, matchingRule(adapter, (candidate) => candidate.matcher?.functionSuffix === "gradient"));
      } else {
        node.value = transformColorTokens(node.value, "surface", stats, contextText, adapter.profile);
      }
    }
    if (stats.transformedColors > transformedBefore) {
      recordRule(stats, matchingRule(adapter, (candidate) => candidate.domain === "color" && candidate.action === "transform-color"), stats.transformedColors - transformedBefore);
    }
  });
}

function processDeclarations(block: string, stats: MutableStats, dark: boolean, adapter: ClientAdapter = getClientAdapter(DEFAULT_CLIENT_ID)) {
  try {
    const root = postcss.parse(`a{${block}}`);
    const rule = root.first;
    if (!rule || rule.type !== "rule") return block;
    processDeclarationContainer(rule, stats, dark, adapter);
    return (rule.nodes ?? []).map((node) => node.toString()).join(";");
  } catch {
    stats.unresolvedCss += 1;
    return block;
  }
}

const ALLOWED_PSEUDOS = new Set([":first-child", ":last-child", ":hover", ":active", ":visited", ":link"]);

function selectorSupported(selector: string, stats?: MutableStats, adapter: ClientAdapter = getClientAdapter(DEFAULT_CLIENT_ID)) {
  try {
    let supported = true;
    let unsupportedAttribute = false;
    const attributeRule = matchingRule(adapter, (rule) => rule.domain === "css-selector" && Boolean(rule.matcher?.allowedAttribute));
    selectorParser((root) => {
      root.walkAttributes((attribute) => {
        if (attribute.attribute !== attributeRule?.matcher?.allowedAttribute || attribute.operator !== attributeRule.matcher.allowedOperator) {
          supported = false;
          unsupportedAttribute = true;
        }
      });
      root.walkPseudos((pseudo) => {
        if (!ALLOWED_PSEUDOS.has(pseudo.value.toLowerCase())) supported = false;
      });
    }).processSync(selector);
    if (unsupportedAttribute && stats) recordRule(stats, attributeRule);
    return supported;
  } catch {
    if (stats) stats.unresolvedCss += 1;
    return false;
  }
}

function mediaRuleSupported(parameters: string, stats: MutableStats, adapter: ClientAdapter) {
  const measuredDrop = matchingRule(adapter, (rule) => rule.domain === "css-at-rule" && Boolean(rule.matcher?.mediaFeature) && parameters.toLowerCase().includes(rule.matcher!.mediaFeature!));
  if (measuredDrop) {
    recordRule(stats, measuredDrop);
    return false;
  }
  if (!/^(?:screen|all)(?:\s+and\s+|$)/i.test(parameters.trim())) return false;
  const features = [...parameters.matchAll(/\(\s*([a-z-]+)/gi)].map((match) => match[1].toLowerCase());
  return features.every((feature) => feature === "min-width" || feature === "max-width");
}

function processStyleSheet(css: string, stats: MutableStats, dark: boolean, adapter: ClientAdapter = getClientAdapter(DEFAULT_CLIENT_ID)): string {
  try {
    const root = postcss.parse(css);
    root.walkAtRules((atRule) => {
      if (atRule.name.toLowerCase() === "media" && mediaRuleSupported(atRule.params, stats, adapter)) return;
      stats.strippedDeclarations += atRule.nodes?.length || 1;
      atRule.remove();
    });
    root.walkRules((rule) => {
      if (!selectorSupported(rule.selector, stats, adapter)) {
        stats.strippedDeclarations += rule.nodes?.length || 1;
        rule.remove();
        return;
      }
      processDeclarationContainer(rule, stats, dark, adapter);
    });
    return root.toString();
  } catch {
    stats.unresolvedCss += 1;
    return css;
  }
}

function safeUrl(value: string) {
  return !/^\s*(?:javascript|vbscript|file):/i.test(value);
}

function injectDocumentGuards(document: Document, loadRemoteImages: boolean, darkCanvas: boolean) {
  const head = document.head || document.documentElement.insertBefore(document.createElement("head"), document.body);
  const csp = document.createElement("meta");
  csp.setAttribute("http-equiv", "Content-Security-Policy");
  csp.setAttribute(
    "content",
    `default-src 'none'; style-src 'unsafe-inline'; img-src ${loadRemoteImages ? "https: http: " : ""}data:; font-src https: data:;`,
  );
  head.prepend(csp);
  const viewport = document.createElement("meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  head.prepend(viewport);
  const base = document.createElement("style");
  base.textContent = `html{margin:0;padding:0;min-height:100%;background:${darkCanvas ? "#121418" : "#ffffff"}}body{margin:0;padding:0;min-height:100%}img{max-width:100%;height:auto}`;
  head.append(base);
}

function serializeDocument(document: Document) {
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

function processDocument(input: string, options: SimulationOptions, stats: MutableStats, adapter: ClientAdapter | null, dark: boolean) {
  const parser = new DOMParser();
  const document = parser.parseFromString(input, "text/html");
  if (!document.body) document.documentElement.append(document.createElement("body"));

  for (const selector of SECURITY_REMOVED_ELEMENTS) {
    const nodes = [...document.querySelectorAll(selector)];
    stats.securityRemovedElements += nodes.length;
    nodes.forEach((node) => node.remove());
  }

  for (const element of [...document.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || (["href", "src", "background", "action"].includes(name) && !safeUrl(attribute.value))) {
        element.removeAttribute(attribute.name);
        stats.securityRemovedAttributes += 1;
      }
    }
    const image = element instanceof HTMLImageElement ? element : null;
    if (image && /^https?:/i.test(image.src)) {
      stats.remoteImages += 1;
      if (!options.loadRemoteImages) {
        image.dataset.blockedSrc = image.getAttribute("src") ?? "";
        image.removeAttribute("src");
        image.alt = image.alt ? `${image.alt} · remote image blocked` : "Remote image blocked";
      }
    }
    if (adapter && element.hasAttribute("style")) {
      element.setAttribute("style", processDeclarations(element.getAttribute("style") ?? "", stats, dark, adapter));
    }
    if (adapter && element.hasAttribute("bgcolor")) {
      const value = element.getAttribute("bgcolor") ?? "";
      if (dark) element.setAttribute("bgcolor", transformColorTokens(value, "surface", stats, undefined, adapter.profile));
    }
    if (adapter && element.hasAttribute("color")) {
      const value = element.getAttribute("color") ?? "";
      if (dark) element.setAttribute("color", transformColorTokens(value, "text", stats, undefined, adapter.profile));
    }
  }

  if (adapter) {
    const bodyStyleRule = matchingRule(adapter, (rule) => rule.domain === "html-element" && rule.matcher?.element === "style" && rule.matcher.location === "body");
    for (const style of [...document.body.querySelectorAll("style")]) {
      stats.strippedElements += 1;
      recordRule(stats, bodyStyleRule);
      style.remove();
    }
    for (const style of [...document.querySelectorAll("style")]) {
      style.textContent = processStyleSheet(style.textContent ?? "", stats, dark, adapter);
    }
  }

  injectDocumentGuards(document, options.loadRemoteImages, dark);
  return serializeDocument(document);
}

export function simulateEmail(input: string, options: SimulationOptions): SimulationResult {
  const adapter = getClientAdapter(options.clientId ?? DEFAULT_CLIENT_ID);
  const createStats = (): MutableStats => ({
    strippedElements: 0,
    strippedAttributes: 0,
    strippedDeclarations: 0,
    transformedColors: 0,
    preservedDarkColors: 0,
    gradients: 0,
    remoteImages: 0,
    unresolvedCss: 0,
    securityRemovedElements: 0,
    securityRemovedAttributes: 0,
    securityRemovedDeclarations: 0,
    ruleCounts: {},
  });
  const originalStats = createStats();
  const lightStats = createStats();
  const darkStats = createStats();
  const originalPreviewHtml = processDocument(input, options, originalStats, null, false);
  const clientLightHtml = processDocument(input, options, lightStats, adapter, false);
  const clientDarkHtml = processDocument(input, options, darkStats, adapter, true);
  const stats: MutableStats = {
    strippedElements: lightStats.strippedElements,
    strippedAttributes: lightStats.strippedAttributes,
    strippedDeclarations: lightStats.strippedDeclarations,
    transformedColors: darkStats.transformedColors,
    preservedDarkColors: darkStats.preservedDarkColors,
    gradients: darkStats.gradients,
    remoteImages: Math.max(originalStats.remoteImages, lightStats.remoteImages, darkStats.remoteImages),
    unresolvedCss: Math.max(lightStats.unresolvedCss, darkStats.unresolvedCss),
    securityRemovedElements: originalStats.securityRemovedElements,
    securityRemovedAttributes: originalStats.securityRemovedAttributes,
    securityRemovedDeclarations: Math.max(originalStats.securityRemovedDeclarations, lightStats.securityRemovedDeclarations, darkStats.securityRemovedDeclarations),
  };
  const ruleCounts = new Map<string, number>();
  for (const current of [lightStats, darkStats]) {
    for (const [ruleId, count] of Object.entries(current.ruleCounts ?? {})) {
      ruleCounts.set(ruleId, Math.max(ruleCounts.get(ruleId) ?? 0, count));
    }
  }
  const ruleApplications: RuleApplication[] = adapter.compatibility.rules.flatMap((rule) => {
    const count = ruleCounts.get(rule.id) ?? 0;
    return count ? [{ ruleId: rule.id, featureId: rule.featureId, action: rule.action, count, evidence: rule.evidence, confidence: rule.confidence }] : [];
  });
  const diagnostics: Diagnostic[] = [
    {
      level: "info",
      title: `${adapter.label} compatibility pass`,
      detail: `${stats.strippedDeclarations} unsupported CSS declarations and ${stats.strippedElements} client-incompatible elements were removed.`,
    },
    {
      level: "info",
      title: "Dark-mode color pass",
      detail: `${stats.transformedColors} color tokens transformed; ${stats.preservedDarkColors} already-dark or light-on-dark tokens preserved.`,
    },
  ];
  if (stats.unresolvedCss) diagnostics.push({ level: "warning", title: "Unresolved CSS", detail: `${stats.unresolvedCss} malformed CSS block${stats.unresolvedCss === 1 ? " was" : "s were"} preserved unchanged rather than guessed.`, count: stats.unresolvedCss });
  const securityChanges = stats.securityRemovedElements + stats.securityRemovedAttributes + stats.securityRemovedDeclarations;
  if (securityChanges) diagnostics.push({ level: "info", title: "Preview security envelope", detail: `${securityChanges} unsafe element, attribute, or declaration change${securityChanges === 1 ? "" : "s"} were applied for isolated previewing and are not reported as ${adapter.label} behavior.`, count: securityChanges });
  if (stats.gradients) diagnostics.push({ level: "info", title: "Gradient treatment", detail: `${stats.gradients} gradient declarations were preserved from the source, matching the measured ${adapter.label} ${adapter.platform} holdout.`, count: stats.gradients });
  if (stats.remoteImages) diagnostics.push({ level: "warning", title: "Remote assets", detail: `${stats.remoteImages} remote image reference${stats.remoteImages === 1 ? "" : "s"} may contact third-party servers.`, count: stats.remoteImages });
  diagnostics.push({
    level: "warning",
    title: "Calibration status",
    detail: adapter.profile.status === "validated-draft" || adapter.profile.status === "calibrated"
      ? `This profile passed its paired ${adapter.label} ${adapter.platform} capture and v0.1 holdout gates. Broader client-build coverage remains ongoing.`
      : `This measured draft uses paired ${adapter.label} ${adapter.platform} captures but remains unverified until its holdouts pass.`,
  });

  return {
    sourceHtml: input,
    originalPreviewHtml,
    originalHtml: originalPreviewHtml,
    clientLightHtml,
    clientDarkHtml,
    diagnostics,
    stats,
    ruleApplications,
    compatibility: { profileId: adapter.compatibility.id, catalogCommit: adapter.compatibility.catalog.commit, target: adapter.compatibility.target },
    profile: { id: adapter.profile.id, label: adapter.profile.label, status: adapter.profile.status },
    client: { id: adapter.id, label: adapter.label, platform: adapter.platform, target: adapter.compatibility.target },
  };
}

export const __testing = { parseColor, luminance, transformColorTokens, processDeclarations, processStyleSheet };
