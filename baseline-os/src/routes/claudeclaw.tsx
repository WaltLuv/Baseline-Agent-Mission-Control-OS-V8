/**
 * ClaudeClaw — your Claude Code CLI, delivered to your phone via Telegram.
 *
 * Mirrors the WaltLuv/claudeclaw-os repo layout: 8 surfaces, one bot, one
 * machine. Tabs (mapped to the repo's design):
 *
 *   Chat         — Talk to the local claude CLI like you would in Telegram
 *   War Room     — Multi-agent text group chat (uses Maestro bus)
 *   Mission      — Kanban board: inbox / running / done per agent
 *   Hive Mind    — Cross-agent activity feed (anatomical brain placeholder)
 *   Scheduled    — Cron tasks with plain-English descriptions
 *   Agents       — Specialist roster (receptionist / dispatcher / account manager / compliance / CFO)
 *   Memory       — SQLite-backed memory with importance + decay (preview)
 *   Setup        — BotFather token wizard + Telegram bridge install steps
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  MessageSquare, Sparkles, FolderOpen, Settings2, Terminal, ExternalLink,
  RefreshCw, Send, Phone, Users, ListChecks, Calendar, Activity, Brain,
  Mic, Headphones, Copy, CheckCircle2, Plus, ArrowRight, Database, Crown,
} from "lucide-react";
import { FullChat } from "@/components/full-chat";
import { AgentWorkspace } from "@/components/agent-workspace";
import { EnvStatusPanel } from "@/components/env-status-panel";

export const Route = createFileRoute("/claudeclaw")({
  head: () => ({
    meta: [
      { title: "Claude Code — Baseline Automations" },
      { name: "description", content: "Your Claude Code CLI, delivered to your phone via Telegram. 8 surfaces, one bot, one machine." },
    ],
  }),
  component: ClaudeClawPage,
});

const TONE = "#D97757"; // Anthropic terracotta
type Tab = "chat" | "warroom" | "mission" | "hive" | "scheduled" | "agents" | "memory" | "specialists" | "setup";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "chat",        label: "Chat",            icon: <MessageSquare size={13} /> },
  { id: "warroom",     label: "War Room",        icon: <Users size={13} /> },
  { id: "mission",     label: "Mission",         icon: <ListChecks size={13} /> },
  { id: "hive",        label: "Hive Mind",       icon: <Brain size={13} /> },
  { id: "scheduled",   label: "Scheduled",       icon: <Calendar size={13} /> },
  { id: "agents",      label: "Agents",          icon: <Sparkles size={13} /> },
  { id: "memory",      label: "Memory",          icon: <Database size={13} /> },
  { id: "specialists", label: "Specialist Team", icon: <Users size={13} /> },
  { id: "setup",       label: "Setup",           icon: <Settings2 size={13} /> },
];

type Backend = "claudeclaw" | "codex" | "claude-code";
const BACKEND_KEY = "claude-os.claudeclaw.backend.v1";
function loadBackend(): Backend {
  if (typeof window === "undefined") return "claudeclaw";
  try {
    const v = localStorage.getItem(BACKEND_KEY);
    if (v === "codex" || v === "claude-code") return v;
    return "claudeclaw";
  } catch { return "claudeclaw"; }
}
function saveBackend(b: Backend) {
  try { localStorage.setItem(BACKEND_KEY, b); } catch { /* skip */ }
}

function ClaudeClawPage() {
  const [tab, setTab] = useState<Tab>("chat");
  const [backend, setBackendState] = useState<Backend>(() => loadBackend());
  const setBackend = (b: Backend) => { setBackendState(b); saveBackend(b); };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-0 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-7 w-7 rounded-lg flex items-center justify-center my-2" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Terminal size={14} />
        </div>
        <span className="text-[13px] font-bold mr-1" style={{ color: "#ffe4d6" }}>Claude Code</span>
        <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: `${TONE}18`, color: TONE, border: `1px solid ${TONE}40` }}>Claude → Telegram</span>
        <div className="flex items-end gap-0 ml-2 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 transition-colors shrink-0" style={{ borderBottomColor: active ? TONE : "transparent", color: active ? "#ffe4d6" : "rgba(255,255,255,0.45)" }}>
                {t.icon}{t.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto my-2 flex items-center gap-2">
          {/* Backend toggle — 3 runtimes:
                · Claude (claudeclaw persona via OpenRouter) — default, conversational
                · Claude CLI (real `claude` binary spawned for repo-grade work)
                · Codex CLI (real `codex` binary fallback)
              All three share the same chat surface; only the spawn target changes. */}
          <div className="flex items-center gap-0 rounded-md overflow-hidden" style={{ border: "1px solid var(--panel-border)" }}>
            <button
              onClick={() => setBackend("claudeclaw")}
              title="Use Claude (ClaudeClaw persona via OpenRouter) — default"
              className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold transition"
              style={{
                background: backend === "claudeclaw" ? `${TONE}28` : "transparent",
                color: backend === "claudeclaw" ? TONE : "rgba(255,255,255,0.55)",
              }}
            >
              Claude
            </button>
            <button
              onClick={() => setBackend("claude-code")}
              title="Spawn the real `claude` CLI for repo-scoped work"
              className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold transition"
              style={{
                background: backend === "claude-code" ? "rgba(167,139,250,0.28)" : "transparent",
                color: backend === "claude-code" ? "#a78bfa" : "rgba(255,255,255,0.55)",
              }}
            >
              Claude CLI
            </button>
            <button
              onClick={() => setBackend("codex")}
              title="Toggle to Codex CLI — fallback when Claude is down"
              className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold transition"
              style={{
                background: backend === "codex" ? "rgba(34,197,94,0.28)" : "transparent",
                color: backend === "codex" ? "#22c55e" : "rgba(255,255,255,0.55)",
              }}
            >
              Codex
            </button>
          </div>
          <ClaudeStatusDot />
        </div>
      </header>

      {tab === "chat"      && <ChatTab backend={backend} />}
      {tab === "warroom"   && <WarRoomTab />}
      {tab === "mission"   && <MissionTab />}
      {tab === "hive"      && <HiveTab />}
      {tab === "scheduled" && <ScheduledTab />}
      {tab === "agents"    && <AgentsTab />}
      {tab === "memory"    && <MemoryTab backend={backend} />}
      {tab === "specialists" && <SpecialistTeamTab />}
      {tab === "setup"     && <SetupTab />}
    </div>
  );
}

