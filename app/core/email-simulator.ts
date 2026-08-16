import { DEFAULT_CLIENT_ID, getClientAdapter, type ClientAdapter, type ColorAnchor, type ColorTransformProfile, type ProfileStatus } from "./clients/index.ts";

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
  };
}

const FORBIDDEN_ELEMENTS = [
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "form",
  "input",
  "textarea",
  "select",
  "button",
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

type MutableStats = SimulationResult["stats"];

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

function splitDeclarations(block: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (const char of block) {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === ";" && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function processDeclarations(block: string, stats: MutableStats, dark: boolean, adapter: ClientAdapter = getClientAdapter(DEFAULT_CLIENT_ID)) {
  const output: string[] = [];
  const declarations = splitDeclarations(block);
  const contextText = declarations.flatMap((declaration) => {
    const colon = declaration.indexOf(":");
    if (colon < 1 || declaration.slice(0, colon).trim().toLowerCase() !== "color") return [];
    const token = declaration.slice(colon + 1).match(COLOR_TOKEN)?.[0];
    const parsed = token ? parseColor(token) : null;
    return parsed ? [parsed] : [];
  })[0];
  for (const declaration of declarations) {
    const colon = declaration.indexOf(":");
    if (colon < 1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    let value = declaration.slice(colon + 1).trim();
    if (!adapter.supportsCustomProperties && (property.startsWith("--") || /\bvar\s*\(/i.test(value))) {
      stats.strippedDeclarations += 1;
      continue;
    }
    if (!adapter.supportedProperties.has(property) && !property.startsWith("--")) {
      stats.strippedDeclarations += 1;
      continue;
    }
    if (/url\(\s*(['"]?)\s*(?:javascript|vbscript|file):/i.test(value)) {
      stats.strippedDeclarations += 1;
      continue;
    }
    if (!adapter.supportsCssDataUrls && /url\(\s*(['"]?)\s*data:/i.test(value)) {
      stats.strippedDeclarations += 1;
      continue;
    }
    if (dark) {
      if (property === "color") value = transformColorTokens(value, "text", stats, undefined, adapter.profile);
      else if (property.includes("border") || property === "outline") value = transformColorTokens(value, "border", stats, undefined, adapter.profile);
      else if (["background", "background-color", "background-image", "box-shadow", "fill", "stroke"].includes(property)) {
        if (adapter.preserveGradients && /gradient\(/i.test(value)) {
          stats.gradients += 1;
        } else {
          value = transformColorTokens(value, "surface", stats, contextText, adapter.profile);
        }
      }
    }
    output.push(`${property}:${value}`);
  }
  return output.join(";");
}

function selectorSupported(selector: string) {
  return !selector.includes("[") && !selector.includes("]") && !/:(?!first-child|last-child|hover|active|visited|link)/i.test(selector);
}

function processStyleSheet(css: string, stats: MutableStats, dark: boolean, adapter: ClientAdapter = getClientAdapter(DEFAULT_CLIENT_ID)): string {
  let index = 0;
  let output = "";
  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open < 0) break;
    const header = css.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth += 1;
      else if (css[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    const body = css.slice(open + 1, cursor - 1);
    if (/^@media\s+(?:screen|all)/i.test(header)) {
      output += `${header}{${processStyleSheet(body, stats, dark, adapter)}}`;
    } else if (!header.startsWith("@") && selectorSupported(header)) {
      output += `${header}{${processDeclarations(body, stats, dark, adapter)}}`;
    } else {
      stats.strippedDeclarations += splitDeclarations(body).length || 1;
    }
    index = cursor;
  }
  return output;
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

  for (const selector of FORBIDDEN_ELEMENTS) {
    const nodes = [...document.querySelectorAll(selector)];
    stats.strippedElements += nodes.length;
    nodes.forEach((node) => node.remove());
  }

  for (const element of [...document.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || (["href", "src", "background", "action"].includes(name) && !safeUrl(attribute.value))) {
        element.removeAttribute(attribute.name);
        stats.strippedAttributes += 1;
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
  });
  const originalStats = createStats();
  const lightStats = createStats();
  const darkStats = createStats();
  const originalHtml = processDocument(input, options, originalStats, null, false);
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
  };
  const diagnostics: Diagnostic[] = [
    {
      level: "info",
      title: `${adapter.label} compatibility pass`,
      detail: `${stats.strippedDeclarations} unsupported CSS declarations and ${stats.strippedElements} unsafe elements were removed.`,
    },
    {
      level: "info",
      title: "Dark-mode color pass",
      detail: `${stats.transformedColors} color tokens transformed; ${stats.preservedDarkColors} already-dark or light-on-dark tokens preserved.`,
    },
  ];
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
    originalHtml,
    clientLightHtml,
    clientDarkHtml,
    diagnostics,
    stats,
    profile: { id: adapter.profile.id, label: adapter.profile.label, status: adapter.profile.status },
    client: { id: adapter.id, label: adapter.label, platform: adapter.platform },
  };
}

export const __testing = { parseColor, luminance, transformColorTokens, processDeclarations, processStyleSheet };
