import path from "node:path";
import process from "node:process";
import { parseTarget, runCompatibilityQuery } from "./compatibility-query-lib.mjs";

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
  console.log("Usage:\n  npm run compatibility:query -- --client <id> --platform <id> [--version <exact>] [--feature <id>] [--status <status>] [--history] [--json]\n  npm run compatibility:query -- --compare <client/platform,...> [--feature <id>] [--status <status>] [--history] [--json]");
  process.exit(0);
}

const compare = valueAfter(args, "--compare");
const client = valueAfter(args, "--client");
const platform = valueAfter(args, "--platform");
const version = valueAfter(args, "--version");
if (compare && (client || platform)) fail("Use either --compare or --client with --platform, not both.");
if (compare && version) fail("--version is only valid for one exact client/platform target; catalog versions are not comparable across clients.");
if (!compare && (!client || !platform)) fail("Both --client and --platform are required unless --compare is used.");

try {
  const targets = compare ? compare.split(",").map(parseTarget) : [{ client, platform }];
  const result = runCompatibilityQuery(path.resolve(import.meta.dirname, ".."), {
    targets,
    version,
    featureId: valueAfter(args, "--feature"),
    status: valueAfter(args, "--status"),
    history: args.includes("--history"),
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const target of result.targets) {
      console.log(`${target.target.client}/${target.target.platform} · ${target.capability} · ${target.count} matching features · catalog ${result.catalog.commit.slice(0, 12)}`);
      for (const match of target.matches) {
        console.log(`${match.feature}\t${match.effectiveStatus}\t${match.observation.version}\t${match.observation.result}\t${match.title}`);
        for (const note of match.referencedNotes) console.log(`  #${note.reference}: ${note.text ?? "Missing note text"}`);
        for (const rule of match.executable?.rules ?? []) console.log(`  local ${rule.evidence}: ${rule.id} → ${rule.action}`);
      }
    }
  }
} catch (error) {
  fail(error.message);
}
