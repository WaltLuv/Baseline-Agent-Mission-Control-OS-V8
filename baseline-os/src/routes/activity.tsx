/**
 * Activity — wired to the real aggregator output in live-data.json.
 *
 * Replaces the prior "empty shell" page that hardcoded `runs = []`. Now shows:
 *   · summary KPIs (assistant/user totals, last-7d, last-5h)
 *   · model distribution (modelUsage)
 *   · recent projects table (recentProjects)
 *   · daily timeline (daily)
 *
 * Data source: scripts/aggregate.ts → src/data/live-data.json (refresh button
 * fires /__refresh_data which re-runs the scanner against ~/.claude/projects).
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity as ActivityIcon, RefreshCw, Folder, MessageSquare, Zap,
  DollarSign, Clock, ExternalLink, TrendingUp,
} from "lucide-react";
import { ModelLogo, type ModelKey } from "@/components/model-logos";
import { useLiveData, useRefreshLiveData } from "@/lib/use-live-data";

const TONE = "#a5b4fc";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Baseline Automations" },
      { name: "description", content: "Live Claude Code sessions, model usage, and per-day activity." },
    ],
  }),
  component: ActivityPage,
});

interface Project { key: string; displayName: string; lastActiveMs: number; lastActiveAgo: string; sessions: number; messages: number; }
interface ModelStat { model: string; messages: number; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; cost_usd: number; }
interface DailyStat { day: string; tokens: number; messages: number; cost: number; }
interface Summary { totalAssistantMessages: number; totalUserMessages: number; messagesLast7d: number; messagesLast5h: number; projectsTracked: number; valueExtracted7d: number; }

function modelKey(name: string): ModelKey {
  const n = name.toLowerCase();
  if (n.includes("claude") || n.includes("opus") || n.includes("sonnet")) return "claude";
  if (n.includes("gpt") || n.includes("openai") || n.includes("codex")) return "openai";
  if (n.includes("gemini") || n.includes("gemma") || n.includes("google")) return "gemini";
  if (n.includes("llama") || n.includes("ollama")) return "llama";
  if (n.includes("deepseek")) return "deepseek";
  return "claude";
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtBytes(tokens: number): string { return fmtCount(tokens); }

function ActivityPage() {
  const ld = useLiveData();
  const refresh = useRefreshLiveData();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"sessions" | "models" | "daily">("sessions");

  const summary: Summary | null = ld?.summary ?? null;
  const projects: Project[] = ld?.recentProjects ?? [];
  const modelUsage: ModelStat[] = ld?.modelUsage ?? [];
  const daily: DailyStat[] = ld?.daily ?? [];
  const isExample = ld?.isExample === true;

  const totalCost = modelUsage.reduce((acc, m) => acc + (m.cost_usd ?? 0), 0);
  const totalMsgs = modelUsage.reduce((acc, m) => acc + (m.messages ?? 0), 0);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      // 1. Re-run the disk aggregator
      const t = await fetch("/__token");
      const { token } = await t.json() as { token: string };
      await fetch("/__refresh_data", { method: "POST", headers: { "x-refresh-token": token } });
      // 2. Invalidate the React Query cache so the page re-fetches
      refresh();
    } catch (e) {
      console.warn("[activity] refresh failed:", e);
    }
    setRefreshing(false);
  }

  return (
    <div className="max-w-[1400px] mx-auto p-6">
      <header className="border-b border-border pb-6 mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2 inline-flex items-center gap-2">
            <ActivityIcon size={11} style={{ color: TONE }} />
            <span>Activity</span>
            {isExample && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] tracking-[0.18em] font-semibold"
                style={{ background: "rgba(251, 191, 36, 0.14)", color: "#fbbf24", border: "1px solid rgba(251, 191, 36, 0.3)" }}>
                SAMPLE DATA · click Refresh to scan your machine
              </span>
            )}
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            {summary ? (
              <>
                {fmtCount(summary.totalAssistantMessages + summary.totalUserMessages)}
                <span className="text-muted-foreground/60 font-normal"> messages · </span>
                {projects.length}<span className="text-muted-foreground/60 font-normal"> projects · </span>
                ${totalCost.toFixed(2)}
              </>
            ) : "Loading…"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Live data from <code className="text-foreground/80">~/.claude/projects/**/*.jsonl</code> via{" "}
            <code className="text-foreground/80">scripts/aggregate.ts</code>.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition disabled:opacity-50"
          style={{ background: `${TONE}18`, border: `1px solid ${TONE}55`, color: TONE }}
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Scanning disk…" : "Refresh from disk"}
        </button>
      </header>

      {/* KPI strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <KPI icon={<MessageSquare size={13} />} label="Last 7 days" value={fmtCount(summary.messagesLast7d)} sub="messages" />
          <KPI icon={<Clock size={13} />} label="Last 5 hours" value={fmtCount(summary.messagesLast5h)} sub="messages" />
          <KPI icon={<DollarSign size={13} />} label="Value extracted" value={`$${summary.valueExtracted7d.toFixed(0)}`} sub="last 7d" />
          <KPI icon={<Folder size={13} />} label="Projects tracked" value={String(summary.projectsTracked)} sub="active dirs" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(["sessions", "models", "daily"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
            <span className="text-[10px] text-muted-foreground ml-1.5 tabular-nums">
              {t === "sessions" ? projects.length : t === "models" ? modelUsage.length : daily.length}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "sessions" && <SessionsTab projects={projects} totalMsgs={totalMsgs} />}
      {tab === "models" && <ModelsTab models={modelUsage} totalCost={totalCost} />}
      {tab === "daily" && <DailyTab daily={daily} />}
    </div>
  );
}

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
        <span style={{ color: TONE }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10.5px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function SessionsTab({ projects, totalMsgs }: { projects: Project[]; totalMsgs: number }) {
  if (projects.length === 0) {
    return <EmptyState text="No active Claude Code projects detected. Open a session in Claude Code and click Refresh." />;
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-4 py-3">Project</th>
            <th className="text-right font-medium px-4 py-3">Sessions</th>
            <th className="text-right font-medium px-4 py-3">Messages</th>
            <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Share</th>
            <th className="text-right font-medium px-4 py-3">Last active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((p) => {
            const share = totalMsgs > 0 ? Math.round((p.messages / totalMsgs) * 100) : 0;
            return (
              <tr key={p.key} className="hover:bg-accent/30">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-foreground">{p.displayName}</div>
                  <div className="text-[10px] text-muted-foreground">{p.key}</div>
                </td>
                <td className="px-4 py-3 text-xs tabular-nums text-right">{p.sessions}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-right">{fmtCount(p.messages)}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-right hidden md:table-cell">
                  <div className="flex items-center justify-end gap-2">
                    <span>{share}%</span>
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full" style={{ width: `${share}%`, background: TONE }} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-right" style={{ color: TONE }}>{p.lastActiveAgo}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModelsTab({ models, totalCost }: { models: ModelStat[]; totalCost: number }) {
  if (models.length === 0) {
    return <EmptyState text="No model usage recorded yet." />;
  }
  return (
    <div className="space-y-3">
      {models.map((m) => {
        const mk = modelKey(m.model);
        const share = totalCost > 0 ? Math.round((m.cost_usd / totalCost) * 100) : 0;
        const totalTokens = (m.input_tokens ?? 0) + (m.output_tokens ?? 0) + (m.cache_read_input_tokens ?? 0) + (m.cache_creation_input_tokens ?? 0);
        return (
          <div key={m.model} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center rounded-md border border-border bg-background p-2">
                  <ModelLogo model={mk} size={16} />
                </span>
                <div>
                  <div className="font-mono text-sm">{m.model}</div>
                  <div className="text-[10.5px] text-muted-foreground">{fmtCount(m.messages)} msgs · {fmtBytes(totalTokens)} tokens</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-nums">${m.cost_usd.toFixed(2)}</div>
                <div className="text-[10.5px] text-muted-foreground tabular-nums">{share}% of spend</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10.5px]">
              <Stat label="Input" value={fmtBytes(m.input_tokens)} />
              <Stat label="Output" value={fmtBytes(m.output_tokens)} />
              <Stat label="Cache read" value={fmtBytes(m.cache_read_input_tokens)} />
              <Stat label="Cache write" value={fmtBytes(m.cache_creation_input_tokens)} />
            </div>
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="h-full rounded-full" style={{ width: `${share}%`, background: TONE }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyTab({ daily }: { daily: DailyStat[] }) {
  if (daily.length === 0) {
    return <EmptyState text="No daily activity recorded in the last window." />;
  }
  const maxTokens = Math.max(1, ...daily.map((d) => d.tokens));
  const maxMsgs = Math.max(1, ...daily.map((d) => d.messages));
  const totalTokens = daily.reduce((a, d) => a + d.tokens, 0);
  const totalMsgs = daily.reduce((a, d) => a + d.messages, 0);
  const totalCost = daily.reduce((a, d) => a + d.cost, 0);

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <KPI icon={<MessageSquare size={13} />} label="Window total" value={fmtCount(totalMsgs)} sub="messages" />
        <KPI icon={<Zap size={13} />} label="Window total" value={fmtBytes(totalTokens)} sub="tokens" />
        <KPI icon={<DollarSign size={13} />} label="Window total" value={`$${totalCost.toFixed(2)}`} sub="spend" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Day</th>
              <th className="text-right font-medium px-4 py-3">Messages</th>
              <th className="text-right font-medium px-4 py-3">Tokens</th>
              <th className="text-right font-medium px-4 py-3">Cost</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {daily.map((d) => (
              <tr key={d.day} className="hover:bg-accent/30">
                <td className="px-4 py-3 text-xs font-mono">{d.day}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-right">{fmtCount(d.messages)}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-right">{fmtBytes(d.tokens)}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-right">${d.cost.toFixed(2)}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(d.tokens / maxTokens) * 100}%`, background: TONE }} />
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: "var(--fg-dimmer)" }}>{Math.round((d.messages / maxMsgs) * 100)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono tabular-nums text-xs">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-[13px] text-muted-foreground">
      <TrendingUp size={32} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
      {text}
    </div>
  );
}
