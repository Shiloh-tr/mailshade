import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const query = (...args) => spawnSync(process.execPath, ["scripts/query-compatibility.mjs", ...args], {
  cwd: repositoryRoot,
  encoding: "utf8",
});

test("queries the latest catalog observation without version inference", () => {
  const result = query("--client", "gmail", "--platform", "ios", "--feature", "css-variables", "--json");
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.matches[0].observationLabel, "latest catalog observation");
  assert.equal(output.matches[0].observation.version, "2019-08");
});

test("queries exact versions for other client families", () => {
  for (const [client, platform, version] of [["apple-mail", "ios", "12.1"], ["outlook", "windows", "2019"]]) {
    const result = query("--client", client, "--platform", platform, "--version", version, "--feature", "css-background-image", "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).matches[0].observation.version, version);
  }
});

test("rejects missing exact versions and unknown targets", () => {
  const missing = query("--client", "gmail", "--platform", "ios", "--version", "imaginary", "--feature", "css-variables");
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /No exact/);
  const unknown = query("--client", "gmail", "--platform", "watchos");
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown platform/);
});