function ClaudeStatusDot() {
  const [status, setStatus] = useState<"checking" | "live" | "offline">("checking");
  useEffect(() => {
    let cancel = false;
    fetch("/__vitals").then((r) => r.json()).then((j: { claude?: { ok?: boolean } }) => { if (!cancel) setStatus(j.claude?.ok ? "live" : "offline"); }).catch(() => { if (!cancel) setStatus("offline"); });
    return () => { cancel = true; };
  }, []);
  const styles = {
    live:     { background: "#10B98118", borderColor: "#10B98155", color: "#10B981" },
    offline:  { background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)", color: "#f87171" },
    checking: { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: "#6b7280" },
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]" style={styles[status]}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "animate-pulse" : ""}`} style={{ background: status === "live" ? "#10B981" : status === "offline" ? "#ef4444" : "#6b7280" }} />
      claude {status === "live" ? "live" : status === "offline" ? "offline" : "…"}
    </span>
  );
}

// ─── Chat tab ───────────────────────────────────────────────────────────────

function ChatTab({ backend }: { backend: Backend }) {
  const welcome =
    backend === "codex"
      ? "Claude Code on Codex CLI fallback. Same chat surface — code edits, shell exec, browser. Switch back to Claude when it's healthy."
      : backend === "claude-code"
        ? "Claude Code CLI live. This routes to the real `claude` binary spawned in this repo — full tool access, repo-grade reasoning. What are we building?"
        : "Claude Code ready. Same chat surface as Telegram — 219 shared skills, both memory layers (Obsidian + Notion), Pinecone vector store, NotebookLM cited research, Maestro peer bus, browser-use harness, and the full Claude Code toolbelt. What are we building?";
  const agentName =
    backend === "codex" ? "Claude Code · Codex CLI"
    : backend === "claude-code" ? "Claude Code · CLI"
    : "Claude Code";
  const placeholder =
    backend === "codex" ? "Talk to Codex CLI…"
    : backend === "claude-code" ? "Talk to the local `claude` CLI…"
    : "Talk to Claude Code like you would on your phone…";
  return (
    <FullChat
      agent={backend}
      agentName={agentName}
      agentColor={TONE}
      storageKey={`claude-os.chat.claudeclaw.${backend}.v1`}
      welcomeMessage={welcome}
      placeholder={placeholder}
      className="flex-1 min-h-0"
    />
  );
}

// ─── War Room tab ───────────────────────────────────────────────────────────

const AGENTS = [
  { id: "gemini", label: "Gemini", color: "#4F8EF7" },
  { id: "openclaw", label: "OpenClaw", color: "#EF4444" },
  { id: "hermes-mcp", label: "Hermes", color: "#06B6D4" },
  { id: "claudeclaw", label: "ClaudeClaw", color: TONE },
  { id: "codex", label: "Codex", color: "#22c55e" },
  { id: "studio", label: "Studio", color: "#a855f7" },
];

