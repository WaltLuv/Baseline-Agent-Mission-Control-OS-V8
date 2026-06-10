/**
 * OpenClaw — 5-tab layout:
 *   Control Panel  — links to real OpenClaw UI, status-aware info card
 *   Chat           — FullChat wired to the openclaw agent (ChatGPT 5.5)
 *   Studio         — Content generation powered by OpenClaw
 *   Workspace      — Files created by OpenClaw agents
 *   Control Room   — Configuration and agent management
 */

import { createFileRoute } from "@tanstack/react-router";
import { AgentIdentityHeader } from "@/components/graphify-awareness";
import { useEffect, useState } from "react";
import { ExternalLink, Terminal, MessageSquare, Zap, Shield, GitBranch, Bug, Wand2, FolderOpen, Settings2, Copy, Check, KeyRound } from "lucide-react";
import openclawLogo from "@/assets/openclaw.png";
import { FullChat } from "@/components/full-chat";
import { AgentWorkspace } from "@/components/agent-workspace";
import { StudioToolbox } from "@/components/studio-toolbox";
import { EnvStatusPanel } from "@/components/env-status-panel";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";

export const Route = createFileRoute("/agents/openclaw")({
  head: () => ({
    meta: [
      { title: "OpenClaw — Baseline Automations" },
      { name: "description", content: "OpenClaw: multi-agent coding swarm control panel + chat." },
    ],
  }),
  component: OpenClawPage,
});

const TONE = "#EF4444";
const DEFAULT_GATEWAY_URL = "http://localhost:18789";
const STATUS_URL = "/__openclaw_status";
const TOKEN_URL = "/__openclaw_token";

// ── Gateway status + token probe ──────────────────────────────────────────────

type GatewayState = "checking" | "up" | "down";

function useGatewayProbe(): {
  state: GatewayState;
  assistantName: string;
  token: string | null;
  gatewayUrl: string;
} {
  const [state, setState] = useState<GatewayState>("checking");
  const [assistantName, setAssistantName] = useState("Phil Gaston");
  const [token, setToken] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string>(DEFAULT_GATEWAY_URL);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const [statusRes, tokenRes] = await Promise.all([
          fetch(STATUS_URL, { signal: AbortSignal.timeout(5000) }),
          fetch(TOKEN_URL, { signal: AbortSignal.timeout(5000) }),
        ]);
        if (statusRes.ok) {
          const j = await statusRes.json() as { running: boolean; assistantName?: string };
          if (!cancelled) {
            setState(j.running ? "up" : "down");
            if (j.assistantName) setAssistantName(j.assistantName);
          }
        } else if (!cancelled) { setState("down"); }
        if (tokenRes.ok) {
          const j = await tokenRes.json() as { token: string | null; url: string };
          if (!cancelled) {
            setToken(j.token);
            if (j.url) setGatewayUrl(j.url);
          }
        }
      } catch { if (!cancelled) setState("down"); }
    };
    void probe();
    return () => { cancelled = true; };
  }, []);

  return { state, assistantName, token, gatewayUrl };
}

// ── Token-copy button ─────────────────────────────────────────────────────────

function TokenCopyCard({ token, gatewayUrl }: { token: string | null; gatewayUrl: string }) {
  const [copied, setCopied] = useState(false);

  if (!token) {
    return (
      <div className="w-full max-w-lg rounded-xl border p-4" style={{ background: "rgba(0,0,0,0.3)", borderColor: `${TONE}30` }}>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Gateway token not found</div>
        <div className="text-[12px] text-muted-foreground">Could not read <code style={{ color: TONE }}>~/.openclaw/openclaw.json</code>. Run <code style={{ color: TONE }}>openclaw doctor --generate-gateway-token</code> to create one.</div>
      </div>
    );
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard may be blocked — user can select manually */ }
  };

  return (
    <div className="w-full max-w-lg rounded-xl border p-4 text-left" style={{ background: "rgba(0,0,0,0.35)", borderColor: `${TONE}30` }}>
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="h-3.5 w-3.5" style={{ color: TONE }} />
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Gateway token — paste in Control UI → Settings</div>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] font-mono px-2.5 py-1.5 rounded-md truncate" style={{ background: "rgba(0,0,0,0.5)", color: "#ffe4e4", border: `1px solid ${TONE}22` }}>{token}</code>
        <button onClick={onCopy} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all hover:opacity-90 active:scale-95" style={{ background: copied ? "#10B981" : TONE, color: "#fff" }}>
          {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground mt-2 leading-snug">
        Seeing <span style={{ color: "#f87171" }}>"unauthorized: gateway token missing"</span>? Open <a href={gatewayUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: TONE }}>{gatewayUrl}</a>, click the Settings gear, paste this token, save.
      </div>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ state }: { state: GatewayState }) {
  const dot =
    state === "up"
      ? { bg: "#10B98118", border: "#10B98155", color: "#10B981", label: "LIVE" }
      : state === "down"
        ? { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.35)", color: "#f87171", label: "OFFLINE" }
        : { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", color: "#6b7280", label: "CHECKING…" };

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]" style={{ background: dot.bg, borderColor: dot.border, color: dot.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot.color, boxShadow: state === "up" ? `0 0 6px ${dot.color}` : "none" }} />
      {dot.label}
    </span>
  );
}

