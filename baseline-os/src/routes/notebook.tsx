/**
 * Notebook — Google NotebookLM-style 3-pane workspace.
 *
 * Layout (matches notebooklm.google.com):
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  ▾ Notebook title           [Share]  [Settings]  [Avatar]           │ Top bar
 *   ├──────────────┬─────────────────────────────────┬──────────────────┤
 *   │   SOURCES    │              CHAT               │     STUDIO       │
 *   │              │                                 │                  │
 *   │  [+ Add]     │   AI summary card               │  Audio Overview  │
 *   │  [Discover]  │   Suggested-question chips      │  ━━━━━━━━━━━     │
 *   │              │   ...messages...                │  Video Overview  │
 *   │  ☑ Select    │                                 │                  │
 *   │  ☐ source1   │   ┌─────────────────────────┐   │  Mind Map        │
 *   │  ☑ source2   │   │  Ask anything…   [▶]    │   │  Reports         │
 *   │  ☑ source3   │   └─────────────────────────┘   │  Notes (+)       │
 *   └──────────────┴─────────────────────────────────┴──────────────────┘
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Plus,
  Search,
  Headphones,
  Film,
  FileText,
  ListTree,
  GraduationCap,
  CalendarClock,
  HelpCircle,
  Map,
  ChevronDown,
  ChevronRight,
  Globe,
  Youtube,
  FileType,
  Type,
  Trash2,
  Sparkles,
  Share2,
  Settings as SettingsIcon,
  X,
  Play,
  Pause,
  RefreshCw,
  CheckSquare,
  Square,
  Pin,
  PinOff,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { VoiceInput } from "@/components/voice-input";

export const Route = createFileRoute("/notebook")({
  head: () => ({
    meta: [
      { title: "NotebookLM — Baseline Automations" },
      { name: "description", content: "NotebookLM-style 3-pane: Sources · Chat · Studio." },
    ],
  }),
  component: NotebookPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceKind = "pdf" | "web" | "youtube" | "text" | "audio";

interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  url?: string;
  excerpt?: string;
  enabled: boolean;
  addedAt: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  citations?: number[]; // indices into the sources list at the time of generation
}

interface Note {
  id: string;
  kind: "note" | "study-guide" | "briefing" | "timeline" | "faq" | "mindmap";
  title: string;
  content: string;
  pinned?: boolean;
  ts: number;
}

interface Notebook {
  id: string;
  title: string;
  emoji: string;
  sources: Source[];
  messages: Message[];
  notes: Note[];
  audioOverview?: { status: "idle" | "scripting" | "synthesizing" | "ready" | "error"; script?: string; audioDataUrl?: string; error?: string };
  videoOverview?: { status: "idle" | "generating" | "ready"; outline?: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#A78BFA";     // NotebookLM lavender
const ACCENT_BG = `${ACCENT}15`;
const ACCENT_BORDER = `${ACCENT}40`;
const STORE_KEY = "claude-os.notebooklm.v2";

const KIND_ICON: Record<SourceKind, React.ReactNode> = {
  pdf:     <FileType size={14} />,
  web:     <Globe size={14} />,
  youtube: <Youtube size={14} />,
  text:    <Type size={14} />,
  audio:   <Headphones size={14} />,
};

const SUGGESTED_QUESTIONS = [
  "Give me a one-paragraph summary",
  "What are the three most important insights?",
  "Make a quick study guide",
  "Pull out every quote-worthy line",
];

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadStore(): Notebook[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Notebook[];
  } catch {
    return [];
  }
}

function saveStore(books: Notebook[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(books)); } catch { /* skip */ }
}

function newId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

// ─── Page ─────────────────────────────────────────────────────────────────────

