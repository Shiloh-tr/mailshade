import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSmtpPassword, redactSmtpError } from "../scripts/smtp-config.mjs";

test("normalizes the grouped 16-character format shown by Google", () => {
  assert.equal(normalizeSmtpPassword("smtp.gmail.com", "abcd efgh ijkl mnop"), "abcdefghijklmnop");
  assert.equal(normalizeSmtpPassword("SMTP.GMAIL.COM", "abcd\tefgh\nijkl mnop"), "abcdefghijklmnop");
});

test("does not alter arbitrary SMTP passwords or malformed Gmail values", () => {
  assert.equal(normalizeSmtpPassword("smtp.example.com", "correct horse battery staple"), "correct horse battery staple");
  assert.equal(normalizeSmtpPassword("smtp.gmail.com", "not a valid grouped password"), "not a valid grouped password");
});

test("redacts configured SMTP secrets from verifier errors", () => {
  const previousPass = process.env.SMTP_PASS;
  const previousUser = process.env.SMTP_USER;
  process.env.SMTP_PASS = "top-secret-value";
  process.env.SMTP_USER = "sender@example.com";
  const redacted = redactSmtpError("Login sender@example.com failed with top-secret-value");
  assert.equal(redacted, "Login [SMTP_USER] failed with [REDACTED]");
  if (previousPass === undefined) delete process.env.SMTP_PASS; else process.env.SMTP_PASS = previousPass;
  if (previousUser === undefined) delete process.env.SMTP_USER; else process.env.SMTP_USER = previousUser;
});
