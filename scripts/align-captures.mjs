import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const configPath = argument("--config");
if (!configPath) throw new Error("Usage: npm run captures:align -- --config captures/<run>/alignment.json");
const config = JSON.parse(await readFile(configPath, "utf8"));

function validateRect(rect, label) {
  for (const key of ["left", "top", "width", "height"]) {
    if (!Number.isInteger(rect?.[key]) || rect[key] < (key === "width" || key === "height" ? 1 : 0)) {
      throw new Error(`${label}.${key} must be a valid integer crop value.`);
    }
  }
}

if (!Number.isInteger(config.width) || !Number.isInteger(config.height) || config.width < 1 || config.height < 1) {
  throw new Error("Alignment width and height must be positive integers.");
}

for (const label of ["expected", "actual"]) {
  const entry = config[label];
  if (!entry?.path || !entry?.output) throw new Error(`${label} path and output are required.`);
  validateRect(entry.rect, label);
  await mkdir(dirname(entry.output), { recursive: true });
  await sharp(entry.path)
    .extract(entry.rect)
    .resize(config.width, config.height, { fit: "fill" })
    .png()
    .toFile(entry.output);
}

console.log(`Aligned expected and actual crops to ${config.width}x${config.height}.`);
