/**
 * Codex Agent — AI coding agent with 4 tabs:
 *   Chat       — Streaming chat via /__ai_chat (codex agent → Claude Sonnet)
 *   Goal Mode  — Long-running goals tracked in ~/.claude-os/codex-goals.json
 *   Sessions   — Past Codex sessions
 *   Workspace  — Files created by Codex in ~/codex-scratch/
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  MessageSquare,
  Target,
  ListChecks,
  FolderOpen,
  Code2,
  Zap,
  Plus,
  Globe,
  Terminal,
} from "lucide-react";
import { CodexTerminal } from "@/components/codex-terminal";
import { FullChat } from "@/components/full-chat";
import { AgentWorkspace } from "@/components/agent-workspace";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";
import { AgentActivity } from "@/components/agent-activity";

export const Route = createFileRoute("/agents/codex")({
  head: () => ({
    meta: [
      { title: "Codex Agent — Baseline Automations" },
      { name: "description", content: "AI coding agent with goal tracking and workspace." },
    ],
  }),
  component: CodexPage,
});

const TONE = "#22c55e";

type Tab = "terminal" | "chat" | "goals" | "browser" | "sessions" | "workspace";

function CodexPage() {
  const [tab, setTab] = useState<Tab>("terminal");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "terminal", label: "Terminal", icon: <Terminal size={14} /> },
    { id: "chat", label: "Chat", icon: <MessageSquare size={14} /> },
    { id: "goals", label: "Goal Mode", icon: <Target size={14} /> },
    { id: "browser", label: "Browser-Use ⭐", icon: <Globe size={14} /> },
    { id: "sessions", label: "Sessions", icon: <ListChecks size={14} /> },
    { id: "workspace", label: "Workspace", icon: <FolderOpen size={14} /> },
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-4 pt-3">
        <RuntimeCredentialStatus
          providerIds={["openai", "codex_cli"]}
          model="gpt-4o"
          variant="inline"
        />
        <AgentActivity agentId="codex" runtime="Codex CLI" provider="OpenAI" />
      </div>
      {/* Tab bar */}
      <header
        className="flex items-center gap-3 px-4 py-0 shrink-0 border-b"
        style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}
      >
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 my-2"
          style={{ background: `${TONE}20`, border: `1px solid ${TONE}44` }}
        >
          <Code2 size={15} style={{ color: TONE }} />
        </div>
        <span className="text-[13px] font-bold mr-1" style={{ color: "#d4fce0" }}>
          Codex
        </span>

        <div className="flex items-end gap-0 ml-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors"
                style={{
                  borderBottomColor: active ? TONE : "transparent",
                  color: active ? "#d4fce0" : "rgba(255,255,255,0.45)",
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto my-2 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
            style={{
              background: `${TONE}14`,
              borderColor: `${TONE}44`,
              color: TONE,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: TONE, boxShadow: `0 0 6px ${TONE}` }}
            />
            READY
          </span>
        </div>
      </header>

      {tab === "terminal" && (
        <div className="flex-1 min-h-0 p-3">
          <CodexTerminal />
        </div>
      )}

      {tab === "chat" && (
        <FullChat
          agent="codex"
          agentName="Codex"
          agentColor={TONE}
          storageKey="claude-os.chat.codex.v1"
          welcomeMessage="⚡ Codex coding agent ready. I can write code, create files, debug issues, review PRs, and build entire projects. What shall we build?"
          placeholder="Describe what to build or fix…"
          className="flex-1 min-h-0"
        />
      )}

      {tab === "goals" && <GoalModeTab tone={TONE} />}
      {tab === "browser" && <CodexBrowserTab tone={TONE} />}
      {tab === "sessions" && <SessionsTab tone={TONE} />}
      {tab === "workspace" && <WorkspaceTab tone={TONE} />}
    </div>
  );
}

// ── Browser-Use Tab (Codex is the recommended driver for browser automation) ─

