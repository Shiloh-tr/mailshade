import { createSmtpTransport, redactSmtpError } from "./smtp-config.mjs";

try {
  const transport = createSmtpTransport();
  await transport.verify();
  transport.close();
  console.log("SMTP authentication succeeded. No email was sent.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SMTP authentication failed: ${redactSmtpError(message)}`);
  process.exitCode = 1;
}
