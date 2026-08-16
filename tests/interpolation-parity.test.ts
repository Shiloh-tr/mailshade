import assert from "node:assert/strict";
import test from "node:test";
import profile from "../profiles/gmail-ios/measured-draft-2026-08-16.json" with { type: "json" };
import { __testing } from "../app/core/email-simulator.ts";
import { predictAnchored, rgbToHex } from "../scripts/profile-fit-lib.mjs";

const stats = () => ({
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
});

test("calibration CLI and runtime use identical contextual residual interpolation", () => {
  const cases = [
    { source: "#78f0bd", rgb: [120, 240, 189], context: "#07110d", key: "surfaceWithDarkText", polarity: "dark" },
    { source: "#fff4c2", rgb: [255, 244, 194], context: "#342806", key: "surfaceWithDarkText", polarity: "dark" },
    { source: "#7657d6", rgb: [118, 87, 214], context: "#ffffff", key: "surfaceWithLightText", polarity: "light" },
  ] as const;

  for (const sample of cases) {
    const runtime = __testing.processDeclarations(`background:${sample.source};color:${sample.context}`, stats(), true);
    const runtimeHex = runtime.match(/background:(#[0-9a-f]{6})/i)?.[1];
    const cliHex = rgbToHex(predictAnchored(sample.rgb as unknown as number[], profile.calibration.anchors[sample.key], sample.polarity));
    assert.equal(runtimeHex, cliHex, `${sample.source}/${sample.polarity} diverged`);
  }
});