function CodexBrowserTab({ tone }: { tone: string }) {
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    source?: string;
    result?: unknown;
    note?: string;
    setup?: string[];
  } | null>(null);
  const [serviceLive, setServiceLive] = useState<"checking" | "live" | "down">("checking");

  useEffect(() => {
    let cancel = false;
    fetch("http://127.0.0.1:8000/health", { signal: AbortSignal.timeout(2500) })
      .then((r) => {
        if (!cancel) setServiceLive(r.ok ? "live" : "down");
      })
      .catch(() => {
        if (!cancel) setServiceLive("down");
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function run() {
    if (!task.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch("/__browser_use", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, agent: "codex" }),
      });
      setResult(await r.json());
    } catch (e) {
      setResult({ ok: false, note: String(e) });
    }
    setRunning(false);
  }

  const QUICK_TASKS = [
    "Go to news.ycombinator.com and summarize the top 5 stories",
    "Search Google for 'PropTech 2026 trends' and return the top 3 articles with one-line summaries each",
    "Open my GitHub notifications and tell me which PRs are awaiting review",
    "Log into AppFolio and list any work orders that are >5 days old",
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={14} style={{ color: tone }} />
          <h3
            className="text-[12px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--cream-mute)" }}
          >
            Codex is your browser driver
          </h3>
          <span
            className="ml-auto text-[10px] uppercase tracking-widest"
            style={{
              color: serviceLive === "live" ? "#10B981" : "#fbbf24",
            }}
          >
            {serviceLive === "live"
              ? "● service live on :8000"
              : serviceLive === "checking"
                ? "checking…"
                : "○ service offline"}
          </span>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--cream-mute)" }}>
          Codex was tuned for browser automation tasks — terse step-by-step instructions, exact
          selectors when known, no narration. Describe the task; Codex turns it into a numbered plan
          and drives a real Chromium via the browser-use harness.
        </p>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={3}
          placeholder="What should the browser do? Codex will plan + execute step-by-step."
          className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
          style={{
            background: "rgba(0,0,0,0.25)",
            border: "1px solid var(--panel-border)",
            color: "var(--fg)",
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10.5px]" style={{ color: "var(--fg-dimmer)" }}>
            Driver: <code style={{ color: tone }}>codex</code> · Service:{" "}
            <code style={{ color: tone }}>localhost:8000</code>
          </span>
          <button
            onClick={run}
            disabled={!task.trim() || running}
            className="px-4 h-[34px] rounded-lg text-[12px] font-semibold transition disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: `${tone}22`, border: `1px solid ${tone}55`, color: tone }}
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>
        {result && (
          <div
            className="rounded-lg p-3 space-y-2"
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)" }}
          >
            <div
              className="text-[10px] uppercase tracking-widest"
              style={{ color: result.ok ? "#10B981" : "#fbbf24" }}
            >
              {result.ok ? "Completed" : "Setup required"} · source: {result.source ?? "—"}
            </div>
            {result.note && (
              <div className="text-[11px]" style={{ color: "var(--fg-dim)" }}>
                {result.note}
              </div>
            )}
            {result.setup && (
              <div className="space-y-1">
                {result.setup.map((s, i) => (
                  <pre
                    key={i}
                    className="text-[11px] font-mono p-1.5 rounded"
                    style={{ background: "rgba(0,0,0,0.4)", color: tone }}
                  >
                    {s}
                  </pre>
                ))}
              </div>
            )}
            {result.result && (
              <pre
                className="text-[11px] whitespace-pre-wrap max-h-[280px] overflow-y-auto"
                style={{ color: "var(--fg-dim)" }}
              >
                {JSON.stringify(result.result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      <div className="panel p-5 space-y-2">
        <h3
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cream-mute)" }}
        >
          Quick tasks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {QUICK_TASKS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTask(t);
                run();
              }}
              disabled={running}
              className="text-left p-3 rounded-lg text-[12px] transition disabled:opacity-40"
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid var(--panel-border)",
                color: "var(--fg-dim)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Goal Mode Tab ─────────────────────────────────────────────────────────────

function GoalModeTab({ tone }: { tone: string }) {
  const [goals, setGoals] = useState<
    Array<{ id: string; title: string; status: string; createdAt: number }>
  >([]);
  const [newGoal, setNewGoal] = useState("");
  const [adding, setAdding] = useState(false);

  async function addGoal() {
    if (!newGoal.trim() || adding) return;
    setAdding(true);
    try {
      const r = await fetch("/__codex_goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "add", title: newGoal.trim() }),
      });
      if (r.ok) {
        const j = (await r.json()) as { goals?: typeof goals };
        setGoals(j.goals ?? []);
        setNewGoal("");
      }
    } catch {
      /* ignore */
    }
    setAdding(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target size={16} style={{ color: tone }} />
          <h3 className="text-sm font-semibold">Goal Mode</h3>
        </div>
        <p className="text-[13px]" style={{ color: "var(--cream-dim)" }}>
          Long-running coding goals. The AI works on each autonomously with many turns.
        </p>
        <div className="flex gap-2">
          <input
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGoal()}
            placeholder="e.g. Build a REST API for managing tasks with auth"
            className="flex-1 h-[38px] px-3 rounded-lg text-sm outline-none"
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px solid var(--panel-border)",
              color: "var(--fg)",
            }}
          />
          <button
            onClick={addGoal}
            disabled={!newGoal.trim() || adding}
            className="px-4 h-[38px] rounded-lg text-sm font-semibold transition disabled:opacity-40"
            style={{ background: `${tone}22`, border: `1px solid ${tone}55`, color: tone }}
          >
            {adding ? "Starting…" : "Start Goal"}
          </button>
        </div>
        {goals.length === 0 ? (
          <div className="text-center py-8 text-[13px]" style={{ color: "var(--cream-mute)" }}>
            No goals yet. Add one above to start working autonomously.
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => (
              <div key={g.id} className="panel p-3">
                <div className="text-[13px] font-medium">{g.title}</div>
                <div className="text-[11px] mt-1" style={{ color: "var(--cream-mute)" }}>
                  {g.status} · {new Date(g.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────────────────────

function SessionsTab({ tone }: { tone: string }) {
  const [sessions] = useState<Array<{ id: string; name: string; updatedAt: number }>>([]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks size={16} style={{ color: tone }} />
          <h3 className="text-sm font-semibold">Codex Sessions</h3>
          <span className="text-[11px] ml-auto" style={{ color: "var(--cream-mute)" }}>
            from ~/.codex/
          </span>
        </div>
        {sessions.length === 0 ? (
          <div className="text-[13px]" style={{ color: "var(--cream-mute)" }}>
            No Codex sessions found. Start a chat above to create your first session.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ border: "1px solid var(--panel-border)" }}
              >
                <div>
                  <div className="text-[13px] font-medium">{s.name || s.id}</div>
                  <div className="text-[11px]" style={{ color: "var(--cream-mute)" }}>
                    {new Date(s.updatedAt).toLocaleString()}
                  </div>
                </div>
                <Zap size={12} style={{ color: tone, opacity: 0.6 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Workspace Tab ─────────────────────────────────────────────────────────────

function WorkspaceTab({ tone }: { tone: string }) {
  return (
    <AgentWorkspace
      agent="codex"
      tone={tone}
      emptyHint="No Codex files yet. Use Chat or Goal Mode to generate code."
    />
  );
}

// Suppress unused import warning
const _Plus = Plus;
void _Plus;
