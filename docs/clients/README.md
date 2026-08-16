# Client profiles

Each simulated email client gets one folder or document containing the same evidence chain:

1. **Identity** — client, platform, app build, OS build, device/viewport, capture date.
2. **Mode control** — the exact UI used to obtain light and dark renders without silently changing another variable.
3. **Corpus** — instrumented fixtures used for fitting and realistic holdouts kept out of fitting.
4. **Observed behavior** — surfaces, text, borders, gradients, images, transparency, media queries, and unsupported CSS.
5. **Model** — versioned coefficients or anchors and the transformation order.
6. **Validation** — pixel/color metrics, geometry checks, visual review, and the raw capture run ID.
7. **Limitations** — unsupported constructions and build-specific uncertainty.

Follow [`adding-a-client.md`](adding-a-client.md) and copy [`profile-template.md`](profile-template.md) when adding a client. Never promote observations from one app/platform combination to another without a separate capture run.
