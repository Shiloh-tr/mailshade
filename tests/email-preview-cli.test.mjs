import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactBasename,
  chromeCandidates,
  htmlForMode,
  manifestArtifact,
  parsePreviewArgs,
  resolvePreviewClientIds,
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

test("defines all as executable adapters and rejects catalog-only rendering", () => {
  const clients = [{ id: "gmail-ios" }];
  assert.deepEqual(resolvePreviewClientIds("all", clients, ["gmail/ios", "outlook/ios", "outlook/windows"]), ["gmail-ios"]);
  assert.throws(() => resolvePreviewClientIds("outlook-ios", clients, ["gmail/ios", "outlook/ios", "outlook/windows"]), /Catalog-only target/);
  assert.throws(() => resolvePreviewClientIds("outlook/windows", clients, ["gmail/ios", "outlook/windows"]), /Catalog-only target/);
  assert.throws(() => resolvePreviewClientIds("imaginary", clients, []), /Unknown client/);
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
  const result = { originalPreviewHtml: "original", clientLightHtml: "light", clientDarkHtml: "dark" };
  assert.equal(htmlForMode(result, "original"), "original");
  assert.equal(htmlForMode(result, "light"), "light");
  assert.equal(htmlForMode(result, "dark"), "dark");
  assert.equal(artifactBasename("Summer Offer.html", "gmail-ios", "dark"), "summer-offer--gmail-ios--dark");
});

test("prefers an explicitly configured Chrome path", () => {
  assert.equal(chromeCandidates("linux", { MAILSHADE_CHROME_PATH: "/custom/chrome" })[0], "/custom/chrome");
});

test("builds mode-specific manifests with exact compatibility evidence", () => {
  const zero = { strippedElements: 0, strippedAttributes: 0, strippedDeclarations: 0, transformedColors: 0, preservedDarkColors: 0, gradients: 0, remoteImages: 0, unresolvedCss: 0, securityRemovedElements: 0, securityRemovedAttributes: 0, securityRemovedDeclarations: 0 };
  const result = {
    client: { id: "gmail-ios", target: { appVersion: "6.0.260803" } },
    profile: { id: "profile", status: "validated-draft" },
    compatibility: { profileId: "compat", catalogCommit: "abc", target: { appVersion: "6.0.260803" } },
    ruleApplications: [{ ruleId: "measured", evidence: "measured" }, { ruleId: "catalog", evidence: "catalog" }],
    modeRuleApplications: { original: [], light: [], dark: [{ ruleId: "measured", evidence: "measured" }, { ruleId: "catalog", evidence: "catalog" }] },
    modeStats: { original: zero, light: { ...zero, strippedDeclarations: 2 }, dark: { ...zero, transformedColors: 3 } },
    diagnostics: [],
    modeDiagnostics: { original: [], light: [], dark: [{ title: "dark" }] },
  };
  const artifact = manifestArtifact(result, "dark", "/tmp/mail.html", "/tmp/mail.png");
  assert.equal(artifact.stats.transformedColors, 3);
  assert.deepEqual(artifact.compatibility.appliedMeasuredOverrides.map((rule) => rule.ruleId), ["measured"]);
  assert.equal(artifact.compatibility.catalogCommit, "abc");
  assert.equal(artifact.diagnostics[0].title, "dark");
});