// ── Control Panel tab ─────────────────────────────────────────────────────────

const CAPABILITIES = [
  { icon: GitBranch, label: "Multi-agent swarm management" },
  { icon: MessageSquare, label: "WhatsApp & Telegram integrations" },
  { icon: Terminal, label: "Session history, skills, canvas" },
  { icon: Bug, label: "Code review, debugging, refactoring" },
  { icon: Zap, label: "Automated workflows & cron jobs" },
  { icon: Shield, label: "Security audits & test generation" },
];

function ControlPanelTab({ gatewayState, gatewayUrl, token }: { gatewayState: GatewayState; gatewayUrl: string; token: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 px-8 py-10 text-center">
      <div className="flex flex-col items-center gap-4">
        <img src={openclawLogo} alt="OpenClaw" className="h-20 object-contain" style={{ filter: `drop-shadow(0 0 28px ${TONE}66)` }} />
        <div>
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: "#ffe4e4" }}>OpenClaw Control Panel</h1>
          <p className="text-[14px] text-muted-foreground mt-1.5 max-w-lg">
            The full OpenClaw UI runs at{" "}
            <code className="text-[13px] font-mono" style={{ color: TONE }}>localhost:18789</code>.
            Click below to open it in a new tab for the complete experience.
          </p>
        </div>
        <StatusPill state={gatewayState} />
      </div>

      <a href={gatewayUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 text-[15px] font-bold px-8 py-4 rounded-2xl transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95" style={{ background: `linear-gradient(135deg, ${TONE}, #b91c1c)`, color: "#fff", boxShadow: `0 8px 32px -8px ${TONE}88` }}>
        <ExternalLink className="h-5 w-5" />
        Open OpenClaw Control Panel
      </a>

      <TokenCopyCard token={token} gatewayUrl={gatewayUrl} />

      <div className="w-full max-w-lg rounded-2xl border p-6 text-left" style={{ background: "rgba(0,0,0,0.35)", borderColor: `${TONE}28` }}>
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">What you can do in the Control Panel</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${TONE}18`, border: `1px solid ${TONE}30` }}>
                <Icon className="h-3.5 w-3.5" style={{ color: TONE }} />
              </div>
              <span className="text-[12px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {gatewayState === "down" && (
        <div className="w-full max-w-lg rounded-xl border p-4" style={{ background: "rgba(0,0,0,0.3)", borderColor: `${TONE}30` }}>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Gateway is offline — start it with</div>
          <code className="text-[12px] font-mono block" style={{ color: TONE }}>openclaw gateway run</code>
          <div className="text-[10px] text-muted-foreground mt-2">Gateway will start at localhost:18789</div>
        </div>
      )}
    </div>
  );
}

// ── Studio tab ────────────────────────────────────────────────────────────────

function StudioTab() {
  return <StudioToolbox namespace="openclaw" agent="openclaw" tone={TONE} brand="OpenClaw" />;
}

// ── Workspace tab ─────────────────────────────────────────────────────────────

function WorkspaceTab() {
  return <AgentWorkspace agent="openclaw" tone={TONE} emptyHint="No OpenClaw artifacts yet. Spawn agents to populate this gallery." />;
}

// ── Control Room tab ──────────────────────────────────────────────────────────

