export interface TextArtifact {
  filename: string;
  text: string;
  mimeType: string;
}

export function createTextArtifact(filename: string, text: string, mimeType: string): TextArtifact {
  return { filename, text, mimeType };
}

export function createDiagnosticsArtifact(payload: unknown): TextArtifact {
  return createTextArtifact("mailshade-diagnostics.json", JSON.stringify(payload, null, 2), "application/json");
}
