#!/usr/bin/env node

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { DOMParser, HTMLImageElement } from "linkedom";
import puppeteer from "puppeteer-core";
import {
  artifactBasename,
  findChromeExecutable,
  htmlForMode,
  manifestArtifact,
  parsePreviewArgs,
  resolvePreviewClientIds,
  safeStem,
  selectModes,
} from "./email-preview-lib.mjs";
import { loadCatalog } from "./compatibility-catalog-lib.mjs";

globalThis.DOMParser = DOMParser;
globalThis.HTMLImageElement = HTMLImageElement;

const { CLIENTS, DEFAULT_CLIENT_ID } = await import("../app/core/clients/index.ts");
const { simulateEmail } = await import("../app/core/email-simulator.ts");

function usage() {
  const clients = CLIENTS.map(({ id, label, platform }) => `${id} (${label} ${platform})`).join(", ");
  return `Mailshade email preview\n\nUsage:\n  npm run preview -- --input <email.html|-> [options]\n\nOptions:\n  -c, --client <id|all>       Client adapter (default: ${DEFAULT_CLIENT_ID})\n  -m, --mode <mode|all>       original, light, dark, or all (default: dark)\n  -w, --viewport <pixels>     Screenshot width from 200-2000 (default: 390)\n  -o, --output <directory>    Artifact directory (default: outputs/previews/<email>)\n      --block-remote-images   Do not request remote image URLs\n      --chrome <path>         Chrome/Chromium executable override\n  -h, --help                  Show this help\n\nRegistered clients: ${clients}\n`;
}

async function readInput(input) {
  if (input !== "-") return readFile(path.resolve(input), "utf8");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function settlePage(page, loadRemoteImages) {
  await page.evaluate(async (allowRemote) => {
    if (document.fonts?.ready) await document.fonts.ready;
    if (!allowRemote) return;
    const pending = [...document.images].filter((image) => !image.complete);
    await Promise.race([
      Promise.all(pending.map((image) => new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      }))),
      new Promise((resolve) => window.setTimeout(resolve, 10_000)),
    ]);
  }, loadRemoteImages);
}

async function main() {
  let options;
  try {
    options = parsePreviewArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}\n\n${usage()}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(usage());
    return;
  }

  let clientIds;
  try {
    clientIds = resolvePreviewClientIds(options.client ?? DEFAULT_CLIENT_ID, CLIENTS, loadCatalog(path.resolve(import.meta.dirname, "..")).clientPlatforms);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const inputHtml = await readInput(options.input);
  const emailStem = safeStem(options.input);
  const outputDirectory = path.resolve(options.outputDirectory ?? path.join("outputs", "previews", emailStem));
  await mkdir(outputDirectory, { recursive: true });

  const jobs = [];
  for (const clientId of clientIds) {
    const result = simulateEmail(inputHtml, { clientId, loadRemoteImages: options.loadRemoteImages });
    for (const mode of selectModes(options.mode)) {
      const basename = artifactBasename(emailStem, clientId, mode);
      const htmlPath = path.join(outputDirectory, `${basename}.html`);
      const pngPath = path.join(outputDirectory, `${basename}.png`);
      await writeFile(htmlPath, htmlForMode(result, mode), "utf8");
      jobs.push({ clientId, mode, basename, htmlPath, pngPath, result });
    }
  }

  const executablePath = await findChromeExecutable(options.chromeExecutable);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--disable-background-networking", "--disable-component-update", "--no-first-run"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: options.viewport, height: 1, deviceScaleFactor: 1 });
    for (const job of jobs) {
      const renderedHtml = await readFile(job.htmlPath, "utf8");
      await page.setContent(renderedHtml, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await settlePage(page, options.loadRemoteImages);
      await page.screenshot({ path: job.pngPath, fullPage: true, captureBeyondViewport: true });
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: options.input === "-" ? "stdin" : path.resolve(options.input),
    viewport: options.viewport,
    loadRemoteImages: options.loadRemoteImages,
    remoteImagePolicy: options.loadRemoteImages ? "load" : "block",
    artifacts: jobs.map((job) => manifestArtifact(job.result, job.mode, job.htmlPath, job.pngPath)),
  };
  const manifestPath = path.join(outputDirectory, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ outputDirectory, manifest: manifestPath, artifacts: manifest.artifacts }, null, 2));
}

main().catch((error) => {
  console.error(`Preview failed: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
