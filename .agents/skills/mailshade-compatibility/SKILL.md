---
name: mailshade-compatibility
description: Query and compare Mailshade's pinned cross-client email compatibility evidence without claiming a rendered simulation. Use when Codex, ChatGPT, Claude, or another Agent Skills host is asked whether an HTML or CSS feature works in a saved email client/platform/version, to compare clients, inspect history or notes, or distinguish Can I Email catalog observations from executable adapters and measured local overrides.
---

# Mailshade Compatibility

Query the repository's pinned Can I Email snapshot and clearly separate catalog evidence from executable and locally measured behavior.

## Query one target

Use exact catalog client and platform IDs. Omit `--version` for the latest entry in upstream file order, labeled `latest catalog observation`. Supply `--version` only for an exact saved value; never infer a semantic or nearest version.

```bash
npm run compatibility:query -- --client gmail --platform ios --feature css-variables --json
npm run compatibility:query -- --client outlook --platform windows --version 2019 --feature css-background-image --json
```

Add `--history` to include all saved observations. Add `--status supported`, `partial`, `unsupported`, `unresolved`, or `locally-overridden` to filter.

## Compare targets

Use comma-separated `client/platform` IDs. Comparisons use each target's latest catalog observation because version labels are client-specific and are never matched across clients.

```bash
npm run compatibility:query -- --compare gmail/ios,apple-mail/ios,outlook/windows --feature css-variables --json
```

Summarize each target independently. Include raw support token, normalized catalog status, exact observation version, referenced notes, source URL, capability (`catalog-only` or `executable`), and any measured local rules. Treat `locally-overridden` as measured Mailshade evidence, not a rewrite of upstream history.

## Evidence boundaries

- A catalog observation describes support; it does not prescribe DOM or CSS transformation.
- An executable profile has curated mappings safe enough to render.
- A measured override has fixture/capture context and may confirm, extend, narrow, or replace catalog evidence for its exact target.
- An unresolved result remains unresolved. Do not guess from another client or version.
- AMP and BIMI are message-level observations and cannot become HTML-body preview transformations.

Use `$mailshade-preview` only when the requested target has an executable adapter.
