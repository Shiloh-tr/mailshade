---
name: mailshade-preview
description: Render local email HTML into Mailshade previews selected by email, registered client, mode, and viewport. Use when Codex or Claude is asked to preview, screenshot, compare, or inspect an email in original, client-light, or client-dark rendering; produce HTML and PNG artifacts; or run a client/mode comparison matrix.
---

# Mailshade Preview

Render an email through Mailshade's registered client profiles and return both transformed HTML and an invisible headless-browser screenshot. Work locally from HTML supplied as a file or pasted by the user; do not retrieve mailbox messages or send email.

## Render a preview

1. Work from the Mailshade repository root containing `mailshade-email-dark-mode-simulator` in `package.json`.
2. Use the user's HTML file unchanged. For pasted HTML, save the exact text to a temporary `.html` file outside tracked source.
3. Discover current client IDs with `npm run preview -- --help` when the user names a client or requests all clients. Never invent an unregistered client or silently substitute one.
4. Map the requested mode to `original`, `light`, `dark`, or `all`. Treat “source” as `original`; use `all` for comparisons.
5. Run the preview command. Use a 390px viewport unless the user requests another width:

```bash
npm run preview -- --input path/to/email.html --client gmail-ios --mode dark --viewport 390
```

Use `--client all --mode all` for every registered client/mode combination. Use `--output <directory>` only when the user requests a destination.

Remote images load by default for visual fidelity and may contact tracking or asset servers. Add `--block-remote-images` when the user requests privacy, offline rendering, or deterministic local-only output. Do not change this policy silently.

The command uses installed Chrome or Chromium in headless mode; it must not open a visible window. If automatic detection fails, use `--chrome <executable>` or `MAILSHADE_CHROME_PATH`. Do not replace the measured Mailshade transform with browser color-scheme emulation.

## Return results

Read `manifest.json` from the reported output directory. Verify that every requested combination has both `.html` and `.png` files and surface any warnings from `diagnostics`.

Return clickable links to the PNG, HTML, and manifest. Display the PNG inline when the client supports local image rendering. Briefly state the client, mode, viewport, profile status, and whether remote images were loaded. Keep claims calibrated: a Mailshade preview is a profile-based simulation, not a guarantee of every inbox build.

## Failure handling

- On an unknown client or mode, show the registered values from `--help` and ask for a valid selection only if intent cannot be mapped.
- On missing dependencies, install from the repository lockfile with `npm install`, then retry.
- On a missing browser, report the supported Chrome override rather than opening a GUI browser.
- Preserve generated HTML even when PNG rendering fails, and report the exact failure and artifact directory.
