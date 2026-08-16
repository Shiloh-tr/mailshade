import assert from "node:assert/strict";
import test from "node:test";
import { predictSurface } from "../scripts/profile-fit-lib.mjs";
import { validateProfileGroup, validationScopeFor } from "../scripts/profile-validation-lib.mjs";

test("marks fitting analyses as in-sample even when paths use different relative spellings", () => {
  assert.equal(validationScopeFor("captures/run/a.json", ["./captures/run/a.json"], "/workspace"), "in-sample");
  assert.equal(validationScopeFor("captures/run/holdout.json", ["captures/run/a.json"], "/workspace"), "holdout");
});

test("validates anchor profiles with anchors and fitted candidates with their role model", () => {
  const observation = [{ id: "sample", light: [255, 255, 255], dark: [20, 21, 22] }];
  const anchored = validateProfileGroup({
    calibration: { anchors: { surface: [{ id: "sample", source: "#ffffff", target: "#141516" }] } },
  }, "surface", observation, "surface");
  assert.equal(anchored.model, "anchor-residual");
  assert.equal(anchored.medianDeltaE00, 0);

  const surface = { preserveBelowLuminance: 0, target: "#141516", lightMix: 1, midMix: 1, lightThreshold: 0.5 };
  const fittedObservation = [{ id: "sample", light: [255, 255, 255], dark: predictSurface([255, 255, 255], surface) }];
  const fitted = validateProfileGroup({ surface }, "surface", fittedObservation, "surface");
  assert.equal(fitted.model, "fitted-role");
  assert.equal(fitted.medianDeltaE00, 0);
});
