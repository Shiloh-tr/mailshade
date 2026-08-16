import { access, readFile } from "node:fs/promises";

const verificationPath = new URL("../profiles/gmail-ios/verification-2026-08-16.json", import.meta.url);
const root = new URL("../", import.meta.url);
const verification = JSON.parse(await readFile(verificationPath, "utf8"));
const failures = [];

for (const field of ["client", "platform", "device", "osVersion", "clientVersion", "captureRunId"]) {
  if (!verification[field]) failures.push(`missing identity field: ${field}`);
}

const profile = JSON.parse(await readFile(new URL(verification.activeProfile, root), "utf8"));
if (verification.status !== "verified") failures.push(`verification status is '${verification.status}'`);
if (profile.status !== "calibrated") failures.push(`active profile status is '${profile.status}'`);

for (const [name, gate] of Object.entries(verification.gates)) {
  if (gate.status !== "pass") failures.push(`${name} gate is '${gate.status}'`);
}

for (const runId of [verification.captureRunId, ...verification.discoveryRuns]) {
  try {
    await access(new URL(`captures/${runId}/`, root));
  } catch {
    failures.push(`capture evidence directory is missing: ${runId}`);
  }
}

if (failures.length) {
  console.error(`Gmail iOS verification is incomplete:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Gmail iOS ${verification.clientVersion} on ${verification.device} / iOS ${verification.osVersion}: all verification gates pass.`);
}
