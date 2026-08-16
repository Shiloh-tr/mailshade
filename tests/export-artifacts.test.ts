import assert from "node:assert/strict";
import test from "node:test";
import { createDiagnosticsArtifact, createTextArtifact } from "../app/core/export-artifacts.ts";

test("builds the downloadable simulated HTML artifact without changing its contents", () => {
  const html = "<!doctype html><p>AUDIT_MARKER</p>";
  assert.deepEqual(createTextArtifact("gmail-ios-simulated.html", html, "text/html"), {
    filename: "gmail-ios-simulated.html",
    text: html,
    mimeType: "text/html",
  });
});

test("builds parseable diagnostics containing client, profile, stats, and explanations", () => {
  const payload = {
    client: { id: "gmail-ios" },
    profile: { status: "validated-draft" },
    stats: { transformedColors: 4 },
    diagnostics: [{ title: "Gradient treatment" }],
  };
  const artifact = createDiagnosticsArtifact(payload);
  assert.equal(artifact.filename, "mailshade-diagnostics.json");
  assert.equal(artifact.mimeType, "application/json");
  assert.deepEqual(JSON.parse(artifact.text), payload);
});
