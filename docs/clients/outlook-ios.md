# Outlook on iOS — catalog-only candidate

Outlook iOS is intentionally not an executable Mailshade adapter. Device measurements established useful behavior, but two independent color holdouts failed the release thresholds. `--client outlook-ios` is therefore rejected and `--client all` continues to render only registered clients.

## Measured target

| Field | Value |
| --- | --- |
| Client | Microsoft Outlook for iOS |
| App version | `5.2630.0` |
| Device / OS | iPhone 15 / iOS `26.6` |
| Account type | Microsoft 365 |
| Outlook appearances | Explicit Light and Dark |
| Screenshot viewport | `318 × 701` px |
| Standard email-body crop | left `20`, top `350`, width `278`, height `230` px |
| Capture run | `2026-08-16T20-23-37-899Z` |
| Capture dates | 2026-08-16–2026-08-17 |
| Catalog snapshot | `1f500feec9df3241bfe679b16101d1ee449e67e9` |

Raw captures, inbox screenshots, addresses, generated analyses, and preview output are ignored and are not committed.

## Outlook-specific observations

The dedicated `outlook-dark-mode-matrix` showed that this build activates `prefers-color-scheme: dark`, exposes Outlook `data-og*` attributes used by common email selectors, and accepts the measured attribute-selector forms. CSS custom properties fell back rather than resolving, and gradient declarations fell back to the preceding solid color. These observations are recorded in `profiles/outlook-ios/catalog-candidate-2026-08-17.json`; they do not inherit Gmail rules.

Paired geometry passed at a maximum normalized email-body delta of `0` px. Color did not:

| Independent holdout | Median ΔE00 | p95 ΔE00 | Gate |
| --- | ---: | ---: | --- |
| Chromatic roles | 34.8721 | 42.0335 | Fail |
| Legacy inheritance, dark-text surfaces | 21.2715 | 21.2715 | Fail |
| Legacy inheritance, light-text surfaces | 31.8918 | 32.4434 | Fail |

The required limits are median ΔE00 ≤ 2, p95 ΔE00 ≤ 5, and geometry ≤ 2 px. Because the color gates failed after refitting discovery mismatches, the measured draft remains inactive and Outlook iOS stays catalog-only. Microsoft 365 is the only account type measured; no cross-account claim is made.

## Gmail real-world regression discovered during this run

A sanitized real-world dark email was separately delivered to the Gmail calibration inbox and captured in Gmail iOS dark mode and its per-message light view. The prior simulator corrupted CSS image URLs containing words such as `green` while transforming color tokens, causing image-backed dark cards to become light. Mailshade now protects complete `url(...)` values from color-token rewriting and includes a synthetic regression fixture. The application banner also states that a rendered email is an approximation, not a claim that the message itself matches a device.
