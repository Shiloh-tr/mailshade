import { gmailIosAdapter } from "./gmail-ios.ts";
import type { ClientAdapter, ClientSummary } from "./types.ts";

const adapters = [gmailIosAdapter] as const;

export const DEFAULT_CLIENT_ID = gmailIosAdapter.id;

export const CLIENTS: ClientSummary[] = adapters.map((adapter) => ({
  id: adapter.id,
  label: adapter.label,
  platform: adapter.platform,
  lightPreviewTitle: adapter.lightPreviewTitle,
  darkPreviewTitle: adapter.darkPreviewTitle,
  lightPassLabel: adapter.lightPassLabel,
  darkEyebrow: adapter.darkEyebrow,
  downloadFilename: adapter.downloadFilename,
  profileLabel: adapter.profile.label,
  profileStatus: adapter.profile.status,
  target: adapter.compatibility.target,
  catalogCommit: adapter.compatibility.catalog.commit,
}));

export function getClientAdapter(id = DEFAULT_CLIENT_ID): ClientAdapter {
  const adapter = adapters.find((candidate) => candidate.id === id);
  if (!adapter) throw new Error(`Unknown email client adapter '${id}'.`);
  return adapter;
}

export type { CatalogObservation, ClientAdapter, ClientSummary, ClientTarget, ColorAnchor, ColorTransformProfile, EffectiveCompatibilityProfile, EffectiveRule, ExecutionState, MeasuredObservation, ProfileStatus, RuleAction, RuleApplication } from "./types.ts";
