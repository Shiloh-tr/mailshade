# Mailshade

Mailshade is an open-source, local-first email compatibility project. It combines a pinned cross-client evidence catalog with executable, measured preview adapters. Gmail iOS is currently the only executable adapter; the measured Outlook iOS candidate remains catalog-only because its independent color gates failed.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Agent and CLI previews

ChatGPT, Codex, Claude, and other hosts that support the Agent Skills convention can use the canonical skills in `.agents/skills`. `mailshade-preview` renders HTML through registered executable adapters:

```bash
npm run preview -- --input path/to/email.html --client gmail-ios --mode dark
```

The command writes transformed HTML, a 390px headless Chrome PNG, and `manifest.json` under `outputs/previews/`. Use `--mode all` or `--client all` for comparisons, `--viewport <pixels>` for another width, and `--block-remote-images` to prevent requests to image and tracking URLs. Chrome stays headless and does not open a visible browser window.

`--client all` means every executable adapter. It currently means Gmail iOS only. Catalog-only targets such as Outlook iOS and Outlook Windows are queryable but cannot be rendered or silently substituted.

## Cross-client compatibility lookup

The Node-only catalog contains 308 Can I Email features across 21 clients and 48 client/platform combinations. Query the latest catalog observation or an exact saved version:

```bash
npm run compatibility:query -- --client outlook --platform windows --feature css-variables
npm run compatibility:query -- --client apple-mail --platform ios --version 12.1 --feature css-background-image
npm run compatibility:query -- --compare gmail/ios,apple-mail/ios,outlook/windows --feature css-variables
```

Catalog results are evidence, not executable transformations. They retain raw tokens, notes, history, and source URLs. Gmail iOS results additionally identify the executable profile and measured local overrides. Outlook iOS measurements and its failed activation gate are documented without borrowing Gmail transformations. The `mailshade-compatibility` skill provides the same lookup and comparison workflow to Agent Skills hosts.

## SMTP authentication

The fixture sender uses a local ignored `.env`. Set `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `TEST_EMAIL_TO`, then run `npm run smtp:verify`. The verifier authenticates without sending an email. Gmail's displayed four-character spacing is accepted and normalized locally. Never commit `.env` or reuse a personal account password.

Use `npm run fixtures:list` to inspect fixture IDs. After authentication succeeds, `npm run fixtures:send` sends the complete instrumented and holdout corpus with unique subjects. The corpus includes solid colors, isolated foreground and border roles, alpha, nested light/dark surfaces, linear/radial/repeating/layered gradients, and a naturally dark holdout email.

For an iterative discovery batch, send only new fixtures with repeated selectors, for example `npm run fixtures:send:selected -- --fixture inheritance-context-matrix --fixture compositing-feature-matrix`.

After cropping paired client screenshots to the same email-body bounds, analyze their deterministic regions with `npm run captures:analyze -- --fixture color-matrix --light captures/light.png --dark captures/dark.png`. Capture images and generated analyses remain ignored locally.

## Accuracy status

The active `gmail-ios-measured-draft-2026-08-16` profile is fitted to paired Gmail iOS light/dark captures for solid surfaces, text, and borders. Measurements disproved the original dark-preservation heuristic: Gmail can invert naturally dark surfaces and light-on-dark text. The profile uses measured anchors plus residual interpolation for unseen colors. The device-validated v0.1 draft passed gradient and naturally dark holdout comparisons against Gmail on the mirrored iPhone; coverage remains fixture- and Gmail-build-specific.

Verification is intentionally discovery-driven: documented behavior is a regression baseline, and new fixture batches target constructions the profile does not yet explain. Confirmed mismatches become measured rules, docs, fixtures, and tests. Strict release-candidate gates are median ΔE00 ≤ 2, p95 ΔE00 ≤ 5, and paired light/dark geometry within 2 normalized email-body pixels. Raw SSIM is reserved for same-engine deterministic renders, not cross-engine device screenshots.

Transformation coefficients live in versioned JSON profiles under `profiles/`. See the [Gmail iOS client profile](docs/clients/gmail-ios.md), the [Outlook iOS candidate](docs/clients/outlook-ios.md), and `docs/calibration.md` for the reusable capture, measurement and holdout workflow.

## Adding clients

The shared renderer is client-neutral. Registered adapters under `app/core/clients/` provide curated executable mappings, measured overrides, exact test context, display metadata, and a versioned dark-mode profile. The UI, previews, diagnostics, and exports read from that registry. See [Adding an email client](docs/clients/adding-a-client.md); unknown and catalog-only client IDs fail explicitly instead of silently using Gmail rules.

## License

MIT
