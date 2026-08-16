import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { __testing } from "../app/core/email-simulator.ts";

test("every manifest fixture is loadable and contains transformable color probes", async () => {
  const fixtureRoot = new URL("../fixtures/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", fixtureRoot), "utf8"));
  const ids = manifest.fixtures.map((fixture: { id: string }) => fixture.id);
  assert.equal(new Set(ids).size, ids.length, "fixture ids must be unique");
  assert.ok(manifest.fixtures.filter((fixture: { category: string }) => fixture.category === "discovery").length >= 4);

  for (const fixture of manifest.fixtures) {
    const html = await readFile(new URL(fixture.file, fixtureRoot), "utf8");
    assert.match(html, /<!doctype html>/i, `${fixture.id} must be a complete HTML document`);
    assert.match(html, /<html/i, `${fixture.id} document root is missing`);
    const colors = html.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    assert.ok(colors.some((color) => __testing.parseColor(color)), `${fixture.id} should exercise at least one parseable color`);
  }
});

test("the second dark holdout covers ten labeled constructions and four gradient families", async () => {
  const html = await readFile(new URL("../fixtures/dark-gradient-holdout-2.html", import.meta.url), "utf8");
  for (let index = 1; index <= 10; index += 1) assert.match(html, new RegExp(`D${index}\\b`));
  for (const family of ["linear-gradient", "radial-gradient", "repeating-linear-gradient", "rgba("]) {
    assert.ok(html.includes(family), `missing ${family} probe`);
  }
});

test("saturation holdouts cover chromatic, layered-gradient, and legacy behavior", async () => {
  const fixtureRoot = new URL("../fixtures/", import.meta.url);
  const cases = [
    ["chromatic-role-holdout.html", "E", 10],
    ["layered-gradient-holdout.html", "F", 8],
    ["legacy-inheritance-holdout.html", "G", 10],
  ] as const;
  for (const [file, prefix, count] of cases) {
    const html = await readFile(new URL(file, fixtureRoot), "utf8");
    for (let index = 1; index <= count; index += 1) assert.match(html, new RegExp(`${prefix}${index}\\b`));
  }
});
