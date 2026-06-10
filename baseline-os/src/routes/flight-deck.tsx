/**
 * Flight Deck — Desktop Operator Terminal.
 *
 * Per the directive: Flight Deck is the operator's at-a-glance surface. It is
 * NOT a demo. It must consume the Runtime Registry directly and show real
 * health, last-seen, capabilities, and status. No fake data.
 *
 * Phase 1 implementation lives inside the dashboard as a single-pane route.
 * A native shell (Tauri / Electron) can wrap this same surface in a later
 * phase without rewriting the data contract.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plane, Crown, Box, Terminal, Code2, Activity, Diamond, Power, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { GraphifyAwareness } from "@/components/graphify-awareness";
import { listReplays } from "@/lib/replay-store";
import { FlightDeckCommandBridge } from "@/components/flight-deck-command-bridge";

const TONE = "#facc15";

export const Route = createFileRoute("/flight-deck")({
  head: () => ({
    meta: [
      { title: "Flight Deck — Baseline OS" },
      { name: "description", content: "Desktop operator terminal — live runtime health, heartbeat, capabilities." },
    ],
  }),
  component: FlightDeckPage,
});

type RuntimeStatus = "healthy" | "warning" | "critical" | "offline";

interface RuntimeRecord {
  runtime_id: string;
  runtime_type: string;
  name: string;
  status: RuntimeStatus;
  last_seen: string | null;
  version: string | null;
  capabilities: string[];
  installed_skills: string[];
  installed_tools: string[];
  active_tasks: number;
  health_score: number;
  consecutive_failures: number;
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

function FlightDeckPage() {
  const [runtimes, setRuntimes] = useState<RuntimeRecord[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnects, setReconnects] = useState(0);
  // Executive bridge telemetry — real data or honest setup-needed.
  const [brain, setBrain] = useState<{ nodes: number; edges: number } | null>(null);
  const [missions, setMissions] = useState(0);
  useEffect(() => {
    let cancel = false;
    fetch("/__graphify")
      .then((r) => r.json())
      .then((j: { health?: { nodes: number; edges: number } }) => { if (!cancel && j.health) setBrain(j.health); })
      .catch(() => {});
    try { setMissions(listReplays().length); } catch { /* none */ }
    return () => { cancel = true; };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/runtimes");
      const j = await r.json() as { ok: boolean; generated_at: string; runtimes: RuntimeRecord[]; error?: string };
      if (!j.ok) { setError(j.error ?? "unknown error"); return; }
      setRuntimes(j.runtimes);
      setGeneratedAt(j.generated_at);
    } catch (e: any) {
      setError(`Reconnecting to /api/runtimes… ${e?.message ?? String(e)}`);
      setReconnects((n) => n + 1);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 4000);   // 4s — fast enough to read as "live"
    return () => clearInterval(t);
  }, [load]);

  const counts = runtimes.reduce<Record<RuntimeStatus, number>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    { healthy: 0, warning: 0, critical: 0, offline: 0 },
  );
  const overall: RuntimeStatus =
    counts.critical > 0 ? "critical" :
    counts.offline > runtimes.length / 2 ? "warning" :
    counts.warning > 0 ? "warning" : (runtimes.length === 0 ? "offline" : "healthy");
  const overallColor = STATUS_COLOR[overall];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", background: "#020617" }}>
      {/* Top status bar — the ONE thing operators check first */}
      <div className="px-6 py-4 border-b flex items-center gap-4 shrink-0" style={{ borderColor: "rgba(250,204,21,0.15)", background: "rgba(250,204,21,0.02)" }}>
        <Plane size={20} style={{ color: TONE }} />
        <div>
          <div className="text-[16px] font-bold tracking-tight" style={{ color: "#fff" }}>Flight Deck</div>
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--cream-mute)" }}>Baseline OS · Desktop Operator Terminal</div>
        </div>
        <div className="hidden flex-1 items-center justify-center lg:flex">
          <GraphifyAwareness compact />
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: `${overallColor}18`, border: `1px solid ${overallColor}55` }}>
            <span className="h-2 w-2 rounded-full" style={{ background: overallColor, boxShadow: `0 0 12px ${overallColor}88` }} />
            <span className="text-[13px] font-bold uppercase tracking-widest" style={{ color: overallColor }}>{overall}</span>
          </div>
          {generatedAt && <div className="text-[10px] mt-1" style={{ color: "var(--fg-dimmer)" }}>{fmtAgo(generatedAt)}</div>}
        </div>
        <button onClick={() => void load()} disabled={loading} className="p-2 rounded-lg disabled:opacity-50" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${TONE}33`, color: TONE }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Mid: counts strip */}
      <div className="px-6 py-3 grid grid-cols-4 gap-3 shrink-0">
        <Counter label="Healthy"  value={counts.healthy}  tone={STATUS_COLOR.healthy} />
        <Counter label="Warning"  value={counts.warning}  tone={STATUS_COLOR.warning} />
        <Counter label="Critical" value={counts.critical} tone={STATUS_COLOR.critical} />
        <Counter label="Offline"  value={counts.offline}  tone={STATUS_COLOR.offline} />
      </div>

      {/* Executive Command Bridge — real telemetry or honest setup-needed */}
      <div className="px-6 pb-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 shrink-0" data-testid="flight-deck-bridge">
        {[
          { k: "Graphify Brain", v: brain ? `${brain.nodes}n · ${brain.edges}e` : "offline", live: !!brain },
          { k: "Workforce", v: `${counts.healthy} online`, live: counts.healthy > 0 },
          { k: "Runtimes", v: `${runtimes.length} registered`, live: runtimes.length > 0 },
          { k: "Replay", v: `${missions} missions`, live: missions > 0 },
          { k: "Proof", v: `${missions} trails`, live: missions > 0 },
          { k: "Approvals", v: "via Approvals", live: false },
          { k: "Cost", v: "local · n/a", live: false },
        ].map((t) => (
          <div key={t.k} className="rounded-lg border p-2" style={{ borderColor: "rgba(250,204,21,0.18)", background: "rgba(255,255,255,0.02)" }} data-testid={`bridge-${t.k.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>{t.k}</div>
            <div className="text-[12px] font-semibold" style={{ color: t.live ? "#43E5FF" : "var(--fg-dimmer)" }}>{t.v}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-1 mb-2 p-3 rounded text-[11.5px] flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}>
          <AlertCircle size={12} /> {error}{reconnects > 0 && <span className="ml-auto opacity-70">{reconnects} reconnect attempts</span>}
        </div>
      )}

      {/* Command Bridge — operator → workforce */}
      <div className="flex-1 overflow-y-auto pb-6 scroll">
      <FlightDeckCommandBridge runtimes={runtimes.map((r) => ({ id: r.runtime_id, status: r.status }))} />

      {/* Bottom: per-runtime rail */}
      <div className="px-6 space-y-2">
        {runtimes.length === 0 && !loading && (
          <div className="text-center py-20 text-[12px]" style={{ color: "var(--fg-dimmer)" }}>
            No runtimes detected. Try <code style={{ color: TONE }}>mc runtime doctor</code> from the OS shell.
          </div>
        )}
        {runtimes.map((r) => {
          const Icon = TYPE_ICON[r.runtime_type] ?? Power;
          const color = STATUS_COLOR[r.status];
          const live = !!r.last_seen && (Date.now() - new Date(r.last_seen).getTime()) < 60_000;
          return (
            <div key={r.runtime_id} className="rounded-lg p-4 flex items-center gap-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}28` }}>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}55`, color }}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono font-bold truncate" style={{ color: "#fff" }}>{r.runtime_id}</span>
                  {live && <CheckCircle2 size={11} style={{ color: STATUS_COLOR.healthy }} />}
                </div>
                <div className="text-[10.5px] mt-0.5 flex items-center gap-3" style={{ color: "var(--fg-dimmer)" }}>
                  <span>{r.name}</span>
                  <span>·</span>
                  <span style={{ color }}>{r.status}</span>
                  <span>·</span>
                  <span>last seen {fmtAgo(r.last_seen)}</span>
                  <span>·</span>
                  <span>{r.health_score}/100</span>
                  <span>·</span>
                  <span>{r.active_tasks} active task{r.active_tasks === 1 ? "" : "s"}</span>
                </div>
              </div>
              <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                <div className="text-[9.5px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>capabilities</div>
                <div className="text-[10.5px]" style={{ color }}>{r.capabilities.length}</div>
              </div>
              <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                <div className="text-[9.5px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>skills</div>
                <div className="text-[10.5px]" style={{ color }}>{r.installed_skills.length}</div>
              </div>
              <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                <div className="text-[9.5px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>tools</div>
                <div className="text-[10.5px]" style={{ color }}>{r.installed_tools.length}</div>
              </div>
              <div className="text-[10px] hidden lg:block" style={{ color: "var(--fg-dimmer)", maxWidth: 240 }}>
                <div className="truncate" style={{ color: "var(--cream-mute)" }}>{r.version ?? "—"}</div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: `${tone}10`, border: `1px solid ${tone}33` }}>
      <div>
        <div className="text-[9.5px] uppercase tracking-[0.18em]" style={{ color: "var(--cream-mute)" }}>{label}</div>
        <div className="text-2xl font-bold tabular-nums mt-0.5" style={{ color: tone }}>{value}</div>
      </div>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone, boxShadow: `0 0 10px ${tone}88` }} />
    </div>
  );
}
