import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

export const CATALOG_SCHEMA_VERSION = 1;
export const CATALOG_FILENAME = "caniemail-snapshot.json";

function extractFrontmatter(source, filename) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  if (!match) throw new Error(`Missing YAML frontmatter in ${filename}`);
  try {
    const lines = match[1].replaceAll("\t", "  ").split("\n");
    let statsDepth = 0;
    const normalized = lines.map((line) => {
      if (!statsDepth && /^stats:\s*\{/.test(line)) {
        statsDepth = 1;
        return line;
      }
      if (!statsDepth) return line;
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      const closesOuterMap = statsDepth === 1 && opens === 0 && closes === 1 && /^\s*}\s*$/.test(line);
      const result = line && !/^\s/.test(line) && !closesOuterMap ? `  ${line}` : line;
      statsDepth += opens - closes;
      return result;
    }).join("\n");
    return parseYaml(normalized, { strict: false, uniqueKeys: false });
  } catch (error) {
    throw new Error(`Invalid YAML frontmatter in ${filename}: ${error.message}`, { cause: error });
  }
}

function normalizeStatus(result) {
  const token = String(result ?? "").trim().charAt(0).toLowerCase();
  if (token === "y") return "supported";
  if (token === "a") return "partial";
  if (token === "n") return "unsupported";
  return "unknown";
}

function noteReferences(result) {
  return [...String(result ?? "").matchAll(/#(\d+)/g)].map((match) => match[1]);
}

function sourceCommit(sourceDirectory) {
  return execFileSync("git", ["-C", sourceDirectory, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function sourceCommitDate(sourceDirectory) {
  return execFileSync("git", ["-C", sourceDirectory, "show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" }).trim();
}

export function buildCatalog(sourceDirectory, expectedCommit) {
  const featuresDirectory = path.join(sourceDirectory, "_features");
  if (!fs.statSync(featuresDirectory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Can I Email _features directory not found under ${sourceDirectory}`);
  }

  const commit = sourceCommit(sourceDirectory);
  if (expectedCommit && commit !== expectedCommit) {
    throw new Error(`Expected Can I Email commit ${expectedCommit}, found ${commit}`);
  }

  const files = fs.readdirSync(featuresDirectory)
    .filter((filename) => filename.endsWith(".md") && filename !== "_template.md")
    .sort();
  const clientPlatforms = new Set();
  const clientIds = new Set();
  let observationCount = 0;

  const features = files.map((filename) => {
    const id = filename.slice(0, -3);
    const document = extractFrontmatter(fs.readFileSync(path.join(featuresDirectory, filename), "utf8"), filename);
    const clients = {};

    for (const [clientId, platforms] of Object.entries(document.stats ?? {})) {
      clientIds.add(clientId);
      clients[clientId] = {};
      for (const [platformId, versions] of Object.entries(platforms ?? {})) {
        clientPlatforms.add(`${clientId}/${platformId}`);
        clients[clientId][platformId] = Object.entries(versions ?? {}).map(([version, result]) => {
          observationCount += 1;
          return {
            version,
            result: String(result),
            status: normalizeStatus(result),
            noteReferences: noteReferences(result),
            executionState: document.category === "others" ? "not-applicable" : "unimplemented",
          };
        });
      }
    }

    return {
      id,
      title: String(document.title ?? id),
      description: String(document.description ?? ""),
      category: String(document.category ?? "unknown"),
      keywords: document.keywords ?? null,
      lastTestDate: document.last_test_date ? String(document.last_test_date) : null,
      testUrl: document.test_url ? String(document.test_url) : null,
      testResultsUrl: document.test_results_url ? String(document.test_results_url) : null,
      notes: document.notes ?? null,
      notesByNumber: document.notes_by_num ?? {},
      sourceUrl: `https://www.caniemail.com/features/${id}/`,
      clients,
    };
  });

  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    source: {
      name: "Can I Email",
      repository: "https://github.com/hteumeuleu/caniemail",
      license: "MIT",
      commit,
      committedAt: sourceCommitDate(sourceDirectory),
      importedAt: new Date().toISOString(),
    },
    counts: {
      features: features.length,
      clients: clientIds.size,
      clientPlatforms: clientPlatforms.size,
      observations: observationCount,
    },
    clientIds: [...clientIds].sort(),
    clientPlatforms: [...clientPlatforms].sort(),
    features,
  };
}

export function catalogPath(repositoryRoot) {
  return path.join(repositoryRoot, "data", "compatibility", CATALOG_FILENAME);
}

export function loadCatalog(repositoryRoot) {
  return JSON.parse(fs.readFileSync(catalogPath(repositoryRoot), "utf8"));
}
