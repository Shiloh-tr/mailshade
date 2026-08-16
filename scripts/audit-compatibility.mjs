#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadCatalog } from "./compatibility-catalog-lib.mjs";
import { loadExecutableProfiles } from "./compatibility-query-lib.mjs";
import { validateSkills } from "./validate-skills.mjs";

const ACTIONS = new Set(["preserve", "drop-declaration", "drop-rule", "drop-at-rule", "remove-attribute", "unwrap-element", "remove-element", "block-resource", "disable-behavior", "warn", "transform-color"]);
const RELATIONSHIPS = new Set(["confirm", "extend", "narrow", "replace"]);

export function auditCompatibility(repositoryRoot) {
  const failures = [];
  const catalog = loadCatalog(repositoryRoot);
  if (catalog.schemaVersion !== 1) failures.push(`catalog schema is ${catalog.schemaVersion}, expected 1`);
  for (const [field, expected] of Object.entries({ features: 308, clients: 21, clientPlatforms: 48 })) {
    if (catalog.counts[field] !== expected) failures.push(`catalog ${field} count is ${catalog.counts[field]}, expected ${expected}`);
  }
  if (!/^[0-9a-f]{40}$/.test(catalog.source.commit)) failures.push("catalog source commit is not a full SHA");
  if (catalog.source.license !== "MIT") failures.push("catalog license attribution is missing or unexpected");

  const featureIds = new Set(catalog.features.map((feature) => feature.id));
  const fixtureManifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "fixtures", "manifest.json"), "utf8"));
  const fixtureIds = new Set(fixtureManifest.fixtures.map((fixture) => fixture.id));
  const profileIds = new Set();
  for (const profile of loadExecutableProfiles(repositoryRoot)) {
    if (profileIds.has(profile.id)) failures.push(`duplicate compatibility profile id: ${profile.id}`);
    profileIds.add(profile.id);
    if (profile.catalog.commit !== catalog.source.commit) failures.push(`${profile.id}: catalog commit does not match the pinned snapshot`);
    if (!catalog.clientPlatforms.includes(`${profile.catalog.client}/${profile.catalog.platform}`)) failures.push(`${profile.id}: unknown catalog target`);
    for (const field of ["appVersion", "osVersion", "device", "accountType", "capturedAt"]) {
      if (!profile.target?.[field]) failures.push(`${profile.id}: missing measured target ${field}`);
    }
    const ruleIds = new Set();
    for (const rule of profile.rules ?? []) {
      if (ruleIds.has(rule.id)) failures.push(`${profile.id}: duplicate rule id ${rule.id}`);
      ruleIds.add(rule.id);
      if (!ACTIONS.has(rule.action)) failures.push(`${rule.id}: unsupported action ${rule.action}`);
      if (!RELATIONSHIPS.has(rule.relationship)) failures.push(`${rule.id}: invalid evidence relationship`);
      const linkedFeatures = [rule.featureId, ...(rule.catalogFeatureIds ?? [])];
      if (!linkedFeatures.some((id) => featureIds.has(id)) && !rule.featureId.startsWith("mailshade-")) failures.push(`${rule.id}: feature is neither catalog-backed nor Mailshade-specific`);
      for (const id of rule.catalogFeatureIds ?? []) if (!featureIds.has(id)) failures.push(`${rule.id}: unknown linked catalog feature ${id}`);
      if (rule.evidence === "measured") {
        if (!rule.captureRunId) failures.push(`${rule.id}: measured rule is missing captureRunId`);
        if (!rule.fixture) failures.push(`${rule.id}: measured rule is missing fixture evidence`);
        for (const fixture of String(rule.fixture ?? "").split(",").map((value) => value.trim()).filter(Boolean)) {
          if (!fixtureIds.has(fixture)) failures.push(`${rule.id}: unknown fixture ${fixture}`);
        }
      }
    }
  }
  failures.push(...validateSkills(repositoryRoot).failures);
  return { failures, catalog, profileIds: [...profileIds] };
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(import.meta.filename)) {
  const result = auditCompatibility(path.resolve(import.meta.dirname, ".."));
  if (result.failures.length) {
    console.error(`Compatibility audit failed:\n- ${result.failures.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Compatibility audit passed: ${result.catalog.counts.features} features, ${result.catalog.counts.clientPlatforms} targets, ${result.profileIds.length} executable profile.`);
  }
}
