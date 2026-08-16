import assert from "node:assert/strict";
import test from "node:test";
import { geometryDelta, structuralSimilarity, windowedSsim } from "../scripts/visual-validation-lib.mjs";

test("SSIM is one for identical pixels and falls for a visible change", () => {
  const pixels = new Uint8Array(64).fill(80);
  assert.equal(structuralSimilarity(pixels, pixels), 1);
  const changed = new Uint8Array(64).fill(180);
  assert.ok(structuralSimilarity(pixels, changed) < 0.8);
  assert.equal(windowedSsim(pixels, pixels, 8, 8), 1);
});

test("geometry gate reports the largest box deviation", () => {
  assert.deepEqual(
    geometryDelta({ x: 10, y: 20, width: 100, height: 40 }, { x: 12, y: 19, width: 99, height: 43 }),
    { x: 2, y: 1, width: 1, height: 3, max: 3 },
  );
});

test("paired geometry is independent of light/dark color changes", () => {
  assert.deepEqual(
    geometryDelta({ x: 10, y: 191, width: 284, height: 69 }, { x: 10, y: 190, width: 284, height: 70 }),
    { x: 0, y: 1, width: 0, height: 1, max: 1 },
  );
});
