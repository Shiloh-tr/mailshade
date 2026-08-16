import fs from "node:fs";
import path from "node:path";
import { loadCatalog } from "./compatibility-catalog-lib.mjs";

export function loadExecutableProfiles(repositoryRoot) {
  const profilesRoot = path.join(repositoryRoot, "profiles");
  const profiles = [];
  for (const clientDirectory of fs.readdirSync(profilesRoot, { withFileTypes: true })) {
    if (!clientDirectory.isDirectory()) continue;
    const directory = path.join(profilesRoot, clientDirectory.name);
    for (const filename of fs.readdirSync(directory).filter((name) => /^compatibility-.*\.json$/.test(name)).sort()) {
      profiles.push(JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8")));
    }
  }
  return profiles;
}

export function parseTarget(value) {
  const [client, platform, extra] = String(value ?? "").split("/");
  if (!client || !platform || extra) throw new Error(`Invalid target '${value}'. Use <client>/<platform>.`);
  return { client, platform };
}

function validateTarget(catalog, target) {
  if (!catalog.clientIds.includes(target.client)) throw new Error(`Unknown client '${target.client}'. Valid clients: ${catalog.clientIds.join(", ")}`);
  if (!catalog.clientPlatforms.includes(`${target.client}/${target.platform}`)) {
    const platforms = catalog.clientPlatforms.filter((entry) => entry.startsWith(`${target.client}/`)).map((entry) => entry.split("/")[1]);
    throw new Error(`Unknown platform '${target.platform}' for ${target.client}. Valid platforms: ${platforms.join(", ")}`);
  }
}

export function queryTarget({ catalog, profiles, target, version, featureId, status, history = false }) {
  validateTarget(catalog, target);
  if (featureId && !catalog.features.some((feature) => feature.id === featureId)) throw new Error(`Unknown feature '${featureId}'.`);
  const executableProfile = profiles.find((profile) => profile.catalog.client === target.client && profile.catalog.platform === target.platform);
  const matches = [];

  for (const feature of catalog.features) {
    if (featureId && feature.id !== featureId) continue;
    const observations = feature.clients?.[target.client]?.[target.platform] ?? [];
    if (!observations.length) continue;
    const selected = version ? observations.find((observation) => observation.version === version) : observations.at(-1);
    if (!selected) continue;
    const localRules = version ? [] : (executableProfile?.rules ?? []).filter((rule) => rule.featureId === feature.id || rule.catalogFeatureIds?.includes(feature.id));
    const effectiveStatus = localRules.some((rule) => rule.evidence === "measured")
      ? "locally-overridden"
      : selected.status === "unknown" ? "unresolved" : selected.status;
    if (status && status !== selected.status && status !== effectiveStatus) continue;
    matches.push({
      feature: feature.id,
      title: feature.title,
      category: feature.category,
      lastTestDate: feature.lastTestDate,
      sourceUrl: feature.sourceUrl,
      observation: selected,
      observationLabel: version ? `exact catalog observation ${version}` : "latest catalog observation",
      effectiveStatus,
      history: history ? observations : undefined,
      referencedNotes: selected.noteReferences.map((reference) => ({ reference, text: feature.notesByNumber?.[reference] ?? null })),
      executable: executableProfile ? {
        adapterId: executableProfile.id.replace(/-compatibility-\d{4}-\d{2}-\d{2}$/, ""),
        profileId: executableProfile.id,
        measuredTarget: executableProfile.target,
        rules: localRules,
      } : null,
    });
  }

  if (version && !matches.length) throw new Error(`No exact ${target.client}/${target.platform} observation found for version '${version}'${featureId ? ` and feature '${featureId}'` : ""}.`);
  return {
    target: { ...target, version: version ?? null },
    capability: executableProfile ? "executable" : "catalog-only",
    executableProfile: executableProfile?.id ?? null,
    count: matches.length,
    matches,
  };
}

export function runCompatibilityQuery(repositoryRoot, options) {
  const catalog = loadCatalog(repositoryRoot);
  const profiles = loadExecutableProfiles(repositoryRoot);
  const targets = options.targets.map((target) => queryTarget({ catalog, profiles, target, ...options }));
  return {
    catalog: { commit: catalog.source.commit, importedAt: catalog.source.importedAt },
    comparison: targets.length > 1,
    targets,
  };
}
