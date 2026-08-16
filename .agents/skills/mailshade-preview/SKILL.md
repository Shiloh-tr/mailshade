---
name: mailshade-preview
description: Render local email HTML with Mailshade's executable client adapters by client, mode, and viewport. Use when Codex, ChatGPT, Claude, or another Agent Skills host is asked to preview, screenshot, compare, or inspect an email in Original, client-light, or client-dark rendering; produce HTML and PNG artifacts; or run an executable client/mode matrix.
---

# Mailshade Preview

Render supplied local HTML through registered executable adapters. Do not retrieve mailbox messages, send email, or substitute a catalog-only client.

## Render

1. Work from the Mailshade repository root containing `mailshade-email-dark-mode-simulator` in `package.json`.
2. Preserve a supplied HTML file. Save pasted HTML exactly in a temporary untracked `.html` file.
3. Run `npm run preview -- --help` to discover executable client IDs. `--client all` means all executable adapters, not all catalog targets.
4. Map the request to `original`, `light`, `dark`, or `all`. Use `all` for “both modes” so the result includes the Original baseline plus client light and dark.
5. Render at 390px unless the user specifies a viewport:

```bash
npm run preview -- --input path/to/email.html --client gmail-ios --mode all --viewport 390
```

Remote images load by default and may contact asset or tracking servers. Add `--block-remote-images` for privacy, offline work, or deterministic local output. Do not change this policy silently.

Use installed headless Chrome or Chromium. If detection fails, pass `--chrome <executable>` or set `MAILSHADE_CHROME_PATH`; do not open a visible browser or replace Mailshade's transform with browser color-scheme emulation.

## Report

Read the generated `manifest.json` and verify every requested artifact has HTML and PNG files. Return clickable artifacts and display PNGs inline where supported. Report:

- exact client target, application/OS/device/account context, and mode;
- catalog snapshot commit and executable compatibility profile;
- color-profile validation status;
- applied measured overrides and unresolved CSS rules;
- viewport and remote-image policy;
- warnings from diagnostics.

Call the output a profile-based simulation, not a guarantee for every inbox build.

## Reject unsupported rendering

Never render or substitute a catalog-only target. The preview command rejects targets such as `outlook/windows` and directs the user to `npm run compatibility:query`. Use `$mailshade-compatibility` when the user wants support evidence or cross-client comparison without a registered adapter.

If PNG rendering fails, preserve generated HTML and report the exact error and artifact directory.
