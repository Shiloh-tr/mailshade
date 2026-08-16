import "dotenv/config";
import nodemailer from "nodemailer";

const requiredVariables = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];

export function normalizeSmtpPassword(host, password) {
  if (host.trim().toLowerCase() !== "smtp.gmail.com") return password;
  const compact = password.replace(/\s/g, "");
  return compact.length === 16 ? compact : password;
}

export function redactSmtpError(message) {
  let redacted = message;
  for (const value of [process.env.SMTP_PASS, process.env.SMTP_USER]) {
    if (value) redacted = redacted.replaceAll(value, value === process.env.SMTP_PASS ? "[REDACTED]" : "[SMTP_USER]");
  }
  return redacted;
}

export function createSmtpTransport() {
  const missing = requiredVariables.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required SMTP configuration: ${missing.join(", ")}. ` +
        "Copy .env.example to .env and fill in your test-account credentials.",
    );
  }

  const port = Number.parseInt(process.env.SMTP_PORT, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535.");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE?.toLowerCase() === "true",
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: normalizeSmtpPassword(process.env.SMTP_HOST, process.env.SMTP_PASS),
    },
  });
}
