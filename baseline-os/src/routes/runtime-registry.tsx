/**
 * Runtime Registry — Mission Control's view of every runtime on the operator's machine.
 *
 * Phase 1 surface: list runtimes, drill into one, see live capabilities, skills,
 * tasks, health. No fake data — everything streams from /api/runtimes which
 * sits on top of ~/.claude-os/runtime-registry.json.
 *
 * Auto-refreshes every 5s so the operator sees heartbeat drift in real time.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Cpu, RefreshCw, AlertCircle, CheckCircle2, Activity, Box, Crown, Terminal,
  Code2, Wand2, Power, Diamond, ChevronRight,
} from "lucide-react";

const TONE = "#a5b4fc";

export const Route = createFileRoute("/runtime-registry")({
  head: () => ({
    meta: [
      { title: "Runtime Registry — Baseline OS Phase 1" },
      { name: "description", content: "Every runtime on the operator's machine — connected, healthy, capable." },
    ],
  }),
  component: RuntimeRegistryPage,
});

type RuntimeStatus = "healthy" | "warning" | "critical" | "offline";

interface RuntimeRecord {
  runtime_id: string;
  runtime_type: string;
  workspace_id: string;
  name: string;
  status: RuntimeStatus;
  last_seen: string | null;
  version: string | null;
  host: string;
  environment: string;
  capabilities: string[];
  installed_tools: string[];
  installed_skills: string[];
  active_tasks: number;
  heartbeat_interval_sec: number;
  health_score: number;
  cost_today_usd: number;
  cost_month_usd: number;
  failure_count_24h: number;
  consecutive_failures: number;
  metadata: Record<string, unknown>;
}

const TYPE_ICON: Record<string, any> = {
  hermes: Crown,
  openclaw: Box,
  "claude-code": Terminal,
  codex: Code2,
  voiceops: Activity,
  visionops: Diamond,
};

const STATUS_COLOR: Record<RuntimeStatus, string> = {
  healthy:  "#10b981",
  warning:  "#fbbf24",
  critical: "#ef4444",
  offline:  "#6b7280",
};

function fmtAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function RuntimeRegistryPage() {
  const [runtimes, setRuntimes] = useState<RuntimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/runtimes");
      const j = await r.json() as { ok: boolean; generated_at: string; runtimes: RuntimeRecord[]; error?: string };
      if (!j.ok) { setError(j.error ?? "unknown error"); }
      else {
        setRuntimes(j.runtimes);
        setGeneratedAt(j.generated_at);
        if (!selected && j.runtimes.length > 0) setSelected(j.runtimes[0].runtime_id);
      }
    } catch (e: any) {
      setError(`Failed to reach /api/runtimes: ${e?.message ?? String(e)}`);
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const selectedRuntime = selected ? runtimes.find((r) => r.runtime_id === selected) ?? null : null;

  const counts = runtimes.reduce<Record<RuntimeStatus, number>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    { healthy: 0, warning: 0, critical: 0, offline: 0 },
  );

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Cpu size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#eef2ff" }}>Runtime Registry</div>
          <div className="text-[10.5px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            Baseline OS · Phase 1 · {runtimes.length} runtimes ·{" "}
            <span style={{ color: STATUS_COLOR.healthy }}>{counts.healthy} healthy</span> ·{" "}
            <span style={{ color: STATUS_COLOR.warning }}>{counts.warning} warning</span> ·{" "}
            <span style={{ color: STATUS_COLOR.critical }}>{counts.critical} critical</span> ·{" "}
            <span style={{ color: STATUS_COLOR.offline }}>{counts.offline} offline</span>
          </div>
        </div>
        {generatedAt && (
          <span className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>
            updated {fmtAgo(generatedAt)}
          </span>
        )}
        <button onClick={() => void load()} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {error && (
        <div className="mx-4 mt-3 p-3 rounded text-[11.5px] flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left: registry list */}
        <div className="flex flex-col overflow-hidden border-r" style={{ width: "min(420px, 40vw)", borderColor: "var(--panel-border)" }}>
          <div className="px-3 py-2 shrink-0 border-b text-[10px] uppercase tracking-widest" style={{ borderColor: "var(--panel-border)", color: "var(--cream-mute)" }}>
            Runtimes
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll">
            {runtimes.length === 0 && !loading && (
              <div className="text-center py-12 text-[11.5px]" style={{ color: "var(--fg-dimmer)" }}>
                No runtimes registered yet.<br/>
                <code className="text-[10.5px]" style={{ color: TONE }}>mc runtime doctor</code>
              </div>
            )}
            {runtimes.map((r) => {
              const Icon = TYPE_ICON[r.runtime_type] ?? Power;
              const active = selected === r.runtime_id;
              const color = STATUS_COLOR[r.status];
              return (
                <button
                  key={r.runtime_id}
                  onClick={() => setSelected(r.runtime_id)}
                  className="w-full text-left p-3 rounded-lg transition flex items-center gap-3"
                  style={{
                    background: active ? `${TONE}18` : "rgba(0,0,0,0.25)",
                    border: `1px solid ${active ? TONE : "var(--panel-border)"}`,
                  }}
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}55`, color }}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-mono truncate" style={{ color: "#fff" }}>{r.runtime_id}</span>
                    </div>
                    <div className="text-[10px] flex items-center gap-1.5 mt-0.5" style={{ color: "var(--fg-dimmer)" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                      <span style={{ color }}>{r.status}</span>
                      <span>·</span>
                      <span>{fmtAgo(r.last_seen)}</span>
                      <span>·</span>
                      <span>{r.health_score}/100</span>
                    </div>
                  </div>
                  <ChevronRight size={12} style={{ color: "var(--fg-dimmer)" }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: selected runtime detail */}
        <div className="flex-1 overflow-y-auto p-5 scroll">
          {!selectedRuntime && (
            <div className="text-center py-20 text-[12px]" style={{ color: "var(--fg-dimmer)" }}>
              Select a runtime on the left to see its full record.
            </div>
          )}
          {selectedRuntime && (
            <RuntimeDetail r={selectedRuntime} onHeartbeat={() => void load()} />
          )}
        </div>
      </div>
    </div>
  );
}

function RuntimeDetail({ r, onHeartbeat }: { r: RuntimeRecord; onHeartbeat: () => void }) {
  const Icon = TYPE_ICON[r.runtime_type] ?? Power;
  const color = STATUS_COLOR[r.status];
  const [beating, setBeating] = useState(false);

  async function sendHeartbeat(failed: boolean) {
    if (beating) return;
    setBeating(true);
    try {
      await fetch(`/api/runtimes/${encodeURIComponent(r.runtime_id)}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failed }),
      });
      onHeartbeat();
    } catch { /* skip */ }
    setBeating(false);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}55`, color }}>
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-mono font-bold truncate" style={{ color: "#fff" }}>{r.runtime_id}</div>
          <div className="text-[11px] uppercase tracking-widest mt-0.5" style={{ color: "var(--cream-mute)" }}>
            {r.name} · {r.runtime_type} · {r.environment} · workspace {r.workspace_id}
          </div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: `${color}18`, border: `1px solid ${color}55` }}>
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color }}>{r.status}</span>
            <span className="text-[11px]" style={{ color }}>{r.health_score}/100</span>
          </div>
          <div className="text-[10px] mt-1" style={{ color: "var(--fg-dimmer)" }}>last seen {fmtAgo(r.last_seen)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Active tasks" value={String(r.active_tasks)} />
        <KPI label="Heartbeat" value={`${r.heartbeat_interval_sec}s`} />
        <KPI label="Failures (24h)" value={String(r.failure_count_24h)} />
        <KPI label="Cost today" value={`$${r.cost_today_usd.toFixed(4)}`} />
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Identity</h3>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <KV label="version" value={r.version ?? "—"} />
          <KV label="host" value={r.host} />
          <KV label="workspace_id" value={r.workspace_id} />
          <KV label="environment" value={r.environment} />
          <KV label="last_seen" value={r.last_seen ?? "never"} mono />
          <KV label="consecutive_failures" value={String(r.consecutive_failures)} />
        </div>
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
          Capabilities · {r.capabilities.length}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {r.capabilities.length === 0 && <span className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>(none)</span>}
          {r.capabilities.map((cap) => (
            <span key={cap} className="text-[11px] px-2 py-1 rounded font-mono" style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}>
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
          Installed tools · {r.installed_tools.length}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {r.installed_tools.length === 0 && <span className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>(none)</span>}
          {r.installed_tools.map((t) => (
            <span key={t} className="text-[11px] px-2 py-1 rounded font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "var(--fg)", border: "1px solid var(--panel-border)" }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
          Installed skills · {r.installed_skills.length}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {r.installed_skills.length === 0 && <span className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>(none)</span>}
          {r.installed_skills.slice(0, 60).map((s) => (
            <span key={s} className="text-[10.5px] px-2 py-0.5 rounded truncate font-mono" style={{ background: "rgba(255,255,255,0.03)", color: "var(--fg-dim)" }}>
              {s}
            </span>
          ))}
          {r.installed_skills.length > 60 && (
            <span className="text-[10.5px]" style={{ color: "var(--fg-dimmer)" }}>…and {r.installed_skills.length - 60} more</span>
          )}
        </div>
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Heartbeat</h3>
        <p className="text-[11.5px]" style={{ color: "var(--cream-mute)" }}>
          Record a heartbeat from this surface to mark the runtime as recently seen, or simulate a failure to verify the alerting model. The CLI exposes the same hooks via{" "}
          <code style={{ color: TONE }}>mc runtime heartbeat {r.runtime_id}</code>.
        </p>
        <div className="flex gap-2">
          <button onClick={() => void sendHeartbeat(false)} disabled={beating} className="px-3 py-1.5 rounded text-[11.5px] font-semibold disabled:opacity-50" style={{ background: "#10b98118", border: "1px solid #10b98155", color: "#10b981" }}>
            {beating ? "…" : "Record heartbeat ✓"}
          </button>
          <button onClick={() => void sendHeartbeat(true)} disabled={beating} className="px-3 py-1.5 rounded text-[11.5px] font-semibold disabled:opacity-50" style={{ background: "#ef444418", border: "1px solid #ef444455", color: "#ef4444" }}>
            Heartbeat (failed)
          </button>
        </div>
      </div>

      <details className="panel p-4 space-y-2 text-[11px]" style={{ color: "var(--fg-dim)" }}>
        <summary className="cursor-pointer text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Raw metadata</summary>
        <pre className="text-[10.5px] whitespace-pre-wrap mt-2" style={{ color: TONE }}>{JSON.stringify(r.metadata, null, 2)}</pre>
      </details>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border bg-background/30 px-2.5 py-1.5">
      <div className="text-[9.5px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className={`text-[11.5px] ${mono ? "font-mono" : ""} truncate`} style={{ color: "var(--fg)" }}>{value}</div>
    </div>
  );
}
