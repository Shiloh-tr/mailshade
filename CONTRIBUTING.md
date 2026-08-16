# Contributing

Mailshade treats email-client behavior as measured data. Changes to a measured profile should include:

1. The synthetic fixture that isolates the behavior.
2. Paired light and dark email-body captures from the same client/platform/device combination.
3. Capture metadata: device model, viewport, OS version, email-client version and date.
4. A holdout result demonstrating that the change improves unseen emails.
5. Unit tests for the resulting profile branch.

Do not commit personal messages, credentials, complete Gmail screenshots or tracking URLs. Use only synthetic email bodies and cropped fixture captures that contain no Gmail or iOS chrome.

Run `npm run lint` and `npm test` before submitting a change.
