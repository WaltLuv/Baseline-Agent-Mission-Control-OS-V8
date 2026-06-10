/**
 * AntigravityTerminal — terminal-grade UI on top of /__agent_run for
 * the antigravity agent (which now spawns the real `agy --print` CLI).
 *
 * The chat is intentionally styled like a real terminal — monospace,
 * green-on-black, prompt prefix `agy >`, command history via ↑/↓ —
 * but with the niceties a raw terminal can't give you:
 *   · Streaming output rendered as native HTML (line wrapping, scroll,
 *     colorised tool-use chips if they ever come back from agy)
 *   · Per-turn timing + exit code in a subtle status line
 *   · Up-arrow / Down-arrow history navigation across the session
 *   · "Copy last output" + "Reset session" controls
 *   · Persists history (last 50 lines) in localStorage
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, RotateCcw, ExternalLink, CheckCircle2, Loader2, Power } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "claude-os.terminal.antigravity.v1";

interface Turn {
  id: string;
  prompt: string;
  output: string;
  startedAt: number;
  finishedAt: number | null;
  exit: number | null;
  status: "running" | "done" | "error" | "cancelled";
}

function loadHistory(): Turn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-50) : [];
  } catch { return []; }
}
function saveHistory(t: Turn[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t.slice(-50))); } catch { /* skip */ }
}
function uid(): string { return Math.random().toString(36).slice(2, 10); }

