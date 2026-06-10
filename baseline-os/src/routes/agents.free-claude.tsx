/**
 * Coding Agent — the OS's dedicated free Claude-Code-CLI surface.
 *
 * Route stays `/agents/free-claude` (URL unchanged to preserve external links
 * and other route-references); the displayed name is now "Coding Agent".
 *
 * Two backends live on this page:
 *   · Chat tab → local Gemma 4 via Ollama on :11434 ($0/forever, fully offline)
 *   · Terminal tab → fcc-server proxy on :8082 (Claude Code CLI surface,
 *     routed through OpenRouter — free models + frontier models on demand)
 */

import { createFileRoute } from "@tanstack/react-router";
import { AgentIdentityHeader } from "@/components/graphify-awareness";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cpu,
  Sparkles,
  RefreshCw,
  Send,
  Lock,
  Wifi,
  CircleDollarSign,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Copy,
  Terminal,
  RotateCcw,
  Play,
  Power,
} from "lucide-react";
import { AgentFactory } from "@/components/agent-factory";

export const Route = createFileRoute("/agents/free-claude")({
  head: () => ({
    meta: [
      { title: "Coding Agent — Baseline Automations" },
      {
        name: "description",
        content:
          "Coding Agent — local Gemma 4 + fcc-server Claude Code CLI. $0/month, 100% private, frontier-class.",
      },
    ],
  }),
  component: BaselineCodingAgentPage,
});

const TONE = "#10B981"; // emerald — "free + local"

const MODEL_PRESETS = [
  { id: "gemma4:e2b", label: "e2b · 7.2 GB", ram: "4 GB", desc: "Phones / low-spec" },
  { id: "gemma4:e4b", label: "e4b · 9.6 GB", ram: "8 GB", desc: "Laptops · default" },
  { id: "gemma4:26b", label: "26b · 18 GB", ram: "14 GB", desc: "Workstations" },
  { id: "gemma4:31b", label: "31b · 20 GB", ram: "19 GB", desc: "Flagship (recommended)" },
];

interface Status {
  ok: boolean;
  host?: string;
  default?: string;
  error?: string;
  hint?: string;
  models?: { name: string; sizeMB: number; modified: string }[];
}

interface FccStatus {
  live: boolean;
  port: number;
  model: string | null;
  adminUrl: string;
}

interface OpenCodeStatus {
  installed: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
}

function BaselineCodingAgentPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [fccStatus, setFccStatus] = useState<FccStatus | null>(null);
  const [opencodeStatus, setOpencodeStatus] = useState<OpenCodeStatus | null>(null);
  const [model, setModel] = useState<string>("gemma4:31b");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<
    "chat" | "factory" | "terminal" | "opencode" | "ant" | "setup" | "models"
  >("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadStatus() {
    try {
      const r = await fetch("/__ollama_status");
      const j = (await r.json()) as Status;
      setStatus(j);
      if (j.default) setModel(j.default);
    } catch (e) {
      setStatus({ ok: false, error: String(e) });
    }
    try {
      const r = await fetch("/__fcc_status");
      const j = (await r.json()) as FccStatus;
      setFccStatus(j);
    } catch {
      /* skip */
    }
    try {
      const r = await fetch("/__opencode_status");
      const j = (await r.json()) as OpenCodeStatus;
      setOpencodeStatus(j);
    } catch {
      /* skip */
    }
  }

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 10_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!input.trim() || sending) return;
    const userMsg = { role: "user" as const, content: input };
    setMessages((m) => [...m, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    try {
      const r = await fetch("/__ollama_chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, messages: [...messages, userMsg] }),
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
              setMessages((m) =>
                m.map((msg, i) => (i === m.length - 1 ? { ...msg, content: out } : msg)),
              );
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch (e) {
      setMessages((m) =>
        m.map((msg, i) => (i === m.length - 1 ? { ...msg, content: `Error: ${String(e)}` } : msg)),
      );
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-4 pt-3"><AgentIdentityHeader name="Coding Agent" provider="Free Claude · runtime" context="coding agent execution" /></div>
      <header
        className="flex items-center gap-3 px-4 py-0 shrink-0 border-b"
        style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}
      >
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center my-2"
          style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}
        >
          <Cpu size={14} />
        </div>
        <div className="mr-1">
          <span className="text-[13px] font-bold" style={{ color: "#dcfce7" }}>
            Coding Agent
          </span>
          <span
            className="ml-1 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ background: `${TONE}15`, color: TONE, border: `1px solid ${TONE}40` }}
          >
            $0/forever
          </span>
        </div>

        {(["chat", "factory", "terminal", "opencode", "ant", "models", "setup"] as const).map(
          (t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-3 text-[12px] font-semibold border-b-2 transition-colors capitalize"
                style={{
                  borderBottomColor: active ? TONE : "transparent",
                  color: active ? "#dcfce7" : "rgba(255,255,255,0.45)",
                }}
              >
                {t}
              </button>
            );
          },
        )}

        <div className="ml-auto my-2 flex items-center gap-2">
          {status?.ok && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
              style={{ background: "#10B98118", borderColor: "#10B98155", color: "#10B981" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: "#10B981" }}
              />
              OLLAMA
            </span>
          )}
          {status && !status.ok && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
              style={{
                background: "rgba(239,68,68,0.10)",
                borderColor: "rgba(239,68,68,0.35)",
                color: "#f87171",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#ef4444" }} />
              OLLAMA
            </span>
          )}
          {fccStatus?.live && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
              style={{ background: "#10B98118", borderColor: "#10B98155", color: "#10B981" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: "#10B981" }}
              />
              FCC :{fccStatus.port}
            </span>
          )}
          {fccStatus && !fccStatus.live && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
              style={{
                background: "rgba(239,68,68,0.10)",
                borderColor: "rgba(239,68,68,0.35)",
                color: "#f87171",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#ef4444" }} />
              FCC
            </span>
          )}
          {opencodeStatus?.installed && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
              style={{ background: "#10B98118", borderColor: "#10B98155", color: "#10B981" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: "#10B981" }}
              />
              OPENCODE
            </span>
          )}
          {opencodeStatus && !opencodeStatus.installed && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
              style={{
                background: "rgba(239,68,68,0.10)",
                borderColor: "rgba(239,68,68,0.35)",
                color: "#f87171",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#ef4444" }} />
              OPENCODE
            </span>
          )}
          <button
            onClick={loadStatus}
            className="p-1.5 rounded-md transition"
            style={{
              background: "rgba(243,235,218,0.04)",
              border: "1px solid var(--panel-border)",
              color: "var(--fg-dim)",
            }}
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </header>

      {tab === "chat" && (
        <>
          <div
            className="flex items-center gap-2 px-4 py-2 shrink-0 border-b"
            style={{ borderColor: "var(--panel-border)", background: "rgba(0,0,0,0.15)" }}
          >
            <span
              className="text-[10.5px] uppercase tracking-widest"
              style={{ color: "var(--fg-dimmer)" }}
            >
              Model
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-[12px] px-2 py-1 rounded outline-none font-mono"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid var(--panel-border)",
                color: TONE,
              }}
            >
              {[
                ...new Set([
                  ...(status?.models?.map((m) => m.name) ?? []),
                  ...MODEL_PRESETS.map((p) => p.id),
                ]),
              ].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-[10.5px]" style={{ color: "var(--fg-dimmer)" }}>
              {status?.models?.find((m) => m.name === model) ? (
                `installed · ${status.models.find((m) => m.name === model)!.sizeMB} MB`
              ) : (
                <>
                  not installed · <code style={{ color: TONE }}>ollama pull {model}</code>
                </>
              )}
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 scroll">
            {messages.length === 0 && (
              <div className="text-center py-16" style={{ color: "var(--fg-dimmer)" }}>
                <Cpu size={40} style={{ opacity: 0.25, margin: "0 auto 12px" }} />
                <div className="text-[14px] font-medium mb-1" style={{ color: "#fff" }}>
                  Coding Agent — same surface, $0 cost
                </div>
                <div className="text-[12px] max-w-md mx-auto leading-relaxed mb-4">
                  Local Gemma 4 via Ollama on <code style={{ color: TONE }}>127.0.0.1:11434</code>.
                  No API calls, no rate limits, no internet required. Switch to the Terminal tab to
                  use the fcc-server Claude Code surface.
                </div>
                {!status?.ok && (
                  <div
                    className="inline-flex items-start gap-2 text-[11px] p-3 rounded-lg max-w-md text-left"
                    style={{
                      background: "rgba(251,191,36,0.08)",
                      border: "1px solid rgba(251,191,36,0.25)",
                      color: "#fde68a",
                    }}
                  >
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold mb-1">Ollama not detected</div>
                      <div className="opacity-80">
                        {status?.hint ?? "Open the Ollama app or run `ollama serve`."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-5 max-w-3xl mx-auto">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                  <div className="max-w-[80%]">
                    <div
                      className="text-[10px] uppercase tracking-[0.16em] mb-1"
                      style={{ color: m.role === "user" ? "var(--fg-dimmer)" : TONE }}
                    >
                      {m.role === "user" ? "You" : "Gemma 4"}
                    </div>
                    <div
                      className="text-[13.5px] leading-relaxed whitespace-pre-wrap"
                      style={{
                        background: m.role === "user" ? "rgba(255,255,255,0.06)" : "transparent",
                        padding: m.role === "user" ? "10px 14px" : "0",
                        borderRadius: m.role === "user" ? "14px" : 0,
                        border: m.role === "user" ? "1px solid rgba(255,255,255,0.08)" : "none",
                        color: "rgba(255,255,255,0.92)",
                      }}
                    >
                      {m.content || (m.role === "assistant" ? "…" : "")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-4 shrink-0">
            <div
              className="max-w-3xl mx-auto flex items-end gap-2 p-2 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  status?.ok ? `Chat with ${model} locally…` : "Start Ollama to enable chat…"
                }
                rows={1}
                className="flex-1 bg-transparent outline-none text-[13.5px] py-2 px-2 resize-none"
                style={{ color: "#fff", maxHeight: 160 }}
                disabled={!status?.ok}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending || !status?.ok}
                className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition disabled:opacity-30"
                style={{
                  background: input.trim() && status?.ok ? TONE : "rgba(255,255,255,0.08)",
                  color: input.trim() && status?.ok ? "#022c1c" : "rgba(255,255,255,0.5)",
                }}
              >
                {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "factory" && (
        <div className="px-4 py-4">
          <AgentFactory model={model} />
        </div>
      )}
      {tab === "terminal" && <TerminalTab fccStatus={fccStatus} onRefresh={loadStatus} />}
      {tab === "opencode" && <OpenCodeTab status={opencodeStatus} onRefresh={loadStatus} />}
      {tab === "ant" && (
        <div className="flex-1 overflow-y-auto p-5">
          <ClaudeAnt />
        </div>
      )}
      {tab === "models" && <ModelsTab status={status} />}
      {tab === "setup" && <SetupTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TerminalTab — mirror of AntigravityTerminal but for fcc-server. Stream a
// Claude-Code-CLI-like surface through /__fcc_chat (which proxies to the
// local fcc-server on :8082 → free models via OpenRouter).
// ─────────────────────────────────────────────────────────────────────────────
interface Turn {
  id: string;
  prompt: string;
  output: string;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt: number | null;
}
const TERMINAL_STORAGE_KEY = "claude-os.terminal.free-claude.v1";
function loadTerminalHistory(): Turn[] {
  try {
    const raw = localStorage.getItem(TERMINAL_STORAGE_KEY);
    return raw ? JSON.parse(raw).slice(-50) : [];
  } catch {
    return [];
  }
}
function saveTerminalHistory(t: Turn[]): void {
  try {
    localStorage.setItem(TERMINAL_STORAGE_KEY, JSON.stringify(t.slice(-50)));
  } catch {
    /* skip */
  }
}
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function TerminalTab({
  fccStatus,
  onRefresh,
}: {
  fccStatus: FccStatus | null;
  onRefresh: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>(() => loadTerminalHistory());
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => saveTerminalHistory(turns), [turns]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streaming]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const promptHistory = turns.map((t) => t.prompt);

  const startServer = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      // Trigger the start-fcc.sh script via /__shell or direct fetch.
      // We don't have a dedicated endpoint, so the user runs it themselves.
      // After 2s, refresh status.
      await fetch("/__fcc_status").catch(() => null);
      setTimeout(onRefresh, 1500);
    } finally {
      setStarting(false);
    }
  }, [starting, onRefresh]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const turn: Turn = {
      id: uid(),
      prompt: text,
      output: "",
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
    };
    setTurns((prev) => [...prev, turn]);
    setInput("");
    setHistIdx(null);
    setStreaming(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Build full conversation history so the model sees context.
      const history = turns.flatMap((t) => [
        { role: "user", content: t.prompt },
        { role: "assistant", content: t.output },
      ]);
      const r = await fetch("/__fcc_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: text }],
          stream: true,
        }),
        signal: ac.signal,
      });
      if (!r.body) throw new Error("no stream body");
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const line of parts) {
          // fcc-server emits Anthropic-style SSE: `event: <name>\n data: {...}`
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            // Match Anthropic content_block_delta shape
            const delta =
              j.delta?.text ??
              j.delta?.partial_json ??
              j.delta?.content ??
              j.message?.content ??
              "";
            if (delta) {
              setTurns((prev) =>
                prev.map((t) => (t.id === turn.id ? { ...t, output: t.output + delta } : t)),
              );
            }
          } catch {
            /* skip non-JSON keepalive */
          }
        }
      }
      setTurns((prev) =>
        prev.map((t) => (t.id === turn.id ? { ...t, status: "done", finishedAt: Date.now() } : t)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turn.id
            ? {
                ...t,
                status: "error",
                output: t.output || `Error: ${msg}`,
                finishedAt: Date.now(),
              }
            : t,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, turns]);

  const reset = useCallback(() => {
    if (streaming) return;
    setTurns([]);
    saveTerminalHistory([]);
  }, [streaming]);

  const copyLast = useCallback(async () => {
    const last = [...turns].reverse().find((t) => t.output);
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.output);
    } catch {
      /* skip */
    }
  }, [turns]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (promptHistory.length === 0) return;
      const nextIdx = histIdx === null ? promptHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(nextIdx);
      setInput(promptHistory[nextIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      const nextIdx = histIdx + 1;
      if (nextIdx >= promptHistory.length) {
        setHistIdx(null);
        setInput("");
      } else {
        setHistIdx(nextIdx);
        setInput(promptHistory[nextIdx]);
      }
    }
  }

  if (fccStatus && !fccStatus.live) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
        <div
          className="panel p-5 space-y-3"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.35)" }}
        >
          <div className="flex items-center gap-2">
            <Power size={14} style={{ color: "#fca5a5" }} />
            <h3
              className="text-[12px] font-semibold uppercase tracking-widest"
              style={{ color: "#fca5a5" }}
            >
              fcc-server is offline
            </h3>
          </div>
          <p className="text-[12.5px]" style={{ color: "var(--cream-mute)" }}>
            The Coding Agent proxy (fcc-server) isn't running on{" "}
            <code style={{ color: TONE }}>:8082</code>. Start it with the launcher in this repo,
            then refresh.
          </p>
          <div
            className="flex items-center gap-2 p-2 rounded"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}
          >
            <pre className="flex-1 text-[11.5px] font-mono" style={{ color: TONE }}>
              bash ~/code/claude-os/scripts/start-fcc.sh --bg
            </pre>
            <button
              onClick={() =>
                navigator.clipboard.writeText("bash ~/code/claude-os/scripts/start-fcc.sh --bg")
              }
              className="p-1"
              style={{ color: "var(--fg-dim)" }}
            >
              <Copy size={11} />
            </button>
          </div>
          <button
            onClick={() => void startServer()}
            disabled={starting}
            className="flex items-center gap-2 px-3 py-2 rounded text-[12px] font-semibold transition disabled:opacity-50"
            style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
          >
            <Play size={12} /> {starting ? "Probing…" : "Refresh status"}
          </button>
        </div>
        <div className="panel p-4 space-y-1.5 text-[11.5px]" style={{ color: "var(--cream-mute)" }}>
          <h3
            className="text-[10px] uppercase tracking-widest mb-1"
            style={{ color: "var(--cream-mute)" }}
          >
            What this gives you
          </h3>
          <p>
            The Coding Agent is the OS's free Claude Code surface. fcc-server proxies the official{" "}
            <code style={{ color: TONE }}>claude</code> CLI through free OpenRouter routes. Once
            it's up, this Terminal becomes a real Claude Code REPL — same prompt format, same tool
            surface — at $0/run.
          </p>
          <p>
            Configure your provider at{" "}
            <a
              href="http://127.0.0.1:8082/admin"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: TONE }}
            >
              localhost:8082/admin
            </a>{" "}
            after the server is live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col"
      style={{
        background: "#020807",
        color: "#a7f3d0",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
        style={{ borderColor: "rgba(16,185,129,0.18)", background: "rgba(16,185,129,0.04)" }}
      >
        <div className="flex items-center gap-2 text-[11px]">
          <Terminal size={12} style={{ color: TONE }} />
          <span style={{ color: TONE }}>coding-agent</span>
          <span style={{ color: "rgba(167,243,208,0.4)" }}>·</span>
          <span style={{ color: "rgba(167,243,208,0.6)" }}>
            {fccStatus?.model ?? "open_router/anthropic/claude-3.5-sonnet"}
          </span>
          {streaming && (
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "#fbbf24" }}>
              · streaming…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <a
            href="http://127.0.0.1:8082/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
            style={{ color: TONE }}
            title="fcc-server admin"
          >
            <ExternalLink size={10} /> admin
          </a>
          <button
            onClick={copyLast}
            disabled={turns.length === 0}
            className="p-1.5 rounded disabled:opacity-40"
            style={{ color: TONE }}
            title="Copy last output"
          >
            <Copy size={11} />
          </button>
          <button
            onClick={reset}
            disabled={streaming}
            className="p-1.5 rounded disabled:opacity-40"
            style={{ color: TONE }}
            title="Reset session"
          >
            <RotateCcw size={11} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 scroll"
        style={{ fontSize: 12.5, lineHeight: 1.55 }}
      >
        {turns.length === 0 && (
          <div style={{ color: "rgba(167,243,208,0.45)" }}>
            <div style={{ color: TONE }}>coding-agent · fcc-server :8082</div>
            <div>
              Type a prompt. ↑/↓ for history. Streams from{" "}
              {fccStatus?.model ?? "the configured model"} via OpenRouter.
            </div>
            <div>&nbsp;</div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="mb-3">
            <div className="flex items-baseline gap-2">
              <span style={{ color: TONE }}>bca&nbsp;{">"}&nbsp;</span>
              <span style={{ color: "#fff" }}>{t.prompt}</span>
            </div>
            {t.output && (
              <pre
                className="whitespace-pre-wrap break-words mt-1"
                style={{
                  color: t.status === "error" ? "#f87171" : "rgba(167,243,208,0.92)",
                  marginLeft: 0,
                }}
              >
                {t.output}
              </pre>
            )}
            {t.status === "running" && !t.output && (
              <div className="text-[10.5px] mt-1" style={{ color: "rgba(167,243,208,0.4)" }}>
                (waiting on first token…)
              </div>
            )}
            {t.status === "done" && t.finishedAt && (
              <div
                className="text-[9.5px] mt-1 inline-flex items-center gap-1"
                style={{ color: "rgba(167,243,208,0.35)" }}
              >
                <CheckCircle2 size={9} /> {((t.finishedAt - t.startedAt) / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="shrink-0 px-3 py-2 border-t flex items-center gap-2"
        style={{ borderColor: "rgba(16,185,129,0.18)", background: "rgba(16,185,129,0.03)" }}
      >
        <span style={{ color: TONE }}>bca&nbsp;{">"}&nbsp;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            streaming
              ? "streaming reply — press Esc to abort (not yet wired)"
              : "ask anything · ↑↓ for history · Enter to send"
          }
          disabled={streaming}
          className="flex-1 bg-transparent outline-none"
          style={{ color: "#fff", caretColor: TONE, fontSize: 12.5 }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={() => void submit()}
          disabled={!input.trim() || streaming}
          className="px-2 py-1 rounded text-[10px] font-semibold disabled:opacity-40"
          style={{ background: `${TONE}22`, color: TONE, border: `1px solid ${TONE}55` }}
        >
          {streaming ? "…" : "send"}
        </button>
      </div>
    </div>
  );
}

function ModelsTab({ status }: { status: Status | null }) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
      <div className="panel p-5 space-y-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          Available models
        </h3>
        <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
          Pick the size that fits your machine. Pull with{" "}
          <code style={{ color: TONE }}>ollama pull &lt;model&gt;</code>. The bigger the model, the
          smarter — and the more RAM it needs.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODEL_PRESETS.map((m) => {
            const installed = status?.models?.find((x) => x.name === m.id);
            return (
              <div
                key={m.id}
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${installed ? `${TONE}55` : "var(--panel-border)"}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[13px] font-mono font-bold"
                    style={{ color: installed ? TONE : "var(--fg)" }}
                  >
                    {m.id}
                  </span>
                  {installed ? (
                    <span
                      className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{ background: `${TONE}22`, color: TONE }}
                    >
                      installed
                    </span>
                  ) : (
                    <span
                      className="text-[9px] uppercase tracking-widest"
                      style={{ color: "var(--fg-dimmer)" }}
                    >
                      not installed
                    </span>
                  )}
                </div>
                <div className="text-[11px] mb-2" style={{ color: "var(--cream-dim)" }}>
                  {m.label} · needs {m.ram} RAM · {m.desc}
                </div>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-[11px] font-mono p-2 rounded"
                    style={{ background: "rgba(0,0,0,0.4)", color: TONE }}
                  >
                    ollama pull {m.id}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`ollama pull ${m.id}`)}
                    className="p-2 rounded transition"
                    style={{ background: "rgba(255,255,255,0.04)", color: "var(--fg-dim)" }}
                  >
                    <Copy size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SetupTab() {
  const cmds = [
    { os: "macOS", cmd: "brew install ollama" },
    { os: "Linux", cmd: "curl -fsSL https://ollama.com/install.sh | sh" },
    { os: "Windows", cmd: "# Download from ollama.com/download" },
  ];
  const launchCmd = `ANTHROPIC_BASE_URL=http://localhost:11434 \\\nANTHROPIC_AUTH_TOKEN=ollama \\\nANTHROPIC_API_KEY= \\\nANTHROPIC_MODEL=gemma4:31b \\\nclaude`;
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
      <div className="panel p-5 space-y-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          What you get
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11.5px]">
          {[
            { icon: <CircleDollarSign size={14} />, label: "$0/forever", desc: "No subscription" },
            { icon: <Lock size={14} />, label: "100% private", desc: "Stays on machine" },
            { icon: <Wifi size={14} />, label: "Works offline", desc: "Code on planes" },
            { icon: <Sparkles size={14} />, label: "No rate limits", desc: "Hammer it" },
          ].map((f) => (
            <div
              key={f.label}
              className="p-3 rounded-lg"
              style={{ background: `${TONE}08`, border: `1px solid ${TONE}22` }}
            >
              <div style={{ color: TONE }}>{f.icon}</div>
              <div className="text-[12.5px] font-semibold mt-1" style={{ color: "#fff" }}>
                {f.label}
              </div>
              <div className="text-[10.5px]" style={{ color: "var(--fg-dimmer)" }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          1. Install Ollama
        </h3>
        {cmds.map((c) => (
          <div
            key={c.os}
            className="flex items-center gap-3 p-2 rounded"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}
          >
            <span className="text-[10px] uppercase tracking-widest w-16" style={{ color: TONE }}>
              {c.os}
            </span>
            <code className="flex-1 text-[11.5px] font-mono" style={{ color: "var(--fg)" }}>
              {c.cmd}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(c.cmd)}
              className="p-1.5 rounded"
              style={{ color: "var(--fg-dim)" }}
            >
              <Copy size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="panel p-5 space-y-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          2. Pull Gemma 4 (flagship)
        </h3>
        <div
          className="flex items-center gap-3 p-2 rounded"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}
        >
          <code className="flex-1 text-[12px] font-mono" style={{ color: TONE }}>
            ollama pull gemma4:31b
          </code>
          <button
            onClick={() => navigator.clipboard.writeText("ollama pull gemma4:31b")}
            className="p-1.5 rounded"
            style={{ color: "var(--fg-dim)" }}
          >
            <Copy size={11} />
          </button>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          3. Run Claude Code against local Gemma
        </h3>
        <div
          className="flex items-start gap-3 p-3 rounded"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--panel-border)" }}
        >
          <CheckCircle2 size={12} style={{ color: TONE, marginTop: 2 }} />
          <div className="flex-1">
            <div className="text-[11px] mb-2" style={{ color: "var(--cream-dim)" }}>
              The one-command way:
            </div>
            <code className="text-[12px] font-mono" style={{ color: TONE }}>
              ollama launch claude
            </code>
          </div>
        </div>
        <div className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>
          Manual fallback:
        </div>
        <pre
          className="text-[11px] font-mono p-3 rounded whitespace-pre overflow-x-auto"
          style={{ background: "rgba(0,0,0,0.4)", color: "var(--fg-dim)" }}
        >
          {launchCmd}
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(launchCmd.replace(/\\\n/g, ""))}
          className="self-end inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded"
          style={{ background: `${TONE}12`, color: TONE, border: `1px solid ${TONE}33` }}
        >
          <Copy size={10} /> Copy
        </button>
      </div>

      <div className="panel p-5 space-y-2">
        <h3
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          Hybrid workflow
        </h3>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--cream-mute)" }}>
          Don't think Gemma <em>vs</em> Sonnet/Opus — think Gemma <strong>with</strong>. Route
          scaffolding, bug fixes, boilerplate, and exploration to local Gemma. Save Sonnet/Opus for
          multi-file refactors, architecture decisions, and production-critical code. Pinecone keeps
          the long-term memory consistent across both.
        </p>
        <a
          href="https://ollama.com/library/gemma4"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11.5px]"
          style={{ color: TONE }}
        >
          <ExternalLink size={11} /> ollama.com/library/gemma4
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenCode tab — sst/opencode TUI coding agent integration.
// Probes /__opencode_status; if installed, surfaces version + path + the
// runtime command operators paste into a terminal. Gemma 4 remains the
// LLM in the Chat tab; opencode lives alongside as a second runtime.
// ─────────────────────────────────────────────────────────────────────────────
function OpenCodeTab({
  status,
  onRefresh,
}: {
  status: OpenCodeStatus | null;
  onRefresh: () => void;
}) {
  const installed = !!status?.installed;
  function copy(s: string) {
    try {
      navigator.clipboard.writeText(s);
    } catch {
      /* skip */
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll" style={{ minHeight: 0 }}>
      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          {installed ? (
            <CheckCircle2 size={14} style={{ color: "#10B981" }} />
          ) : (
            <AlertCircle size={14} style={{ color: "#fbbf24" }} />
          )}
          <h3
            className="text-[12px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--cream-mute)" }}
          >
            {installed ? "opencode installed" : "opencode not installed"}
          </h3>
          <button
            onClick={onRefresh}
            className="ml-auto p-1.5 rounded-md transition"
            style={{
              background: "rgba(243,235,218,0.04)",
              border: "1px solid var(--panel-border)",
              color: "var(--fg-dim)",
            }}
          >
            <RefreshCw size={11} />
          </button>
        </div>
        {installed && (
          <div className="grid grid-cols-2 gap-3 text-[11.5px]">
            <div
              className="rounded border p-3"
              style={{ borderColor: "var(--panel-border)", background: "rgba(0,0,0,0.25)" }}
            >
              <div
                className="text-[9.5px] uppercase tracking-[0.18em]"
                style={{ color: "var(--cream-mute)" }}
              >
                Version
              </div>
              <div className="text-[12px] font-mono mt-1" style={{ color: TONE }}>
                {status?.version ?? "(unknown)"}
              </div>
            </div>
            <div
              className="rounded border p-3"
              style={{ borderColor: "var(--panel-border)", background: "rgba(0,0,0,0.25)" }}
            >
              <div
                className="text-[9.5px] uppercase tracking-[0.18em]"
                style={{ color: "var(--cream-mute)" }}
              >
                Binary
              </div>
              <div className="text-[11px] font-mono mt-1 break-all" style={{ color: "var(--fg)" }}>
                {status?.path ?? "(unknown)"}
              </div>
            </div>
          </div>
        )}
        {!installed && (
          <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
            opencode is sst/opencode — an open-source TUI coding agent. It runs locally and works
            alongside this page's Gemma 4 Chat surface. Install it with one of the commands below,
            then click the refresh icon above.
          </p>
        )}
      </div>

      <div className="panel p-5 space-y-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          {installed ? "Run it" : "Install"}
        </h3>
        <div className="space-y-2">
          {(installed
            ? [
                "opencode                       # start in current dir",
                'opencode -p "refactor this file" path/to/file.ts',
                "opencode --help                 # full flag list",
              ]
            : [
                "curl -fsSL https://opencode.ai/install | bash",
                "# or: brew install sst/tap/opencode",
                "# or: npm i -g @opencode-ai/cli",
              ]
          ).map((cmd, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-2 rounded"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}
            >
              <span className="text-[10px] font-bold mt-1" style={{ color: TONE }}>
                {i + 1}
              </span>
              <pre
                className="flex-1 text-[11.5px] font-mono break-all"
                style={{ color: "var(--fg)" }}
              >
                {cmd}
              </pre>
              <button
                onClick={() => copy(cmd)}
                className="p-1.5 rounded transition"
                style={{ color: "var(--fg-dim)" }}
                title="Copy"
              >
                <Copy size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5 space-y-2">
        <h3
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          Why opencode + Gemma 4 together
        </h3>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--cream-mute)" }}>
          Same Coding Agent page, two runtimes:
        </p>
        <ul
          className="text-[11.5px] leading-relaxed space-y-1"
          style={{ color: "var(--cream-dim)" }}
        >
          <li>
            · <strong>Chat tab → Gemma 4 on Ollama</strong> — instant, local, $0/run. Best for
            prototyping, rubber-ducking, single-file work.
          </li>
          <li>
            · <strong>OpenCode tab → opencode TUI</strong> — repo-scoped multi-file edits with tool
            calls. Best for bigger refactors and feature scaffolds.
          </li>
          <li>
            · <strong>Terminal tab → fcc-server (Claude Code surface)</strong> — frontier-grade when
            you need it; routes through OpenRouter.
          </li>
        </ul>
        <a
          href="https://opencode.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11.5px] mt-2"
          style={{ color: TONE }}
        >
          <ExternalLink size={11} /> opencode.ai
        </a>
      </div>
    </div>
  );
}
