import assert from "node:assert/strict";
import test from "node:test";
import { gmailIosAdapter } from "../app/core/clients/gmail-ios.ts";
import { __testing } from "../app/core/email-simulator.ts";

const emptyStats = () => ({
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

test("parses common email color formats", () => {
  assert.deepEqual(__testing.parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(__testing.parseColor("rgba(10, 20, 30, .5)"), { r: 10, g: 20, b: 30, a: 0.5 });
  assert.deepEqual(__testing.parseColor("hsl(0 100% 50%)"), { r: 255, g: 0, b: 0, a: 1 });
});

test("matches measured Gmail iOS surface anchors, including dark inversion", () => {
  const stats = emptyStats();
  const light = __testing.transformColorTokens("#ffffff", "surface", stats);
  const dark = __testing.transformColorTokens("#080a0f", "surface", stats);
  assert.equal(light, "#212025");
  assert.equal(dark, "#f8f7fc");
  assert.equal(stats.preservedDarkColors, 0);
});

test("uses foreground polarity when transforming a component surface", () => {
  const stats = emptyStats();
  const css = __testing.processDeclarations("background:#78f0bd;color:#07110d", stats, true);
  const match = css.match(/background:(#[0-9a-f]{6})/i);
  assert.ok(match);
  const surface = __testing.parseColor(match[1])!;
  assert.ok(surface.g > surface.r && surface.g > surface.b, `expected a green surface, received ${match[1]}`);
  assert.ok(__testing.luminance(surface) < 0.15, `expected a dark surface, received ${match[1]}`);
  const textMatch = css.match(/color:(#[0-9a-f]{6})/i);
  assert.ok(textMatch);
  assert.ok(__testing.luminance(__testing.parseColor(textMatch[1])!) > 0.9);
});

test("keeps validation-informed nested light surfaces near the Gmail iOS holdout", () => {
  const cases = [
    { css: "background:#fff4c2;color:#342806", expected: { r: 42, g: 37, b: 7 } },
    { css: "background:#78f0bd;color:#07110d", expected: { r: 11, g: 63, b: 36 } },
  ];

  for (const { css, expected } of cases) {
    const transformed = __testing.processDeclarations(css, emptyStats(), true);
    const match = transformed.match(/background:(#[0-9a-f]{6})/i);
    assert.ok(match);
    const actual = __testing.parseColor(match[1])!;
    assert.ok(Math.abs(actual.r - expected.r) <= 16, `${match[1]} red channel drifted`);
    assert.ok(Math.abs(actual.g - expected.g) <= 16, `${match[1]} green channel drifted`);
    assert.ok(Math.abs(actual.b - expected.b) <= 16, `${match[1]} blue channel drifted`);
  }
});

test("matches measured Gmail iOS text anchors in both directions", () => {
  const stats = emptyStats();
  const darkText = __testing.transformColorTokens("#202124", "text", stats);
  const lightText = __testing.transformColorTokens("#ffffff", "text", stats);
  assert.equal(darkText, "#fcfbff");
  assert.equal(lightText, "#212025");
});

test("matches discovery anchors for saturated purple surfaces and chromatic green text", () => {
  const surface = __testing.processDeclarations("background:#7657d6;color:#ffffff", emptyStats(), true);
  assert.match(surface, /background:#a085f0/i);
  const text = __testing.processDeclarations("color:#0b603b", emptyStats(), true);
  assert.match(text, /color:#6eb48b/i);
});

test("preserves gradient stops while transforming foreground text", () => {
  const stats = emptyStats();
  const css = __testing.processDeclarations(
    "background:linear-gradient(125deg,#5b2cff 0%,#d52aa8 46%,#ff7246 100%);color:#fff",
    stats,
    true,
  );
  assert.match(css, /linear-gradient/);
  assert.match(css, /#5b2cff/i);
  assert.match(css, /#d52aa8/i);
  assert.match(css, /#ff7246/i);
  assert.match(css, /color:#212025/i);
  assert.equal(stats.gradients, 1);
  assert.equal(stats.transformedColors, 1);
});

test("filters unsupported declarations and risky selectors", () => {
  const stats = emptyStats();
  const css = __testing.processStyleSheet(
    ".safe{color:#111;animation:spin 1s}[data-x]{background:#fff}@media screen and (max-width:500px){.safe{padding:10px}}",
    stats,
    false,
  );
  assert.match(css, /\.safe\{color:#111\}/);
  assert.match(css, /@media screen/);
  assert.doesNotMatch(css, /animation|data-x/);
  assert.ok(stats.strippedDeclarations >= 2);
});

test("obeys a client adapter's CSS policy instead of hard-coding Gmail in the core", () => {
  const adapter = {
    ...gmailIosAdapter,
    id: "future-client",
    compatibility: { ...gmailIosAdapter.compatibility, allowedCssProperties: ["color"] },
  };
  const stats = emptyStats();
  const css = __testing.processDeclarations("background:#fff;color:#000", stats, true, adapter);
  assert.equal(css, "color:#ffffff");
  assert.equal(stats.strippedDeclarations, 1);
});
