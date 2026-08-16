# Adding an email client

Mailshade separates catalog evidence, shared document safety/rule execution, and client-specific rendering. Saving support observations makes a target **catalog-only**. Rendering requires a separately reviewed **executable adapter**.

1. Identify the exact Can I Email client/platform IDs. Verify them with `npm run compatibility:query`; do not copy Gmail rules from a similar-looking target.
2. Copy [`profile-template.md`](profile-template.md) and record the tested application build, OS build, device, account type, and capture controls.
3. Add instrumented and holdout fixtures to `fixtures/manifest.json` when the existing corpus does not cover a behavior.
4. Capture, analyze, fit, and validate a versioned profile using `docs/calibration.md`.
5. Add a compact compatibility profile under `profiles/<client>/`. It must pin the catalog snapshot, define curated actions for behavior that cannot be safely inferred from support status, and link measured overrides to fixtures and capture runs.
6. Add an adapter under `app/core/clients/` with UI metadata, the compatibility profile, and any applicable dark-mode color profile.
7. Register the adapter in `app/core/clients/index.ts`. Only registered adapters appear in preview `--client all`.
8. Add catalog-query, registry, rule-action, malformed-input, security-separation, and rendering tests. Never silently fall back when an unknown or catalog-only target is requested.

The shared core handles source isolation, the iframe security envelope, remote-image policy, PostCSS parsing, generic rule actions, three-output generation, color parsing, role classification, and diagnostics. Keep security actions out of compatibility statistics. Preserve malformed CSS as unresolved.

If a future client needs behavior that cannot be expressed by the current matcher/action schema, extend that generic schema and test it with client evidence. Do not add client-name conditionals to shared parsing or execution. Support tokens such as `y`, `a`, and `n` remain observations and must never directly select a destructive action. AMP and BIMI remain queryable message-level evidence, not HTML-body transformations.

Run `npm run compatibility:audit`, `npm run lint`, and `npm test` before registering the adapter as executable.
