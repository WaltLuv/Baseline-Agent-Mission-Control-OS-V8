/**
 * Browser-Use Harness — drives a real Chromium via the browser-use service.
 *
 * Every agent (Hermes, OpenClaw, Gemini, Codex, ClaudeClaw, Studio, SEO) has
 * this capability through /__browser_use. This page is the human-driven console
 * for it — useful for one-off automation tasks.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, Play, RefreshCw, ExternalLink, Copy, AlertCircle, CheckCircle2 } from "lucide-react";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";

export const Route = createFileRoute("/browser")({
  head: () => ({
    meta: [
      { title: "Browser Use — Baseline Automations" },
      { name: "description", content: "Drive a real Chromium browser via the browser-use harness." },
    ],
  }),
  component: BrowserPage,
});

const TONE = "#fb923c";

const QUICK_TASKS = [
  "Go to news.ycombinator.com and summarize the top 5 stories",
  "Search Twitter for 'Baseline Automations' and capture the top 3 threads with screenshots",
  "Log into the WACRM dev at localhost:3000 and list all contacts tagged 'warm'",
  "Open notebooklm.google.com and list my notebooks (use existing browser session)",
];

interface RunResult {
  ok: boolean;
  source: "browser-use" | "stub";
  result?: unknown;
  note?: string;
  setup?: string[];
}

function BrowserPage() {
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [agent, setAgent] = useState<"gemini" | "openclaw" | "hermes-mcp" | "claudeclaw" | "codex">("gemini");
  const [serviceStatus, setServiceStatus] = useState<"checking" | "live" | "down">("checking");

  useEffect(() => {
    let cancel = false;
    fetch("http://127.0.0.1:8000/health", { signal: AbortSignal.timeout(2500) })
      .then((r) => { if (!cancel) setServiceStatus(r.ok ? "live" : "down"); })
      .catch(() => { if (!cancel) setServiceStatus("down"); });
    return () => { cancel = true; };
  }, []);

  async function run() {
    if (!task.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch("/__browser_use", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, agent }),
      });
      const j = await r.json() as RunResult;
      setResult(j);
    } catch (e) {
      setResult({ ok: false, source: "stub", note: String(e) });
    }
    setRunning(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-4 pt-3">
        <RuntimeCredentialStatus providerIds={["browser_use"]} variant="inline" />
      </div>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Globe size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#ffedd5" }}>Browser-Use Harness</div>
          <div className="text-[10px] uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--cream-mute)" }}>
            {serviceStatus === "live" && <><CheckCircle2 size={10} style={{ color: "#10B981" }} /> Service live on :8000</>}
            {serviceStatus === "down" && <><AlertCircle size={10} style={{ color: "#fbbf24" }} /> Service offline</>}
            {serviceStatus === "checking" && "Checking…"}
            <span className="opacity-60">· available to every agent via /__browser_use</span>
          </div>
        </div>
        <a href="https://github.com/WaltLuv/Ai-agent-harness-browser-use" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] transition" style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: "#ffedd5" }}>
          <ExternalLink size={12} /> Repo
        </a>
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
          <div className="panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play size={14} style={{ color: TONE }} />
                <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Run a task</h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span style={{ color: "var(--fg-dimmer)" }}>Driver:</span>
                <select value={agent} onChange={(e) => setAgent(e.target.value as typeof agent)} className="px-2 py-1 rounded text-[11px] outline-none" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}>
                  <option value="gemini">Gemini</option>
                  <option value="codex">Codex ⭐ best for browser</option>
                  <option value="openclaw">OpenClaw</option>
                  <option value="hermes-mcp">Hermes</option>
                  <option value="claudeclaw">ClaudeClaw</option>
                </select>
              </div>
            </div>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
              placeholder="Describe what you want the browser to do. e.g. 'Go to amazon.com, search wireless mouse, sort by reviews, paste the top 3 with prices.'"
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
              style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
            />
            <div className="flex justify-end">
              <button
                onClick={run}
                disabled={!task.trim() || running}
                className="px-4 h-[36px] rounded-lg flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-40"
                style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
              >
                {running ? <><RefreshCw size={14} className="animate-spin" /> Driving…</> : <><Play size={14} /> Run</>}
              </button>
            </div>
            {result && (
              <div className="p-4 rounded-lg space-y-2" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--panel-border)" }}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest" style={{ color: result.ok ? "#10B981" : "#fbbf24" }}>
                  {result.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  {result.ok ? "Completed" : "Setup required"} · source: {result.source}
                </div>
                {result.note && <div className="text-[12px]" style={{ color: "var(--fg-dim)" }}>{result.note}</div>}
                {result.setup && (
                  <div className="space-y-1.5">
                    {result.setup.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded" style={{ background: "rgba(0,0,0,0.4)" }}>
                        <span className="text-[10px] font-bold" style={{ color: TONE }}>{i + 1}</span>
                        <pre className="flex-1 text-[11.5px] font-mono break-all" style={{ color: "var(--fg)" }}>{s}</pre>
                        <button onClick={() => navigator.clipboard.writeText(s)} className="p-1" style={{ color: "var(--fg-dim)" }}><Copy size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {result.result && (
                  <pre className="text-[11.5px] whitespace-pre-wrap p-3 rounded max-h-[300px] overflow-y-auto scroll" style={{ background: "rgba(0,0,0,0.5)", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono',monospace" }}>{JSON.stringify(result.result, null, 2)}</pre>
                )}
              </div>
            )}
          </div>

          <div className="panel p-5 space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Quick tasks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {QUICK_TASKS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTask(t); run(); }}
                  disabled={running}
                  className="text-left p-3 rounded-lg text-[12px] transition disabled:opacity-40"
                  style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
