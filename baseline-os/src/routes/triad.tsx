/**
 * Triad — Opus → DeepSeek → GPT 3-model council.
 *
 *   Conductor (Opus 4.7) interrogates + writes a brief
 *     ↓
 *   Worker    (DeepSeek V4) drafts 3 angles in parallel
 *     ↓
 *   Critic    (GPT-5.5)     tears each draft apart
 *     ↓
 *   Conductor validates → final artifact
 *
 * Streams NDJSON from /__triad_run.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles, RefreshCw, Send, CheckCircle2, AlertCircle, Copy,
  Wand2, Pickaxe, Search, Crown,
} from "lucide-react";

export const Route = createFileRoute("/triad")({
  head: () => ({
    meta: [
      { title: "Triad — Baseline Automations" },
      { name: "description", content: "Opus + DeepSeek + GPT 3-model council. The meta for high-stakes work." },
    ],
  }),
  component: TriadPage,
});

type Role = "conductor" | "worker" | "critic" | "validate";

interface StreamEvent {
  phase: Role | "done" | "error";
  role?: string;
  status?: "thinking" | "done";
  message?: string;
  content?: string;
  artifact?: string;
}

interface Phase {
  id: Role;
  title: string;
  model: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const PHASES: Phase[] = [
  { id: "conductor", title: "Conductor", model: "Opus 4.7",  icon: <Wand2 size={14} />,   color: "#D97757", description: "Interrogate + brief" },
  { id: "worker",    title: "Worker",    model: "DeepSeek V4", icon: <Pickaxe size={14} />, color: "#06B6D4", description: "Grind 3 angles in parallel" },
  { id: "critic",    title: "Critic",    model: "GPT-5.5",   icon: <Search size={14} />,  color: "#a3e635", description: "Tear each draft apart" },
  { id: "validate",  title: "Final",     model: "Opus 4.7",  icon: <Crown size={14} />,   color: "#fbbf24", description: "Validate + ship artifact" },
];

const TONE = "#fbbf24";

interface PhaseState {
  status: "idle" | "thinking" | "done" | "error";
  message?: string;
  content?: string;
}

function TriadPage() {
  const [brief, setBrief] = useState("");
  const [running, setRunning] = useState(false);
  const [phases, setPhases] = useState<Record<Role, PhaseState>>({
    conductor: { status: "idle" },
    worker:    { status: "idle" },
    critic:    { status: "idle" },
    validate:  { status: "idle" },
  });
  const [artifact, setArtifact] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const artifactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (artifact && artifactRef.current) {
      artifactRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [artifact]);

  async function run() {
    if (!brief.trim() || running) return;
    setRunning(true);
    setError(null);
    setArtifact(null);
    setPhases({
      conductor: { status: "idle" },
      worker:    { status: "idle" },
      critic:    { status: "idle" },
      validate:  { status: "idle" },
    });

    try {
      const r = await fetch("/__triad_run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      if (!r.body) throw new Error("no body");
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
            const evt = JSON.parse(line) as StreamEvent;
            if (evt.phase === "error") { setError(evt.message ?? "unknown"); continue; }
            if (evt.phase === "done") { setArtifact(evt.artifact ?? ""); continue; }
            const phase = evt.phase as Role;
            setPhases((p) => ({
              ...p,
              [phase]: {
                status: evt.status ?? "thinking",
                message: evt.message ?? p[phase].message,
                content: evt.content ?? p[phase].content,
              },
            }));
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setError(String(e));
    }
    setRunning(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Crown size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#fef3c7" }}>Triad · Opus + DeepSeek + GPT council</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            For high-stakes work — interrogate, grind in parallel, tear apart, validate.
          </div>
        </div>
        {error && <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5" }}>error</span>}
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
        {/* Brief composer */}
        <div className="panel p-5 space-y-3 max-w-4xl">
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: TONE }} />
            <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Brief</h3>
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder="State the high-stakes goal. The Triad takes 60-90 seconds — use it when one model alone isn't enough.&#10;&#10;Examples:&#10;• Architect the Q3 launch — three angles, opinionated, runnable&#10;• Decide between Stripe vs Lemon Squeezy for our pricing — full tradeoff matrix&#10;• Draft the cold outreach sequence for the top 50 prospects"
            disabled={running}
            className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10.5px]" style={{ color: "var(--fg-dimmer)" }}>
              Routes through OpenRouter · ~60-90s per run · saves final to Studio history
            </div>
            <button
              onClick={run}
              disabled={!brief.trim() || running}
              className="px-4 h-[36px] rounded-lg flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-40"
              style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
            >
              {running ? <><RefreshCw size={14} className="animate-spin" /> Running…</> : <><Send size={14} /> Convene the Triad</>}
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-1.5 text-[11px] p-2 rounded" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              <AlertCircle size={11} className="shrink-0 mt-0.5" /> <span className="break-all">{error}</span>
            </div>
          )}
        </div>

        {/* Phase cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 max-w-4xl">
          {PHASES.map((p) => {
            const st = phases[p.id];
            const isLive = st.status === "thinking";
            const isDone = st.status === "done";
            return (
              <div key={p.id} className="rounded-xl p-4 flex flex-col gap-2 transition" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${isLive ? p.color : isDone ? `${p.color}55` : "var(--panel-border)"}`, opacity: st.status === "idle" ? 0.5 : 1 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5" style={{ color: p.color }}>{p.icon}<span className="text-[11.5px] font-semibold">{p.title}</span></div>
                  {isLive && <RefreshCw size={11} className="animate-spin" style={{ color: p.color }} />}
                  {isDone && <CheckCircle2 size={11} style={{ color: "#10B981" }} />}
                </div>
                <div className="text-[9.5px] uppercase tracking-widest" style={{ color: "var(--fg-dimmer)" }}>{p.model}</div>
                <div className="text-[10.5px]" style={{ color: "var(--cream-mute)" }}>{p.description}</div>
                {st.message && <div className="text-[10px] mt-1 italic" style={{ color: "var(--fg-dim)" }}>{st.message}</div>}
                {st.content && (
                  <details>
                    <summary className="text-[10px] cursor-pointer" style={{ color: p.color }}>view {st.content.length} chars</summary>
                    <pre className="text-[10px] mt-1 p-2 rounded max-h-[200px] overflow-y-auto whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.4)", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono',monospace" }}>{st.content}</pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>

        {/* Final artifact */}
        {artifact && (
          <div ref={artifactRef} className="panel p-5 max-w-4xl space-y-3" style={{ background: `${TONE}08`, border: `1px solid ${TONE}44` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown size={14} style={{ color: TONE }} />
                <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: TONE }}>Final artifact</h3>
              </div>
              <button onClick={() => navigator.clipboard.writeText(artifact)} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] transition" style={{ background: `${TONE}15`, border: `1px solid ${TONE}33`, color: TONE }}>
                <Copy size={11} /> Copy
              </button>
            </div>
            <pre className="text-[13px] leading-relaxed whitespace-pre-wrap p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)", color: "#fff", fontFamily: "Manrope, sans-serif" }}>{artifact}</pre>
          </div>
        )}

        {/* Explainer */}
        <div className="panel p-5 max-w-4xl space-y-2 text-[12px]" style={{ color: "var(--cream-dim)" }}>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Why three different model families</h3>
          <p>
            The Critic and Worker must come from <strong>different architectures</strong>. Same architecture = same blind spots = pointless critique. Reflexion fails when the critic just yes-ands the executor.
          </p>
          <p>
            Use this when the cost of being wrong is high: architecture decisions, big launches, deal-shaping, anything you'd otherwise put off for a "long thinking session." The council does the thinking; you wake up to a peer-reviewed artifact.
          </p>
        </div>
      </div>
    </div>
  );
}
