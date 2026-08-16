import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

test("Outlook verification records failed color gates and blocks executable registration", async () => {
  const verification = JSON.parse(await readFile(new URL("../profiles/outlook-ios/verification-2026-08-17.json", import.meta.url), "utf8"));
  assert.equal(verification.status, "failed");
  assert.equal(verification.activeProfile, null);
  assert.equal(verification.gates.geometry.maximumDeltaPixels <= 2, true);
  assert.equal(verification.gates.chromaticHoldoutColor.medianDeltaE00 > 2, true);
  assert.equal(verification.gates.chromaticHoldoutColor.p95DeltaE00 > 5, true);
  assert.equal(verification.gates.registration.status, "blocked");

  const result = spawnSync(process.execPath, ["scripts/audit-verification.mjs", "--verification", "profiles/outlook-ios/verification-2026-08-17.json"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no active executable profile is registered/);
  assert.match(result.stderr, /Color gate is 'fail'|chromaticHoldoutColor gate is 'fail'/);
});
