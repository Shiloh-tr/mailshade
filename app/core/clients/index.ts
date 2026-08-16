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
}));

export function getClientAdapter(id = DEFAULT_CLIENT_ID): ClientAdapter {
  const adapter = adapters.find((candidate) => candidate.id === id);
  if (!adapter) throw new Error(`Unknown email client adapter '${id}'.`);
  return adapter;
}

export type { ClientAdapter, ClientSummary, ColorAnchor, ColorTransformProfile, ProfileStatus } from "./types.ts";
