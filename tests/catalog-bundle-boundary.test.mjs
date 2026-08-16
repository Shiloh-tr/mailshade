import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

test("browser application sources never import the historical catalog snapshot", () => {
  const appDirectory = path.resolve(import.meta.dirname, "../app");
  const source = filesUnder(appDirectory).filter((file) => /\.(?:ts|tsx)$/.test(file)).map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /caniemail-snapshot|data\/compatibility/);
});

