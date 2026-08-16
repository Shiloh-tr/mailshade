import { resolve } from "node:path";
import { validateAnchorProfile, validateRoleProfile } from "./profile-fit-lib.mjs";

export function validationScopeFor(analysisPath, sourceAnalyses = [], baseDirectory = process.cwd()) {
  const absoluteAnalysis = resolve(baseDirectory, analysisPath);
  const absoluteSources = sourceAnalyses.map((path) => resolve(baseDirectory, path));
  return absoluteSources.includes(absoluteAnalysis) ? "in-sample" : "holdout";
}

export function validateProfileGroup(profile, role, observations, anchorKey, surfaceContext) {
  const anchors = profile.calibration?.anchors?.[anchorKey] ?? [];
  const validation = anchors.length
    ? validateAnchorProfile(observations, anchors, surfaceContext)
    : validateRoleProfile(observations, role, profile[role]);
  return {
    role,
    model: anchors.length ? "anchor-residual" : "fitted-role",
    ...(anchors.length ? { anchorKey } : {}),
    ...validation,
  };
}