function WarRoomTab() {
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState<{ agent: string; body: string; ts: number }[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["gemini", "openclaw", "hermes-mcp", "claudeclaw"]);

  function toggleAgent(id: string) {
    setSelectedAgents((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  async function standup() {
    if (!topic.trim() || running) return;
    setRunning(true);
    setTranscript([]);
    for (const id of selectedAgents) {
      const meta = AGENTS.find((a) => a.id === id)!;
      let out = "";
      try {
        const r = await fetch("/__ai_chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agent: id,
            prompt: `[STANDUP] Topic: ${topic}\n\nYou're in the War Room with peers ${selectedAgents.filter((x) => x !== id).join(", ")}. Give your 2-3 sentence position, owning the lane you're best at. Be specific, be sharp, no fluff.`,
          }),
        });
        if (r.body) {
          const reader = r.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n"); buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try { const evt = JSON.parse(line) as { type?: string; delta?: string }; if (evt.type === "delta" && evt.delta) out += evt.delta; } catch {}
            }
          }
        }
      } catch (e) { out = `(error: ${String(e)})`; }
      setTranscript((t) => [...t, { agent: meta.label, body: out.trim() || "(no response)", ts: Date.now() }]);

      // Log to Maestro bus
      try {
        await fetch("/__agent_message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from: id, to: "all", subject: `Standup: ${topic.slice(0, 80)}`, body: out.slice(0, 8000) }),
        });
      } catch {}
    }
    setRunning(false);
  }

  return (
    <div className="flex-1 flex" style={{ minHeight: 0 }}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} style={{ color: TONE }} />
            <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>War Room · text mode</h3>
            <span className="ml-auto text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{selectedAgents.length} agents speaking</span>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {AGENTS.map((a) => {
              const on = selectedAgents.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggleAgent(a.id)} className="px-2.5 py-1 rounded-full text-[11px] transition" style={{ background: on ? `${a.color}22` : "rgba(255,255,255,0.04)", border: `1px solid ${on ? a.color : "var(--panel-border)"}`, color: on ? "#fff" : "var(--fg-dim)" }}>
                  {a.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-end gap-2">
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder="Topic for the standup — e.g. 'How do we ship the Q3 launch in 30 days?'" className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none resize-y" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)" }} />
            <button onClick={standup} disabled={!topic.trim() || running || selectedAgents.length === 0} className="px-4 h-[36px] rounded-lg flex items-center gap-1.5 text-[12px] font-semibold transition disabled:opacity-40" style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}>
              {running ? <><RefreshCw size={12} className="animate-spin" /> Running…</> : <>/standup</>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scroll">
          {transcript.length === 0 && !running && (
            <div className="text-center py-16" style={{ color: "var(--fg-dimmer)" }}>
              <Users size={40} style={{ opacity: 0.25, margin: "0 auto 12px" }} />
              <div className="text-[13px] mb-1" style={{ color: "var(--fg)" }}>Pick agents, set a topic, hit /standup</div>
              <div className="text-[11px]">Every reply also lands in the Maestro bus.</div>
            </div>
          )}
          <div className="space-y-4 max-w-3xl mx-auto">
            {transcript.map((t, i) => {
              const a = AGENTS.find((x) => x.label === t.agent);
              return (
                <div key={i} className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${a?.color ?? "var(--panel-border)"}44` }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: a?.color ?? "var(--fg-dim)" }}>{t.agent}</div>
                  <div className="text-[12.5px] whitespace-pre-wrap leading-relaxed" style={{ color: "#fff" }}>{t.body}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mission Control tab ────────────────────────────────────────────────────

function MissionTab() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <iframe src="/kanban" className="flex-1" style={{ border: 0, background: "transparent" }} title="Mission Control" />
    </div>
  );
}

// ─── Hive Mind tab ──────────────────────────────────────────────────────────

interface HiveMessage { id: string; from: string; to: string; subject: string; body: string; ts: number }

function HiveTab() {
  const [messages, setMessages] = useState<HiveMessage[]>([]);

  async function load() {
    try { const r = await fetch("/__agent_message?limit=80"); const j = await r.json(); setMessages((j.messages ?? []).slice().reverse()); } catch {}
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 scroll">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: TONE }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Hive Mind · cross-agent activity</h3>
        </div>
        <a href="/maestro" className="text-[11px] flex items-center gap-1" style={{ color: TONE }}>Open full Maestro bus <ArrowRight size={11} /></a>
      </div>
      <div className="space-y-2 max-w-3xl">
        {messages.length === 0 && (
          <div className="text-center py-12" style={{ color: "var(--fg-dimmer)" }}>
            <Brain size={36} style={{ opacity: 0.25, margin: "0 auto 10px" }} />
            <div className="text-[12px]">No cross-agent activity yet — run a /standup in the War Room.</div>
          </div>
        )}
        {messages.map((m) => {
          const fa = AGENTS.find((a) => a.id === m.from);
          return (
            <div key={m.id} className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)" }}>
              <div className="flex items-center gap-2 text-[10px] mb-1">
                <span className="px-1.5 py-0.5 rounded font-semibold" style={{ background: `${fa?.color ?? "#888"}22`, color: fa?.color ?? "var(--fg-dim)" }}>{fa?.label ?? m.from}</span>
                <ArrowRight size={9} style={{ color: "var(--fg-dimmer)" }} />
                <span style={{ color: "var(--fg-dimmer)" }}>{m.to}</span>
                <span className="ml-auto" style={{ color: "var(--fg-dimmer)" }}>{new Date(m.ts).toLocaleTimeString()}</span>
              </div>
              {m.subject && <div className="text-[11.5px] font-semibold mb-0.5" style={{ color: "#fff" }}>{m.subject}</div>}
              <div className="text-[11px] line-clamp-2" style={{ color: "var(--fg-dim)" }}>{m.body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scheduled tasks tab ────────────────────────────────────────────────────

function ScheduledTab() {
  const examples = [
    { cron: "0 9 * * 1", desc: "Every Monday at 9am", task: "Summarize AI news from the past week" },
    { cron: "0 8 * * 1-5", desc: "Every weekday at 8am", task: "Check my calendar + inbox and give me a briefing" },
    { cron: "0 */4 * * *", desc: "Every 4 hours", task: "Check for new client emails, flag urgent" },
    { cron: "0 7 * * *", desc: "Every day at 7am", task: "Daily dream review — audit last 24h" },
  ];
  return (
    <div className="flex-1 overflow-y-auto p-6 scroll space-y-5">
      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: TONE }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Scheduled tasks</h3>
        </div>
        <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
          ClaudeClaw uses plain-English descriptions for cron jobs. Tell it what you want, when you want it. Backed by the existing <code style={{ color: TONE }}>~/.claude-os/cron</code> + launchd integration.
        </p>
        <div className="space-y-2">
          {examples.map((e, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center p-2 rounded text-[11px]" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)" }}>
              <code className="font-mono" style={{ color: TONE }}>{e.cron}</code>
              <div>
                <div className="text-[12px]" style={{ color: "#fff" }}>{e.task}</div>
                <div style={{ color: "var(--fg-dimmer)" }}>{e.desc}</div>
              </div>
              <button onClick={() => navigator.clipboard.writeText(`hermes cron "${e.task}" "${e.cron}"`)} className="p-1.5 rounded" style={{ color: "var(--fg-dim)" }}><Copy size={11} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Agents roster tab ──────────────────────────────────────────────────────

const SPECIALIST_AGENTS = [
  {
    id: "receptionist",
    label: "Receptionist",
    job: "Front desk · Intake · Scheduling · Caller triage · First response",
    desc: "Owns first touch across inbound messages: captures context, answers routine questions, schedules next steps, and routes the work to the right Baseline specialist.",
    channels: ["Telegram intake", "Lead capture", "Scheduling", "Caller triage", "Customer first response"],
    outcomes: ["greet and qualify inbound contacts", "capture complete contact details", "answer routine questions", "schedule next steps", "route qualified work to Dispatcher"],
    skills: ["telegram-gateway", "day5-voiceops-receptionist", "day5-voiceops-receptionist-script", "productivity/google-workspace", "note-taking/obsidian"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "warm, concise, organized, intake-first, escalation-aware",
    summon: ["Receptionist", "front desk", "intake this", "new lead", "triage this"],
  },
  {
    id: "dispatcher",
    label: "Dispatcher",
    job: "Dispatch desk · Work orders · Vendor routing · Follow-through",
    desc: "Converts intake into assigned work: creates tasks, routes issues to the correct owner or vendor, tracks status, and keeps the operator informed until the loop is closed.",
    channels: ["Work orders", "Vendor routing", "Task assignment", "Status follow-up", "Escalations"],
    outcomes: ["turn intake into concrete tasks", "assign each item to the right owner", "track due dates and blockers", "send concise status updates", "escalate stalled work"],
    skills: ["devops/kanban-worker", "devops/kanban-orchestrator", "day6-workorder-flow-script", "productivity/google-workspace", "note-taking/obsidian"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "direct, checklist-driven, calm under load, ownership-focused",
    summon: ["Dispatcher", "dispatch this", "route this", "make a work order", "track this"],
  },
  {
    id: "account-manager",
    label: "Account Manager",
    job: "Account desk · Client updates · Renewals · Relationship follow-up",
    desc: "Owns the client relationship after intake: keeps accounts warm, prepares updates, follows up on commitments, and protects retention and expansion opportunities.",
    channels: ["Client updates", "Renewals", "Follow-up cadences", "Owner relations", "Expansion opportunities"],
    outcomes: ["summarize account status", "draft client-ready updates", "track promises and next steps", "surface renewal and upsell risks", "coordinate with CFO and Compliance Officer"],
    skills: ["sales/revenue-operations", "productivity/google-workspace", "apple/imessage", "note-taking/obsidian", "telegram-gateway"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "commercial, relationship-aware, crisp, accountable",
    summon: ["Account Manager", "account manager", "client follow-up", "renewal risk", "account update"],
  },
  {
    id: "compliance-officer",
    label: "Compliance Officer",
    job: "Compliance desk · Policy checks · Risk review · Documentation",
    desc: "Reviews proposed actions, messages, workflows, and records for policy, legal, contractual, and operational risk before execution.",
    channels: ["Policy checks", "Risk review", "Documentation", "Approvals", "Audit trail"],
    outcomes: ["flag policy and contractual risk", "separate facts from assumptions", "prepare approval notes", "maintain audit-ready records", "recommend safer execution paths"],
    skills: ["research/llm-wiki", "research/blogwatcher", "productivity/ocr-and-documents", "note-taking/obsidian", "mandatory-execution-approval"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "precise, conservative, evidence-first, approval-aware",
    summon: ["Compliance Officer", "compliance", "risk check", "review this", "approval note"],
  },
  {
    id: "cfo",
    label: "CFO",
    job: "Finance desk · Pricing · Cash flow · Billing · Forecasts",
    desc: "Owns financial judgment for Baseline: pricing, cash flow, billing follow-up, margin checks, forecasts, and revenue operations decisions.",
    channels: ["Pricing", "Cash flow", "Billing", "Forecasts", "Revenue operations", "Margin checks"],
    outcomes: ["review pricing and margin", "prepare billing and collections actions", "forecast cash impact", "spot revenue leaks", "recommend the next financial decision"],
    skills: ["sales/revenue-operations", "repair-cost-guide-pricing", "spec-kit", "productivity/google-workspace", "note-taking/obsidian"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "numbers-first, blunt, practical, decision-oriented",
    summon: ["CFO", "finance", "pricing check", "cash flow", "billing review"],
  },
];

function AgentsTab() {
  return (
    <div className="flex-1 overflow-y-auto p-6 scroll space-y-5">
      <div className="panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={14} style={{ color: TONE }} />
            <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Specialist team</h3>
          </div>
          <a href="/agents/hermes" className="text-[11px] flex items-center gap-1" style={{ color: TONE }}>Hermes pantheon <ArrowRight size={11} /></a>
        </div>
        <p className="text-[12px] max-w-3xl" style={{ color: "var(--cream-mute)" }}>
          These Baseline specialists are generated by the local agent setup script. Each one runs on the same ClaudeClaw stack, shares memory and Maestro routing, and carries its own job, intake lanes, skills, tone, and summon phrases.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {SPECIALIST_AGENTS.map((a) => (
            <div key={a.id} className="p-4 rounded-lg space-y-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: TONE }}>{a.label}</div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: "var(--cream-dim)" }}>{a.job}</div>
                  </div>
                  <code className="text-[9px] px-2 py-1 rounded shrink-0" style={{ background: `${TONE}14`, border: `1px solid ${TONE}30`, color: TONE }}>{a.id}</code>
                </div>
                <div className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--cream-mute)" }}>{a.desc}</div>
              </div>

              <AgentPills label="Channels" items={a.channels} />
              <AgentPills label="Outcomes" items={a.outcomes} />
              <AgentPills label="Skills" items={a.skills} mono />
              <AgentPills label="Summon" items={a.summon} />

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-start">
                <div>
                  <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "var(--cream-dim)" }}>Tone</div>
                  <div className="text-[10.5px]" style={{ color: "var(--cream-mute)" }}>{a.tone}</div>
                </div>
                <pre className="text-[9.5px] font-mono p-2 rounded overflow-x-auto" style={{ background: "rgba(0,0,0,0.4)", color: "var(--fg-dim)" }}>{`npm run agent:create --id ${a.id}`}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentPills({ label, items, mono = false }: { label: string; items: string[]; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: "var(--cream-dim)" }}>{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={`${mono ? "font-mono" : ""} text-[9.5px] px-2 py-1 rounded-full`} style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--cream-mute)" }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Memory tab ─────────────────────────────────────────────────────────────

function MemoryTab({ backend }: { backend: Backend }) {
  return (
    <div className="flex-1 overflow-y-auto p-6 scroll space-y-5">
      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Database size={14} style={{ color: TONE }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>3-layer memory model</h3>
        </div>
        <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
          ClaudeClaw uses the same 3-brain pattern documented in the repo: short-term (CLAUDE.md identity), mid-term (project-folder CLAUDE.md + memory/), long-term (Pinecone + Notion + Obsidian).
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Short-term", desc: "Who you are · global CLAUDE.md", href: "/settings", color: "#10B981" },
            { label: "Mid-term",   desc: "What you're working on · project memory/",  href: "/memory", color: TONE },
            { label: "Long-term",  desc: "Past expert knowledge · Pinecone + Notion", href: "/pinecone", color: "#22D3EE" },
          ].map((b) => (
            <a key={b.label} href={b.href} className="p-4 rounded-lg transition" style={{ background: `${b.color}08`, border: `1px solid ${b.color}33` }}>
              <div className="text-[12.5px] font-semibold mb-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-[10.5px]" style={{ color: "var(--cream-dim)" }}>{b.desc}</div>
            </a>
          ))}
        </div>
      </div>
      <AgentWorkspace agent={backend} tone={TONE} emptyHint="ClaudeClaw workspace artifacts will appear here." />
    </div>
  );
}

// ─── Setup tab ──────────────────────────────────────────────────────────────

interface PluginInfo { installed: boolean; version?: string; path?: string; }
interface PluginStatus { claude: PluginInfo; codex: PluginInfo; gemini: PluginInfo; }

function SetupTab() {
  const [envStatus, setEnvStatus] = useState<{ telegramSet: boolean; chatIdSet: boolean } | null>(null);
  const [plugins, setPlugins] = useState<PluginStatus | null>(null);

  useEffect(() => {
    fetch("/__env_status").then((r) => r.json()).then((j: { keys: { name: string; present: boolean }[] }) => {
      const tg = j.keys.find((k) => k.name === "TELEGRAM_BOT_TOKEN")?.present ?? false;
      setEnvStatus({ telegramSet: tg, chatIdSet: false });
    });
    fetch("/__plugin_status").then((r) => r.json()).then(setPlugins).catch(() => setPlugins(null));
  }, []);

  const steps = [
    { n: 1, cmd: "@BotFather → /newbot", note: "Create a Telegram bot, copy the token" },
    { n: 2, cmd: "git clone https://github.com/WaltLuv/claudeclaw-os.git ~/code/claudeclaw && cd ~/code/claudeclaw", note: "Clone the bridge" },
    { n: 3, cmd: "npm install && npm run setup", note: "Interactive wizard handles token, chat ID, security, agents" },
    { n: 4, cmd: "npm start", note: "Launches the bot · or use the launchd background service" },
  ];

  const pluginSteps = [
    { id: "codex-install",   label: "Install Codex CLI",    cmd: "npm install -g @openai/codex",                    check: () => plugins?.codex.installed },
    { id: "gemini-install",  label: "Install Gemini CLI",   cmd: "npm install -g @google/gemini-cli",               check: () => plugins?.gemini.installed },
    { id: "codex-auth",      label: "Codex login",          cmd: "codex login",                                     check: () => false },
    { id: "gemini-auth",     label: "Gemini auth",          cmd: "gemini auth",                                     check: () => false },
    { id: "mp-codex",        label: "Add Codex marketplace", cmd: "/plugin marketplace add openai/codex-plugin-cc", check: () => false },
    { id: "plug-codex",      label: "Install Codex plugin",  cmd: "/plugin install codex@openai-codex",             check: () => false },
    { id: "mp-gemini",       label: "Add Gemini marketplace",cmd: "/plugin marketplace add thepushkarp/cc-gemini-plugin", check: () => false },
    { id: "plug-gemini",     label: "Install Gemini plugin", cmd: "/plugin install cc-gemini-plugin@cc-gemini-plugin",    check: () => false },
    { id: "reload",          label: "Reload plugins",        cmd: "/reload-plugins",                                check: () => false },
  ];
  return (
    <div className="flex-1 overflow-y-auto p-6 scroll space-y-5">
      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Phone size={14} style={{ color: TONE }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>1 · Connect Telegram</h3>
          {envStatus?.telegramSet && <span className="ml-auto text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: "#10B98118", color: "#10B981", border: "1px solid #10B98155" }}>token set</span>}
        </div>
        <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
          ClaudeClaw runs the actual claude CLI on your machine and pipes the result back to your Telegram chat. Setup is one-time, ~5 minutes.
        </p>
        <div className="space-y-2">
          {steps.map((s) => (
            <div key={s.n} className="flex items-start gap-3 p-3 rounded" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
              <span className="text-[10px] font-bold uppercase mt-1 w-6" style={{ color: TONE }}>{s.n}</span>
              <div className="flex-1 min-w-0">
                <pre className="text-[11.5px] font-mono break-all whitespace-pre-wrap" style={{ color: "var(--fg)" }}>{s.cmd}</pre>
                <div className="text-[10.5px] mt-0.5" style={{ color: "var(--fg-dimmer)" }}>{s.note}</div>
              </div>
              <button onClick={() => navigator.clipboard.writeText(s.cmd)} className="p-1.5 rounded" style={{ color: "var(--fg-dim)" }}><Copy size={11} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: TONE }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>2 · Codex + Gemini CLI plugin hub</h3>
        </div>
        <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
          Add OpenAI Codex and Google Gemini CLI as Claude Code plugins so you have all three frontier models inside one session. Live status below — green checks for what's installed.
        </p>

        {/* Live binary status */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "claude", label: "Claude Code", info: plugins?.claude },
            { key: "codex",  label: "Codex CLI",   info: plugins?.codex },
            { key: "gemini", label: "Gemini CLI",  info: plugins?.gemini },
          ].map((b) => (
            <div key={b.key} className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${b.info?.installed ? "#10B98155" : "var(--panel-border)"}` }}>
              <div className="flex items-center gap-1.5 mb-1">
                {b.info?.installed
                  ? <CheckCircle2 size={11} style={{ color: "#10B981" }} />
                  : <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid var(--panel-border)" }} />}
                <span className="text-[11.5px] font-semibold" style={{ color: b.info?.installed ? "#fff" : "var(--fg-dim)" }}>{b.label}</span>
              </div>
              <div className="text-[10px] font-mono" style={{ color: "var(--fg-dimmer)" }}>{b.info?.version ?? (b.info?.installed ? "installed" : "not installed")}</div>
            </div>
          ))}
        </div>

        {/* Steps — green check when satisfied */}
        <div className="space-y-1.5">
          {pluginSteps.map((s) => {
            const done = !!s.check();
            return (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded" style={{ background: done ? "rgba(16,185,129,0.04)" : "rgba(0,0,0,0.25)", border: `1px solid ${done ? "rgba(16,185,129,0.25)" : "var(--panel-border)"}` }}>
                {done
                  ? <CheckCircle2 size={11} style={{ color: "#10B981" }} />
                  : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--panel-border)" }} />}
                <span className="text-[11px] font-medium w-44 shrink-0" style={{ color: done ? "var(--fg-dim)" : "#fff" }}>{s.label}</span>
                <code className="flex-1 text-[11px] font-mono truncate" style={{ color: done ? "var(--fg-dimmer)" : TONE }}>{s.cmd}</code>
                <button onClick={() => navigator.clipboard.writeText(s.cmd)} className="p-1 rounded" style={{ color: "var(--fg-dim)" }}><Copy size={10} /></button>
              </div>
            );
          })}
        </div>

        <button onClick={() => navigator.clipboard.writeText(pluginSteps.map((s) => s.cmd).join("\n"))} className="self-start inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded" style={{ background: `${TONE}12`, color: TONE, border: `1px solid ${TONE}33` }}>
          <Copy size={10} /> Copy all 9 commands
        </button>
      </div>

      <div className="panel p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Crown size={13} style={{ color: TONE }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>3 · Triad council (high-stakes work)</h3>
        </div>
        <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
          When one model isn't enough, run the <strong>Triad</strong>: Opus 4.7 (Conductor) → DeepSeek V4 (Worker, 3 parallel angles) → GPT-5.5 (Critic) → Opus validates. Wake up to a peer-reviewed artifact.
        </p>
        <a href="/triad" className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition" style={{ background: `${TONE}22`, color: TONE, border: `1px solid ${TONE}55` }}>
          <Crown size={12} /> Open Triad Council
        </a>
      </div>

      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Headphones size={14} style={{ color: TONE }} />
          <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>3 · Voice features (optional)</h3>
        </div>
        <div className="text-[12px] space-y-2" style={{ color: "var(--cream-mute)" }}>
          <div><Mic size={11} className="inline mr-1" style={{ color: TONE }} /> <strong>Voice input</strong> — Groq Whisper. GROQ_API_KEY already set in .env.local.</div>
          <div><Headphones size={11} className="inline mr-1" style={{ color: TONE }} /> <strong>Voice output</strong> — ElevenLabs (5 voice IDs already configured), falls back to Gradium then macOS say.</div>
          <div><ExternalLink size={11} className="inline mr-1" style={{ color: TONE }} /> Full feature matrix → <a href="https://github.com/WaltLuv/claudeclaw-os" target="_blank" rel="noopener noreferrer" style={{ color: TONE }}>github.com/WaltLuv/claudeclaw-os</a></div>
        </div>
      </div>

      <div className="panel p-5">
        <EnvStatusPanel tone={TONE} groups={["core", "providers", "media", "voice", "integrations", "channels"]} compact />
      </div>
    </div>
  );
}

