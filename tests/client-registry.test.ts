import assert from "node:assert/strict";
import test from "node:test";
import { CLIENTS, DEFAULT_CLIENT_ID, getClientAdapter } from "../app/core/clients/index.ts";

test("registers Gmail iOS behind the generic client adapter boundary", () => {
  const adapter = getClientAdapter(DEFAULT_CLIENT_ID);
  assert.equal(adapter.id, "gmail-ios");
  assert.equal(adapter.platform, "iOS");
  assert.equal(adapter.profile.status, "validated-draft");
  assert.ok(adapter.supportedProperties.has("background"));
  assert.ok(adapter.supportedProperties.has("font-size-adjust"));
  assert.ok(adapter.supportedProperties.has("border-bottom-color"));
  assert.ok(adapter.supportedProperties.has("writing-mode"));
  assert.equal(adapter.supportedProperties.has("-webkit-text-size-adjust"), false);
  assert.equal(adapter.preserveGradients, true);
  assert.deepEqual(CLIENTS.map(({ id }) => id), ["gmail-ios"]);
});

test("rejects unknown client ids instead of silently using the wrong renderer", () => {
  assert.throws(() => getClientAdapter("unknown-client"), /Unknown email client adapter/);
});
