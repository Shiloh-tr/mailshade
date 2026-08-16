import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildCatalog, catalogPath } from "./compatibility-catalog-lib.mjs";

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const source = valueAfter(args, "--source");
const expectedCommit = valueAfter(args, "--commit");
if (!source) {
  console.error("Usage: npm run compatibility:sync -- --source /path/to/caniemail [--commit <sha>]");
  process.exit(1);
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const catalog = buildCatalog(path.resolve(source), expectedCommit);
const output = catalogPath(repositoryRoot);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${catalog.counts.features} features and ${catalog.counts.observations} observations to ${output}`);

