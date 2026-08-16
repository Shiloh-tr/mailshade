import { readFile } from "node:fs/promises";
import { validateProfileGroup, validationScopeFor } from "./profile-validation-lib.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const analysisPath = argument("--analysis");
const profilePath = argument("--profile");
if (!analysisPath || !profilePath) {
  throw new Error("Usage: npm run captures:validate -- --analysis captures/holdout.json --profile captures/candidate.json");
}

const analysis = JSON.parse(await readFile(analysisPath, "utf8"));
const profile = JSON.parse(await readFile(profilePath, "utf8"));
const validationScope = validationScopeFor(analysisPath, profile.calibration?.sourceAnalyses);
if (validationScope === "in-sample" && !process.argv.includes("--allow-in-sample")) {
  throw new Error("Refusing to report a release gate from fitting data. Use an independent holdout analysis, or pass --allow-in-sample for diagnostics only.");
}
const observations = analysis.regions.map((region) => ({ ...region, role: region.role ?? "surface", id: `${analysis.fixture}/${region.id}` }));
const resultFor = (role, selected, anchorKey, surfaceContext) => {
  if (!selected.length) return [];
  return [validateProfileGroup(profile, role, selected, anchorKey, surfaceContext)];
};
const surfaces = observations.filter((region) => region.role === "surface");
const results = [
  ...resultFor("surface", surfaces.filter((region) => !region.contextText), "surface"),
  ...resultFor("surface", surfaces.filter((region) => region.contextText === "dark"), "surfaceWithDarkText", "dark"),
  ...resultFor("surface", surfaces.filter((region) => region.contextText === "light"), "surfaceWithLightText", "light"),
  ...resultFor("text", observations.filter((region) => region.role === "text"), "text"),
  ...resultFor("border", observations.filter((region) => region.role === "border"), "border"),
];
console.log(JSON.stringify({ validationScope, releaseGateEligible: validationScope === "holdout", results }, null, 2));

if (results.some((result) => result.medianDeltaE00 > 2 || result.p95DeltaE00 > 5)) {
  console.error("Validation gate failed (median ΔE00 ≤ 2 and p95 ΔE00 ≤ 5 required)." );
  process.exitCode = 1;
}
