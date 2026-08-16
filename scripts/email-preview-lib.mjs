import { access } from "node:fs/promises";
import path from "node:path";

export const PREVIEW_MODES = ["original", "light", "dark"];
export const DEFAULT_VIEWPORT = 390;

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

export function parsePreviewArgs(argv) {
  const options = {
    input: null,
    client: null,
    mode: "dark",
    outputDirectory: null,
    viewport: DEFAULT_VIEWPORT,
    loadRemoteImages: true,
    chromeExecutable: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--block-remote-images") options.loadRemoteImages = false;
    else if (argument === "--input" || argument === "-i") options.input = requireValue(argv, index++, argument);
    else if (argument === "--client" || argument === "-c") options.client = requireValue(argv, index++, argument);
    else if (argument === "--mode" || argument === "-m") options.mode = requireValue(argv, index++, argument);
    else if (argument === "--output" || argument === "-o") options.outputDirectory = requireValue(argv, index++, argument);
    else if (argument === "--viewport" || argument === "-w") {
      const value = Number(requireValue(argv, index++, argument));
      if (!Number.isInteger(value) || value < 200 || value > 2_000) {
        throw new Error("--viewport must be an integer between 200 and 2000 pixels.");
      }
      options.viewport = value;
    } else if (argument === "--chrome") options.chromeExecutable = requireValue(argv, index++, argument);
    else throw new Error(`Unknown argument '${argument}'.`);
  }

  if (!options.help && !options.input) throw new Error("--input is required. Use '-' to read HTML from stdin.");
  if (options.mode !== "all" && !PREVIEW_MODES.includes(options.mode)) {
    throw new Error(`Unknown mode '${options.mode}'. Expected original, light, dark, or all.`);
  }
  return options;
}

export function safeStem(input) {
  if (input === "-") return "stdin-email";
  const extension = path.extname(input);
  return path.basename(input, extension).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "email";
}

export function artifactBasename(emailStem, clientId, mode) {
  return `${safeStem(emailStem)}--${clientId}--${mode}`;
}

export function selectModes(mode) {
  return mode === "all" ? PREVIEW_MODES : [mode];
}

export function resolvePreviewClientIds(requested, clients, catalogTargets = []) {
  if (requested === "all") return clients.map(({ id }) => id);
  const clientId = requested ?? clients[0]?.id;
  if (clients.some(({ id }) => id === clientId)) return [clientId];
  const catalogTarget = catalogTargets.find((target) => target === clientId || target.replace("/", "-") === clientId);
  if (catalogTarget) throw new Error(`Catalog-only target '${clientId}' has no executable adapter. Use npm run compatibility:query instead.`);
  throw new Error(`Unknown client '${clientId}'. Registered executable clients: ${clients.map(({ id }) => id).join(", ")}`);
}

export function htmlForMode(result, mode) {
  if (mode === "original") return result.originalPreviewHtml ?? result.originalHtml;
  if (mode === "light") return result.clientLightHtml;
  if (mode === "dark") return result.clientDarkHtml;
  throw new Error(`Unknown mode '${mode}'.`);
}

export function manifestArtifact(result, mode, htmlPath, pngPath) {
  return {
    client: result.client,
    profile: result.profile,
    compatibility: {
      ...result.compatibility,
      appliedMeasuredOverrides: result.modeRuleApplications[mode].filter((application) => application.evidence === "measured"),
      unresolvedRules: result.modeStats[mode].unresolvedCss,
    },
    mode,
    html: path.basename(htmlPath),
    png: path.basename(pngPath),
    stats: result.modeStats[mode],
    diagnostics: result.modeDiagnostics[mode],
  };
}

export function chromeCandidates(platform = process.platform, env = process.env) {
  const configured = env.MAILSHADE_CHROME_PATH ? [env.MAILSHADE_CHROME_PATH] : [];
  if (platform === "darwin") {
    return [...configured,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ];
  }
  if (platform === "win32") {
    return [...configured,
      path.join(env.PROGRAMFILES ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
      path.join(env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
      path.join(env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
    ];
  }
  return [...configured, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
}

export async function findChromeExecutable(explicitPath) {
  const candidates = explicitPath ? [explicitPath] : chromeCandidates();
  for (const candidate of candidates.filter(Boolean)) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next conventional installation path.
    }
  }
  throw new Error("Chrome or Chromium was not found. Install Chrome, pass --chrome <path>, or set MAILSHADE_CHROME_PATH.");
}