// ─── Specialist Team tab ────────────────────────────────────────────────────
// Seven specialist roles — each with a focused identity, skill kit, default
// ElevenLabs voice, and a "Chat now" button that launches a focused chat
// thread bound to that specialist's system prompt.
//
// All specialists ride the same FullChat surface (so they get the voice
// controls + session continuity + skill insertion + Obsidian save for free).
// Per-specialist memory persists in localStorage under
//   claude-os.chat.specialist.{id}.{backend}.v1

interface Specialist {
  id: string;
  name: string;
  role: string;
  description: string;
  color: string;
  default_voice_id: string;     // ElevenLabs voice id (one of the user's account voices)
  systemSummary: string;        // visible to the operator; not the full system prompt
  skills: string[];             // tool/skill labels they reach for
  welcomeMessage: string;
}

const SPECIALISTS: Specialist[] = [
  {
    id: "receptionist",
    name: "Receptionist",
    role: "Front Desk · Intake · Scheduling",
    description: "Owns first touch across inbound messages: captures context, answers routine questions, schedules next steps, and routes the work to the right Baseline specialist.",
    color: "#22d3ee",
    default_voice_id: "EXAVITQu4vr4xnSDxMaL",   // Sarah - Mature, Reassuring
    systemSummary: "Telegram intake · Lead capture · Scheduling · Caller triage · Customer first response. Tone: warm, concise, organized, intake-first, escalation-aware.",
    skills: ["telegram-gateway", "day5-voiceops-receptionist", "productivity/google-workspace", "note-taking/obsidian"],
    welcomeMessage: "Receptionist here. Tell me who's reaching out and what they need — I'll qualify, capture details, and route to the right specialist.",
  },
  {
    id: "dispatcher",
    name: "Dispatcher",
    role: "Dispatch Desk · Work Orders · Vendor Routing",
    description: "Converts intake into assigned work: creates tasks, routes issues to the correct owner or vendor, tracks status, and keeps the operator informed until the loop is closed.",
    color: "#f59e0b",
    default_voice_id: "CwhRBWXzGAHq8TQ4Fs17",   // Roger - Laid-Back, Resonant
    systemSummary: "Work orders · Vendor routing · Task assignment · Status follow-up · Escalations. Tone: direct, checklist-driven, calm under load, ownership-focused.",
    skills: ["devops/kanban-worker", "devops/kanban-orchestrator", "day6-workorder-flow-script", "productivity/google-workspace", "note-taking/obsidian"],
    welcomeMessage: "Dispatcher. Hand me the intake — I'll turn it into a work order, assign the right owner, and track it to done.",
  },
  {
    id: "account-manager",
    name: "Account Manager",
    role: "Account Desk · Client Updates · Renewals",
    description: "Owns the client relationship after intake: keeps accounts warm, prepares updates, follows up on commitments, and protects retention and expansion opportunities.",
    color: "#10b981",
    default_voice_id: "cjVigY5qzO86Huf0OWal",   // Eric - Smooth, Trustworthy
    systemSummary: "Client updates · Renewals · Follow-up cadences · Owner relations · Expansion. Tone: commercial, relationship-aware, crisp, accountable.",
    skills: ["sales/revenue-operations", "productivity/google-workspace", "apple/imessage", "note-taking/obsidian", "telegram-gateway"],
    welcomeMessage: "Account Manager. Which client and what's the situation? I'll draft the update or surface the renewal/upsell move.",
  },
  {
    id: "compliance-officer",
    name: "Compliance Officer",
    role: "Compliance Desk · Policy Checks · Risk Review",
    description: "Reviews proposed actions, messages, workflows, and records for policy, legal, contractual, and operational risk before execution.",
    color: "#a855f7",
    default_voice_id: "Xb7hH8MSUJpSbSDYk0k2",   // Alice - Clear, Engaging Educator
    systemSummary: "Policy checks · Risk review · Documentation · Approvals · Audit trail. Tone: precise, conservative, evidence-first, approval-aware.",
    skills: ["research/llm-wiki", "research/blogwatcher", "productivity/ocr-and-documents", "note-taking/obsidian", "mandatory-execution-approval"],
    welcomeMessage: "Compliance. Show me what you're about to send or do — I'll separate facts from assumptions and flag any policy or contractual risk before it ships.",
  },
  {
    id: "cfo",
    name: "CFO",
    role: "Finance Desk · Pricing · Cash Flow · Billing",
    description: "Owns financial judgment for Baseline: pricing, cash flow, billing follow-up, margin checks, forecasts, and revenue operations decisions.",
    color: "#ef4444",
    default_voice_id: "JBFqnCBsd6RMkjVDRZzb",   // George - Warm, Captivating Storyteller
    systemSummary: "Pricing · Cash flow · Billing · Forecasts · Revenue operations · Margin checks. Tone: numbers-first, blunt, practical, decision-oriented.",
    skills: ["sales/revenue-operations", "repair-cost-guide-pricing", "spec-kit", "productivity/google-workspace", "note-taking/obsidian"],
    welcomeMessage: "CFO. What's the number you're trying to move? Pricing, cash, billing, margin — give me the situation and I'll give you the decision.",
  },
  {
    id: "strategist",
    name: "Sloane Kim",
    role: "Chief of Staff",
    description: "OKRs, weekly priorities, board prep, decision frameworks.",
    color: "#a78bfa",
    default_voice_id: "EXAVITQu4vr4xnSDxMaL",   // Sarah - Mature, Reassuring, Confident
    systemSummary: "Frames decisions, sets the agenda, and runs the weekly review. Direct, exec-summary first.",
    skills: ["goals", "decisions", "weekly review", "board deck", "OKR scoring"],
    welcomeMessage: "Sloane here. Tell me what you're trying to decide. I'll frame it cleanly and surface the next move.",
  },
  {
    id: "marketer",
    name: "Vanessa Holt",
    role: "Marketing Lead",
    description: "Positioning, campaigns, copy, content cadence.",
    color: "#f472b6",
    default_voice_id: "FGY2WhTYpPnrIDTdsKH5",   // Laura - Enthusiast, Quirky Attitude
    systemSummary: "Owns voice + positioning + the calendar. Writes copy that actually converts — no marketing speak.",
    skills: ["positioning", "ad copy", "blog drafts", "social calendar", "email sequences"],
    welcomeMessage: "Vanessa. What are we selling, who's the buyer, and what's the angle they haven't heard yet?",
  },
  {
    id: "engineer",
    name: "Mason Park",
    role: "Lead Engineer",
    description: "Architecture, code review, debugging, migrations.",
    color: "#22d3ee",
    default_voice_id: "CwhRBWXzGAHq8TQ4Fs17",   // Roger - Laid-Back, Casual, Resonant
    systemSummary: "Thinks in systems. Will push back on premature abstraction and ask what failure mode you're guarding against.",
    skills: ["code review", "system design", "refactor", "bug triage", "migrations"],
    welcomeMessage: "Mason. Paste the code or describe the bug. I'll find the root cause, not the symptom.",
  },
  {
    id: "designer",
    name: "Rio Aoyama",
    role: "Brand & Product Designer",
    description: "Visual identity, UI flows, marketing assets, brand kit.",
    color: "#fb7185",
    default_voice_id: "XrExE9yKIg1WjnnlVkGX",   // Matilda - Knowledgable, Professional
    systemSummary: "Designs with intent. Will tell you when the brand wants restraint and when it wants to be loud.",
    skills: ["brand kit", "UI flow", "moodboard", "landing layout", "social templates"],
    welcomeMessage: "Rio. Tell me the feeling first, the brief second. I'll show you three directions.",
  },
  {
    id: "analyst",
    name: "Dev Iyer",
    role: "Data Analyst",
    description: "Metrics, dashboards, customer segments, churn analysis.",
    color: "#34d399",
    default_voice_id: "Xb7hH8MSUJpSbSDYk0k2",   // Alice - Clear, Engaging Educator
    systemSummary: "Quantifies the question first. Won't show you a chart without a hypothesis to test.",
    skills: ["SQL", "cohort analysis", "metric trees", "dashboard spec", "experiment design"],
    welcomeMessage: "Dev. What metric is moving? Tell me what changed in the business — I'll trace it.",
  },
  {
    id: "closer",
    name: "Marco DeLuca",
    role: "Sales Closer",
    description: "Discovery calls, objection handling, pricing, follow-ups.",
    color: "#fbbf24",
    default_voice_id: "cjVigY5qzO86Huf0OWal",   // Eric - Smooth, Trustworthy
    systemSummary: "Reads the room. Negotiates with respect. Will tell you to drop a deal if the prospect isn't real.",
    skills: ["discovery script", "objection bank", "pricing logic", "follow-up cadence", "contract redlines"],
    welcomeMessage: "Marco. Walk me through the deal — who's the buyer, what's the pain, where are they stuck.",
  },
  {
    id: "concierge",
    name: "Pia Sandoval",
    role: "Customer Success & Ops",
    description: "Onboarding, retention plays, ops checklists, response templates.",
    color: "#22c55e",
    default_voice_id: "pFZP5JQG7iQjIQuC4Bku",   // Lily - Velvety Actress
    systemSummary: "Owns the customer's first 30 days and the moments that win loyalty. Calm under pressure.",
    skills: ["onboarding plan", "retention play", "ops checklist", "incident response", "knowledge base"],
    welcomeMessage: "Pia. What does the customer need right now? I'll draft the move that makes them feel seen.",
  },
];

