import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("verification metadata is structured and cannot hide pending gates in prose", async () => {
  const verification = JSON.parse(await readFile(new URL("../profiles/gmail-ios/verification-2026-08-16.json", import.meta.url), "utf8"));
  const required = ["identity", "anchorRegression", "contextualHoldoutColor", "visualSimilarity", "geometry", "expandedRegressionSuite", "discoverySaturation"];
  assert.deepEqual(Object.keys(verification.gates), required);
  for (const gate of Object.values(verification.gates)) {
    assert.ok(["pass", "fail", "pending"].includes(gate.status));
  }
  assert.equal(verification.gates.contextualHoldoutColor.medianDeltaE00 <= 2, true);
  assert.equal(verification.gates.contextualHoldoutColor.p95DeltaE00 <= 5, true);
});
