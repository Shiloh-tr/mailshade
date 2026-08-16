import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditCompatibility } from "./audit-compatibility.mjs";

const root = new URL("../", import.meta.url);
const verificationArgumentIndex = process.argv.indexOf("--verification");
const verificationArgument = verificationArgumentIndex >= 0 ? process.argv[verificationArgumentIndex + 1] : undefined;
const verificationPath = verificationArgument
  ? new URL(verificationArgument, root)
  : new URL("../profiles/gmail-ios/verification-2026-08-16.json", import.meta.url);
const verification = JSON.parse(await readFile(verificationPath, "utf8"));
const failures = [...auditCompatibility(fileURLToPath(new URL("../", import.meta.url))).failures];

for (const field of ["client", "platform", "device", "osVersion", "clientVersion", "captureRunId"]) {
  if (!verification[field]) failures.push(`missing identity field: ${field}`);
}

const profile = verification.activeProfile
  ? JSON.parse(await readFile(new URL(verification.activeProfile, root), "utf8"))
  : null;
if (verification.status !== "verified") failures.push(`verification status is '${verification.status}'`);
if (!profile) failures.push("no active executable profile is registered");
else if (profile.status !== "calibrated") failures.push(`active profile status is '${profile.status}'`);

for (const [name, gate] of Object.entries(verification.gates)) {
  if (gate.status !== "pass") failures.push(`${name} gate is '${gate.status}'`);
}

for (const runId of [verification.captureRunId, ...(verification.discoveryRuns ?? [])]) {
  try {
    await access(new URL(`captures/${runId}/`, root));
  } catch {
    failures.push(`capture evidence directory is missing: ${runId}`);
  }
}

if (failures.length) {
  console.error(`${verification.client} ${verification.platform} verification is incomplete:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`${verification.client} ${verification.clientVersion} on ${verification.device} / ${verification.platform} ${verification.osVersion}: all verification gates pass.`);
}
