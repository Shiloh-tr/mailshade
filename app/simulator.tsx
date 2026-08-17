"use client";

import { type ChangeEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { simulateEmail, type SimulationResult } from "./core/email-simulator";
import { CLIENTS, DEFAULT_CLIENT_ID } from "./core/clients/index.ts";
import { createDiagnosticsArtifact, createTextArtifact, type TextArtifact } from "./core/export-artifacts.ts";
import { DEFAULT_TEMPLATE, EMAIL_TEMPLATES, type TemplateId } from "./core/templates";

type ViewMode = "grid" | "focus";
type PreviewKey = "originalPreviewHtml" | "clientLightHtml" | "clientDarkHtml";

const VIEWPORTS = [
  { value: 320, label: "320 px" },
  { value: 390, label: "390 px" },
  { value: 430, label: "430 px" },
];

const WORKFLOW = [
  { number: "01", title: "Import", heading: "Paste HTML, upload an .html file", copy: "Paste HTML, upload an .html file, or try a safe local example." },
  { number: "02", title: "Compare", heading: "Choose client, mode, and viewport", copy: "Measured and reference statuses stay explicit at every step." },
  { number: "03", title: "Inspect", heading: "Trace findings to source evidence", copy: "Review each transformation and its practical remediation." },
  { number: "04", title: "Report", heading: "Share evidence and recommended fixes", copy: "Export affected clients, evidence, and the next actions." },
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
  const [sourceLabel, setSourceLabel] = useState(`${DEFAULT_TEMPLATE.name} · local fixture`);
  const [clientId, setClientId] = useState(DEFAULT_CLIENT_ID);
  const [viewport, setViewport] = useState(390);
  const [remoteImages, setRemoteImages] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [focused, setFocused] = useState<PreviewKey>("clientDarkHtml");
  const [copied, setCopied] = useState<PreviewKey | null>(null);
  const iframeRefs = useRef<Partial<Record<PreviewKey, HTMLIFrameElement | null>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncing = useRef(false);
  const client = CLIENTS.find((candidate) => candidate.id === clientId) ?? CLIENTS[0];
  const previews = useMemo<Array<{ key: PreviewKey; eyebrow: string; title: string; tone: string }>>(() => [
    { key: "originalPreviewHtml", eyebrow: "SOURCE", title: "Original", tone: "neutral" },
    { key: "clientLightHtml", eyebrow: "MEASURED · LIGHT", title: client.lightPreviewTitle, tone: "light" },
    { key: "clientDarkHtml", eyebrow: "MEASURED · DARK", title: client.darkPreviewTitle, tone: "dark" },
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
    if (!template) return;
    setSource(template.html);
    setSourceLabel(`${template.name} · local fixture`);
  };

  const pasteHtml = async () => {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) return;
    setSource(text);
    setSourceLabel("Pasted HTML · local only");
  };

  const uploadHtml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".html") || file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      return;
    }
    setSource(await file.text());
    setSourceLabel(`${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB · local file`);
    event.target.value = "";
  };

  const syncFrames = (origin: PreviewKey) => {
    if (syncing.current) return;
    const sourceRoot = iframeRefs.current[origin]?.contentDocument?.scrollingElement;
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
    iframeRefs.current[key]?.contentWindow?.addEventListener("scroll", () => syncFrames(key), { passive: true });
  };

  const copyHtml = async (key: PreviewKey) => {
    if (!result) return;
    await navigator.clipboard.writeText(result[key]);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1_400);
  };

  return (
    <main className="app-shell">
      <header className="site-nav">
        <a className="brand" href="#top" aria-label="Unbreakmail home">Unbreakmail</a>
        <nav aria-label="Primary navigation">
          <a href="#workflow">How it works</a>
          <a href="#coverage">Coverage</a>
          <a href="#compatibility">Compatibility</a>
        </nav>
        <a className="button button-highlight button-small" href="#test">Test my HTML →</a>
      </header>

      <section className="landing-hero" id="top">
        <p className="eyebrow">LOCAL-FIRST EMAIL QA</p>
        <h1>Find what breaks<br />before you send.</h1>
        <p className="hero-description">Paste or upload an email. Compare measured previews, inspect compatibility evidence, and leave with a report your team can act on.</p>
        <a className="button button-primary" href="#test">Test my email HTML →</a>
        <p className="privacy-proof">Local only — your HTML isn’t uploaded</p>
      </section>

      <section className="landing-content" aria-label="Product overview">
        <article className="product-proof">
          <p className="eyebrow">MEASURED PREVIEW</p>
          <h2>Gmail iOS · Dark mode · 390px</h2>
          <p>Executable adapter • generated locally</p>
          <div className="proof-canvas">
            <h3>Your campaign headline</h3>
            <p>This focused preview is paired with diagnostics and cited compatibility evidence.</p>
          </div>
        </article>

        <section className="workflow-section" id="workflow">
          <h2>One clear path from HTML to evidence.</h2>
          <div className="workflow-grid">
            {WORKFLOW.map((step, index) => (
              <article className={index === 1 ? "featured" : ""} key={step.number}>
                <p className="step-label">{step.number} · {step.title}</p>
                <h3>{step.heading}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="coverage-card" id="coverage">
          <div>
            <h2>Coverage without the hand-waving.</h2>
            <p className="coverage-status measured">Measured preview</p>
            <p>Gmail iOS has an executable local adapter.</p>
            <p className="coverage-status reference">Reference evidence</p>
            <p>308 features across 21 clients and 48 combinations.</p>
          </div>
          <dl className="client-list" id="compatibility">
            <div><dt>Gmail iOS</dt><dd>Measured</dd></div>
            <div><dt>Apple Mail</dt><dd>Reference</dd></div>
            <div><dt>Outlook Windows</dt><dd>Reference</dd></div>
            <div><dt>Yahoo Mail</dt><dd>Reference</dd></div>
            <div><dt>Samsung Email</dt><dd>Reference</dd></div>
          </dl>
        </section>

        <section className="landing-cta">
          <h2>Email QA should explain itself.</h2>
          <p>Bring your HTML. Keep it local. Get measured previews and cited evidence.</p>
          <a className="button button-highlight" href="#test">Start testing →</a>
        </section>
      </section>

      <section className="workspace" id="test" aria-label="Email simulator workspace">
        <header className="section-heading">
          <p className="eyebrow">01 / IMPORT</p>
          <h2>Bring your email HTML</h2>
          <p>Paste your complete email below. Previews update automatically.</p>
        </header>

        <div className="entry-actions">
          <button className="button button-primary" type="button" onClick={pasteHtml}>Paste HTML</button>
          <button className="button button-secondary" type="button" onClick={() => fileInputRef.current?.click()}>Upload .html</button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept=".html,text/html" onChange={uploadHtml} />
          <span>{sourceLabel}</span>
        </div>

        <div className="workbench">
          <aside className="editor-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">YOUR EMAIL HTML</p><span>{source.split("\n").length} lines</span></div>
            </div>
            <textarea aria-label="Email HTML source" value={source} onChange={(event) => { setSource(event.target.value); setSourceLabel("Edited HTML · local only"); }} spellCheck={false} />
            <div className="editor-footer">
              <label className="switch-row">
                <input type="checkbox" checked={remoteImages} onChange={(event) => setRemoteImages(event.target.checked)} />
                <span className="switch" aria-hidden="true" />
                Load remote images
              </label>
              <span>May contact third parties</span>
            </div>
          </aside>

          <aside className="example-panel">
            <h3>Try an example</h3>
            <p>See how the workflow behaves with a safe local fixture.</p>
            {EMAIL_TEMPLATES.map((template) => (
              <button className="example-button" type="button" key={template.id} onClick={() => selectTemplate(template.id)}>{template.name}</button>
            ))}
          </aside>
        </div>

        <section className="compare-section" aria-labelledby="compare-heading">
          <header className="section-heading compact-heading">
            <p className="eyebrow">02 / COMPARE</p>
            <h2 id="compare-heading">Rendered previews</h2>
          </header>
          <div className="comparison-controls">
            <label><span>Client</span><select aria-label="Email client" value={clientId} onChange={(event) => setClientId(event.target.value)}>{CLIENTS.map((option) => <option value={option.id} key={option.id}>{option.label} · {option.platform}</option>)}</select></label>
            <label><span>Viewport</span><select aria-label="Preview viewport" value={viewport} onChange={(event) => setViewport(Number(event.target.value))}>{VIEWPORTS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
            <div><span>Mode</span><div className="segmented" aria-label="Preview layout"><button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>Compare</button><button className={viewMode === "focus" ? "active" : ""} onClick={() => setViewMode("focus")}>Focus</button></div></div>
            <div className="rendering-status"><span>Rendering</span><strong>{client.profileStatus === "calibrated" || client.profileStatus === "validated-draft" ? "Measured" : "Reference"}</strong></div>
          </div>

          {viewMode === "focus" && <div className="focus-tabs" role="tablist">{previews.map((preview) => <button role="tab" aria-selected={focused === preview.key} className={focused === preview.key ? "active" : ""} key={preview.key} onClick={() => setFocused(preview.key)}>{preview.title}</button>)}</div>}

          <div className="calibration-banner" role="status"><strong>{client.profileLabel} · Profile-based {client.label} on {client.platform} preview.</strong><span>This evidence-based approximation is not a claim that the message exactly matches the device; it is tied to the adapter’s documented fixture holdouts.</span></div>
          <div className={`preview-grid ${viewMode}`}>
            {activePreviews.map((preview) => (
              <article className={`preview-card ${preview.tone}`} key={preview.key}>
                <header>
                  <div><span>{preview.eyebrow}</span><h3>{preview.title}</h3></div>
                  <div className="card-actions"><button onClick={() => copyHtml(preview.key)}>{copied === preview.key ? "Copied" : "Copy HTML"}</button><button aria-label={`Focus ${preview.title}`} onClick={() => { setFocused(preview.key); setViewMode("focus"); }}>↗</button></div>
                </header>
                <div className="device-stage">
                  {result ? <iframe ref={(node) => { iframeRefs.current[preview.key] = node; }} onLoad={() => attachScrollSync(preview.key)} title={`${preview.title} email preview`} sandbox="allow-same-origin" srcDoc={result[preview.key]} style={{ width: `${viewport}px` }} /> : <div className="rendering">Rendering…</div>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {result && (
        <section className="report-section" id="report">
          <header className="section-heading report-heading"><p className="eyebrow">03 / INSPECT · 04 / REPORT</p><h2>Every change, accounted for.</h2><p>The preview never modifies your source. Export the simulator artifact or inspect how the measured draft reached its result.</p></header>
          <div className="report-grid">
            <div className="metrics">
              <div><strong>{result.stats.transformedColors}</strong><span>colors transformed</span></div>
              <div><strong>{result.stats.preservedDarkColors}</strong><span>dark tokens preserved</span></div>
              <div><strong>{result.stats.gradients}</strong><span>gradients inspected</span></div>
              <div><strong>{result.stats.strippedDeclarations}</strong><span>CSS rules removed</span></div>
            </div>
            <div className="diagnostics-list">
              <h3>{result.diagnostics.length} findings</h3>
              {result.diagnostics.map((item, index) => <article key={`${item.title}-${index}`} className={item.level}><span>{item.level === "warning" ? "WARNING" : "INFO"}</span><h4>{item.title}</h4><p>{item.detail}</p></article>)}
            </div>
          </div>
          <div className="export-row"><button className="button button-highlight" onClick={() => downloadArtifact(createTextArtifact(client.downloadFilename, result.clientDarkHtml, "text/html"))}>Download dark HTML</button><button className="button button-inverse" onClick={() => downloadArtifact(createDiagnosticsArtifact({ client: result.client, profile: result.profile, stats: result.stats, diagnostics: result.diagnostics }))}>Export diagnostics</button></div>
        </section>
      )}

      <footer><strong>Unbreakmail</strong><p>Local-first email QA, powered by the Mailshade rendering engine.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
