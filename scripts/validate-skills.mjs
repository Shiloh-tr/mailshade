#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";

function frontmatter(source, filename) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  if (!match) throw new Error(`${filename}: missing YAML frontmatter`);
  return parseYaml(match[1]);
}

function localReferences(source) {
  return [...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].split("#")[0])
    .filter((reference) => reference && !/^(?:https?:|mailto:|#)/i.test(reference));
}

export function validateSkills(repositoryRoot) {
  const failures = [];
  const skillsRoot = path.join(repositoryRoot, ".agents", "skills");
  const packageJson = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
  const skillNames = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  for (const name of skillNames) {
    const directory = path.join(skillsRoot, name);
    const skillPath = path.join(directory, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      failures.push(`${name}: missing SKILL.md`);
      continue;
    }
    const source = fs.readFileSync(skillPath, "utf8");
    let metadata;
    try {
      metadata = frontmatter(source, skillPath);
    } catch (error) {
      failures.push(error.message);
      continue;
    }
    const metadataKeys = Object.keys(metadata ?? {}).sort();
    if (metadataKeys.join(",") !== "description,name") failures.push(`${name}: frontmatter must contain only name and description`);
    if (metadata?.name !== name) failures.push(`${name}: frontmatter name must match its directory`);
    if (!/^[a-z0-9-]{1,63}$/.test(name)) failures.push(`${name}: name must be 1-63 lowercase letters, digits, or hyphens`);
    if (typeof metadata?.description !== "string" || !metadata.description.trim() || metadata.description.length > 1024) failures.push(`${name}: description must contain 1-1024 characters`);
    for (const reference of localReferences(source)) {
      if (!fs.existsSync(path.resolve(directory, reference))) failures.push(`${name}: missing relative reference ${reference}`);
    }
    for (const match of source.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
      if (!packageJson.scripts?.[match[1]]) failures.push(`${name}: referenced npm script does not exist: ${match[1]}`);
    }

    const openaiPath = path.join(directory, "agents", "openai.yaml");
    if (fs.existsSync(openaiPath)) {
      const openai = parseYaml(fs.readFileSync(openaiPath, "utf8"));
      if (Object.keys(openai ?? {}).join(",") !== "interface") failures.push(`${name}: agents/openai.yaml may contain display metadata only`);
      const ui = openai?.interface ?? {};
      if (typeof ui.short_description !== "string" || ui.short_description.length < 25 || ui.short_description.length > 64) failures.push(`${name}: short_description must contain 25-64 characters`);
      if (typeof ui.default_prompt !== "string" || !ui.default_prompt.includes(`$${name}`)) failures.push(`${name}: default_prompt must mention $${name}`);
    }
  }

  for (const forbidden of [".claude/skills", ".openai/skills"]) {
    const forbiddenPath = path.join(repositoryRoot, forbidden);
    if (fs.existsSync(forbiddenPath) && fs.readdirSync(forbiddenPath).length) failures.push(`portable skills must not be duplicated under ${forbidden}`);
  }
  return { skillNames, failures };
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(import.meta.filename)) {
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const result = validateSkills(repositoryRoot);
  if (result.failures.length) {
    console.error(`Skill validation failed:\n- ${result.failures.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${result.skillNames.length} portable skills: ${result.skillNames.join(", ")}`);
  }
}
