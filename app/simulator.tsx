"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { simulateEmail, type SimulationResult } from "./core/email-simulator";
import { CLIENTS, DEFAULT_CLIENT_ID } from "./core/clients/index.ts";
import { createDiagnosticsArtifact, createTextArtifact, type TextArtifact } from "./core/export-artifacts.ts";
import { DEFAULT_TEMPLATE, EMAIL_TEMPLATES, type TemplateId } from "./core/templates";

type ViewMode = "grid" | "focus";
type PreviewKey = "originalHtml" | "clientLightHtml" | "clientDarkHtml";

const VIEWPORTS = [
  { value: 320, label: "iPhone SE · 320" },
  { value: 390, label: "iPhone · 390" },
  { value: 430, label: "iPhone Max · 430" },
];

function downloadArtifact(artifact: TextArtifact) {
  const blob = new Blob([artifact.text], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function Simulator() {
  const [source, setSource] = useState(DEFAULT_TEMPLATE.html);
  const [clientId, setClientId] = useState(DEFAULT_CLIENT_ID);
  const [viewport, setViewport] = useState(390);
  const [remoteImages, setRemoteImages] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [focused, setFocused] = useState<PreviewKey>("clientDarkHtml");
  const [copied, setCopied] = useState<PreviewKey | null>(null);
  const iframeRefs = useRef<Partial<Record<PreviewKey, HTMLIFrameElement | null>>>({});
  const syncing = useRef(false);
  const client = CLIENTS.find((candidate) => candidate.id === clientId) ?? CLIENTS[0];
  const previews = useMemo<Array<{ key: PreviewKey; eyebrow: string; title: string; tone: string }>>(() => [
    { key: "originalHtml", eyebrow: "01 · SOURCE", title: "Original", tone: "neutral" },
    { key: "clientLightHtml", eyebrow: `02 · ${client.lightPassLabel}`, title: client.lightPreviewTitle, tone: "light" },
    { key: "clientDarkHtml", eyebrow: `03 · ${client.darkEyebrow}`, title: client.darkPreviewTitle, tone: "dark" },
  ], [client]);

  const isClient = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const result: SimulationResult | null = useMemo(
    () => isClient ? simulateEmail(source, { loadRemoteImages: remoteImages, clientId }) : null,
    [clientId, isClient, remoteImages, source],
  );

  const activePreviews = useMemo(
    () => viewMode === "grid" ? previews : previews.filter((preview) => preview.key === focused),
    [focused, previews, viewMode],
  );

  const selectTemplate = (id: TemplateId) => {
    const template = EMAIL_TEMPLATES.find((candidate) => candidate.id === id);
    if (template) setSource(template.html);
  };

  const syncFrames = (origin: PreviewKey) => {
    if (syncing.current) return;
    const sourceFrame = iframeRefs.current[origin];
    const sourceRoot = sourceFrame?.contentDocument?.scrollingElement;
    if (!sourceRoot) return;
    const max = sourceRoot.scrollHeight - sourceRoot.clientHeight;
    const ratio = max > 0 ? sourceRoot.scrollTop / max : 0;
    syncing.current = true;
    for (const preview of previews) {
      if (preview.key === origin) continue;
      const root = iframeRefs.current[preview.key]?.contentDocument?.scrollingElement;
      if (root) root.scrollTop = ratio * Math.max(0, root.scrollHeight - root.clientHeight);
    }
    window.setTimeout(() => { syncing.current = false; }, 20);
  };

  const attachScrollSync = (key: PreviewKey) => {
    const frame = iframeRefs.current[key];
    frame?.contentWindow?.addEventListener("scroll", () => syncFrames(key), { passive: true });
  };

  const copyHtml = async (key: PreviewKey) => {
    if (!result) return;
    await navigator.clipboard.writeText(result[key]);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1400);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Mailshade home">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>mailshade</span>
        </a>
        <div className={`profile-pill ${client.profileStatus === "validated-draft" || client.profileStatus === "calibrated" ? "verified" : "unverified"}`}><span className="status-dot" /> {client.profileLabel}</div>
        <a className="github-link" href="#method">Method notes <span>↓</span></a>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="kicker">EMAIL RENDERING LAB / 001</p>
          <h1>See what inboxes<br /><em>do in the dark.</em></h1>
        </div>
        <div className="hero-copy">
          <p>Paste production email HTML. Compare the source, the selected client’s compatibility pass, and a transparent device-measured dark-mode simulation.</p>
          <div className="hero-proof"><span>LOCAL-FIRST</span><span>NO UPLOADS</span><span>RULE EXPLAINED</span></div>
        </div>
      </section>

      <section className="workbench" aria-label="Email simulator workspace">
        <aside className="editor-panel">
          <div className="panel-heading">
            <div><span className="step-number">01</span><h2>Email HTML</h2></div>
            <span className="line-count">{source.split("\n").length} lines</span>
          </div>
          <label className="template-label" htmlFor="template">Test fixture</label>
          <select id="template" className="template-select" defaultValue={DEFAULT_TEMPLATE.id} onChange={(event) => selectTemplate(event.target.value as TemplateId)}>
            {EMAIL_TEMPLATES.map((template) => <option value={template.id} key={template.id}>{template.name} · {template.label}</option>)}
          </select>
          <textarea aria-label="Email HTML source" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} />
          <div className="editor-footer">
            <label className="switch-row">
              <input type="checkbox" checked={remoteImages} onChange={(event) => setRemoteImages(event.target.checked)} />
              <span className="switch" aria-hidden="true" />
              Load remote images
            </label>
            <span className="privacy-note">May contact third parties</span>
          </div>
        </aside>

        <section className="preview-panel">
          <div className="preview-toolbar">
            <div className="panel-heading compact"><div><span className="step-number">02</span><h2>Rendered previews</h2></div></div>
            <div className="toolbar-controls">
              <select aria-label="Email client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                {CLIENTS.map((option) => <option value={option.id} key={option.id}>{option.label} · {option.platform}</option>)}
              </select>
              <select aria-label="Preview viewport" value={viewport} onChange={(event) => setViewport(Number(event.target.value))}>
                {VIEWPORTS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
              <div className="segmented" aria-label="Preview layout">
                <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>Compare</button>
                <button className={viewMode === "focus" ? "active" : ""} onClick={() => setViewMode("focus")}>Focus</button>
              </div>
            </div>
          </div>

          {viewMode === "focus" && (
            <div className="focus-tabs" role="tablist">
              {previews.map((preview) => <button role="tab" aria-selected={focused === preview.key} className={focused === preview.key ? "active" : ""} key={preview.key} onClick={() => setFocused(preview.key)}>{preview.title}</button>)}
            </div>
          )}

          <div className="calibration-banner" role="status">
            <strong>Checked against {client.label} on {client.platform}.</strong>
            <span>The selected draft uses paired light/dark captures and passed its documented holdouts. Coverage is fixture- and build-specific.</span>
          </div>

          <div className={`preview-grid ${viewMode}`}>
            {activePreviews.map((preview) => (
              <article className={`preview-card ${preview.tone}`} key={preview.key}>
                <header>
                  <div><span>{preview.eyebrow}</span><h3>{preview.title}</h3></div>
                  <div className="card-actions">
                    <button onClick={() => copyHtml(preview.key)}>{copied === preview.key ? "Copied" : "Copy HTML"}</button>
                    <button aria-label={`Focus ${preview.title}`} onClick={() => { setFocused(preview.key); setViewMode("focus"); }}>↗</button>
                  </div>
                </header>
                <div className="device-stage">
                  {result ? (
                    <iframe
                      ref={(node) => { iframeRefs.current[preview.key] = node; }}
                      onLoad={() => attachScrollSync(preview.key)}
                      title={`${preview.title} email preview`}
                      sandbox="allow-same-origin"
                      srcDoc={result[preview.key]}
                      style={{ width: `${viewport}px` }}
                    />
                  ) : <div className="rendering">Rendering…</div>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {result && (
        <section className="analysis-section" id="method">
          <div className="analysis-intro">
            <p className="kicker">TRANSFORMATION REPORT</p>
            <h2>Every change,<br />accounted for.</h2>
            <p>The preview never modifies your source. Export the simulator artifact or inspect how the device-validated draft reached its result.</p>
            <div className="export-row">
              <button onClick={() => downloadArtifact(createTextArtifact(client.downloadFilename, result.clientDarkHtml, "text/html"))}>Download dark HTML</button>
              <button onClick={() => downloadArtifact(createDiagnosticsArtifact({ client: result.client, profile: result.profile, stats: result.stats, diagnostics: result.diagnostics }))}>Export diagnostics</button>
            </div>
          </div>
          <div className="metrics">
            <div><strong>{result.stats.transformedColors}</strong><span>colors transformed</span></div>
            <div><strong>{result.stats.preservedDarkColors}</strong><span>dark tokens preserved</span></div>
            <div><strong>{result.stats.gradients}</strong><span>gradients inspected</span></div>
            <div><strong>{result.stats.strippedDeclarations}</strong><span>CSS rules removed</span></div>
          </div>
          <div className="diagnostics-list">
            {result.diagnostics.map((item, index) => (
              <article key={`${item.title}-${index}`} className={item.level}>
                <span className="diag-icon">{item.level === "warning" ? "!" : "i"}</span>
                <div><h3>{item.title}</h3><p>{item.detail}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer><span>MAILSHADE / EXPERIMENTAL OSS</span><p>Built to turn client folklore into measurable rendering rules.</p><span>PROFILE v0.1</span></footer>
    </main>
  );
}
