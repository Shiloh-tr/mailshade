# Client calibration

## 1. Prepare

Use a dedicated sender and test inbox. Put SMTP credentials only in the ignored `.env`, verify with `npm run smtp:verify`, then send the versioned corpus with `npm run fixtures:send`.

## 2. Capture

On the same device and client build, capture each fixture once in the client’s explicit light appearance and once in dark appearance. Crop both images to identical email-body bounds. Record the device model, CSS viewport, iOS version, client version, account type, fixture subject, capture date, and run ID.

## 3. Measure

Save captures locally under `captures/` and run:

```bash
npm run captures:analyze -- --fixture color-matrix --light captures/light.png --dark captures/dark.png
```

The analyzer samples stable fixture regions and outputs paired RGB observations. Gradient fixtures use separate normalized sample regions. If Gmail's light and dark message views introduce different padding, pass a run-local pixel map with `--regions captures/<run>/region-map.json`; each region may define separate `lightRect` and `darkRect` bounds.

## 4. Fit and validate

Fit a measured draft without touching the active heuristic profile:

```bash
npm run captures:fit -- --analysis captures/color-matrix-analysis.json --analysis captures/role-matrix-analysis.json --output captures/gmail-ios-measured-draft.json
```

The fitter reproduces the simulator's role-aware surface, text, and border models and reports RGB RMSE plus in-sample CIE76 error for each measured role. If a role has too few observations, its values remain explicitly inherited. Validate the candidate against a separately captured holdout:

```bash
npm run captures:validate -- --analysis captures/holdout-analysis.json --profile captures/gmail-ios-measured-draft.json
```

The validator refuses to treat a profile's own fitting analyses as release-gate evidence. Use `--allow-in-sample` only to diagnose the fitter; its output is explicitly marked `releaseGateEligible: false`. A passing verification gate requires an independent holdout analysis.

Never overwrite a calibrated historical profile. Fit only against instrumented fixtures. Validate against `dark-native-holdout` and realistic templates before changing the profile status from `heuristic` or `measured-draft`.

The device-validated v0.1 draft uses paired-pixel checks for contextual holdout surfaces and paired light/dark geometry. Release-candidate targets are median ΔE00 ≤ 2, 95th-percentile ΔE00 ≤ 5, and key boxes within 2 normalized email-body pixels. Do not label a profile fully calibrated until those automated gates pass across the declared Gmail/iOS build combination.

The strict color metric is implemented by `npm run captures:validate` (CIEDE2000), and paired layout is gated by `npm run captures:geometry`. Device screenshots must first be cropped and normalized to the same authored email-body bounds; application chrome is not part of the client transformation model. Store the source crop rectangles and common output size in a run-local JSON file, then execute `npm run captures:align -- --config captures/<run>/alignment.json` so the alignment is repeatable rather than a manual image edit.

`npm run captures:visual` remains useful for deterministic renders from the same engine. It is not a Gmail iOS release gate when one image comes from WebKit/iOS and the other from a desktop browser: font rasterization, device screenshot scaling, and JPEG encoding make raw cross-engine SSIM measure the capture pipeline rather than Gmail's dark-mode transformation. For device verification, compare paired Gmail light/dark geometry and wrapping, then gate the transformed colors independently.

## 5. Discovery loop

Previous measurements are the regression baseline, not the end of testing. Every discovery batch must exercise constructions that are not already explained by the current client profile—for example inheritance boundaries, alpha compositing, fallback declarations, legacy HTML attributes, blend modes, or nested mixed-polarity content.

For each batch:

1. Predict the result from the current rules before inspecting Gmail.
2. Capture paired Gmail dark and per-message light renders on the recorded device/build.
3. Compare sampled colors, aligned visuals, and key geometry against the prediction.
4. Record every mismatch as a candidate finding; reproduce it with the smallest possible fixture.
5. Only after a second capture confirms it, update the client rule, documentation, fixture corpus, and automated regression test.
6. Rerun all historical fixtures. A new rule may not fix its probe by regressing an earlier measured behavior.

Discovery is considered saturated—not proven exhaustive—after three consecutive independent batches of at least eight novel constructions produce no confirmed new transformation class and all strict gates pass. Any Gmail or iOS version change resets the saturation count.

Run `npm run verification:audit` for the final completion check. It intentionally fails while any identity, color, visual, geometry, expanded-suite, or discovery-saturation gate is pending or failing, or while the active profile has not been promoted to `calibrated`. A green unit-test suite alone is not verification evidence.
