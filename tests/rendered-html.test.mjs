import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Mailshade application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Mailshade — Email Dark Mode Simulator<\/title>/i);
  assert.match(html, /mailshade/i);
  assert.match(html, /See what inboxes/i);
  assert.match(html, /Email client/i);
  assert.match(html, /Rendered previews/i);
  assert.match(html, /Profile-based[\s\S]*Gmail[\s\S]*on[\s\S]*iOS[\s\S]*approximation, not a claim/i);
  assert.match(html, /DEVICE-VALIDATED DRAFT/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("starter preview assets were removed", async () => {
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
