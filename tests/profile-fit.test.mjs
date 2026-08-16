import assert from "node:assert/strict";
import test from "node:test";
import {
  fitBorderProfile,
  fitSurfaceProfile,
  fitTextProfile,
  anchorsFromObservations,
  baselineInvert,
  deltaE00,
  predictBorder,
  predictSurface,
  predictText,
  validateRoleProfile,
  validateAnchorProfile,
  validateSurfaceProfile,
} from "../scripts/profile-fit-lib.mjs";

test("CIEDE2000 is symmetric and reports zero for identical sRGB colors", () => {
  assert.equal(deltaE00([12, 34, 56], [12, 34, 56]), 0);
  const forward = deltaE00([255, 0, 0], [0, 128, 255]);
  const reverse = deltaE00([0, 128, 255], [255, 0, 0]);
  assert.ok(Math.abs(forward - reverse) < 1e-12);
  assert.ok(forward > 40);
});

test("recovers a predictive surface profile from synthetic paired observations", () => {
  const expected = {
    preserveBelowLuminance: 0.11,
    target: "#121418",
    lightMix: 0.88,
    midMix: 0.64,
    lightThreshold: 0.55,
  };
  const sources = [
    [8, 10, 15], [17, 17, 17], [91, 44, 255], [119, 119, 119],
    [189, 189, 189], [220, 227, 245], [242, 242, 242], [255, 255, 255],
  ];
  const observations = sources.map((light, index) => ({
    id: `sample-${index}`,
    light,
    dark: predictSurface(light, expected),
  }));
  const fitted = fitSurfaceProfile(observations, { mixStep: 0.02 });
  const validation = validateSurfaceProfile(observations, fitted);
  assert.ok(fitted.rmseRgb < 1.5, `unexpected RGB RMSE ${fitted.rmseRgb}`);
  assert.ok(validation.medianDeltaE76 < 0.8, `unexpected median ΔE ${validation.medianDeltaE76}`);
  assert.ok(validation.p95DeltaE76 < 1.8, `unexpected p95 ΔE ${validation.p95DeltaE76}`);
});

test("anchor residual model reproduces measurements and interpolates unseen colors", () => {
  const observations = [
    { id: "black", light: [0, 0, 0], dark: [255, 255, 255] },
    { id: "gray", light: [119, 119, 119], dark: [150, 151, 155] },
    { id: "white", light: [255, 255, 255], dark: [33, 32, 37] },
    { id: "purple", light: [91, 45, 255], dark: [165, 123, 222] },
    { id: "orange", light: [255, 114, 71], dark: [173, 63, 33] },
  ];
  const anchors = anchorsFromObservations(observations);
  const validation = validateAnchorProfile(observations, anchors);
  assert.equal(validation.medianDeltaE76, 0);
  assert.equal(validation.p95DeltaE76, 0);
  const unseen = baselineInvert([220, 220, 220]);
  assert.ok(unseen.every((channel) => channel >= 40 && channel <= 90));
  const nearWhite = validateAnchorProfile(
    [{ id: "near-white", light: [247, 249, 255], dark: [35, 34, 40] }],
    anchors,
  );
  assert.ok(nearWhite.medianDeltaE76 < 5);
});

test("requires enough observations to avoid a misleading fit", () => {
  assert.throws(() => fitSurfaceProfile([{ id: "one", light: [255, 255, 255], dark: [20, 20, 20] }]), /five surface observations/);
});

test("recovers predictive text and border role models", () => {
  const sources = [[0, 0, 0], [32, 33, 36], [85, 85, 85], [119, 119, 119], [91, 44, 255], [189, 189, 189], [220, 227, 245], [255, 255, 255]];
  const expectedText = { preserveAboveLuminance: 0.72, target: "#f1f4f8", darkMix: 0.9, midMix: 0.72, darkThreshold: 0.18 };
  const expectedBorder = { darkThreshold: 0.16, darkTarget: "#696f79", darkMix: 0.52, lightTarget: "#434850", lightMix: 0.76, midMix: 0.44, lightThreshold: 0.55 };
  const textObservations = sources.map((light, index) => ({ id: `text-${index}`, light, dark: predictText(light, expectedText) }));
  const borderObservations = sources.map((light, index) => ({ id: `border-${index}`, light, dark: predictBorder(light, expectedBorder) }));
  const text = fitTextProfile(textObservations);
  const border = fitBorderProfile(borderObservations);
  const textValidation = validateRoleProfile(textObservations, "text", text);
  const borderValidation = validateRoleProfile(borderObservations, "border", border);
  assert.ok(text.rmseRgb < 1.5);
  assert.ok(border.rmseRgb < 1.8);
  assert.ok(textValidation.p95DeltaE76 < 1.8);
  assert.ok(borderValidation.p95DeltaE76 < 2.2);
});
