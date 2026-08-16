import path from "node:path";
import process from "node:process";
import { loadCatalog } from "./compatibility-catalog-lib.mjs";

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: npm run compatibility:query -- --client <id> --platform <id> [--version <exact>] [--feature <id>] [--status <status>] [--history] [--json]");
  process.exit(0);
}

const client = valueAfter(args, "--client");
const platform = valueAfter(args, "--platform");
const version = valueAfter(args, "--version");
const featureId = valueAfter(args, "--feature");
const status = valueAfter(args, "--status");
const history = args.includes("--history");
const json = args.includes("--json");
if (!client || !platform) fail("Both --client and --platform are required. Use --help for examples.");

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const catalog = loadCatalog(repositoryRoot);
if (!catalog.clientIds.includes(client)) fail(`Unknown client '${client}'. Valid clients: ${catalog.clientIds.join(", ")}`);
if (!catalog.clientPlatforms.includes(`${client}/${platform}`)) {
  const platforms = catalog.clientPlatforms.filter((entry) => entry.startsWith(`${client}/`)).map((entry) => entry.split("/")[1]);
  fail(`Unknown platform '${platform}' for ${client}. Valid platforms: ${platforms.join(", ")}`);
}

const matches = [];
for (const feature of catalog.features) {
  if (featureId && feature.id !== featureId) continue;
  const observations = feature.clients?.[client]?.[platform] ?? [];
  if (!observations.length) continue;
  const selected = version ? observations.find((observation) => observation.version === version) : observations.at(-1);
  if (!selected || (status && selected.status !== status)) continue;
  matches.push({
    feature: feature.id,
    title: feature.title,
    category: feature.category,
    lastTestDate: feature.lastTestDate,
    sourceUrl: feature.sourceUrl,
    observation: selected,
    observationLabel: version ? `exact catalog observation ${version}` : "latest catalog observation",
    history: history ? observations : undefined,
    referencedNotes: selected.noteReferences.map((reference) => ({ reference, text: feature.notesByNumber?.[reference] ?? null })),
  });
}

if (featureId && !catalog.features.some((feature) => feature.id === featureId)) fail(`Unknown feature '${featureId}'.`);
if (version && !matches.length) fail(`No exact ${client}/${platform} observation found for version '${version}'${featureId ? ` and feature '${featureId}'` : ""}.`);

const result = {
  target: { client, platform, version: version ?? null },
  catalog: { commit: catalog.source.commit, importedAt: catalog.source.importedAt },
  count: matches.length,
  matches,
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`${client}/${platform} · ${matches.length} matching features · catalog ${catalog.source.commit.slice(0, 12)}`);
  for (const match of matches) {
    console.log(`${match.feature}\t${match.observation.status}\t${match.observation.version}\t${match.observation.result}\t${match.title}`);
    for (const note of match.referencedNotes) console.log(`  #${note.reference}: ${note.text ?? "Missing note text"}`);
  }
}

