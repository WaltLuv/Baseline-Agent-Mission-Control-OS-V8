/**
 * Search Chats — Campaign #90.
 *
 * Full-text search across every past conversation on disk:
 *   · ~/.claude/projects/**\/*.jsonl  (Claude Code sessions)
 *   · ~/.hermes/sessions/*.jsonl      (Hermes Agent sessions)
 *
 * Backed by /__search_chats (ripgrep if installed, JS scanner otherwise).
 * Click any session card to open a replay view of every message.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, MessageCircle, X, Loader2, ChevronDown, FileText } from "lucide-react";

export const Route = createFileRoute("/search-chats")({
  head: () => ({
    meta: [
      { title: "Search Chats — Baseline Automations" },
      { name: "description", content: "Search every past Claude + Hermes conversation on this machine." },
    ],
  }),
  component: SearchChatsPage,
});

interface Hit { lineNo: number; role: string; text: string; ts: string | null }
interface Session { source: "claude" | "hermes"; file: string; fileName: string; mtime: number; hits: Hit[] }

function SearchChatsPage() {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"" | "claude" | "hermes">("");
  const [results, setResults] = useState<{ sessions: Session[]; total: number; usedRg: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults(null); return; }
    setLoading(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const url = new URL("/__search_chats", window.location.origin);
      url.searchParams.set("q", query.trim());
      if (source) url.searchParams.set("source", source);
      const r = await fetch(url.toString(), { signal: ac.signal });
      const j = await r.json();
      setResults(j);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.warn("[search-chats]", e);
    } finally {
      setLoading(false);
    }
  }, [source]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => { if (q.trim()) void runSearch(q); else setResults(null); }, 300);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="px-5 py-4 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
        <div className="flex items-center gap-3 max-w-3xl">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.4)" }}>
            <Search size={15} style={{ color: "#60A5FA" }} />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="text-[13px] font-semibold">Search chats</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/65">every conversation on disk</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 max-w-3xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search every Claude + Hermes session…"
              className="w-full pl-9 pr-9 py-2 rounded-lg text-[13px] bg-black/30 border border-white/10 focus:outline-none focus:border-blue-400/50"
            />
            {q && (
              <button onClick={() => { setQ(""); setResults(null); }} className="absolute right-2 top-1.5 p-1 rounded hover:bg-white/5">
                <X size={12} />
              </button>
            )}
          </div>
          <select value={source} onChange={(e) => setSource(e.target.value as any)} className="px-2.5 py-2 rounded-lg text-[12px] bg-black/30 border border-white/10 focus:outline-none">
            <option value="">All sources</option>
            <option value="claude">Claude Code only</option>
            <option value="hermes">Hermes only</option>
          </select>
        </div>
        {results && (
          <div className="mt-2 text-[10.5px] text-muted-foreground/65 font-mono tabular-nums">
            {results.total} hit{results.total === 1 ? "" : "s"} in {results.sessions.length} session{results.sessions.length === 1 ? "" : "s"}
            {results.usedRg ? " · via ripgrep" : " · via JS scanner"}
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-2">
        {loading && <div className="flex items-center gap-2 opacity-65 text-[12px]"><Loader2 size={12} className="animate-spin" /> searching…</div>}
        {!loading && !results && (
          <div className="text-[12px] opacity-50 italic text-center py-12">Type a query above to search every Claude + Hermes conversation on disk.</div>
        )}
        {results && results.sessions.length === 0 && !loading && (
          <div className="text-[12px] opacity-65 italic text-center py-12">No matches.</div>
        )}
        {results && results.sessions.map((s) => (
          <SessionCard key={s.file} session={s} expanded={open === s.file} onToggle={() => setOpen(open === s.file ? null : s.file)} />
        ))}
      </div>
    </div>
  );
}

function SessionCard({ session, expanded, onToggle }: { session: Session; expanded: boolean; onToggle: () => void }) {
  const tone = session.source === "claude" ? "#D97757" : "#FFD21E";
  const label = session.source === "claude" ? "Claude Code" : "Hermes";
  return (
    <div className="rounded-xl border" style={{ background: "rgba(0,0,0,0.32)", borderColor: "rgba(255,255,255,0.08)" }}>
      <button type="button" onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3">
        <span className="px-1.5 py-0.5 rounded text-[9.5px] uppercase tracking-[0.18em] font-mono" style={{ background: `${tone}22`, color: tone, border: `1px solid ${tone}55` }}>{label}</span>
        <FileText size={11} className="opacity-50" />
        <span className="font-mono text-[11px] truncate">{session.fileName}</span>
        <span className="text-[10px] opacity-50 font-mono">{new Date(session.mtime).toLocaleString()}</span>
        <span className="ml-auto text-[10px] opacity-60 font-mono">{session.hits.length} hit{session.hits.length === 1 ? "" : "s"}</span>
        <ChevronDown size={12} className="opacity-50 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
      </button>
      <div className="px-4 pb-3 space-y-1.5">
        {session.hits.slice(0, expanded ? 3 : 1).map((h, i) => (
          <Snippet key={i} hit={h} />
        ))}
        {expanded && (
          <SessionViewer file={session.file} />
        )}
      </div>
    </div>
  );
}

function Snippet({ hit }: { hit: Hit }) {
  const roleColor = hit.role === "user" ? "#60A5FA" : hit.role === "assistant" ? "#10B981" : "rgba(255,255,255,0.45)";
  return (
    <div className="rounded-lg border p-2.5 bg-black/30 text-[11.5px] leading-relaxed" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] uppercase tracking-[0.18em] font-mono px-1.5 py-0.5 rounded" style={{ background: `${roleColor}22`, color: roleColor }}>{hit.role}</span>
        {hit.ts && <span className="text-[9.5px] opacity-50 font-mono">{hit.ts}</span>}
        <span className="text-[9.5px] opacity-40 font-mono ml-auto">line {hit.lineNo}</span>
      </div>
      <div className="font-sans" style={{ color: "rgba(255,255,255,0.85)" }}>{hit.text}</div>
    </div>
  );
}

function SessionViewer({ file }: { file: string }) {
  const [events, setEvents] = useState<any[] | null>(null);
  useEffect(() => {
    fetch(`/__chat_session?file=${encodeURIComponent(file)}&limit=300`)
      .then((r) => r.json())
      .then((j: { events: any[] }) => setEvents(j.events ?? []))
      .catch(() => setEvents([]));
  }, [file]);
  if (events === null) return <div className="opacity-60 text-[11px] pt-2">loading session…</div>;
  if (events.length === 0) return null;
  return (
    <details className="mt-1.5 rounded-lg border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <summary className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] cursor-pointer opacity-65 hover:opacity-100">
        <MessageCircle size={10} className="inline mr-1" /> Replay full session ({events.length} events)
      </summary>
      <div className="max-h-[400px] overflow-y-auto p-2 space-y-1.5 bg-black/30">
        {events.slice(-100).map((e, i) => {
          let role = "?", text = "";
          if (typeof e?.role === "string") role = e.role;
          else if (typeof e?.message?.role === "string") role = e.message.role;
          else if (typeof e?.type === "string") role = e.type;
          const content = e?.message?.content ?? e?.content ?? e?.text;
          if (typeof content === "string") text = content;
          else if (Array.isArray(content)) text = content.map((c: any) => c?.text ?? "").filter(Boolean).join(" ");
          else text = JSON.stringify(e).slice(0, 240);
          return (
            <div key={i} className="text-[11px] flex gap-2">
              <span className="font-mono text-[9.5px] opacity-50 w-16 shrink-0">{role}</span>
              <span className="flex-1 break-words" style={{ color: "rgba(255,255,255,0.8)" }}>{text.slice(0, 600)}{text.length > 600 ? "…" : ""}</span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
