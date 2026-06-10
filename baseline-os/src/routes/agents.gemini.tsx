/**
 * Gemini — 4 tabs: Chat · Studio · Workspace · Control Room
 */

import { createFileRoute } from "@tanstack/react-router";
import { AgentIdentityHeader } from "@/components/graphify-awareness";
import { useEffect, useState } from "react";
import { FullChat } from "@/components/full-chat";
import { AgentWorkspace } from "@/components/agent-workspace";
import { StudioToolbox } from "@/components/studio-toolbox";
import { EnvStatusPanel } from "@/components/env-status-panel";
import { AgentActivity } from "@/components/agent-activity";
import { planFromGoal, flowStats, flowReplayEvents, ARTIFACT_KINDS, type FlowWorkflow } from "@/lib/gemini-flow";
import { recordMission } from "@/lib/replay-store";
import { MessageSquare, Wand2, FolderOpen, Settings2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/agents/gemini")({
  head: () => ({
    meta: [
      { title: "Gemini 3.5 Flash — Baseline Automations" },
      {
        name: "description",
        content: "Gemini 3.5 Flash — Google's fastest frontier model via OpenRouter.",
      },
    ],
  }),
  component: GeminiPage,
});

const COLOR = "#4F8EF7";

type Tab = "flow" | "chat" | "studio" | "workspace" | "control";

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot() {
  const [status, setStatus] = useState<"checking" | "live" | "offline">("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/__ai_chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "gemini", messages: [{ role: "user", content: "ping" }] }),
      signal: AbortSignal.timeout(6000),
    })
      .then((r) => {
        if (!cancelled) setStatus(r.ok ? "live" : "offline");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = {
    live: { background: "#10B98118", borderColor: "#10B98155", color: "#10B981" },
    offline: {
      background: "rgba(239,68,68,0.10)",
      borderColor: "rgba(239,68,68,0.35)",
      color: "#f87171",
    },
    checking: {
      background: "rgba(255,255,255,0.05)",
      borderColor: "rgba(255,255,255,0.12)",
      color: "#6b7280",
    },
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
      style={styles[status]}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "animate-pulse" : ""}`}
        style={{
          background: status === "live" ? "#10B981" : status === "offline" ? "#ef4444" : "#6b7280",
        }}
      />
      {status === "checking" ? "CHECKING…" : status === "live" ? "LIVE" : "OFFLINE"}
    </span>
  );
}

function GeminiLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient
          id="gemini-grad-t"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#82b4ff" />
          <stop offset="50%" stopColor="#4F8EF7" />
          <stop offset="100%" stopColor="#1e5fd4" />
        </linearGradient>
      </defs>
      <path
        d="M20 2 C20 2 22.5 12 30 20 C22.5 28 20 38 20 38 C20 38 17.5 28 10 20 C17.5 12 20 2 20 2Z"
        fill="url(#gemini-grad-t)"
      />
      <path
        d="M2 20 C2 20 12 17.5 20 10 C28 17.5 38 20 38 20 C38 20 28 22.5 20 30 C12 22.5 2 20 2 20Z"
        fill="url(#gemini-grad-t)"
        opacity="0.7"
      />
    </svg>
  );
}

// ── Flow tab (Google-Flow-style, graph-first) ──────────────────────────────────

function GeminiFlowTab() {
  const [goal, setGoal] = useState("");
  const [wf, setWf] = useState<FlowWorkflow | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = async () => {
    if (!goal.trim() || busy) return;
    setBusy(true);
    // Graph-first: query Graphify for the goal before laying out the plan.
    let files: string[] = [];
    try {
      const r = await fetch(`/__graphify?q=${encodeURIComponent(goal)}`);
      const j = await r.json();
      files = (j.results ?? []).map((n: { path: string }) => n.path);
    } catch {
      /* graph optional */
    }
    const planned = planFromGoal(goal, files, { now: Date.now(), provider: "gemini" });
    setWf(planned);
    // Replay: every workflow plan is a replayable mission.
    try {
      recordMission(`Gemini Flow: ${goal}`.slice(0, 80), goal, flowReplayEvents(planned, Date.now()));
    } catch {
      /* replay optional */
    }
    setBusy(false);
  };

  const stats = wf ? flowStats(wf) : null;
  const byKind = (k: string) => (wf?.nodes ?? []).filter((n) => n.kind === k);

  return (
    <div className="flex-1 overflow-y-auto p-5" data-testid="gemini-flow-tab">
      <div className="mb-3">
        <div className="text-sm font-semibold">Gemini Flow · workflow workspace</div>
        <p className="text-xs" style={{ color: "var(--cream-mute)" }}>
          Goal → graph-first task plan, artifacts, agents + providers. Not a chatbot — a Google
          Flow-style execution workspace. Every plan queries Graphify first and emits replay events.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && plan()}
          placeholder="Ship a product launch in 14 days…"
          className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none"
          data-testid="flow-goal"
        />
        <button
          onClick={plan}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-semibold text-black"
          style={{ backgroundColor: COLOR }}
        >
          {busy ? "Planning…" : "Build flow"}
        </button>
      </div>

      {wf && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3" data-testid="flow-canvas">
          {/* task graph */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 lg:col-span-2">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-white/55">
              Task graph · {stats?.tasks} tasks · {stats?.contextFiles} graph-context files{" "}
              {stats?.graphFirst ? "· graph-first ✓" : ""}
            </div>
            <div className="space-y-1.5">
              {wf.nodes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-2 text-[11px]"
                  data-testid={`flow-node-${n.kind}`}
                >
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] uppercase"
                    style={{ background: `${COLOR}22`, color: COLOR }}
                  >
                    {n.kind}
                  </span>
                  <span className="text-white/80">{n.label}</span>
                  {n.deps.length > 0 && (
                    <span className="text-white/25">
                      ← {n.deps.length} dep{n.deps.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* artifacts + agents/providers */}
          <div className="space-y-3">
            <div
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              data-testid="flow-artifacts"
            >
              <div className="mb-1 text-[10px] uppercase tracking-widest text-white/55">
                Artifacts
              </div>
              <div className="flex flex-wrap gap-1">
                {ARTIFACT_KINDS.map((a) => (
                  <span
                    key={a}
                    className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              data-testid="flow-agents"
            >
              <div className="mb-1 text-[10px] uppercase tracking-widest text-white/55">
                Agents · Providers
              </div>
              {byKind("agent").map((n) => (
                <div key={n.id} className="text-[11px] text-white/75">
                  🤖 {n.label}
                </div>
              ))}
              {byKind("provider").map((n) => (
                <div key={n.id} className="text-[11px] text-white/75">
                  ⚙ {n.label}
                </div>
              ))}
            </div>
            <AgentActivity agentId="gemini-flow" runtime="Gemini" provider="Google" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Studio tab ────────────────────────────────────────────────────────────────

function StudioTab() {
  return <StudioToolbox namespace="gemini" agent="gemini" tone={COLOR} brand="Gemini" />;
}

// ── Workspace tab ─────────────────────────────────────────────────────────────

function WorkspaceTab() {
  return (
    <AgentWorkspace
      agent="gemini"
      tone={COLOR}
      emptyHint="No Gemini artifacts yet. Outputs saved during chat will appear here."
    />
  );
}

// ── Control Room tab ──────────────────────────────────────────────────────────

function ControlRoomTab() {
  const capabilities = [
    { label: "Role", value: "Lead Orchestrator" },
    { label: "Context Window", value: "1M tokens" },
    { label: "Provider", value: "Google DeepMind" },
    { label: "Routing", value: "via OpenRouter" },
    { label: "Modalities", value: "Text, Code, Vision" },
    { label: "Model", value: "gemini-3.5-flash" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 size={16} style={{ color: COLOR }} />
          <h3 className="text-sm font-semibold">Gemini Control Room</h3>
          <span
            className="ml-auto text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold"
            style={{ background: `${COLOR}22`, color: COLOR, border: `1px solid ${COLOR}55` }}
          >
            Higgsfield Lead
          </span>
        </div>

        <p className="text-[12px] leading-relaxed" style={{ color: "var(--cream-mute)" }}>
          Gemini is the designated lead orchestrator for the Higgsfield Supercomputer (image + video
          generation). It plans shoots, routes shots across Soul / Nano Banana / Seedance / Kling /
          Marketing Studio, writes the generation prompts, and hands off execution to OpenClaw and
          Hermes.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {capabilities.map((cap) => (
            <div
              key={cap.label}
              className="p-3 rounded-lg"
              style={{ background: `${COLOR}08`, border: `1px solid ${COLOR}22` }}
            >
              <div
                className="text-[10px] uppercase tracking-widest mb-1"
                style={{ color: "var(--cream-mute)" }}
              >
                {cap.label}
              </div>
              <div className="text-[13px] font-semibold" style={{ color: "#e8f4ff" }}>
                {cap.value}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a
            href="/triad"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition"
            style={{
              background: `linear-gradient(135deg, #fbbf2426, #d9775718)`,
              border: `1px solid #fbbf2455`,
              color: "#fef3c7",
            }}
          >
            <ExternalLink size={13} /> 👑 Convene the Triad (high-stakes)
          </a>
          <a
            href="/higgsfield"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition"
            style={{ background: `${COLOR}18`, border: `1px solid ${COLOR}44`, color: "#e8f4ff" }}
          >
            <ExternalLink size={13} /> Open Higgsfield Page
          </a>
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition"
            style={{ background: `${COLOR}12`, border: `1px solid ${COLOR}33`, color: "#e8f4ff" }}
          >
            <ExternalLink size={13} /> Google AI Studio
          </a>
          <a
            href="https://openrouter.ai/models?q=gemini"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition"
            style={{
              background: "rgba(243,235,218,0.05)",
              border: "1px solid var(--panel-border)",
              color: "var(--fg-dim)",
            }}
          >
            <ExternalLink size={13} /> OpenRouter Models
          </a>
          <a
            href="https://mcp.higgsfield.ai/mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition"
            style={{
              background: "rgba(243,235,218,0.05)",
              border: "1px solid var(--panel-border)",
              color: "var(--fg-dim)",
            }}
          >
            <ExternalLink size={13} /> Higgsfield MCP
          </a>
        </div>
      </div>

      <div className="panel p-5">
        <EnvStatusPanel
          tone={COLOR}
          groups={["core", "providers", "media", "higgsfield", "voice", "integrations"]}
          compact
        />
        <div className="mt-3">
          <AgentActivity agentId="gemini" runtime="Gemini" provider="Google" />
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function GeminiPage() {
  const [tab, setTab] = useState<Tab>("chat");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "flow", label: "Flow", icon: <Wand2 size={13} /> },
    { id: "chat", label: "Chat", icon: <MessageSquare size={13} /> },
    { id: "studio", label: "Studio", icon: <Wand2 size={13} /> },
    { id: "workspace", label: "Workspace", icon: <FolderOpen size={13} /> },
    { id: "control", label: "Control Room", icon: <Settings2 size={13} /> },
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-4 pt-3"><AgentIdentityHeader name="Gemini" provider="Google · Gemini" context="gemini flow agent" /></div>
      {/* Tab bar */}
      <header
        className="flex items-center gap-3 px-4 py-0 shrink-0 border-b"
        style={{ background: `${COLOR}08`, borderColor: `${COLOR}28` }}
      >
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 my-2"
          style={{
            background: `${COLOR}18`,
            borderColor: `${COLOR}40`,
            border: `1px solid ${COLOR}40`,
          }}
        >
          <GeminiLogo size={18} />
        </div>
        <span className="text-[13px] font-bold mr-1" style={{ color: "#e8f4ff" }}>
          Gemini 3.5 Flash
        </span>

        <div className="flex items-end gap-0 ml-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 transition-colors"
                style={{
                  borderBottomColor: active ? COLOR : "transparent",
                  color: active ? "#e8f4ff" : "rgba(255,255,255,0.45)",
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto my-2">
          <StatusDot />
        </div>
      </header>

      {tab === "chat" && (
        <FullChat
          agent="gemini"
          agentName="Gemini 2.5 Flash"
          agentColor={COLOR}
          storageKey="claude-os.chat.gemini.v1"
          welcomeMessage="Hi! I'm Gemini 3.5 Flash — Google's fastest frontier model with 1M token context. I can reason through complex problems, write and review code, analyse data, and handle long documents. What would you like to work on?"
          placeholder="Ask Gemini anything... (Shift+Enter for new line)"
          className="flex-1 min-h-0"
        />
      )}
      {tab === "flow" && <GeminiFlowTab />}
      {tab === "studio" && <StudioTab />}
      {tab === "workspace" && <WorkspaceTab />}
      {tab === "control" && <ControlRoomTab />}
    </div>
  );
}
