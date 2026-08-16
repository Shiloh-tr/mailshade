import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactBasename,
  chromeCandidates,
  htmlForMode,
  parsePreviewArgs,
  selectModes,
} from "../scripts/email-preview-lib.mjs";

test("parses preview dimensions and loads remote images by default", () => {
  assert.deepEqual(parsePreviewArgs(["--input", "offer.html", "--client", "gmail-ios", "--mode", "light", "--viewport", "430"]), {
    input: "offer.html",
    client: "gmail-ios",
    mode: "light",
    outputDirectory: null,
    viewport: 430,
    loadRemoteImages: true,
    chromeExecutable: null,
    help: false,
  });
});

test("supports stdin, all comparisons, and the remote-image privacy switch", () => {
  const options = parsePreviewArgs(["-i", "-", "-c", "all", "-m", "all", "--block-remote-images"]);
  assert.equal(options.input, "-");
  assert.equal(options.client, "all");
  assert.deepEqual(selectModes(options.mode), ["original", "light", "dark"]);
  assert.equal(options.loadRemoteImages, false);
});

test("rejects invalid modes and unsafe viewport values", () => {
  assert.throws(() => parsePreviewArgs(["-i", "email.html", "-m", "sepia"]), /Unknown mode/);
  assert.throws(() => parsePreviewArgs(["-i", "email.html", "-w", "120"]), /between 200 and 2000/);
});

test("maps simulation results and creates stable artifact names", () => {
  const result = { originalHtml: "original", clientLightHtml: "light", clientDarkHtml: "dark" };
  assert.equal(htmlForMode(result, "original"), "original");
  assert.equal(htmlForMode(result, "light"), "light");
  assert.equal(htmlForMode(result, "dark"), "dark");
  assert.equal(artifactBasename("Summer Offer.html", "gmail-ios", "dark"), "summer-offer--gmail-ios--dark");
});

test("prefers an explicitly configured Chrome path", () => {
  assert.equal(chromeCandidates("linux", { MAILSHADE_CHROME_PATH: "/custom/chrome" })[0], "/custom/chrome");
});
