import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser, HTMLImageElement } from "linkedom";
import { simulateEmail } from "../app/core/email-simulator.ts";

globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
globalThis.HTMLImageElement = HTMLImageElement as unknown as typeof globalThis.HTMLImageElement;

test("keeps exact source separate from a security-wrapped original preview", () => {
  const source = "<html><body><script>alert(1)</script><form><input name='email'></form></body></html>";
  const result = simulateEmail(source, { loadRemoteImages: false });
  assert.equal(result.sourceHtml, source);
  assert.equal(result.originalHtml, result.originalPreviewHtml);
  assert.doesNotMatch(result.originalPreviewHtml, /<script/i);
  assert.match(result.originalPreviewHtml, /<form>/i);
  assert.match(result.clientLightHtml, /<input name="email">/i);
  assert.equal(result.stats.securityRemovedElements, 1);
  assert.equal(result.stats.strippedElements, 0);
});

test("applies deterministic Gmail style, selector, and media rules", () => {
  const source = `<!doctype html><html><head><style>
    [class~=card]{color:#000}
    [data-card]{background:#fff}
    @media screen and (max-width:500px){.card{padding:4px}}
    @media (prefers-color-scheme:dark){.card{color:#fff}}
  </style></head><body><style>.body-only{color:red}</style><div class="card" data-card>Card</div></body></html>`;
  const result = simulateEmail(source, { loadRemoteImages: false });
  assert.match(result.clientLightHtml, /\[class~=card\]/);
  assert.doesNotMatch(result.clientLightHtml, /\[data-card\]/);
  assert.match(result.clientLightHtml, /max-width:500px/);
  assert.doesNotMatch(result.clientLightHtml, /prefers-color-scheme|body-only/);
  assert.ok(result.ruleApplications.some((application) => application.ruleId === "gmail-ios-body-style"));
  assert.ok(result.ruleApplications.some((application) => application.ruleId === "gmail-ios-attribute-selector"));
  assert.ok(result.ruleApplications.some((application) => application.ruleId === "gmail-ios-prefers-color-scheme"));
});

test("reports measured compatibility rules independently from preview security", () => {
  const source = "<div style=\"--brand:#fff;color:var(--brand);background-image:url('data:image/svg+xml;base64,AA==');background:#fff\">Test</div>";
  const result = simulateEmail(source, { loadRemoteImages: false });
  assert.equal(result.compatibility.catalogCommit, "1f500feec9df3241bfe679b16101d1ee449e67e9");
  assert.equal(result.compatibility.target.accountType, "google");
  assert.ok(result.ruleApplications.some((application) => application.ruleId === "gmail-ios-custom-property"));
  assert.ok(result.ruleApplications.some((application) => application.ruleId === "gmail-ios-var-function"));
  assert.ok(result.ruleApplications.some((application) => application.ruleId === "gmail-ios-css-data-url"));
  assert.equal(result.stats.securityRemovedElements, 0);
});