function NotebookPage() {
  const [books, setBooks] = useState<Notebook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNotebookList, setShowNotebookList] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);

  // First-load: load from localStorage, seed a starter notebook if empty.
  useEffect(() => {
    const loaded = loadStore();
    if (loaded.length === 0) {
      const starter: Notebook = {
        id: newId("nb"),
        title: "Untitled Notebook",
        emoji: "📓",
        sources: [],
        messages: [],
        notes: [],
      };
      setBooks([starter]);
      setActiveId(starter.id);
      saveStore([starter]);
    } else {
      setBooks(loaded);
      setActiveId(loaded[0].id);
    }
  }, []);

  // Persist every change.
  useEffect(() => { if (books.length) saveStore(books); }, [books]);

  const active = useMemo(() => books.find((b) => b.id === activeId) ?? null, [books, activeId]);

  const updateActive = useCallback((mut: (nb: Notebook) => Notebook) => {
    setBooks((prev) => prev.map((b) => (b.id === activeId ? mut(b) : b)));
  }, [activeId]);

  function newNotebook() {
    const nb: Notebook = { id: newId("nb"), title: "Untitled Notebook", emoji: "📓", sources: [], messages: [], notes: [] };
    setBooks((p) => [nb, ...p]);
    setActiveId(nb.id);
    setShowNotebookList(false);
  }

  if (!active) {
    return <div className="p-8 text-[12px]" style={{ color: "var(--cream-mute)" }}>Loading…</div>;
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", background: "#0b0b0d", overflow: "hidden" }}>
      {/* Top bar */}
      <TopBar
        notebook={active}
        notebooks={books}
        onRename={(t) => updateActive((nb) => ({ ...nb, title: t }))}
        onSwitch={(id) => { setActiveId(id); setShowNotebookList(false); }}
        onNew={newNotebook}
        onDelete={() => {
          const remaining = books.filter((b) => b.id !== active.id);
          setBooks(remaining.length ? remaining : []);
          setActiveId(remaining[0]?.id ?? null);
        }}
        showList={showNotebookList}
        setShowList={setShowNotebookList}
      />

      {/* 3-pane body */}
      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        <SourcesPane
          notebook={active}
          onUpdate={updateActive}
          onAddClick={() => setShowAddSource(true)}
        />
        <ChatPane
          notebook={active}
          onUpdate={updateActive}
        />
        <StudioPane
          notebook={active}
          onUpdate={updateActive}
        />
      </div>

      {/* Add source modal */}
      {showAddSource && (
        <AddSourceModal
          onClose={() => setShowAddSource(false)}
          onAdd={(src) => {
            updateActive((nb) => ({ ...nb, sources: [...nb.sources, src] }));
            setShowAddSource(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({
  notebook, notebooks, onRename, onSwitch, onNew, onDelete, showList, setShowList,
}: {
  notebook: Notebook;
  notebooks: Notebook[];
  onRename: (t: string) => void;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
  showList: boolean;
  setShowList: (b: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notebook.title);

  useEffect(() => { setDraft(notebook.title); }, [notebook.title]);

  return (
    <header className="flex items-center justify-between px-4 h-12 shrink-0 border-b relative" style={{ background: "#111114", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2 relative">
        <button
          onClick={() => setShowList(!showList)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] transition hover:bg-white/5"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          <span className="text-lg leading-none">{notebook.emoji}</span>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { onRename(draft.trim() || "Untitled"); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="bg-transparent outline-none text-[13px]"
              style={{ color: "#fff", minWidth: 200 }}
            />
          ) : (
            <span className="font-medium" onDoubleClick={() => setEditing(true)}>{notebook.title}</span>
          )}
          <ChevronDown size={14} style={{ opacity: 0.55 }} />
        </button>

        {showList && (
          <div className="absolute top-full left-0 mt-1 w-[300px] rounded-lg shadow-lg z-30 overflow-hidden" style={{ background: "#1a1a1d", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="max-h-[60vh] overflow-y-auto">
              {notebooks.map((nb) => (
                <button
                  key={nb.id}
                  onClick={() => onSwitch(nb.id)}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 transition"
                  style={{ background: nb.id === notebook.id ? ACCENT_BG : "transparent" }}
                >
                  <span className="text-base">{nb.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] truncate" style={{ color: "#fff" }}>{nb.title}</div>
                    <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{nb.sources.length} sources</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <button onClick={onNew} className="w-full text-left px-3 py-2 flex items-center gap-2 text-[12.5px] transition hover:bg-white/5" style={{ color: ACCENT }}>
                <Plus size={13} /> New notebook
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <a
          href="https://notebooklm.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] transition hover:bg-white/5"
          style={{ color: ACCENT }}
          title="Google NotebookLM has no public API — open your real notebooks in a new tab"
        >
          <ExternalLink size={12} /> Open in Google NotebookLM
        </a>
        <button onClick={() => navigator.clipboard.writeText(JSON.stringify(notebook, null, 2))} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] transition hover:bg-white/5" style={{ color: "rgba(255,255,255,0.7)" }}>
          <Share2 size={12} /> Share
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-md transition hover:bg-white/5" style={{ color: "rgba(255,255,255,0.55)" }} title="Delete notebook">
          <Trash2 size={13} />
        </button>
        <button className="p-1.5 rounded-md transition hover:bg-white/5" style={{ color: "rgba(255,255,255,0.55)" }} title="Settings">
          <SettingsIcon size={13} />
        </button>
      </div>
    </header>
  );
}

// ─── Sources pane ─────────────────────────────────────────────────────────────

function SourcesPane({ notebook, onUpdate, onAddClick }: { notebook: Notebook; onUpdate: (m: (n: Notebook) => Notebook) => void; onAddClick: () => void }) {
  const allEnabled = notebook.sources.length > 0 && notebook.sources.every((s) => s.enabled);
  const someEnabled = notebook.sources.some((s) => s.enabled);

  return (
    <aside className="flex flex-col overflow-hidden" style={{ width: "320px", borderRight: "1px solid rgba(255,255,255,0.06)", background: "#0f0f12" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-[13px] font-semibold" style={{ color: "#fff" }}>Sources</span>
      </div>

      <div className="px-3 pb-3 grid grid-cols-2 gap-2 shrink-0">
        <button onClick={onAddClick} className="flex items-center justify-center gap-1.5 py-2 rounded-full text-[12px] font-medium transition" style={{ background: "#ffffff", color: "#0b0b0d" }}>
          <Plus size={13} /> Add
        </button>
        <button className="flex items-center justify-center gap-1.5 py-2 rounded-full text-[12px] transition" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Search size={12} /> Discover
        </button>
      </div>

      {notebook.sources.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 shrink-0">
          <button
            onClick={() => onUpdate((nb) => ({ ...nb, sources: nb.sources.map((s) => ({ ...s, enabled: !allEnabled })) }))}
            className="flex items-center gap-2 text-[11.5px] transition"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            {allEnabled ? <CheckSquare size={13} style={{ color: ACCENT }} /> : someEnabled ? <Square size={13} style={{ color: ACCENT, opacity: 0.5 }} /> : <Square size={13} />}
            Select all sources
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-2 scroll">
        {notebook.sources.length === 0 && (
          <div className="px-4 py-12 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
            <FileText size={32} style={{ opacity: 0.25, margin: "0 auto 12px" }} />
            <div className="text-[12.5px] mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Saved sources will appear here</div>
            <div className="text-[11px] leading-relaxed">Click <strong>Add</strong> to upload PDFs, websites, YouTube videos, or paste text.</div>
          </div>
        )}
        {notebook.sources.map((s) => (
          <div
            key={s.id}
            className="group flex items-start gap-2 px-2 py-2 rounded-md transition hover:bg-white/5"
          >
            <button
              onClick={() => onUpdate((nb) => ({ ...nb, sources: nb.sources.map((x) => x.id === s.id ? { ...x, enabled: !x.enabled } : x) }))}
              className="shrink-0 mt-0.5"
            >
              {s.enabled
                ? <CheckSquare size={14} style={{ color: ACCENT }} />
                : <Square size={14} style={{ color: "rgba(255,255,255,0.3)" }} />}
            </button>
            <span className="shrink-0 mt-0.5" style={{ color: s.enabled ? ACCENT : "rgba(255,255,255,0.5)" }}>{KIND_ICON[s.kind]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] truncate" style={{ color: s.enabled ? "#fff" : "rgba(255,255,255,0.6)" }}>{s.title}</div>
              {s.url && <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{s.url}</div>}
            </div>
            <button
              onClick={() => onUpdate((nb) => ({ ...nb, sources: nb.sources.filter((x) => x.id !== s.id) }))}
              className="opacity-0 group-hover:opacity-100 p-1 rounded transition"
              style={{ color: "rgba(255,255,255,0.5)" }}
              title="Remove source"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      <footer className="px-4 py-2.5 text-[10.5px] shrink-0 border-t" style={{ color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.06)" }}>
        {notebook.sources.filter((s) => s.enabled).length} of {notebook.sources.length} selected
      </footer>
    </aside>
  );
}

// ─── Chat pane ────────────────────────────────────────────────────────────────

function ChatPane({ notebook, onUpdate }: { notebook: Notebook; onUpdate: (m: (n: Notebook) => Notebook) => void }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const enabledSources = notebook.sources.filter((s) => s.enabled);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [notebook.messages.length]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    const userMsg: Message = { id: newId("m"), role: "user", content: q, ts: Date.now() };
    onUpdate((nb) => ({ ...nb, messages: [...nb.messages, userMsg] }));
    setInput("");
    setSending(true);

    const ctx = enabledSources.length
      ? `You are a NotebookLM-style research assistant. Use ONLY the following sources for the answer. Cite by [n] referencing source indexes (1-based).\n\nSOURCES:\n${enabledSources.map((s, i) => `[${i + 1}] ${s.title}${s.url ? ` (${s.url})` : ""}${s.excerpt ? `\n${s.excerpt}` : ""}`).join("\n\n")}`
      : "You are a NotebookLM-style research assistant. The user has not added any sources yet — answer in general but suggest they add sources for grounded answers.";

    const assistantId = newId("m");
    onUpdate((nb) => ({
      ...nb,
      messages: [...nb.messages, { id: assistantId, role: "assistant", content: "", ts: Date.now() }],
    }));

    try {
      const r = await fetch("/__ai_chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: "studio",
          messages: [{ role: "system", content: ctx }, { role: "user", content: q }],
        }),
      });
      if (!r.body) throw new Error("no body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let out = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as { type?: string; delta?: string };
            if (evt.type === "delta" && evt.delta) {
              out += evt.delta;
              onUpdate((nb) => ({
                ...nb,
                messages: nb.messages.map((m) => m.id === assistantId ? { ...m, content: out } : m),
              }));
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      onUpdate((nb) => ({
        ...nb,
        messages: nb.messages.map((m) => m.id === assistantId ? { ...m, content: `Error: ${String(e)}` } : m),
      }));
    }
    setSending(false);
  }

  return (
    <section className="flex-1 flex flex-col overflow-hidden" style={{ background: "#0b0b0d" }}>
      <div className="px-6 py-3 shrink-0 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <span className="text-[13px] font-semibold" style={{ color: "#fff" }}>Chat</span>
        <span className="text-[10.5px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          {enabledSources.length} source{enabledSources.length !== 1 ? "s" : ""} active
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll px-6 py-6">
        {notebook.messages.length === 0 && (
          <div className="max-w-[680px] mx-auto">
            <div className="text-center py-10">
              <div className="text-3xl mb-3">{notebook.emoji}</div>
              <h2 className="text-[20px] font-medium mb-2" style={{ color: "#fff" }}>{notebook.title}</h2>
              <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                {notebook.sources.length === 0
                  ? "Add sources to get started — PDFs, websites, YouTube videos, or pasted text."
                  : `Ready to dig into ${enabledSources.length} source${enabledSources.length !== 1 ? "s" : ""}. Ask anything below.`}
              </p>
            </div>

            <div className="mt-8">
              <div className="text-[10.5px] uppercase tracking-[0.18em] mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>Suggested questions</div>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={sending || enabledSources.length === 0}
                    className="text-left px-4 py-3 rounded-xl transition text-[12.5px] disabled:opacity-40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-[760px] mx-auto space-y-5">
          {notebook.messages.map((m) => (
            <div key={m.id} className="flex gap-3">
              {m.role === "assistant" && (
                <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-0.5" style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT }}>
                  <Sparkles size={12} />
                </div>
              )}
              <div className={m.role === "user" ? "ml-auto max-w-[80%]" : "flex-1"}>
                <div className="text-[10px] uppercase tracking-[0.16em] mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {m.role === "user" ? "You" : "Assistant"}
                </div>
                <div
                  className="text-[13.5px] leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: m.role === "user" ? "rgba(255,255,255,0.06)" : "transparent",
                    color: "rgba(255,255,255,0.92)",
                    padding: m.role === "user" ? "10px 14px" : "0",
                    borderRadius: m.role === "user" ? "14px" : 0,
                    border: m.role === "user" ? "1px solid rgba(255,255,255,0.08)" : "none",
                  }}
                >
                  {m.content || (m.role === "assistant" ? "…" : "")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="px-6 py-4 shrink-0">
        <div className="max-w-[760px] mx-auto">
          <div className="flex items-end gap-2 p-2 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <VoiceInput onTranscript={(t) => setInput((p) => `${p}${p ? " " : ""}${t}`)} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={enabledSources.length === 0 ? "Add sources first, then ask anything…" : "Ask anything…"}
              rows={1}
              className="flex-1 bg-transparent outline-none text-[13.5px] py-2 px-2 resize-none"
              style={{ color: "#fff", maxHeight: 160 }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || sending}
              className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition disabled:opacity-30"
              style={{ background: input.trim() ? ACCENT : "rgba(255,255,255,0.08)", color: input.trim() ? "#1a0b3a" : "rgba(255,255,255,0.5)" }}
            >
              {sending ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUp size={14} />}
            </button>
          </div>
          <div className="text-[10.5px] text-center mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            NotebookLM may produce inaccurate information. Verify with sources.
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Studio pane ──────────────────────────────────────────────────────────────

type StudioJob = "audio" | "video" | "mindmap" | "briefing" | "study-guide" | "timeline" | "faq";

function StudioPane({ notebook, onUpdate }: { notebook: Notebook; onUpdate: (m: (n: Notebook) => Notebook) => void }) {
  const [generating, setGenerating] = useState<StudioJob | null>(null);

  const enabledSources = notebook.sources.filter((s) => s.enabled);

  async function generate(job: StudioJob) {
    if (generating || enabledSources.length === 0) return;
    setGenerating(job);

    const ctx = `SOURCES:\n${enabledSources.map((s, i) => `[${i + 1}] ${s.title}${s.url ? ` (${s.url})` : ""}${s.excerpt ? `\n${s.excerpt}` : ""}`).join("\n\n")}`;

    const PROMPTS: Record<StudioJob, { instr: string; title: string; kind: Note["kind"] }> = {
      audio: {
        title: "Audio Overview",
        kind: "note",
        instr: `Write a 6-minute deep-dive podcast script for two hosts (Host A, Host B) covering everything important across these sources. Conversational, curious, with natural transitions. Mark each line with the speaker.\n\n${ctx}`,
      },
      video: {
        title: "Video Overview",
        kind: "note",
        instr: `Write a complete video overview script (3-5 minutes) for the sources. Include: opening hook (0-15s), 3-5 main beats with on-screen text suggestions and B-roll cues, ending CTA.\n\n${ctx}`,
      },
      mindmap: {
        title: "Mind Map",
        kind: "mindmap",
        instr: `Build a markdown mind map of the central themes and how they connect, using nested bullets up to 3 levels deep. Root is the overarching subject.\n\n${ctx}`,
      },
      briefing: {
        title: "Briefing Doc",
        kind: "briefing",
        instr: `Write a one-page briefing document for an executive. Sections: TL;DR (3 bullets), Background, Key Findings (numbered), Risks & Open Questions, Recommended Next Steps.\n\n${ctx}`,
      },
      "study-guide": {
        title: "Study Guide",
        kind: "study-guide",
        instr: `Write a study guide with: 10-question quiz (no answers shown), 10-question quiz answer key, 6 essay prompts, glossary of 12 key terms.\n\n${ctx}`,
      },
      timeline: {
        title: "Timeline",
        kind: "timeline",
        instr: `Construct a chronological timeline of all events, dates, and milestones in the sources. Markdown table with columns: Date | Event | Source #.\n\n${ctx}`,
      },
      faq: {
        title: "FAQ",
        kind: "faq",
        instr: `Generate a 12-question FAQ a curious reader would ask after reviewing the sources, with concise grounded answers. Q: / A: format.\n\n${ctx}`,
      },
    };

    const noteId = newId("note");
    onUpdate((nb) => ({
      ...nb,
      notes: [{ id: noteId, kind: PROMPTS[job].kind, title: PROMPTS[job].title, content: "Generating…", ts: Date.now() }, ...nb.notes],
    }));

    try {
      const r = await fetch("/__ai_chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: "studio", prompt: PROMPTS[job].instr }),
      });
      if (!r.body) throw new Error("no body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let out = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as { type?: string; delta?: string };
            if (evt.type === "delta" && evt.delta) {
              out += evt.delta;
              onUpdate((nb) => ({
                ...nb,
                notes: nb.notes.map((n) => n.id === noteId ? { ...n, content: out } : n),
              }));
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      onUpdate((nb) => ({
        ...nb,
        notes: nb.notes.map((n) => n.id === noteId ? { ...n, content: `Error: ${String(e)}` } : n),
      }));
    }
    setGenerating(null);
  }

  return (
    <aside className="flex flex-col overflow-hidden" style={{ width: "380px", borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0f0f12" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-[13px] font-semibold" style={{ color: "#fff" }}>Studio</span>
      </div>

      <div className="flex-1 overflow-y-auto scroll px-3 pb-4 space-y-3">
        {/* Audio Overview card — real ElevenLabs 2-host podcast */}
        <AudioOverviewCard
          notebook={notebook}
          onUpdate={onUpdate}
          enabledSources={enabledSources}
          disabled={generating !== null}
        />

        {/* Video Overview card */}
        <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1b3548, #0f2030)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Film size={13} style={{ color: "#60a5fa" }} />
              <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>Video Overview</span>
            </div>
            <h3 className="text-[14px] font-medium mb-3" style={{ color: "#fff" }}>Visual Brief</h3>
            <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
              Short scripted video walkthrough with on-screen text + B-roll cues.
            </p>
            <button
              onClick={() => generate("video")}
              disabled={enabledSources.length === 0 || generating !== null}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full text-[12.5px] font-medium transition disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.94)", color: "#0a1c2f" }}
            >
              {generating === "video" ? <><RefreshCw size={12} className="animate-spin" /> Generating…</> : <><Play size={11} /> Generate</>}
            </button>
          </div>
        </div>

        {/* Mind Map */}
        <button
          onClick={() => generate("mindmap")}
          disabled={enabledSources.length === 0 || generating !== null}
          className="w-full flex items-center gap-3 p-3 rounded-xl transition disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "#a78bfa22", color: ACCENT }}>
            {generating === "mindmap" ? <RefreshCw size={14} className="animate-spin" /> : <Map size={14} />}
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12.5px] font-medium" style={{ color: "#fff" }}>Mind Map</div>
            <div className="text-[10.5px]" style={{ color: "rgba(255,255,255,0.45)" }}>Visualize concept connections</div>
          </div>
        </button>

        {/* Notes section */}
        <div className="pt-2">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.5)" }}>Notes</span>
            <button
              onClick={() => {
                const note: Note = { id: newId("note"), kind: "note", title: "New note", content: "", ts: Date.now() };
                onUpdate((nb) => ({ ...nb, notes: [note, ...nb.notes] }));
              }}
              className="p-1 rounded transition hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.6)" }}
              title="Add note"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Quick action chips */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <StudioChip onClick={() => generate("study-guide")} disabled={enabledSources.length === 0 || generating !== null} loading={generating === "study-guide"} icon={<GraduationCap size={11} />} label="Study Guide" />
            <StudioChip onClick={() => generate("briefing")}    disabled={enabledSources.length === 0 || generating !== null} loading={generating === "briefing"}    icon={<FileText size={11} />}      label="Briefing" />
            <StudioChip onClick={() => generate("faq")}         disabled={enabledSources.length === 0 || generating !== null} loading={generating === "faq"}         icon={<HelpCircle size={11} />}    label="FAQ" />
            <StudioChip onClick={() => generate("timeline")}    disabled={enabledSources.length === 0 || generating !== null} loading={generating === "timeline"}    icon={<CalendarClock size={11} />} label="Timeline" />
          </div>

          <div className="space-y-2">
            {notebook.notes.length === 0 && (
              <div className="text-center py-6">
                <ListTree size={24} style={{ opacity: 0.2, margin: "0 auto 8px" }} />
                <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Saved notes will appear here.
                </div>
              </div>
            )}
            {notebook.notes.map((n) => <NoteCard key={n.id} note={n} onUpdate={onUpdate} />)}
          </div>
        </div>
      </div>
    </aside>
  );
}

function AudioOverviewCard({ notebook, onUpdate, enabledSources, disabled }: {
  notebook: Notebook;
  onUpdate: (m: (n: Notebook) => Notebook) => void;
  enabledSources: Source[];
  disabled: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState<boolean | null>(null);

  // Probe ElevenLabs availability once
  useEffect(() => {
    let cancel = false;
    fetch("/__env_status")
      .then((r) => r.json())
      .then((j: { keys: { name: string; present: boolean }[] }) => {
        if (cancel) return;
        setTtsAvailable(j.keys.some((k) => k.name === "ELEVENLABS_API_KEY" && k.present));
      })
      .catch(() => { if (!cancel) setTtsAvailable(false); });
    return () => { cancel = true; };
  }, []);

  const state = notebook.audioOverview?.status ?? "idle";
  const isLoading = state === "scripting" || state === "synthesizing";

  async function generate() {
    if (disabled || enabledSources.length === 0) return;

    onUpdate((nb) => ({ ...nb, audioOverview: { status: "scripting" } }));

    // Stage 1: AI writes 2-host dialogue script
    const ctx = `SOURCES:\n${enabledSources.map((s, i) => `[${i + 1}] ${s.title}${s.url ? ` (${s.url})` : ""}${s.excerpt ? `\n${s.excerpt}` : ""}`).join("\n\n")}`;
    const scriptPrompt = `Write a natural 4-minute deep-dive podcast for two hosts (Host A: warm, curious; Host B: sharp, analytical). They explore the most important ideas, surprises, and tensions across the sources. Light banter, but stay grounded.

FORMAT REQUIREMENTS:
- Every line MUST start with "Host A:" or "Host B:"
- Keep each turn 1-3 sentences (NotebookLM-style pacing)
- No stage directions, no [music], no parentheticals
- 25-35 turns total
- Open with Host A welcoming the listener; close with Host B's takeaway

${ctx}`;

    let scriptOut = "";
    try {
      const r = await fetch("/__ai_chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: "studio", prompt: scriptPrompt }),
      });
      if (!r.body) throw new Error("no chat body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as { type?: string; delta?: string };
            if (evt.type === "delta" && evt.delta) {
              scriptOut += evt.delta;
              onUpdate((nb) => ({ ...nb, audioOverview: { status: "scripting", script: scriptOut } }));
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      onUpdate((nb) => ({ ...nb, audioOverview: { status: "error", error: `Script failed: ${String(e)}` } }));
      return;
    }

    if (!scriptOut.trim()) {
      onUpdate((nb) => ({ ...nb, audioOverview: { status: "error", error: "Empty script returned" } }));
      return;
    }

    // Stage 2: ElevenLabs TTS
    onUpdate((nb) => ({ ...nb, audioOverview: { status: "synthesizing", script: scriptOut } }));

    try {
      const r = await fetch("/__tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ script: scriptOut }),
      });
      const j = await r.json() as { audio?: string; error?: string };
      if (!r.ok || !j.audio) {
        onUpdate((nb) => ({ ...nb, audioOverview: { status: "error", script: scriptOut, error: j.error || `TTS error ${r.status}` } }));
        return;
      }
      onUpdate((nb) => ({ ...nb, audioOverview: { status: "ready", script: scriptOut, audioDataUrl: j.audio } }));
    } catch (e) {
      onUpdate((nb) => ({ ...nb, audioOverview: { status: "error", script: scriptOut, error: String(e) } }));
    }
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); }
    else { el.pause(); setPlaying(false); }
  }

  const buttonLabel = (() => {
    if (state === "scripting")    return <><RefreshCw size={12} className="animate-spin" /> Writing script…</>;
    if (state === "synthesizing") return <><RefreshCw size={12} className="animate-spin" /> Synthesizing voice…</>;
    if (state === "ready")        return playing ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Play</>;
    if (state === "error")        return <><RefreshCw size={11} /> Retry</>;
    return <><Play size={11} /> Generate</>;
  })();

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #2a1b48, #1a0f30)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Headphones size={13} style={{ color: ACCENT }} />
            <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>Audio Overview</span>
          </div>
          {ttsAvailable === false && (
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5" }} title="ELEVENLABS_API_KEY missing">
              key missing
            </span>
          )}
          {ttsAvailable === true && (
            <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>11Labs · v2</span>
          )}
        </div>
        <h3 className="text-[14px] font-medium mb-3" style={{ color: "#fff" }}>Deep Dive</h3>
        <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
          Two AI hosts have a podcast-style conversation about your sources. Real ElevenLabs voices.
        </p>

        <button
          onClick={state === "ready" ? togglePlay : generate}
          disabled={(state !== "ready" && (enabledSources.length === 0 || disabled || isLoading)) || ttsAvailable === false}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full text-[12.5px] font-medium transition disabled:opacity-40"
          style={{ background: "#ffffff", color: "#1a0b3a" }}
        >
          {buttonLabel}
        </button>

        {state === "error" && notebook.audioOverview?.error && (
          <div className="mt-2 flex items-start gap-1.5 text-[10.5px] p-2 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>
            <AlertCircle size={10} className="shrink-0 mt-0.5" />
            <span className="break-all">{notebook.audioOverview.error}</span>
          </div>
        )}

        {state === "ready" && notebook.audioOverview?.audioDataUrl && (
          <audio
            ref={audioRef}
            src={notebook.audioOverview.audioDataUrl}
            onEnded={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="w-full mt-3"
            controls
            style={{ height: 32 }}
          />
        )}

        {notebook.audioOverview?.script && state !== "error" && (
          <details className="mt-3">
            <summary className="text-[10.5px] cursor-pointer" style={{ color: "rgba(255,255,255,0.5)" }}>View script</summary>
            <pre className="text-[10.5px] leading-relaxed mt-2 p-2 rounded whitespace-pre-wrap max-h-[200px] overflow-y-auto scroll" style={{ background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.75)", fontFamily: "Manrope, sans-serif" }}>
              {notebook.audioOverview.script}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function StudioChip({ onClick, disabled, loading, icon, label }: { onClick: () => void; disabled: boolean; loading: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-[11px] transition disabled:opacity-40"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
    >
      {loading ? <RefreshCw size={11} className="animate-spin" /> : icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function NoteCard({ note, onUpdate }: { note: Note; onUpdate: (m: (n: Notebook) => Notebook) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition hover:bg-white/5"
      >
        {expanded ? <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.5)" }} /> : <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.5)" }} />}
        <span className="flex-1 text-[12px] truncate" style={{ color: "#fff" }}>{note.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onUpdate((nb) => ({ ...nb, notes: nb.notes.map((x) => x.id === note.id ? { ...x, pinned: !x.pinned } : x) })); }}
          className="p-1 transition"
          style={{ color: note.pinned ? ACCENT : "rgba(255,255,255,0.35)" }}
          title={note.pinned ? "Unpin" : "Pin"}
        >
          {note.pinned ? <Pin size={10} /> : <PinOff size={10} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onUpdate((nb) => ({ ...nb, notes: nb.notes.filter((x) => x.id !== note.id) })); }}
          className="p-1 transition"
          style={{ color: "rgba(255,255,255,0.35)" }}
          title="Delete"
        >
          <Trash2 size={10} />
        </button>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1">
          <pre className="text-[11.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Manrope, sans-serif" }}>
            {note.content || "(empty)"}
          </pre>
          {note.content && (
            <button onClick={() => navigator.clipboard.writeText(note.content)} className="mt-2 text-[10px] underline" style={{ color: "rgba(255,255,255,0.5)" }}>
              Copy
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add source modal ─────────────────────────────────────────────────────────

function AddSourceModal({ onAdd, onClose }: { onAdd: (s: Source) => void; onClose: () => void }) {
  const [mode, setMode] = useState<SourceKind>("web");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");

  function submit() {
    const t = title.trim() || (url.trim() || "Untitled source");
    if (!t) return;
    onAdd({
      id: newId("src"),
      kind: mode,
      title: t,
      url: url.trim() || undefined,
      excerpt: excerpt.trim() || undefined,
      enabled: true,
      addedAt: Date.now(),
    });
  }

  const modes: { id: SourceKind; label: string; icon: React.ReactNode; help: string }[] = [
    { id: "web",     label: "Website", icon: <Globe size={14} />,    help: "Paste a URL." },
    { id: "youtube", label: "YouTube", icon: <Youtube size={14} />,  help: "YouTube video URL." },
    { id: "pdf",     label: "PDF",     icon: <FileType size={14} />, help: "Local path or URL." },
    { id: "text",    label: "Text",    icon: <Type size={14} />,     help: "Paste raw text below." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[min(560px,92vw)] rounded-2xl overflow-hidden" style={{ background: "#15151a", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <h3 className="text-[14px] font-medium" style={{ color: "#fff" }}>Add source</h3>
          <button onClick={onClose} className="p-1 rounded transition hover:bg-white/10" style={{ color: "rgba(255,255,255,0.5)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {modes.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-lg text-[11px] transition"
                  style={{
                    background: active ? ACCENT_BG : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? ACCENT_BORDER : "rgba(255,255,255,0.06)"}`,
                    color: active ? "#fff" : "rgba(255,255,255,0.7)",
                  }}
                >
                  <span style={{ color: active ? ACCENT : "rgba(255,255,255,0.5)" }}>{m.icon}</span>
                  {m.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>{modes.find((m) => m.id === mode)?.help}</p>

          {mode !== "text" && (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={mode === "youtube" ? "https://youtube.com/watch?v=…" : mode === "pdf" ? "/path/to/file.pdf or https://…" : "https://example.com/article"}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
            />
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />

          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={mode === "text" ? 8 : 3}
            placeholder={mode === "text" ? "Paste text here…" : "Excerpt or notes (optional, helps grounding)"}
            className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-y"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-full text-[12.5px] transition" style={{ background: "transparent", color: "rgba(255,255,255,0.7)" }}>Cancel</button>
          <button
            onClick={submit}
            disabled={mode !== "text" ? !url.trim() : !excerpt.trim()}
            className="px-4 py-2 rounded-full text-[12.5px] font-medium transition disabled:opacity-40"
            style={{ background: "#fff", color: "#0b0b0d" }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
