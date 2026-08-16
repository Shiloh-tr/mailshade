import assert from "node:assert/strict";
import test from "node:test";
import { __testing } from "../app/core/email-simulator.ts";

const stats = () => ({
  strippedElements: 0,
  strippedAttributes: 0,
  strippedDeclarations: 0,
  transformedColors: 0,
  preservedDarkColors: 0,
  gradients: 0,
  remoteImages: 0,
  unresolvedCss: 0,
  securityRemovedElements: 0,
  securityRemovedAttributes: 0,
  securityRemovedDeclarations: 0,
});

test("preserves alpha while transforming rgba foreground colors", () => {
  const result = __testing.processDeclarations("color:rgba(255,255,255,.42)", stats(), true);
  assert.match(result, /^color:rgba\(33, 32, 37, 0\.42\)$/);
});

test("transforms colors inside border shorthands without changing geometry", () => {
  const result = __testing.processDeclarations("border:3px dashed #5f2eff", stats(), true);
  assert.equal(result, "border:3px dashed #b27ff2");
});

test("preserves gradients but still transforms a separate fallback background color", () => {
  const value = stats();
  const result = __testing.processDeclarations(
    "background-color:#fff;background-image:linear-gradient(90deg,#000,#fff);color:#000",
    value,
    true,
  );
  assert.match(result, /background-color:#212025/);
  assert.match(result, /linear-gradient\(90deg,#000,#fff\)/);
  assert.match(result, /color:#ffffff/);
  assert.equal(value.gradients, 1);
});

test("retains supported nested media rules and transforms their declarations", () => {
  const result = __testing.processStyleSheet(
    "@media screen and (max-width:600px){.card{background:#fff;color:#000;padding:12px}}",
    stats(),
    true,
  );
  assert.match(result, /^@media screen/);
  assert.match(result, /background:#212025/);
  assert.match(result, /color:#ffffff/);
  assert.match(result, /padding:12px/);
});

test("drops unsupported at-rules and attribute selectors", () => {
  const value = stats();
  const result = __testing.processStyleSheet(
    "@supports(display:grid){.x{color:red}}[data-secret]{background:#fff}.safe{color:#000}",
    value,
    true,
  );
  assert.doesNotMatch(result, /@supports|data-secret/);
  assert.match(result, /\.safe\{color:#ffffff\}/);
  assert.ok(value.strippedDeclarations >= 2);
});

test("removes unsafe CSS URL schemes", () => {
  for (const scheme of ["javascript", "vbscript", "file"]) {
    const value = stats();
    const result = __testing.processDeclarations(`background-image:url(${scheme}:payload);color:#000`, value, false);
    assert.equal(result, "color:#000");
    assert.equal(value.strippedDeclarations, 0);
    assert.equal(value.securityRemovedDeclarations, 1);
  }
});

test("keeps https and cid CSS image URLs available to email fixtures", () => {
  for (const url of ["https://example.com/a.png", "cid:hero-image"]) {
    const value = stats();
    const result = __testing.processDeclarations(`background-image:url('${url}')`, value, false);
    assert.match(result, /background-image:url/);
    assert.equal(value.strippedDeclarations, 0);
  }
});

test("preserves malformed declaration blocks instead of guessing", () => {
  const value = stats();
  const input = "broken;color:#000;also-broken;background:#fff";
  const result = __testing.processDeclarations(input, value, true);
  assert.equal(result, input);
  assert.equal(value.unresolvedCss, 1);
});

test("strips custom properties and dependent declarations for Gmail", () => {
  const result = __testing.processDeclarations("--brand:#fff;color:var(--brand);padding:4px", stats(), true);
  assert.equal(result, "padding:4px");
});

test("parses case-insensitive named colors and transparent tokens", () => {
  const value = stats();
  assert.equal(__testing.transformColorTokens("WHITE transparent Navy", "text", value), "#212025 transparent #bfcbdb");
  assert.equal(value.transformedColors, 2);
});

test("produces finite valid colors across a deterministic RGB matrix", () => {
  const value = stats();
  for (let red = 0; red <= 255; red += 51) {
    for (let green = 0; green <= 255; green += 51) {
      for (let blue = 0; blue <= 255; blue += 51) {
        const input = `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
        for (const role of ["surface", "text", "border"] as const) {
          const output = __testing.transformColorTokens(input, role, value);
          assert.match(output, /^#[0-9a-f]{6}$/i);
          assert.doesNotMatch(output, /nan|undefined/i);
        }
      }
    }
  }
});

test("strips CSS data URLs while preserving neighboring declarations", () => {
  const result = __testing.processDeclarations(
    "background-image:url('data:image/svg+xml;utf8,<svg></svg>');color:#000",
    stats(),
    false,
  );
  assert.equal(result, "color:#000");
});
