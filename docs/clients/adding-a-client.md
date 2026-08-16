# Adding an email client

Mailshade separates shared document safety/rendering from client-specific behavior. A new client does not require forking the simulator.

1. Copy [`profile-template.md`](profile-template.md) and document the client/platform identity and capture controls.
2. Add instrumented and holdout fixtures to `fixtures/manifest.json` when the existing corpus does not cover a behavior.
3. Capture, analyze, fit, and validate a versioned profile using `docs/calibration.md`.
4. Add an adapter under `app/core/clients/`. The adapter owns:
   - display labels and download filename;
   - supported CSS properties;
   - gradient treatment;
   - the versioned color profile and validation status.
5. Register the adapter in `app/core/clients/index.ts`. The client selector, preview labels, diagnostics, exports, and renderer then use that adapter.
6. Add a registry test and adapter-policy test. Never silently fall back when an unknown client ID is requested.

The shared core handles source isolation, forbidden elements/attributes, remote-image policy, three-output generation, color parsing, role classification, and export diagnostics. If a future client needs a transformation that cannot be expressed by the current adapter fields, extend the adapter interface with an explicit capability or hook and test it with that client's evidence. Do not add client-name conditionals to the shared core.
