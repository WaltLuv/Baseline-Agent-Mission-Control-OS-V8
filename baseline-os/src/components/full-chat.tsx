/**
 * FullChat — Universal reusable chat interface for every agent page.
 *
 * Features:
 *  - Persistent history via localStorage (max 50 messages)
 *  - Voice input (VoiceInput component)
 *  - File/image attachments (base64 inline thumbnails)
 *  - SSE streaming from /__ai_chat or /__hermes_chat
 *  - Auto-scroll, markdown-like rendering, copy buttons
 *  - Clear history, save chat to Obsidian vault
 *  - Typing indicator, auto-grow textarea, keyboard shortcuts
 *  - Error state with retry button
 *
 * Backwards-compatible: still accepts quickPrompt for agent pages that use it.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { AlertTriangle, Bot, Check, ChevronDown, Copy, Paperclip, RotateCcw, Save, Search, Send, Sparkles, Trash2, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VoiceInput } from "@/components/voice-input";
import { VoiceControls } from "@/components/voice-controls";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant";

/** A tool call surfaced by the agent backend (Claude --output-format stream-json). */
export interface ToolEvent {
  /** Unique tool_use_id from the LLM. */
  id: string;
  /** Tool name, e.g. "Write", "Bash", "Edit", "Read", "Glob", "WebFetch". */
  name?: string;
  /** Lifecycle: dispatcher emits `running` on content_block_start, `input-complete` on assistant message, `complete` / `error` on tool_result. */
  status: "running" | "input-complete" | "complete" | "error";
  /** Tool input (parsed once we get the input-complete event). */
  input?: unknown;
  /** Tool result text once the model receives it back (truncated to ~1.5KB by the dispatcher). */
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  model?: string;
  ts: number;
  attachments?: string[]; // base64 data URIs
  /** Inline tool calls (order matters — same order they fired). */
  tools?: ToolEvent[];
  /** End-of-turn metadata from the agent (cost, duration, turn count). */
  meta?: { durationMs?: number; totalCostUsd?: number; numTurns?: number };
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface FullChatProps {
  agent: string;
  agentName: string;
  agentColor: string;
  welcomeMessage: string;
  placeholder?: string;
  storageKey: string;
  /** If true, routes to /__hermes_chat SSE instead of /__ai_chat. */
  useHermesBackend?: boolean;
  /** When this prop changes to a non-empty string, fill the textarea and focus. */
  quickPrompt?: string;
  /** Optional status/info shown above the messages area. */
  systemInfo?: React.ReactNode;
  className?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadHistory(key: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Handle both old format {messages:[]} and new format []
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.messages)) {
      // Migrate old format: add missing id fields
      return parsed.messages.map((m: Omit<ChatMessage, "id">) => ({
        id: uid(),
        ...m,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

function saveHistory(key: string, messages: ChatMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded — silently skip.
  }
}

// ─── Session continuity (Phase 1) ────────────────────────────────────────────
// The dispatcher emits `data: {"sessionId":"..."}` once per stream — Hermes
// gives us a `session_id: 20260528_xxx` line; Claude stream-json carries
// `session_id` on every event. We persist it per (agent) so the next turn
// posts `{ sessionId }` in the body, the dispatcher passes `--resume <id>`,
// and the underlying CLI continues the same conversation thread.
function loadSession(key: string): string | null {
  try { return localStorage.getItem(`${key}.session`); } catch { return null; }
}
function saveSession(key: string, id: string): void {
  try { localStorage.setItem(`${key}.session`, id); } catch { /* skip */ }
}
function clearSession(key: string): void {
  try { localStorage.removeItem(`${key}.session`); } catch { /* skip */ }
}

/**
 * Minimal markdown-like rendering.
 * Supports: **bold**, `inline code`, and \n → <br>.
 */
function renderContent(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(...splitNewlines(text.slice(last, match.index), `pre-${match.index}`));
    }
    if (match[0].startsWith("**")) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={`c-${match.index}`}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs"
        >
          {match[3]}
        </code>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(...splitNewlines(text.slice(last), `tail`));
  }

  return <>{parts}</>;
}

function splitNewlines(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split("\n").flatMap((line, i, arr) =>
    i < arr.length - 1
      ? [line, <br key={`${keyPrefix}-br-${i}`} />]
      : [line],
  );
}

// ─── Typing indicator ────────────────────────────────────────────────────────

function TypingDots({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full animate-bounce"
          style={{
            backgroundColor: color,
            animationDelay: `${i * 0.15}s`,
            animationDuration: "0.8s",
          }}
        />
      ))}
    </span>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────────

// ─── SkillPicker — one-click /skill invocations (Phase 3) ────────────────
// Lists every skill returned by /__skills_shared (the 230-skill shared
// library: ~/.claude/skills/, ~/.hermes/skills/, ~/.claude/plugins/**/skills/,
// and the in-repo skills/ folder). Searchable, click-to-insert. Inserts
// `/<skill-name> ` at the start of the input (or after an existing leading
// slash command) so the user can immediately add args + send.
interface SkillEntry { name: string; desc?: string; cat?: string; }
function SkillPicker({
  color,
  onPick,
  onClose,
}: {
  color: string;
  onPick: (name: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [skills, setSkills] = useState<SkillEntry[] | null>(null);
  const [filter, setFilter] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/__skills_shared")
      .then((r) => r.json())
      .then((j: { skills?: SkillEntry[] }) => {
        if (cancelled) return;
        const list = (j.skills ?? []).filter((s) => s.name).sort((a, b) => a.name.localeCompare(b.name));
        setSkills(list);
      })
      .catch((e: unknown) => { if (!cancelled) setLoadError(String(e)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Click-outside + Esc closes
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const filtered = (skills ?? []).filter((s) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return s.name.toLowerCase().includes(q)
      || (s.desc?.toLowerCase().includes(q) ?? false)
      || (s.cat?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 mb-2 w-[420px] max-w-[calc(100vw-2rem)] z-40 rounded-xl border shadow-2xl"
      style={{ background: "rgba(7,29,28,0.98)", borderColor: `${color}55`, boxShadow: `0 20px 40px -10px ${color}44, 0 0 0 1px ${color}22` }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: `${color}22` }}>
        <Sparkles className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color }}>Skills</span>
        <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto">
          {skills === null ? "loading…" : `${filtered.length}/${skills.length}`}
        </span>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/5" aria-label="close">
          <X className="h-3 w-3 text-muted-foreground/60" />
        </button>
      </div>
      {/* Search */}
      <div className="px-3 pt-2.5 pb-1.5 relative">
        <Search className="absolute left-5 top-[14px] h-3 w-3 text-muted-foreground/50" />
        <input
          ref={searchRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search 230+ skills (name / category / description)…"
          className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[12px] bg-black/30 border border-white/10 focus:outline-none focus:border-white/25"
          style={{ color: "#e5e7eb" }}
        />
      </div>
      {/* List */}
      <div className="max-h-[280px] overflow-y-auto py-1">
        {loadError && (
          <div className="px-3 py-4 text-[11px] text-red-300">Failed to load skills: {loadError}</div>
        )}
        {skills === null && !loadError && (
          <div className="px-3 py-4 text-[11px] text-muted-foreground/60">Loading skill library…</div>
        )}
        {skills !== null && filtered.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-muted-foreground/60">No skills match "{filter}".</div>
        )}
        {filtered.slice(0, 200).map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => { onPick(s.name); onClose(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 transition-colors group flex items-center gap-2"
          >
            <span className="font-mono text-[12px]" style={{ color }}>/{s.name}</span>
            {s.cat && (
              <span className="text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded font-mono"
                style={{ background: `${color}15`, color: `${color}cc` }}>{s.cat}</span>
            )}
            {s.desc && (
              <span className="text-[11px] text-muted-foreground/55 truncate flex-1 ml-1">{s.desc}</span>
            )}
          </button>
        ))}
      </div>
      {/* Footer hint */}
      <div className="px-3 py-1.5 text-[9.5px] text-muted-foreground/50 border-t font-mono" style={{ borderColor: `${color}1f` }}>
        click to insert · Esc to close
      </div>
    </div>
  );
}

// ─── ToolChip — inline visualization of a tool the agent ran ──────────────
// Status lifecycle from the dispatcher: running → input-complete → complete/error
function ToolChip({ tool, color }: { tool: ToolEvent; color: string }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";
  const tone = isError ? "#fda4af" : isRunning ? color : "#7dd4b6";
  const inputPreview = (() => {
    if (!tool.input) return null;
    const s = typeof tool.input === "string" ? tool.input : JSON.stringify(tool.input);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  })();
  const hasDetail = !!(tool.input || tool.result);
  return (
    <div
      className="rounded-lg border text-[11px] font-mono leading-snug"
      style={{
        borderColor: `${tone}55`,
        background: `${tone}0d`,
        color: "rgba(243,235,218,0.85)",
      }}
    >
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((e) => !e)}
        disabled={!hasDetail}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
      >
        {isRunning ? (
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 rounded-full opacity-75 animate-ping" style={{ background: tone }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: tone }} />
          </span>
        ) : isError ? (
          <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: tone }} />
        ) : (
          <Check className="h-3 w-3 shrink-0" style={{ color: tone }} />
        )}
        <Wrench className="h-3 w-3 shrink-0 opacity-60" />
        <span className="font-semibold" style={{ color: tone }}>{tool.name ?? "tool"}</span>
        {inputPreview && !expanded && (
          <span className="truncate opacity-60">· {inputPreview}</span>
        )}
        {isRunning && <span className="ml-auto text-[9px] opacity-60">running…</span>}
        {tool.status === "complete" && <span className="ml-auto text-[9px] opacity-50">done</span>}
        {isError && <span className="ml-auto text-[9px] opacity-80" style={{ color: tone }}>error</span>}
        {hasDetail && (
          <ChevronDown
            className="h-3 w-3 shrink-0 opacity-50 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "none", marginLeft: isRunning || tool.status === "complete" || isError ? 6 : "auto" }}
          />
        )}
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 pt-1 space-y-1.5 border-t" style={{ borderColor: `${tone}33` }}>
          {tool.input !== undefined && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.15em] opacity-50 mb-0.5">input</div>
              <pre className="text-[10.5px] whitespace-pre-wrap break-words bg-black/30 rounded px-2 py-1 max-h-[180px] overflow-y-auto">
                {typeof tool.input === "string" ? tool.input : JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}
          {tool.result && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.15em] opacity-50 mb-0.5">{isError ? "error" : "result"}</div>
              <pre className="text-[10.5px] whitespace-pre-wrap break-words bg-black/30 rounded px-2 py-1 max-h-[220px] overflow-y-auto">
                {tool.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  agentColor: string;
  isStreaming?: boolean;
}

function MessageBubble({ message, agentColor, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [message.content]);

  return (
    <div
      className={cn(
        "group flex w-full gap-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${agentColor}22`, border: `1px solid ${agentColor}44` }}
        >
          <Bot className="h-3.5 w-3.5" style={{ color: agentColor }} />
        </div>
      )}

      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Attachments (user only) */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.attachments.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`attachment-${i}`}
                className="h-20 w-20 rounded-lg object-cover border border-white/10"
              />
            ))}
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-sm text-white"
              : "rounded-tl-sm bg-white/5 text-foreground border border-white/8",
          )}
          style={isUser ? { backgroundColor: `${agentColor}cc` } : {}}
        >
          {isStreaming && !message.content && (!message.tools || message.tools.length === 0) ? (
            <TypingDots color={agentColor} />
          ) : (
            <>
              {message.content && renderContent(message.content)}
              {!isUser && message.tools && message.tools.length > 0 && (
                <div className={cn("flex flex-col gap-1", message.content ? "mt-2" : "")}>
                  {message.tools.map((t) => (
                    <ToolChip key={t.id} tool={t} color={agentColor} />
                  ))}
                </div>
              )}
            </>
          )}
          {isStreaming && message.content && (
            <span className="ml-1 inline-block">
              <TypingDots color={agentColor} />
            </span>
          )}
        </div>
        {/* Meta footer (cost + duration) once turn completes */}
        {!isUser && !isStreaming && message.meta && (
          <div className="text-[9.5px] text-muted-foreground/50 px-1 font-mono">
            {message.meta.durationMs !== undefined && `${(message.meta.durationMs / 1000).toFixed(1)}s`}
            {message.meta.totalCostUsd !== undefined && ` · $${message.meta.totalCostUsd.toFixed(4)}`}
            {message.meta.numTurns !== undefined && ` · ${message.meta.numTurns} turn${message.meta.numTurns === 1 ? "" : "s"}`}
          </div>
        )}

        {/* Meta: model tag + copy */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-2 px-1">
            {message.model && (
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                {message.model}
              </span>
            )}
            <button
              onClick={handleCopy}
              title="Copy message"
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-all",
                "opacity-0 group-hover:opacity-100",
                copied
                  ? "text-emerald-400"
                  : "text-muted-foreground/50 hover:text-muted-foreground",
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        {/* Timestamp */}
        <span className="px-1 text-[10px] text-muted-foreground/40">
          {new Date(message.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="mx-4 my-2 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      <div className="flex-1 text-red-300">{message}</div>
      <button
        onClick={onRetry}
        className="shrink-0 rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FullChat({
  agent,
  agentName,
  agentColor,
  welcomeMessage,
  placeholder = "Message…",
  storageKey,
  useHermesBackend = false,
  quickPrompt,
  systemInfo,
  className,
}: FullChatProps) {
  // ── State ──
  // (used by VoiceControls autoplay — declared next to messages state below)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const history = loadHistory(storageKey);
    if (history.length === 0) {
      return [
        {
          id: uid(),
          role: "assistant",
          content: welcomeMessage,
          ts: Date.now(),
        },
      ];
    }
    return history;
  });

  const [input, setInput] = useState("");
  // Last assistant message text — used by VoiceControls autoplay so the
  // agent's reply gets read aloud when autoplay is enabled.
  const lastAssistantText = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && typeof m.content === "string" && m.content.trim()) return m.content;
    }
    return null;
  })();
  const [attachments, setAttachments] = useState<string[]>([]); // base64 data URIs
  const [streaming, setStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPayloadForRetry, setLastPayloadForRetry] = useState<ChatMessage[] | null>(null);
  // sessionId persists per-agent so multi-turn conversations resume the same
  // CLI session (hermes --resume, claude --resume). Cleared by "New conversation".
  const [sessionId, setSessionId] = useState<string | null>(() => loadSession(storageKey));
  const sessionIdRef = useRef<string | null>(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Phase 3 — skill picker open state + insert helper. The picker fetches
  // /__skills_shared on open and inserts `/<skill> ` at cursor position
  // (with a space) so the user can keep typing arguments after.
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const insertSkill = useCallback((name: string): void => {
    const slug = `/${name} `;
    const ta = textareaRef.current;
    if (!ta) { setInput((prev) => slug + prev); return; }
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    setInput((prev) => prev.slice(0, start) + slug + prev.slice(end));
    // Restore caret AFTER the inserted slug on the next paint
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (!t) return;
      const pos = start + slug.length;
      t.focus();
      t.setSelectionRange(pos, pos);
    });
  }, []);

  // ── Refs ──
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevQuickPrompt = useRef<string | undefined>(undefined);

  // ── quickPrompt compat: fill textarea on prop change ──
  useEffect(() => {
    if (quickPrompt && quickPrompt !== prevQuickPrompt.current) {
      prevQuickPrompt.current = quickPrompt;
      setInput(quickPrompt);
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.style.height = "auto";
          ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      }, 0);
    }
  }, [quickPrompt]);

  // ── Persist history (skip initial welcome-only state) ──
  useEffect(() => {
    if (messages.length > 1 || messages[0]?.role !== "assistant") {
      saveHistory(storageKey, messages);
    }
  }, [messages, storageKey]);

  // ── Auto-scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ── Auto-grow textarea ──
  const growTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight || "20", 10);
    const maxH = lineHeight * 8;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, []);

  useEffect(() => {
    growTextarea();
  }, [input, growTextarea]);

  // ── SSE streaming core ──
  const streamFromEndpoint = useCallback(
    async (endpoint: string, body: object, assistantMsgId: string) => {
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        // Fetch the per-request security token for protected endpoints
        // (/__hermes_chat requires X-Claude-OS-Token)
        let osToken: string | null = null;
        if (endpoint === "/__hermes_chat") {
          try {
            const t = await fetch("/__token", { signal: ac.signal });
            if (t.ok) osToken = ((await t.json()) as { token?: string }).token ?? null;
          } catch { /* ignore — endpoint will 403 and we'll surface the error */ }
        }

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(osToken ? { "X-Claude-OS-Token": osToken } : {}),
          },
          body: JSON.stringify(body),
          signal: ac.signal,
        });

        if (!resp.ok || !resp.body) {
          const text = await resp.text().catch(() => "Request failed");
          throw new Error(text);
        }

        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let eventName = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n");
          buf = parts.pop() ?? "";

          for (const raw of parts) {
            const line = raw.trimEnd();

            if (line === "") {
              eventName = "";
              continue;
            }

            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
              continue;
            }

            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();

            // ── Hermes SSE format: event: chunk|done|error ──
            if (useHermesBackend) {
              if (eventName === "chunk" || eventName === "") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + data }
                      : m,
                  ),
                );
              } else if (eventName === "done") {
                setStreaming(false);
                setStreamingId(null);
                return;
              } else if (eventName === "error") {
                throw new Error(data);
              }
              continue;
            }

            // ── /__ai_chat SSE format: data: JSON ──
            if (data === "[DONE]") {
              setStreaming(false);
              setStreamingId(null);
              return;
            }

            try {
              const j = JSON.parse(data);

              if (j.error) throw new Error(j.error);

              // ── sessionId event (Phase 1): persist for next turn's --resume ──
              if (j.sessionId && typeof j.sessionId === "string") {
                setSessionId(j.sessionId);
                saveSession(storageKey, j.sessionId);
                continue;
              }

              // ── tool event (Phase 2): merge into the streaming assistant message ──
              if (j.tool && typeof j.tool === "object") {
                const incoming: ToolEvent = j.tool;
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantMsgId) return m;
                    const tools = m.tools ? [...m.tools] : [];
                    const idx = tools.findIndex((t) => t.id === incoming.id);
                    if (idx >= 0) {
                      // Merge: status from new event wins, but keep name/input if not present in new event
                      tools[idx] = { ...tools[idx], ...incoming };
                    } else {
                      tools.push(incoming);
                    }
                    return { ...m, tools };
                  }),
                );
                continue;
              }

              // ── meta event (cost / duration / turns) ──
              if (j.meta && typeof j.meta === "object") {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, meta: j.meta } : m)),
                );
                continue;
              }

              if (j.done) {
                if (j.model) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, model: j.model } : m,
                    ),
                  );
                }
                setStreaming(false);
                setStreamingId(null);
                return;
              }

              if (j.delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + j.delta }
                      : m,
                  ),
                );
              }
            } catch (parseErr: unknown) {
              // Non-JSON chunk — treat as raw text delta
              if (data && !data.startsWith("{")) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + data }
                      : m,
                  ),
                );
              }
            }
          }
        }

        setStreaming(false);
        setStreamingId(null);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setStreaming(false);
        setStreamingId(null);
        const msg = err instanceof Error ? err.message : "Streaming failed";
        setError(msg);
        // Remove the empty assistant placeholder bubble
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
      }
    },
    [useHermesBackend],
  );

  // ── Core send logic (supports retry via overrideMessages) ──
  const sendMessage = useCallback(
    async (overrideMessages?: ChatMessage[]) => {
      const trimmed = input.trim();
      if (!trimmed && attachments.length === 0 && !overrideMessages) return;
      if (streaming) return;

      setError(null);

      let userMsg: ChatMessage;
      let conversationSoFar: ChatMessage[];

      if (overrideMessages) {
        // Retry: the last message in overrideMessages is the user message to resend
        userMsg = overrideMessages[overrideMessages.length - 1];
        conversationSoFar = overrideMessages;
      } else {
        userMsg = {
          id: uid(),
          role: "user",
          content: trimmed,
          ts: Date.now(),
          ...(attachments.length > 0 ? { attachments } : {}),
        };
        conversationSoFar = [...messages, userMsg];
        setMessages(conversationSoFar);
        setInput("");
        setAttachments([]);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }

      // Placeholder for the streaming assistant reply
      const assistantId = uid();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        ts: Date.now(),
      };

      setMessages((prev) => {
        const base = overrideMessages ? overrideMessages : prev;
        return [...base, assistantPlaceholder];
      });
      setStreaming(true);
      setStreamingId(assistantId);
      setLastPayloadForRetry(conversationSoFar);

      // Build API message list
      const apiMessages = conversationSoFar.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // All agents now route through /__agent_run — the universal agentic
      // engine that dispatches to native CLIs (hermes / codex / gemini /
      // notebooklm) or to `claude -p` with persona-injected system prompts
      // for everything else. Each backend can actually execute tools.
      // /__hermes_chat is kept for the legacy "useHermesBackend" path
      // (currently unused, but the option is preserved on the prop API).
      const endpoint = useHermesBackend ? "/__hermes_chat" : "/__agent_run";
      // Include the stored session id (if any) so the backend can --resume
      // and continue this conversation thread instead of starting fresh.
      const body = useHermesBackend
        ? { prompt: userMsg.content }
        : { agent, messages: apiMessages, ...(sessionIdRef.current ? { sessionId: sessionIdRef.current } : {}) };

      await streamFromEndpoint(endpoint, body, assistantId);
    },
    [
      input,
      attachments,
      streaming,
      messages,
      agent,
      useHermesBackend,
      streamFromEndpoint,
    ],
  );

  // ── Retry ──
  const handleRetry = useCallback(() => {
    if (!lastPayloadForRetry) return;
    setError(null);
    sendMessage(lastPayloadForRetry);
  }, [lastPayloadForRetry, sendMessage]);

  // ── Voice transcript ──
  const handleVoiceTranscript = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  }, []);

  // ── File attachment ──
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const readers = files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = reject;
          fr.readAsDataURL(file);
        }),
    );

    Promise.all(readers)
      .then((results) => setAttachments((prev) => [...prev, ...results]))
      .catch(() => toast.error("Failed to read file"));

    e.target.value = "";
  }, []);

  // ── Keyboard ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  // ── Clear history (full wipe — messages + session id) ──
  const handleClear = useCallback(() => {
    const welcome: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: welcomeMessage,
      ts: Date.now(),
    };
    setMessages([welcome]);
    localStorage.removeItem(storageKey);
    clearSession(storageKey);
    setSessionId(null);
    setError(null);
    toast.success("Chat history cleared");
  }, [welcomeMessage, storageKey]);

  // ── New conversation: keep history visible but start a fresh thread ──
  // Drops only the sessionId so the next message starts a new --resume
  // chain on the backend. Useful when the agent has gone off-track or you
  // want it to forget mid-stream context without losing the visible log.
  const handleNewConversation = useCallback(() => {
    clearSession(storageKey);
    setSessionId(null);
    toast.success("New conversation started — next message begins a fresh session");
  }, [storageKey]);

  // ── Save to Obsidian vault ──
  const handleSaveVault = useCallback(async () => {
    const lines = messages
      .map((m) => {
        const role = m.role === "user" ? "**You**" : `**${agentName}**`;
        return `${role}: ${m.content}`;
      })
      .join("\n\n---\n\n");

    const dateStr = new Date().toISOString().slice(0, 10);
    const content = `# Chat with ${agentName}\n*${dateStr}*\n\n${lines}\n`;

    try {
      const resp = await fetch("/__obsidian_write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relativePath: `Baseline Automations/Chats/chat-${dateStr}-${agent}.md`,
          content,
        }),
      });
      if (resp.ok) {
        toast.success("Chat saved to vault");
      } else {
        const j = await resp.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Failed to save");
      }
    } catch {
      toast.error("Could not reach sidecar");
    }
  }, [messages, agentName, agent]);

  // ── Stop streaming ──
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingId(null);
  }, []);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !streaming;

  // ── Render ──
  return (
    <div
      className={cn("flex flex-col flex-1 min-h-0 rounded-2xl border overflow-hidden", className)}
      style={{ borderColor: `${agentColor}44` }}
    >
      {/* ── Header ── */}
      <div
        className="flex shrink-0 items-center gap-3 px-4 py-2.5 border-b"
        style={{
          background: `linear-gradient(135deg, ${agentColor}14, transparent)`,
          borderColor: `${agentColor}28`,
        }}
      >
        {/* Status dot */}
        <span
          className="h-2 w-2 rounded-full shrink-0 animate-pulse"
          style={{ backgroundColor: agentColor }}
        />

        {/* Name */}
        <span
          className="text-[12px] font-semibold uppercase tracking-[0.18em] truncate"
          style={{ color: agentColor }}
        >
          {agentName}
        </span>

        {/* Live badge */}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-mono font-medium border"
          style={{
            color: agentColor,
            borderColor: `${agentColor}44`,
            backgroundColor: `${agentColor}11`,
          }}
        >
          live
        </span>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {systemInfo && <div className="mr-2">{systemInfo}</div>}

          {/* Voice — mic + voice picker + mute + autoplay (per-agent, ElevenLabs) */}
          <div className="mr-1">
            <VoiceControls
              agentId={agent}
              agentLabel={agentName}
              onTranscript={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
              lastReply={lastAssistantText}
              tone={agentColor}
            />
          </div>

          {/* Save to vault */}
          <button
            onClick={() => void handleSaveVault()}
            title="Save chat to Obsidian vault"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
          </button>

          {/* New conversation — drop sessionId only (keeps visible history) */}
          <button
            onClick={handleNewConversation}
            title={sessionId ? `New conversation (drop session ${sessionId.slice(0, 8)}…)` : "No active session"}
            disabled={!sessionId}
            className={cn(
              "flex h-7 items-center gap-1 rounded-lg px-1.5 transition-colors text-[10px] uppercase tracking-[0.18em]",
              sessionId
                ? "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                : "text-muted-foreground/25 cursor-not-allowed",
            )}
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden md:inline">new</span>
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            title="Clear chat history (and session)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 p-5"
        style={{ background: "rgba(0,0,0,0.20)" }}
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            agentColor={agentColor}
            isStreaming={msg.id === streamingId}
          />
        ))}

        {/* Pending attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {attachments.map((src, i) => (
              <div key={i} className="relative">
                <img
                  src={src}
                  alt={`pending-${i}`}
                  className="h-16 w-16 rounded-lg object-cover border border-white/20"
                />
                <button
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && <ErrorBanner message={error} onRetry={handleRetry} />}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input row ── */}
      <div
        className="flex items-stretch gap-2 p-3 border-t shrink-0"
        style={{ borderColor: `${agentColor}22`, background: "rgba(0,0,0,0.30)" }}
      >
        {/* Paperclip */}
        <button
          type="button"
          title="Attach file"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/8 transition-colors self-end"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,text/*,.pdf"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Skills picker — one-click /<skill-name> invocation */}
        <div className="relative self-end shrink-0">
          <button
            type="button"
            title="Insert a /skill from the shared library (230+)"
            onClick={() => setSkillPickerOpen((o) => !o)}
            disabled={streaming}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-white/8 transition-colors disabled:opacity-40"
            style={{ background: skillPickerOpen ? `${agentColor}22` : "transparent", color: skillPickerOpen ? agentColor : undefined }}
          >
            <Sparkles className="h-4 w-4" />
          </button>
          {skillPickerOpen && (
            <SkillPicker
              color={agentColor}
              onPick={insertSkill}
              onClose={() => setSkillPickerOpen(false)}
            />
          )}
        </div>

        {/* Voice */}
        <div className="flex items-end self-end pb-1 shrink-0">
          <VoiceInput
            onTranscript={handleVoiceTranscript}
            color={agentColor}
            disabled={streaming}
          />
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={streaming ? "Responding…" : placeholder}
          disabled={streaming}
          rows={1}
          className="flex-1 resize-none rounded-xl px-4 py-3 text-[13.5px] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${agentColor}33`,
            color: "#e5e7eb",
            lineHeight: "1.5",
            minHeight: 48,
            maxHeight: 200,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = agentColor)}
          onBlur={(e) => (e.currentTarget.style.borderColor = `${agentColor}33`)}
        />

        {/* Send / Stop */}
        {streaming ? (
          <button
            type="button"
            onClick={handleStop}
            title="Stop streaming"
            className="self-end flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
            style={{ backgroundColor: `${agentColor}33`, color: agentColor }}
          >
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: agentColor }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void sendMessage()}
            title="Send (Enter)"
            disabled={!canSend}
            className="self-end self-stretch px-5 rounded-xl font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 active:scale-95 text-[13px]"
            style={{
              background: canSend
                ? `linear-gradient(135deg, ${agentColor}, ${agentColor}bb)`
                : "transparent",
              color: canSend ? "#fff" : agentColor,
              border: canSend ? "none" : `1px solid ${agentColor}44`,
              boxShadow: canSend ? `0 4px 20px -6px ${agentColor}` : "none",
            }}
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        )}
      </div>
    </div>
  );
}
