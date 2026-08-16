import { readFile } from "node:fs/promises";
import { createSmtpTransport } from "./smtp-config.mjs";

const root = new URL("../fixtures/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
if (process.argv.includes("--list")) {
  manifest.fixtures.forEach((fixture) => console.log(`${fixture.id} — ${fixture.description}`));
  process.exit(0);
}
const requestedIds = process.argv.flatMap((value, index) => value === "--fixture" && process.argv[index + 1] ? [process.argv[index + 1]] : []);
const requested = process.argv.includes("--all")
  ? manifest.fixtures
  : manifest.fixtures.filter((fixture) => requestedIds.includes(fixture.id));

if (requested.length === 0) {
  console.error("Choose --all or one or more --fixture <id> arguments. Available fixtures:");
  manifest.fixtures.forEach((fixture) => console.error(`  ${fixture.id} — ${fixture.description}`));
  process.exit(1);
}
if (!process.env.SMTP_FROM?.trim() || !process.env.TEST_EMAIL_TO?.trim()) {
  throw new Error("SMTP_FROM and TEST_EMAIL_TO are required in .env before sending fixtures.");
}

const transport = createSmtpTransport();
await transport.verify();
const runId = new Date().toISOString().replace(/[:.]/g, "-");

for (const fixture of requested) {
  const html = await readFile(new URL(fixture.file, root), "utf8");
  const subject = `[Mailshade ${manifest.version}] ${fixture.id} · ${runId}`;
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.TEST_EMAIL_TO,
    subject,
    text: `Mailshade calibration fixture: ${fixture.id}\n${fixture.description}\nRun: ${runId}`,
    html,
    headers: { "X-Mailshade-Fixture": fixture.id, "X-Mailshade-Run": runId },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  console.log(`${fixture.id}: ${info.messageId}`);
}

transport.close();
console.log(`Sent ${requested.length} fixture${requested.length === 1 ? "" : "s"} for run ${runId}.`);