function SpecialistTeamTab() {
  const [active, setActive] = useState<string | null>(null);
  const specialist = SPECIALISTS.find((s) => s.id === active) ?? null;

  // Pre-seed default voice assignments so each specialist already has a voice
  // (operator can swap via the per-chat VoiceControls picker).
  useEffect(() => {
    try {
      const KEY = "claude-os.voice.assignments.v1";
      const raw = localStorage.getItem(KEY);
      const map = raw ? JSON.parse(raw) : {};
      let changed = false;
      for (const s of SPECIALISTS) {
        const agentId = `specialist-${s.id}`;
        if (!map[agentId]) { map[agentId] = s.default_voice_id; changed = true; }
      }
      if (changed) localStorage.setItem(KEY, JSON.stringify(map));
    } catch { /* skip */ }
  }, []);

  if (specialist) {
    const agent = `specialist-${specialist.id}`;
    return (
      <div className="flex flex-col" style={{ height: "100%", minHeight: 0 }}>
        <div className="flex items-center gap-3 px-4 py-2.5 shrink-0 border-b" style={{ borderColor: "var(--panel-border)", background: `${specialist.color}08` }}>
          <button onClick={() => setActive(null)} className="text-[11px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>← Team</button>
          <div className="h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: `${specialist.color}26`, border: `1px solid ${specialist.color}55`, color: specialist.color }}>
            {specialist.name.split(" ").map(n => n[0]).join("").slice(0,2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={{ color: "#fff" }}>{specialist.name}</div>
            <div className="text-[10.5px] uppercase tracking-widest" style={{ color: specialist.color }}>{specialist.role}</div>
          </div>
          <div className="text-[10.5px] hidden md:block max-w-[40%] truncate" style={{ color: "var(--fg-dimmer)" }}>{specialist.systemSummary}</div>
        </div>
        <FullChat
          agent={agent}
          agentName={specialist.name}
          agentColor={specialist.color}
          storageKey={`claude-os.chat.${agent}.v1`}
          welcomeMessage={specialist.welcomeMessage}
          placeholder={`Talk to ${specialist.name.split(" ")[0]} — ${specialist.role.toLowerCase()}…`}
          className="flex-1 min-h-0"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 scroll" style={{ minHeight: 0 }}>
      <div className="max-w-5xl">
        <div className="mb-4">
          <h2 className="text-[16px] font-bold" style={{ color: "#ffe4d6" }}>Specialist Team</h2>
          <p className="text-[12px] mt-1" style={{ color: "var(--cream-mute)" }}>
            Seven voice-enabled specialists, each with their own persona, skill kit, and ElevenLabs voice. Click a card to start a focused conversation. Voice picker lives in the chat header — every specialist has a sensible default, swap any time.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SPECIALISTS.map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)} className="rounded-xl p-4 text-left transition flex flex-col gap-2.5"
              style={{ background: `${s.color}08`, border: `1px solid ${s.color}33` }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: `${s.color}26`, border: `1px solid ${s.color}55`, color: s.color }}>
                  {s.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold truncate" style={{ color: "#fff" }}>{s.name}</div>
                  <div className="text-[10.5px] uppercase tracking-widest" style={{ color: s.color }}>{s.role}</div>
                </div>
              </div>
              <p className="text-[11.5px]" style={{ color: "var(--cream-mute)" }}>{s.description}</p>
              <div className="flex flex-wrap gap-1">
                {s.skills.slice(0, 4).map((sk) => (
                  <span key={sk} className="text-[9.5px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "var(--fg-dim)", border: "1px solid var(--panel-border)" }}>
                    {sk}
                  </span>
                ))}
              </div>
              <div className="text-[10px] mt-1" style={{ color: "var(--fg-dimmer)" }}>
                Default voice: <span style={{ color: s.color }}>set ✓</span> · Click to chat
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
