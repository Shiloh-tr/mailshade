export type ProfileStatus = "heuristic" | "measured-draft" | "validated-draft" | "calibrated";

export interface ColorAnchor {
  source: string;
  target: string;
}

export interface ColorTransformProfile {
  id: string;
  label: string;
  status: ProfileStatus;
  surface: {
    preserveBelowLuminance: number;
    target: string;
    lightMix: number;
    midMix: number;
    lightThreshold: number;
  };
  text: {
    preserveAboveLuminance: number;
    target: string;
    darkMix: number;
    midMix: number;
    darkThreshold: number;
  };
  border: {
    darkThreshold: number;
    darkTarget: string;
    darkMix: number;
    lightTarget: string;
    lightMix: number;
    midMix: number;
    lightThreshold: number;
  };
  calibration?: {
    method?: string;
    anchors?: Record<string, ColorAnchor[]>;
  };
}

export interface ClientAdapter {
  id: string;
  label: string;
  platform: string;
  lightPreviewTitle: string;
  darkPreviewTitle: string;
  lightPassLabel: string;
  darkEyebrow: string;
  downloadFilename: string;
  supportedProperties: ReadonlySet<string>;
  preserveGradients: boolean;
  profile: ColorTransformProfile;
}

export interface ClientSummary {
  id: string;
  label: string;
  platform: string;
  lightPreviewTitle: string;
  darkPreviewTitle: string;
  lightPassLabel: string;
  darkEyebrow: string;
  downloadFilename: string;
  profileLabel: string;
  profileStatus: ProfileStatus;
}
