/**
 * NotebookLM — bridge via the `notebooklm` CLI (notebooklm-py).
 *
 * Lets you query your real NotebookLM notebooks from the dashboard or any
 * agent. Routes through /__notebooklm_status, /__notebooklm_list, /__notebooklm_query.
 *
 * Replaces the "iframe to google.com" approach (which CSP blocks) with a real
 * CLI bridge that returns cited answers.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, RefreshCw, Send, AlertCircle, CheckCircle2, Copy, Sparkles } from "lucide-react";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";
import { AgentIdentityHeader } from "@/components/graphify-awareness";

export const Route = createFileRoute("/agents/notebooklm")({
  head: () => ({
    meta: [
      { title: "NotebookLM Bridge — Baseline Automations" },
      { name: "description", content: "Query your NotebookLM notebooks via notebooklm-py — works from every agent." },
    ],
  }),
  component: NotebookLMPage,
});

const TONE = "#A78BFA";

interface Notebook {
  id: string;
  title: string;
  source_count?: number;
}

interface Artifact {
  id: string;
  title: string;
  type: string;
  type_id: string;
  status: string;
  created_at: string;
}

function NotebookLMPage() {
  const [status, setStatus] = useState<{ ok: boolean; hasCli: boolean; setup?: string | null; stderr?: string; stdout?: string } | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [active, setActive] = useState<Notebook | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [view, setView] = useState<"chat" | "gallery">("gallery");

  // When the active notebook changes, fetch its artifacts.
  useEffect(() => {
    if (!active) { setArtifacts([]); return; }
    setArtifactsLoading(true);
    setArtifacts([]);
    fetch(`/__notebooklm_artifacts?notebook=${active.id}`)
      .then((r) => r.json())
      .then((j: { ok?: boolean; artifacts?: Artifact[] }) => {
        if (j.ok && Array.isArray(j.artifacts)) setArtifacts(j.artifacts);
      })
      .catch(() => { /* skip */ })
      .finally(() => setArtifactsLoading(false));
  }, [active?.id]);

  async function probe() {
    try {
      const r = await fetch("/__notebooklm_status");
      const j = await r.json();
      setStatus(j);
      if (j.ok || j.hasCli) {
        const l = await fetch("/__notebooklm_list");
        const lj = await l.json();
        const nbs = (lj.notebooks ?? []) as Notebook[];
        setNotebooks(Array.isArray(nbs) ? nbs : []);
      }
    } catch (e) { setStatus({ ok: false, hasCli: false, stderr: String(e) }); }
  }

  useEffect(() => { probe(); }, []);

  async function ask() {
    if (!active || !question.trim() || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      const r = await fetch("/__notebooklm_query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notebookId: active.id, question }),
      });
      const j = await r.json() as { ok?: boolean; answer?: string; error?: string };
      setAnswer(j.ok ? (j.answer ?? "(empty)") : `Error: ${j.error}`);
    } catch (e) { setAnswer(`Error: ${String(e)}`); }
    setAsking(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-4 pt-3 space-y-2">
        <AgentIdentityHeader name="NotebookLM" provider="Google · synthesis" context="notebooklm knowledge synthesis" />
        <RuntimeCredentialStatus
          providerIds={["notebooklm_agent", "google_oauth"]}
          variant="inline"
        />
      </div>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <BookOpen size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#e9d5ff" }}>NotebookLM Bridge</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            {status?.ok
              ? <>Connected · {notebooks.length} notebook{notebooks.length !== 1 ? "s" : ""}</>
              : status?.hasCli
                ? "CLI installed · not authenticated"
                : "notebooklm CLI not installed"}
          </div>
        </div>
        {status?.ok ? <CheckCircle2 size={14} style={{ color: "#10B981" }} /> : <AlertCircle size={14} style={{ color: "#fbbf24" }} />}
        <a href="https://notebooklm.google.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] transition" style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: "#e9d5ff" }}>
          <ExternalLink size={12} /> Open NotebookLM
        </a>
        <button onClick={probe} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}><RefreshCw size={11} /></button>
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Notebooks list */}
        <div className="flex flex-col overflow-hidden border-r" style={{ width: "min(320px, 30vw)", borderColor: "var(--panel-border)" }}>
          <div className="px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>My notebooks</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scroll">
            {notebooks.length === 0 && (
              <div className="px-3 py-8 text-center text-[11px]" style={{ color: "var(--fg-dimmer)" }}>
                {status?.ok ? "No notebooks yet" : "Authenticate the CLI first →"}
              </div>
            )}
            {notebooks.map((nb) => {
              const isActive = active?.id === nb.id;
              return (
                <button key={nb.id} onClick={() => setActive(nb)} className="w-full p-2 rounded-md text-left transition" style={{ background: isActive ? `${TONE}18` : "transparent", border: `1px solid ${isActive ? `${TONE}55` : "transparent"}`, color: isActive ? "#fff" : "var(--fg-dim)" }}>
                  <div className="text-[12px] truncate font-medium">{nb.title}</div>
                  <div className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{nb.source_count ?? "?"} sources · {nb.id.slice(0, 8)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Q&A */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!active && !status?.ok && (
            <div className="flex-1 overflow-y-auto p-6 scroll">
              <div className="panel p-5 space-y-3 max-w-2xl">
                <div className="flex items-center gap-2">
                  {status?.hasCli
                    ? <><CheckCircle2 size={14} style={{ color: "#10B981" }} /> <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>CLI installed — one step left</h3></>
                    : <><AlertCircle size={14} style={{ color: "#fbbf24" }} /> <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Setup</h3></>}
                </div>

                {status?.hasCli ? (
                  <>
                    <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
                      The <code style={{ color: TONE }}>notebooklm</code> CLI is installed (pipx + Chromium ready). Last step — authenticate by running this in your terminal. A Chromium window will open; sign in with your Google account.
                    </p>
                    <div className="flex items-center gap-2 p-3 rounded" style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${TONE}55` }}>
                      <code className="flex-1 text-[13px] font-mono" style={{ color: TONE }}>notebooklm login</code>
                      <button onClick={() => navigator.clipboard.writeText("notebooklm login")} className="p-2 rounded" style={{ background: `${TONE}12`, color: TONE }}><Copy size={11} /></button>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>
                      💡 Sign out of any other Google sessions in Chromium first to avoid conflicts.
                      Once you're done, click the refresh button in the header above and your notebooks will load.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
                      Bridge uses <code style={{ color: TONE }}>notebooklm-py</code> to talk to Google NotebookLM through your browser session (no public API exists). One-time setup:
                    </p>
                    <pre className="text-[11px] font-mono p-3 rounded whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.4)", color: TONE }}>{`# 1. Install (recommended: pipx for isolation)
brew install pipx
pipx install "notebooklm-py[browser]"

# 2. Install the Chromium browser Playwright needs
~/.local/pipx/venvs/notebooklm-py/bin/playwright install chromium

# 3. Authenticate (opens a browser)
notebooklm login

# 4. Verify
notebooklm list`}</pre>
                    <button onClick={() => navigator.clipboard.writeText(`brew install pipx\npipx install "notebooklm-py[browser]"\n~/.local/pipx/venvs/notebooklm-py/bin/playwright install chromium\nnotebooklm login\nnotebooklm list`)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded" style={{ background: `${TONE}12`, color: TONE, border: `1px solid ${TONE}33` }}>
                      <Copy size={10} /> Copy setup
                    </button>
                  </>
                )}

                {status?.stdout && /storage|authenticate/i.test(status.stdout) && (
                  <details>
                    <summary className="text-[10.5px] cursor-pointer" style={{ color: "var(--fg-dimmer)" }}>CLI auth check output</summary>
                    <pre className="text-[10px] mt-2 p-2 rounded max-h-[200px] overflow-y-auto" style={{ background: "rgba(0,0,0,0.4)", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono',monospace" }}>{status.stdout}</pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {active && (
            <>
              <header className="px-4 py-3 shrink-0 border-b flex items-center gap-3" style={{ borderColor: "var(--panel-border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: "#fff" }}>{active.title}</div>
                  <div className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{active.id} · {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}</div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
                  {(["gallery", "chat"] as const).map((v) => (
                    <button key={v} onClick={() => setView(v)} className="px-3 py-1 rounded text-[11px] uppercase tracking-widest transition" style={{ background: view === v ? `${TONE}22` : "transparent", color: view === v ? "#fff" : "var(--fg-dim)" }}>
                      {v}
                    </button>
                  ))}
                </div>
              </header>

              {view === "gallery" && (
                <div className="flex-1 overflow-y-auto p-6 scroll">
                  {artifactsLoading && <div className="text-[12px]" style={{ color: "var(--fg-dim)" }}>Loading artifacts…</div>}
                  {!artifactsLoading && artifacts.length === 0 && (
                    <div className="text-center py-12" style={{ color: "var(--fg-dimmer)" }}>
                      <Sparkles size={32} style={{ opacity: 0.25, margin: "0 auto 10px" }} />
                      <div className="text-[12px]">No artifacts generated yet in this notebook.</div>
                      <div className="text-[10.5px] mt-1">Generate audio overviews, videos, slide decks, infographics inside NotebookLM and refresh.</div>
                    </div>
                  )}
                  {!artifactsLoading && artifacts.length > 0 && (() => {
                    const groups: Record<string, Artifact[]> = {};
                    for (const a of artifacts) {
                      const g = a.type || "Other";
                      (groups[g] ??= []).push(a);
                    }
                    return (
                      <div className="space-y-5">
                        {Object.entries(groups).map(([type, items]) => (
                          <div key={type}>
                            <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: TONE }}>
                              {type} · <span style={{ color: "var(--fg-dimmer)" }}>{items.length}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {items.map((a) => (
                                <ArtifactCard key={a.id} artifact={a} notebook={active} tone={TONE} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {view === "chat" && (
                <>
                  <div className="flex-1 overflow-y-auto p-6 scroll">
                    {!answer && !asking && (
                      <div className="text-center py-12" style={{ color: "var(--fg-dimmer)" }}>
                        <Sparkles size={32} style={{ opacity: 0.25, margin: "0 auto 10px" }} />
                        <div className="text-[12px]">Ask anything — answers cite your notebook's sources.</div>
                      </div>
                    )}
                    {answer && (
                      <div className="max-w-3xl">
                        <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: TONE }}>Answer</div>
                        <pre className="text-[13px] leading-relaxed whitespace-pre-wrap p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)", color: "#fff", fontFamily: "Manrope, sans-serif" }}>{answer}</pre>
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 shrink-0">
                    <div className="max-w-3xl flex items-end gap-2 p-2 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="Ask the notebook…" rows={1} className="flex-1 bg-transparent outline-none text-[13.5px] py-2 px-2 resize-none" style={{ color: "#fff", maxHeight: 160 }} />
                      <button onClick={ask} disabled={!question.trim() || asking} className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition disabled:opacity-30" style={{ background: question.trim() ? TONE : "rgba(255,255,255,0.08)", color: question.trim() ? "#1f0b3a" : "rgba(255,255,255,0.5)" }}>
                        {asking ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Artifact card with real download ─────────────────────────────────────────

const TYPE_TO_CLI: Record<string, string> = {
  "Audio": "audio",
  "Video": "video",
  "Cinematic Video": "cinematic-video",
  "Slide Deck": "slide-deck",
  "Infographic": "infographic",
  "Mind Map": "mind-map",
  "Quiz": "quiz",
  "Flashcards": "flashcards",
  "Flashcard": "flashcards",
  "Data Table": "data-table",
  "Report": "report",
};

function ArtifactCard({ artifact, notebook, tone }: { artifact: Artifact; notebook: Notebook; tone: string }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState<{ ok: boolean; path?: string; sizeBytes?: number; error?: string } | null>(null);
  const downloadType = TYPE_TO_CLI[artifact.type];
  const downloadable = Boolean(downloadType);

  async function download() {
    if (!downloadable || downloading) return;
    setDownloading(true);
    setDownloaded(null);
    try {
      const r = await fetch("/__notebooklm_download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notebook: notebook.id, type: downloadType, name: artifact.title }),
      });
      const j = await r.json();
      setDownloaded(j);
    } catch (e) { setDownloaded({ ok: false, error: String(e) }); }
    setDownloading(false);
  }

  return (
    <div className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
      <div className="text-[12.5px] font-medium mb-1 line-clamp-2" style={{ color: "#fff" }}>{artifact.title}</div>
      <div className="text-[10px] flex items-center justify-between" style={{ color: "var(--fg-dimmer)" }}>
        <span>{artifact.status}</span>
        <span>{new Date(artifact.created_at).toLocaleDateString()}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {downloadable && (
          <button
            onClick={download}
            disabled={downloading}
            className="flex-1 text-[10px] px-2 py-1 rounded transition disabled:opacity-40"
            style={{ background: downloaded?.ok ? "rgba(16,185,129,0.18)" : `${tone}18`, color: downloaded?.ok ? "#10B981" : tone, border: `1px solid ${downloaded?.ok ? "rgba(16,185,129,0.4)" : `${tone}33`}` }}
            title="Download via notebooklm CLI to ~/.claude-os/notebooklm/"
          >
            {downloading ? "Downloading…" : downloaded?.ok ? "✓ Downloaded" : "↓ Download"}
          </button>
        )}
        <a
          href={`https://notebooklm.google.com/notebook/${notebook.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-[10px] px-2 py-1 rounded transition"
          style={{ background: "rgba(255,255,255,0.04)", color: "var(--fg-dim)", border: "1px solid var(--panel-border)" }}
        >
          <ExternalLink size={9} className="inline mr-1" /> Open in NLM
        </a>
      </div>
      {downloaded?.ok && downloaded.path && (
        <div className="mt-1.5 text-[9.5px] font-mono break-all" style={{ color: "var(--fg-dimmer)" }}>
          {downloaded.path.replace(/^\/Users\/[^/]+/, "~")}
          {downloaded.sizeBytes && <span style={{ color: tone }}> · {(downloaded.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>}
        </div>
      )}
      {downloaded && !downloaded.ok && downloaded.error && (
        <div className="mt-1.5 text-[9.5px]" style={{ color: "#fca5a5" }}>{String(downloaded.error).slice(0, 200)}</div>
      )}
    </div>
  );
}
