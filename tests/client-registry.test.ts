import assert from "node:assert/strict";
import test from "node:test";
import { CLIENTS, DEFAULT_CLIENT_ID, getClientAdapter } from "../app/core/clients/index.ts";

test("registers Gmail iOS behind the generic client adapter boundary", () => {
  const adapter = getClientAdapter(DEFAULT_CLIENT_ID);
  assert.equal(adapter.id, "gmail-ios");
  assert.equal(adapter.platform, "iOS");
  assert.equal(adapter.profile.status, "validated-draft");
  assert.ok(adapter.compatibility.allowedCssProperties.includes("background"));
  assert.ok(adapter.compatibility.allowedCssProperties.includes("font-size-adjust"));
  assert.ok(adapter.compatibility.allowedCssProperties.includes("border-bottom-color"));
  assert.ok(adapter.compatibility.allowedCssProperties.includes("writing-mode"));
  assert.equal(adapter.compatibility.allowedCssProperties.includes("-webkit-text-size-adjust"), false);
  assert.equal(adapter.compatibility.catalog.client, "gmail");
  assert.equal(adapter.compatibility.target.accountType, "google");
  assert.ok(adapter.compatibility.rules.some((rule) => rule.id === "gmail-ios-custom-property"));
  assert.ok(adapter.compatibility.rules.some((rule) => rule.id === "gmail-ios-css-data-url"));
  assert.equal(adapter.preserveGradients, true);
  assert.deepEqual(CLIENTS.map(({ id }) => id), ["gmail-ios"]);
});

test("rejects unknown client ids instead of silently using the wrong renderer", () => {
  assert.throws(() => getClientAdapter("unknown-client"), /Unknown email client adapter/);
});
