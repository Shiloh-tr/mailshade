import profileJson from "../../../profiles/gmail-ios/measured-draft-2026-08-16.json" with { type: "json" };
import compatibilityJson from "../../../profiles/gmail-ios/compatibility-2026-08-16.json" with { type: "json" };
import type { ClientAdapter, ColorTransformProfile, EffectiveCompatibilityProfile } from "./types.ts";

export const gmailIosAdapter: ClientAdapter = {
  id: "gmail-ios",
  label: "Gmail",
  platform: "iOS",
  lightPreviewTitle: "Gmail light",
  darkPreviewTitle: "Gmail iOS dark simulation",
  lightPassLabel: "GMAIL PASS",
  darkEyebrow: "DEVICE-VALIDATED DRAFT",
  downloadFilename: "gmail-ios-simulated.html",
  compatibility: compatibilityJson as unknown as EffectiveCompatibilityProfile,
  preserveGradients: true,
  profile: profileJson as unknown as ColorTransformProfile,
};
