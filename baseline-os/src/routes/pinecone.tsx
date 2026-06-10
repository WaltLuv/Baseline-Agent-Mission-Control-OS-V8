/**
 * Pinecone — long-term vector memory.
 *
 * Backed by /__pinecone_status, /__pinecone_query, /__pinecone_upsert.
 * Auto-embeds via Pinecone's Inference API (multilingual-e5-large by default).
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Search, RefreshCw, Save, Trash2, AlertCircle, CheckCircle2, Sparkles, Copy } from "lucide-react";

export const Route = createFileRoute("/pinecone")({
  head: () => ({
    meta: [
      { title: "Pinecone — Baseline Automations" },
      { name: "description", content: "Long-term vector memory — semantic search and store across every agent." },
    ],
  }),
  component: PineconePage,
});

const TONE = "#22D3EE";

interface PineconeStatus {
  ok: boolean;
  indexHost?: string;
  indexName?: string;
  dim?: number;
  totalVectors?: number;
  namespaces?: Record<string, { vectorCount: number }>;
  error?: string;
}

interface Match {
  id: string;
  score: number;
  metadata?: { text?: string; timestamp?: number; source?: string; [k: string]: unknown };
}

function PineconePage() {
  const [status, setStatus] = useState<PineconeStatus | null>(null);
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [storeText, setStoreText] = useState("");
  const [storeTags, setStoreTags] = useState("");
  const [storing, setStoring] = useState(false);
  const [storeResult, setStoreResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function loadStatus() {
    try {
      const r = await fetch("/__pinecone_status");
      const j = await r.json() as PineconeStatus;
      setStatus(j);
    } catch (e) { setStatus({ ok: false, error: String(e) }); }
  }

  useEffect(() => { loadStatus(); }, []);

  async function search() {
    if (!query.trim() || searching) return;
    setSearching(true);
    try {
      const r = await fetch("/__pinecone_query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: query, topK }),
      });
      const j = await r.json() as { matches?: Match[] };
      setMatches(j.matches ?? []);
    } catch { setMatches([]); }
    setSearching(false);
  }

  async function store() {
    if (!storeText.trim() || storing) return;
    setStoring(true);
    setStoreResult(null);
    try {
      const r = await fetch("/__pinecone_upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: storeText,
          metadata: storeTags.trim() ? { tags: storeTags.split(",").map((t) => t.trim()).filter(Boolean) } : undefined,
        }),
      });
      const j = await r.json() as { ok?: boolean; id?: string; error?: string };
      if (r.ok && j.ok) {
        setStoreResult({ ok: true, msg: `Saved → ${j.id}` });
        setStoreText("");
        setStoreTags("");
        loadStatus();
      } else {
        setStoreResult({ ok: false, msg: j.error ?? `Error ${r.status}` });
      }
    } catch (e) { setStoreResult({ ok: false, msg: String(e) }); }
    setStoring(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Database size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#cffafe" }}>Pinecone · Long-term Memory</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            {status?.ok
              ? <>{status.indexName} · {status.totalVectors ?? 0} vectors · dim {status.dim}</>
              : "Not configured · set PINECONE_API_KEY + PINECONE_INDEX_HOST in .env.local"}
          </div>
        </div>
        {status?.ok ? <CheckCircle2 size={14} style={{ color: "#10B981" }} /> : <AlertCircle size={14} style={{ color: "#fbbf24" }} />}
        <button onClick={loadStatus} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}><RefreshCw size={11} /></button>
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Search */}
        <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: "var(--panel-border)" }}>
          <div className="p-4 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
                <Search size={13} style={{ color: "var(--fg-dimmer)" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Semantic search — by meaning, not keyword" className="flex-1 bg-transparent outline-none text-[13px]" style={{ color: "#fff" }} disabled={!status?.ok} />
              </div>
              <input type="number" min={1} max={50} value={topK} onChange={(e) => setTopK(Number(e.target.value) || 5)} className="w-16 px-2 py-2 rounded-lg text-[12px] outline-none" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }} title="topK" />
              <button onClick={search} disabled={!query.trim() || searching || !status?.ok} className="px-4 py-2 rounded-lg text-[12px] font-semibold transition disabled:opacity-40" style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}>
                {searching ? "…" : "Search"}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scroll">
            {matches.length === 0 && !searching && (
              <div className="text-center py-16" style={{ color: "var(--fg-dimmer)" }}>
                <Database size={36} style={{ opacity: 0.25, margin: "0 auto 12px" }} />
                <div className="text-[13px] mb-1" style={{ color: "var(--fg)" }}>No matches yet</div>
                <div className="text-[11px]">Search by meaning above, or store a new memory →</div>
              </div>
            )}
            <div className="space-y-3 max-w-3xl">
              {matches.map((m) => (
                <div key={m.id} className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
                  <div className="flex items-center gap-2 text-[10px] mb-2">
                    <span className="font-mono" style={{ color: TONE }}>{m.id}</span>
                    <span className="ml-auto px-1.5 py-0.5 rounded font-mono" style={{ background: `${TONE}18`, color: TONE }}>{m.score.toFixed(3)}</span>
                  </div>
                  <div className="text-[12.5px] whitespace-pre-wrap leading-relaxed" style={{ color: "#fff" }}>{m.metadata?.text ?? "(no text)"}</div>
                  {m.metadata?.timestamp && <div className="text-[9.5px] mt-2" style={{ color: "var(--fg-dimmer)" }}>{new Date((m.metadata.timestamp as number) * 1000).toLocaleString()}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Store */}
        <aside className="flex flex-col overflow-y-auto p-4 space-y-3 scroll" style={{ width: "min(400px, 38vw)" }}>
          <div className="panel p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Save size={13} style={{ color: TONE }} />
              <h3 className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Store a memory</h3>
            </div>
            <textarea value={storeText} onChange={(e) => setStoreText(e.target.value)} rows={6} placeholder="A fact, decision, preference, lesson — anything you want every agent to remember forever." className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-y" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }} disabled={!status?.ok} />
            <input value={storeTags} onChange={(e) => setStoreTags(e.target.value)} placeholder="Tags (comma-separated)" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }} disabled={!status?.ok} />
            <button onClick={store} disabled={!storeText.trim() || storing || !status?.ok} className="w-full py-2 rounded-full text-[12.5px] font-semibold transition disabled:opacity-40" style={{ background: TONE, color: "#031e26" }}>
              {storing ? "Saving…" : "Save memory"}
            </button>
            {storeResult && (
              <div className="flex items-start gap-1.5 text-[11px] p-2 rounded" style={{ background: storeResult.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${storeResult.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`, color: storeResult.ok ? "#86efac" : "#fca5a5" }}>
                {storeResult.ok ? <CheckCircle2 size={11} className="shrink-0 mt-0.5" /> : <AlertCircle size={11} className="shrink-0 mt-0.5" />}
                <span className="break-all">{storeResult.msg}</span>
              </div>
            )}
          </div>

          <div className="panel p-4 space-y-2 text-[11.5px]" style={{ background: "rgba(0,0,0,0.25)", color: "var(--cream-dim)" }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Available to every agent</h3>
            <p>Every agent in this OS — Gemini, OpenClaw, Hermes, ClaudeClaw, Codex, Gemma 4, Studio, SEO — has access to <code style={{ color: TONE }}>/__pinecone_query</code> and <code style={{ color: TONE }}>/__pinecone_upsert</code>. They will search this memory before answering recall-style questions.</p>
            <p>Embedding model: <code style={{ color: TONE }}>multilingual-e5-large</code> (1024 dim).</p>
          </div>

          {!status?.ok && (
            <div className="panel p-4 space-y-2" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <h3 className="text-[10px] uppercase tracking-widest" style={{ color: "#fde68a" }}>Setup</h3>
              <pre className="text-[10.5px] font-mono whitespace-pre-wrap p-2 rounded" style={{ background: "rgba(0,0,0,0.4)", color: TONE }}>{`# .env.local
PINECONE_API_KEY=pcsk_…
PINECONE_INDEX_HOST=your-index-abc123.svc.us-east-1.pinecone.io
PINECONE_INDEX_NAME=claude-os
PINECONE_EMBED_MODEL=multilingual-e5-large`}</pre>
              <a href="https://app.pinecone.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px]" style={{ color: TONE }}>
                <Sparkles size={11} /> Create an index at app.pinecone.io
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
