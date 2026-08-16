export type ProfileStatus = "heuristic" | "measured-draft" | "validated-draft" | "calibrated";

export type ObservationRelationship = "confirm" | "extend" | "narrow" | "replace";
export type ExecutionState = "not-applicable" | "unimplemented" | "diagnostic-only" | "implemented" | "native-equivalent";
export type RuleAction = "preserve" | "drop-declaration" | "drop-rule" | "drop-at-rule" | "remove-attribute" | "unwrap-element" | "remove-element" | "block-resource" | "disable-behavior" | "warn" | "transform-color";
export type RuleDomain = "css-property" | "css-function" | "css-value" | "css-selector" | "css-at-rule" | "html-element" | "html-attribute" | "image-format" | "color";

export interface RuleMatcher {
  property?: string;
  propertyPrefix?: string;
  function?: string;
  functionSuffix?: string;
  urlScheme?: string;
  atRule?: string;
  mediaFeature?: string;
  element?: string;
  location?: string;
  allowedAttribute?: string;
  allowedOperator?: string;
  colorRoles?: string;
  keyword?: string;
  declarationImportant?: boolean;
}

export interface ClientTarget {
  client: string;
  platform: string;
  appVersion: string;
  osVersion: string;
  device: string;
  accountType: string;
  capturedAt: string;
}

export interface CatalogObservation {
  featureId: string;
  client: string;
  platform: string;
  version: string;
  result: string;
  status: "supported" | "partial" | "unsupported" | "unknown";
  noteReferences: string[];
  executionState: ExecutionState;
}

export interface MeasuredObservation {
  id: string;
  featureId: string;
  catalogFeatureIds?: string[];
  domain: RuleDomain;
  matcher?: RuleMatcher;
  action: RuleAction;
  evidence: "measured" | "catalog" | "curated";
  relationship: ObservationRelationship;
  confidence: string;
  captureRunId?: string;
  fixture?: string;
}

export type EffectiveRule = MeasuredObservation;

export interface EffectiveCompatibilityProfile {
  schemaVersion: number;
  id: string;
  catalog: { commit: string; client: string; platform: string };
  target: ClientTarget;
  allowedCssProperties: string[];
  rules: EffectiveRule[];
}

export interface RuleApplication {
  ruleId: string;
  featureId: string;
  action: RuleAction;
  count: number;
  evidence: EffectiveRule["evidence"];
  confidence: string;
}

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
    baselineRadius?: number;
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
  compatibility: EffectiveCompatibilityProfile;
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
  target: ClientTarget;
  catalogCommit: string;
}
