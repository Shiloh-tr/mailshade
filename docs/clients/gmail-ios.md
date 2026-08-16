# Gmail on iOS

## Identity

| Field | Value |
| --- | --- |
| Client | Gmail for iOS |
| Platform | iPhone, observed through iPhone Mirroring |
| App version | Gmail `6.0.260803` |
| iOS version | iOS `26.6` |
| Device | iPhone 15 |
| Capture viewport | 318 × 701 device screenshot |
| Capture date | 2026-08-16 |
| Capture run ID | `2026-08-16T09-55-10-855Z` |

The app version, OS version, and device model were read directly from iPhone Settings through iPhone Mirroring after the first capture sequence. They are not inferred from screenshots or release dates.

## Mode control

Fixtures were delivered to the calibration account itself over authenticated SMTP and opened in Gmail on the mirrored iPhone.

- Dark: Gmail's normal dark message render.
- Paired light: open the message menu and choose **View in light theme**.

The per-message command is the canonical pairing method. Do not change the iPhone system appearance between every fixture; doing so introduces unnecessary state changes.

## Corpus

Fitting fixtures:

- `color-matrix` — solid surfaces and foreground polarity.
- `role-matrix` — isolated text and border roles.

Validation fixtures:

- `gradient-matrix` — linear, radial, repeating, transparent, and layered gradients.
- `dark-native-holdout` — a naturally dark campaign containing deliberately light and saturated nested regions.

Ongoing discovery fixtures:

- `inheritance-context-matrix` — inherited/nested foreground polarity, variables, and legacy color attributes.
- `compositing-feature-matrix` — alpha, shadows, `currentColor`, blend modes, media queries, and data SVG.
- `cascade-attribute-matrix` — precedence, links, multi-side borders, transparency, and opacity.
- `dark-gradient-holdout-2` — a second naturally dark corpus with four gradient families.
- `text-autosizing-matrix` — typography scaling, wrapping, and `-webkit-text-size-adjust` activation conditions.

## Observed behavior

### Solid colors

Gmail iOS does not apply one global invert function. The result depends on whether a color is used as a surface, text, or border and, for surfaces, on nearby foreground polarity. Examples from paired captures:

| Role | Source | Gmail iOS dark |
| --- | --- | --- |
| Surface with dark text | `#ffffff` | `#212025` |
| Surface with dark text | `#bdbdbd` | `#595a5e` |
| Surface with light text | `#111111` | `#f0f0f0` |
| Surface with light text | `#090a0f` | `#f8f7fc` |
| Text | `#000000` | `#ffffff` |
| Text | `#ffffff` | `#212025` |
| Border | `#5f2eff` | `#b27ff2` |
| Border | `#fe7345` | `#ad3e20` |

This disproved the initial “preserve already-dark colors” heuristic: naturally dark solids and light-on-dark text can still invert.

### Gradients

At the sampled holdout points, authored CSS gradient image pixels were preserved within capture noise while foreground text colors changed. The simulator therefore preserves declarations containing `gradient(` and transforms separately declared foreground/background colors.

Observed examples include linear, radial, repeating-linear, layered, and alpha-containing gradients. This is a measured rule for the tested Gmail/iOS build, not a guarantee for every possible CSS/image construction.

### Naturally dark email

The dark-native holdout preserved the authored hero gradient, but solid nested surfaces and light text still followed Gmail's contextual transformations. The two activation samples were:

| Region | Gmail iOS | Simulator | ΔE76 |
| --- | --- | --- | ---: |
| Pale notice | `#2a2507` | `#2d2607` | 1.5621 |
| Green CTA | `#0b3f24` | `#103a28` | 6.8380 |

## Model

The active profile is [`profiles/gmail-ios/measured-draft-2026-08-16.json`](../../profiles/gmail-ios/measured-draft-2026-08-16.json). Its order of operations is:

1. Parse and sanitize the email document.
2. Apply the Gmail-compatible light pass.
3. Preserve authored gradient declarations.
4. Classify remaining color tokens as surface, text, or border.
5. For surfaces, infer dark-text or light-text context from the local declaration block.
6. Reproduce exact measured anchors; interpolate unseen colors with a role/context-specific residual prior.

Generated dark HTML is returned separately. The source HTML is never modified in place.

The Gmail compatibility allowlist follows Google's current [official CSS support reference](https://developers.google.com/workspace/gmail/design/css). Device fixtures still determine rendering behavior where that cross-platform reference is silent, especially iOS auto-sizing and dark-mode transformation.

## Validation

- Instrumented surface, text, and border anchors reproduce their paired samples exactly in the calibration CLI.
- The gradient holdout passed sampled-pixel and visual comparison.
- The naturally dark contextual samples passed the v0.1 draft gate of ΔE76 ≤ 7.
- The same independent contextual holdout passes the strict color gate: median ΔE00 `1.3540`, p95 ΔE00 `3.6767`.
- A dedicated 12-probe typography matrix found no Gmail dark-mode reflow: default, `100%`, `none`, and `auto` `-webkit-text-size-adjust` cases retained the same wrapping. Paired light/dark geometry passed at a maximum normalized delta of 2 px. The earlier SSIM failure was caused by comparing different widths and capture engines, not Gmail auto-sizing.
- Raw cross-engine SSIM is diagnostic only. Release geometry uses paired Gmail light/dark captures; color uses independent CIEDE2000 holdouts.
- Application build, unit/integration tests, lint, and runtime controls are verified separately.

Raw local evidence is stored under the ignored `captures/2026-08-16T09-55-10-855Z/` directory. See the [run report](../calibration-runs/2026-08-16.md) and the [calibration procedure](../calibration.md).

## Limitations

- Coverage is limited to the documented fixtures and sampled points.
- Remote raster/SVG image rewriting, blend modes, animated content, and every possible media-query construction are not yet exhaustively characterized.
- No Gmail dark-mode typography auto-sizing was observed in the dedicated matrix. `-webkit-text-size-adjust` is stripped/ignored, while standard `font-size-adjust` remains accepted.
- CSS custom properties are not retained: Gmail removes `--name` declarations and declarations that depend on `var()`, allowing ordinary cascade/inheritance fallbacks to take effect.
- CSS `url(data:...)` declarations are removed. This is measured for CSS background images and is intentionally not generalized to ordinary `<img>` sources without a separate fixture.
- The profile is a device-validated draft, not a claim of pixel-perfect equivalence across all Gmail iOS versions.
