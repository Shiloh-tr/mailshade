import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const lightPath = argument("--light");
const darkPath = argument("--dark");
const fixtureId = argument("--fixture");
const outputPath = argument("--output") ?? `captures/${fixtureId ?? "capture"}-analysis.json`;
const regionPath = argument("--regions");

if (!lightPath || !darkPath || !fixtureId) {
  throw new Error("Usage: npm run captures:analyze -- --fixture <id> --light <light.png> --dark <dark.png> [--output result.json]");
}

const regionMap = JSON.parse(await readFile(regionPath ?? new URL("../fixtures/capture-regions.json", import.meta.url), "utf8"));
const regions = regionMap[fixtureId];
if (!regions) throw new Error(`No capture regions are defined for fixture '${fixtureId}'.`);

async function loadImage(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function median(values) {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function sample(image, region, variant) {
  const rect = region[`${variant}Rect`] ?? region;
  const absolute = rect.x > 1 || rect.y > 1 || rect.width > 1 || rect.height > 1;
  const x0 = Math.round(absolute ? rect.x : rect.x * image.width);
  const y0 = Math.round(absolute ? rect.y : rect.y * image.height);
  const x1 = Math.min(image.width, Math.round(absolute ? rect.x + rect.width : (rect.x + rect.width) * image.width));
  const y1 = Math.min(image.height, Math.round(absolute ? rect.y + rect.height : (rect.y + rect.height) * image.height));
  if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0 || x1 > image.width || y1 > image.height) {
    throw new Error(`Region '${region.id}' is outside the ${variant} capture bounds.`);
  }
  let pixels = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const offset = (y * image.width + x) * image.channels;
      pixels.push([image.data[offset], image.data[offset + 1], image.data[offset + 2]]);
    }
  }
  if (region.sampleMode === "foreground") {
    const background = [0, 1, 2].map((channel) => median(pixels.map((pixel) => pixel[channel])));
    pixels = pixels
      .map((pixel) => ({ pixel, distance: pixel.reduce((sum, value, channel) => sum + (value - background[channel]) ** 2, 0) }))
      .filter(({ distance }) => distance > 24 ** 2)
      .sort((left, right) => right.distance - left.distance)
      .slice(0, Math.max(1, Math.ceil(pixels.length * 0.35)))
      .map(({ pixel }) => pixel);
    if (pixels.length < 4) throw new Error(`Foreground sampler found too few contrasting pixels in region '${region.id}'. Check the crop and region map.`);
  }
  return [0, 1, 2].map((channel) => median(pixels.map((pixel) => pixel[channel])));
}

const [light, dark] = await Promise.all([loadImage(lightPath), loadImage(darkPath)]);
if (light.width !== dark.width || light.height !== dark.height) {
  throw new Error(`Capture dimensions differ: light=${light.width}x${light.height}, dark=${dark.width}x${dark.height}`);
}

const result = {
  fixture: fixtureId,
  dimensions: { width: light.width, height: light.height },
  generatedAt: new Date().toISOString(),
  regions: regions.map((region) => ({
    id: region.id,
    role: region.role ?? "surface",
    ...(region.contextText ? { contextText: region.contextText } : {}),
    sampleMode: region.sampleMode ?? "median",
    light: sample(light, region, "light"),
    dark: sample(dark, region, "dark"),
  })),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Analyzed ${result.regions.length} regions → ${outputPath}`);