export function AntigravityTerminal() {
  const [turns, setTurns] = useState<Turn[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => saveHistory(turns), [turns]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [turns, streaming]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const promptHistory = turns.map((t) => t.prompt);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const turn: Turn = { id: uid(), prompt: text, output: "", startedAt: Date.now(), finishedAt: null, exit: null, status: "running" };
    setTurns((prev) => [...prev, turn]);
    setInput("");
    setHistIdx(null);
    setStreaming(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const r = await fetch("/__agent_run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: "antigravity", messages: [{ role: "user", content: text }] }),
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
          if (!line.startsWith("data:")) continue;
          try {
            const j = JSON.parse(line.slice(5).trim());
            if (j.delta) {
              setTurns((prev) => prev.map((t) => t.id === turn.id ? { ...t, output: t.output + j.delta } : t));
            }
            if (j.done) {
              setTurns((prev) => prev.map((t) => t.id === turn.id ? { ...t, status: j.exit === 0 ? "done" : "error", exit: j.exit ?? null, finishedAt: Date.now() } : t));
              setStreaming(false);
            }
          } catch { /* skip */ }
        }
      }
      setStreaming(false);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setTurns((prev) => prev.map((t) => t.id === turn.id ? { ...t, status: "cancelled", finishedAt: Date.now() } : t));
      } else {
        setTurns((prev) => prev.map((t) => t.id === turn.id ? { ...t, status: "error", output: t.output + `\n[error] ${String(e)}\n`, finishedAt: Date.now() } : t));
      }
      setStreaming(false);
    }
  }, [input, streaming]);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (promptHistory.length === 0) return;
      const next = histIdx === null ? promptHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(promptHistory[next] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      const next = histIdx + 1;
      if (next >= promptHistory.length) { setHistIdx(null); setInput(""); }
      else { setHistIdx(next); setInput(promptHistory[next] ?? ""); }
      return;
    }
  }

  function copyLast(): void {
    const last = [...turns].reverse().find((t) => t.output);
    if (!last) return;
    navigator.clipboard.writeText(last.output).then(() => toast.success("copied last output"));
  }
  function clearAll(): void {
    setTurns([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* skip */ }
    toast.success("terminal cleared");
  }
  function stop(): void {
    abortRef.current?.abort();
  }

  return (
    <section
      className="rounded-xl border overflow-hidden flex flex-col"
      style={{
        background: "#0a0e0a",
        borderColor: "rgba(74,222,128,0.35)",
        boxShadow: "0 0 24px -6px rgba(74,222,128,0.3), inset 0 0 0 1px rgba(74,222,128,0.05)",
      }}
    >
      {/* Title bar — fake macOS terminal chrome */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ background: "#0f1410", borderColor: "rgba(74,222,128,0.18)" }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FF5F57" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28C840" }} />
        <span className="ml-3 font-mono text-[10.5px]" style={{ color: "rgba(74,222,128,0.85)" }}>
          agy@baseline-os
        </span>
        <span className="font-mono text-[10.5px] opacity-50">— ~/code/claude-os</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={copyLast} className="p-1 rounded hover:bg-white/5" title="Copy last output">
            <Copy className="h-3 w-3 opacity-60" />
          </button>
          <button onClick={clearAll} className="p-1 rounded hover:bg-white/5" title="Clear terminal">
            <RotateCcw className="h-3 w-3 opacity-60" />
          </button>
          {streaming && (
            <button onClick={stop} className="p-1 rounded hover:bg-red-500/10" title="Cancel">
              <Power className="h-3 w-3" style={{ color: "#F87171" }} />
            </button>
          )}
          <a href="https://antigravity.google/product/antigravity-cli" target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-white/5" title="Antigravity docs">
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>

      {/* Scrollback */}
      <div
        ref={scrollRef}
        className="font-mono text-[12.5px] leading-[1.55] px-4 py-3 overflow-y-auto"
        style={{ color: "#a3e3a8", maxHeight: "55vh", minHeight: 320 }}
      >
        {turns.length === 0 && (
          <div className="space-y-0.5">
            <div style={{ color: "#5ad36a" }}>Antigravity CLI v1.0.3 — Gemini-powered agentic workspace</div>
            <div className="opacity-60">Type a prompt below and hit Enter. ↑/↓ to navigate history.</div>
            <div className="opacity-60">Backed by `agy --print` (Homebrew · /opt/homebrew/bin/agy).</div>
            <div className="mt-2" style={{ color: "#74e081" }}>
              Suggestions:
              <ul className="list-disc list-inside opacity-80 mt-0.5 ml-2">
                <li>build a single-page landing for an "AI Workforce OS" demo</li>
                <li>summarise the README in 5 bullets</li>
                <li>list every TypeScript file in src/components and sort by line count</li>
              </ul>
            </div>
          </div>
        )}
        {turns.map((t) => (
          <TurnBlock key={t.id} turn={t} />
        ))}
      </div>

      {/* Input row */}
      <form
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        className="flex items-center gap-2 px-4 py-2.5 border-t font-mono text-[13px]"
        style={{ background: "#0c1110", borderColor: "rgba(74,222,128,0.22)" }}
      >
        <span style={{ color: "#74e081" }}>agy</span>
        <span style={{ color: "rgba(116,224,129,0.55)" }}>›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={streaming}
          placeholder={streaming ? "(streaming — wait or hit ⏻ to cancel)" : "type a prompt and press Enter"}
          className="flex-1 bg-transparent border-0 focus:outline-none disabled:opacity-50"
          style={{ color: "#cef0d2", caretColor: "#74e081" }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="px-2.5 py-0.5 rounded text-[10.5px] uppercase tracking-[0.2em] border disabled:opacity-30"
          style={{ borderColor: "rgba(74,222,128,0.45)", color: "#74e081", background: "rgba(74,222,128,0.08)" }}
        >
          {streaming ? "…" : "run"}
        </button>
      </form>
    </section>
  );
}

function TurnBlock({ turn }: { turn: Turn }) {
  const dur = turn.finishedAt ? ((turn.finishedAt - turn.startedAt) / 1000).toFixed(1) : null;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-2">
        <span style={{ color: "#74e081" }}>agy</span>
        <span style={{ color: "rgba(116,224,129,0.55)" }}>›</span>
        <span style={{ color: "#cef0d2" }}>{turn.prompt}</span>
      </div>
      {turn.output && (
        <pre className="whitespace-pre-wrap break-words mt-0.5" style={{ color: "#a3e3a8" }}>{turn.output}</pre>
      )}
      <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-60">
        {turn.status === "running" && (<><Loader2 className="h-2.5 w-2.5 animate-spin" /> streaming…</>)}
        {turn.status === "done"    && (<><CheckCircle2 className="h-2.5 w-2.5" style={{ color: "#5ad36a" }} /> ok · {dur}s</>)}
        {turn.status === "error"   && (<>✗ error · exit {turn.exit ?? "?"} · {dur ?? "?"}s</>)}
        {turn.status === "cancelled" && (<>⏻ cancelled</>)}
      </div>
    </div>
  );
}
