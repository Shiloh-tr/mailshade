import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { anchorsFromObservations, fitBorderProfile, fitSurfaceProfile, fitTextProfile, validateAnchorProfile } from "./profile-fit-lib.mjs";

function argumentsFor(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

const inputs = argumentsFor("--analysis");
const basePath = argumentsFor("--base")[0] ?? "profiles/gmail-ios/heuristic-v0.json";
const outputPath = argumentsFor("--output")[0] ?? "captures/gmail-ios-measured-draft.json";

if (!inputs.length) {
  throw new Error("Usage: npm run captures:fit -- --analysis captures/result.json [--analysis ...] [--base profile.json] [--output candidate.json]");
}

const base = JSON.parse(await readFile(basePath, "utf8"));
const analyses = await Promise.all(inputs.map(async (path) => ({ path, value: JSON.parse(await readFile(path, "utf8")) })));
const allObservations = analyses.flatMap(({ value }) => value.regions
  .map((region) => ({ ...region, role: region.role ?? "surface", id: `${value.fixture}/${region.id}` })));
const observationsFor = (role) => allObservations.filter((region) => region.role === role);
const fitted = fitSurfaceProfile(observationsFor("surface"));
const surface = {
  preserveBelowLuminance: fitted.preserveBelowLuminance,
  target: fitted.target,
  lightMix: fitted.lightMix,
  midMix: fitted.midMix,
  lightThreshold: fitted.lightThreshold,
};
const textFit = observationsFor("text").length >= 5 ? fitTextProfile(observationsFor("text")) : null;
const borderFit = observationsFor("border").length >= 6 ? fitBorderProfile(observationsFor("border")) : null;
const text = textFit ? {
  preserveAboveLuminance: textFit.preserveAboveLuminance,
  target: textFit.target,
  darkMix: textFit.darkMix,
  midMix: textFit.midMix,
  darkThreshold: textFit.darkThreshold,
} : base.text;
const border = borderFit ? {
  darkThreshold: borderFit.darkThreshold,
  darkTarget: borderFit.darkTarget,
  darkMix: borderFit.darkMix,
  lightTarget: borderFit.lightTarget,
  lightMix: borderFit.lightMix,
  midMix: borderFit.midMix,
  lightThreshold: borderFit.lightThreshold,
} : base.border;
const anchors = {
  surface: anchorsFromObservations(observationsFor("surface")),
  surfaceWithDarkText: anchorsFromObservations(observationsFor("surface").filter((observation) => observation.contextText === "dark")),
  surfaceWithLightText: anchorsFromObservations(observationsFor("surface").filter((observation) => observation.contextText === "light")),
  text: anchorsFromObservations(observationsFor("text")),
  border: anchorsFromObservations(observationsFor("border")),
};
const validations = {
  surface: validateAnchorProfile(observationsFor("surface"), anchors.surface),
  text: validateAnchorProfile(observationsFor("text"), anchors.text),
  border: validateAnchorProfile(observationsFor("border"), anchors.border),
};
const candidate = {
  ...base,
  id: `gmail-ios-measured-draft-${new Date().toISOString().slice(0, 10)}`,
  label: "Gmail iOS · measured draft",
  status: "measured-draft",
  surface,
  text,
  border,
  calibration: {
    generatedAt: new Date().toISOString(),
    method: "anchor-residual-v1",
    anchors,
    sourceAnalyses: analyses.map(({ path }) => path),
    fits: {
      surface: { rmseRgb: fitted.rmseRgb, observationCount: fitted.observationCount },
      ...(textFit ? { text: { rmseRgb: textFit.rmseRgb, observationCount: textFit.observationCount } } : { text: { inherited: true } }),
      ...(borderFit ? { border: { rmseRgb: borderFit.rmseRgb, observationCount: borderFit.observationCount } } : { border: { inherited: true } }),
    },
    inSampleValidation: Object.fromEntries(Object.entries(validations).map(([role, value]) => [role, {
      metric: "CIE76", median: value.medianDeltaE76, p95: value.p95DeltaE76,
    }])),
    note: "Anchors reproduce measured regions; residual interpolation handles unseen colors. Validate every role against gradients and naturally dark holdouts before activation.",
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`);
console.log(`Fitted ${allObservations.length} observations → ${outputPath}`);
for (const [role, value] of Object.entries(validations)) {
  console.log(`${role}: median ΔE76 ${value.medianDeltaE76}; p95 ΔE76 ${value.p95DeltaE76}`);
}
