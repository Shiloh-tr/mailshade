import { readFile } from "node:fs/promises";
import { geometryDelta } from "./visual-validation-lib.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const geometryPath = argument("--geometry");
const threshold = Number(argument("--threshold") ?? 2);
if (!geometryPath || !Number.isFinite(threshold) || threshold < 0) {
  throw new Error("Usage: npm run captures:geometry -- --geometry boxes.json [--threshold 2]");
}

const boxes = JSON.parse(await readFile(geometryPath, "utf8"));
const geometry = boxes.map((box) => ({ id: box.id, ...geometryDelta(box.lightRect, box.darkRect) }));
const maximumDelta = Math.max(0, ...geometry.map((box) => box.max));
const result = { thresholdPixels: threshold, maximumDelta, geometry };
console.log(JSON.stringify(result, null, 2));

if (maximumDelta > threshold) {
  console.error(`Geometry gate failed (maximum paired light/dark delta must be ≤ ${threshold}px).`);
  process.exitCode = 1;
}