function ControlRoomTab({ gatewayState, gatewayUrl, token }: { gatewayState: GatewayState; gatewayUrl: string; token: string | null }) {
  const config = [
    { label: "Gateway URL", value: gatewayUrl },
    { label: "Status", value: gatewayState === "up" ? "Running" : gatewayState === "down" ? "Offline" : "Checking…" },
    { label: "Start Command", value: "openclaw gateway run" },
    { label: "Model", value: "ChatGPT 5.5" },
    { label: "Mode", value: "Multi-agent swarm" },
    { label: "Integrations", value: "Telegram, WhatsApp" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 size={16} style={{ color: TONE }} />
          <h3 className="text-sm font-semibold">OpenClaw Control Room</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {config.map((item) => (
            <div key={item.label} className="p-3 rounded-lg" style={{ background: `${TONE}08`, border: `1px solid ${TONE}22` }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--cream-mute)" }}>{item.label}</div>
              <div className="text-[12px] font-mono font-semibold truncate" style={{ color: "#ffe4e4" }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <a href={gatewayUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition" style={{ background: `linear-gradient(135deg, ${TONE}33, ${TONE}11)`, border: `1px solid ${TONE}44`, color: "#ffe4e4" }}>
            <ExternalLink size={13} /> Open OpenClaw Gateway ({gatewayUrl})
          </a>
        </div>
        <TokenCopyCard token={token} gatewayUrl={gatewayUrl} />
        <div className="p-4 rounded-lg text-[12px]" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--cream-dim)" }}>
          <div className="font-semibold mb-2" style={{ color: "var(--cream)" }}>Quick Commands</div>
          <div className="space-y-1 font-mono text-[11px]">
            <div><span style={{ color: TONE }}>$</span> openclaw gateway run</div>
            <div><span style={{ color: TONE }}>$</span> openclaw health</div>
            <div><span style={{ color: TONE }}>$</span> openclaw agents list</div>
            <div><span style={{ color: TONE }}>$</span> openclaw doctor</div>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <EnvStatusPanel tone={TONE} groups={["core", "providers", "media", "higgsfield", "integrations", "twilio"]} compact />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "panel" | "chat" | "studio" | "workspace" | "control";

function OpenClawPage() {
  const { state: gatewayState, gatewayUrl, token } = useGatewayProbe();
  const [activeTab, setActiveTab] = useState<Tab>("panel");

  const tabs: { id: Tab; label: string; icon?: React.ReactNode }[] = [
    { id: "panel",     label: "Control Panel" },
    { id: "chat",      label: "Chat" },
    { id: "studio",    label: "Studio" },
    { id: "workspace", label: "Workspace" },
    { id: "control",   label: "Control Room" },
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-4 pt-3 space-y-2">
        <AgentIdentityHeader name="OpenClaw" provider="OpenClaw runtime" context="openclaw swarm execution" />
        <RuntimeCredentialStatus
          providerIds={["openclaw", "openai"]}
          model={`openai/${process.env.CODEX_MODEL || "gpt-4o"}`}
          variant="inline"
        />
      </div>
      {/* Tab bar */}
      <header className="flex items-center gap-4 px-4 py-0 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <img src={openclawLogo} alt="OpenClaw" className="h-6 object-contain shrink-0 my-2" style={{ filter: `drop-shadow(0 0 6px ${TONE}55)` }} />
        <span className="text-[13px] font-bold mr-1" style={{ color: "#ffe4e4" }}>OpenClaw</span>

        <div className="flex items-end gap-0 ml-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors" style={{ borderBottomColor: active ? TONE : "transparent", color: active ? "#ffe4e4" : "rgba(255,255,255,0.45)" }}>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 my-2">
          <StatusPill state={gatewayState} />
          <a href={gatewayUrl} target="_blank" rel="noopener noreferrer" title="Open OpenClaw in new tab" className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95" style={{ background: `linear-gradient(135deg, ${TONE}, #b91c1c)`, color: "#fff" }}>
            <ExternalLink className="h-3 w-3" />
            Open Tab
          </a>
        </div>
      </header>

      {/* Tab content */}
      {activeTab === "panel"     && <ControlPanelTab gatewayState={gatewayState} gatewayUrl={gatewayUrl} token={token} />}
      {activeTab === "chat"      && (
        <FullChat
          agent="openclaw"
          agentName="OpenClaw"
          agentColor={TONE}
          storageKey="claude-os.chat.openclaw.v1"
          welcomeMessage="OpenClaw coding agent ready (powered by ChatGPT 5.5). I can review code, write tests, refactor, migrate, hunt bugs, and decompose complex codebases. Paste code or describe your task."
          placeholder="Describe a coding task… paste code, repo URL, or ask anything"
          className="flex-1 min-h-0"
        />
      )}
      {activeTab === "studio"    && <StudioTab />}
      {activeTab === "workspace" && <WorkspaceTab />}
      {activeTab === "control"   && <ControlRoomTab gatewayState={gatewayState} gatewayUrl={gatewayUrl} token={token} />}
    </div>
  );
}
