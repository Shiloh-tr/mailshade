import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadCatalog } from "../scripts/compatibility-catalog-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const catalog = loadCatalog(repositoryRoot);

test("pins the complete Can I Email catalog snapshot", () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.source.commit, "1f500feec9df3241bfe679b16101d1ee449e67e9");
  assert.equal(catalog.source.license, "MIT");
  assert.deepEqual(catalog.counts, {
    features: 308,
    clients: 21,
    clientPlatforms: 48,
    observations: 15797,
  });
});

test("preserves raw history and keeps execution state independent", () => {
  const variables = catalog.features.find((feature) => feature.id === "css-variables");
  assert.ok(variables);
  const gmailIos = variables.clients.gmail.ios;
  assert.equal(gmailIos.at(-1).version, "2019-08");
  assert.equal(gmailIos.at(-1).result, "n #1 #2");
  assert.equal(gmailIos.at(-1).status, "unsupported");
  assert.equal(gmailIos.at(-1).executionState, "unimplemented");
  assert.deepEqual(gmailIos.at(-1).noteReferences, ["1", "2"]);
});

test("keeps message-level features queryable but non-rendering", () => {
  const amp = catalog.features.find((feature) => feature.id === "amp");
  assert.equal(amp.category, "others");
  assert.equal(amp.clients.gmail.ios.at(-1).executionState, "not-applicable");
});

test("contains observations for future client adapters", () => {
  const background = catalog.features.find((feature) => feature.id === "css-background-image");
  assert.ok(background.clients["apple-mail"].ios.length > 0);
  assert.ok(background.clients.outlook.windows.length > 0);
  assert.ok(catalog.clientPlatforms.includes("yahoo/ios"));
});

