import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { deltaE00 } from "./profile-fit-lib.mjs";
import { geometryDelta, windowedSsim } from "./visual-validation-lib.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const expectedPath = argument("--expected");
const actualPath = argument("--actual");
const geometryPath = argument("--geometry");
if (!expectedPath || !actualPath) {
  throw new Error("Usage: npm run captures:visual -- --expected expected.png --actual actual.png [--geometry boxes.json]");
}

async function load(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

const [expected, actual] = await Promise.all([load(expectedPath), load(actualPath)]);
if (expected.width !== actual.width || expected.height !== actual.height) {
  throw new Error(`Aligned image dimensions are required; expected=${expected.width}x${expected.height}, actual=${actual.width}x${actual.height}.`);
}

const expectedLuminance = new Uint8Array(expected.width * expected.height);
const actualLuminance = new Uint8Array(actual.width * actual.height);
const differences = [];
for (let pixel = 0; pixel < expectedLuminance.length; pixel += 1) {
  const offset = pixel * expected.channels;
  const left = [expected.data[offset], expected.data[offset + 1], expected.data[offset + 2]];
  const right = [actual.data[offset], actual.data[offset + 1], actual.data[offset + 2]];
  expectedLuminance[pixel] = Math.round(0.2126 * left[0] + 0.7152 * left[1] + 0.0722 * left[2]);
  actualLuminance[pixel] = Math.round(0.2126 * right[0] + 0.7152 * right[1] + 0.0722 * right[2]);
  differences.push(deltaE00(left, right));
}
differences.sort((left, right) => left - right);
const percentile = (ratio) => differences[Math.min(differences.length - 1, Math.ceil(differences.length * ratio) - 1)] ?? 0;

let geometry = [];
if (geometryPath) {
  const boxes = JSON.parse(await readFile(geometryPath, "utf8"));
  geometry = boxes.map((box) => ({ id: box.id, ...geometryDelta(box.expectedRect, box.actualRect) }));
}

const result = {
  dimensions: { width: expected.width, height: expected.height },
  ssim: Number(windowedSsim(expectedLuminance, actualLuminance, expected.width, expected.height).toFixed(6)),
  medianDeltaE00: Number(percentile(0.5).toFixed(4)),
  p95DeltaE00: Number(percentile(0.95).toFixed(4)),
  geometry,
};
console.log(JSON.stringify(result, null, 2));

if (result.ssim < 0.98 || result.medianDeltaE00 > 2 || result.p95DeltaE00 > 5 || geometry.some((box) => box.max > 2)) {
  console.error("Visual gate failed (SSIM ≥ 0.98, median ΔE00 ≤ 2, p95 ΔE00 ≤ 5, geometry ≤ 2 px required)." );
  process.exitCode = 1;
}
