import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { auditCompatibility } from "../scripts/audit-compatibility.mjs";
import { validateSkills } from "../scripts/validate-skills.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

test("audits catalog, measured evidence, compiled rules, and portable skills", () => {
  const result = auditCompatibility(repositoryRoot);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.profileIds, ["gmail-ios-compatibility-2026-08-16"]);
});

test("validates both canonical skills and their OpenAI display metadata", () => {
  const result = validateSkills(repositoryRoot);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.skillNames, ["mailshade-compatibility", "mailshade-preview"]);
});
