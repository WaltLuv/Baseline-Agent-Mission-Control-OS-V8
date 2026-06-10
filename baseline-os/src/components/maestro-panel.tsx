/**
 * <MaestroPanel /> — local-first conductor for multi-agent software
 * engineering.
 *
 * Walt's framing: Maestro is the coordination layer for missions, tasks,
 * handoffs, checkpoints, validation, memory, project context, agent
 * launches, and proof tracking. This panel is the dashboard surface on
 * top of the `maestro` CLI:
 *
 *   GET  /__maestro_status                  → install + project state +
 *                                             mission-control JSON snapshot
 *   POST /__maestro_exec  { command, args } → runs one of the whitelisted
 *                                             subcommands (writable ones
 *                                             prompt for confirmation).
 *
 * No fake state:
 *   · "Not installed" surfaces install instructions + version probe.
 *   · "Project not initialized" surfaces `maestro init` as a one-click.
 *   · Mission-control JSON read is best-effort; failures show null,
 *     never a fabricated mission.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AgentActivity } from "@/components/agent-activity";
import {
  routeMission,
  maestroReplayEvents,
  MAESTRO_DIMENSIONS,
  type RoutingDecision,
} from "@/lib/maestro";
import { recordMission } from "@/lib/replay-store";
import { GraphifyAwareness } from "@/components/graphify-awareness";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
  ExternalLink,
} from "lucide-react";

const TONE = "#a78bfa"; // violet — matches Maestro brand

type MaestroStatus = {
  installed: boolean;
  bin: string | null;
  version: string | null;
  cwd: string;
  project_initialized: boolean;
  maestro_dir: string | null;
  mission_control: MaestroMissionControl | null;
};

type MaestroMissionControl = {
  // Maestro's own mission-control JSON shape. We render whatever's there
  // defensively — the upstream shape may evolve.
  missions?: Array<{ id?: string; title?: string; status?: string }>;
  milestones?: Array<{ id?: string; title?: string; status?: string }>;
  features?: Array<{ id?: string; title?: string; status?: string }>;
  tasks?: Array<{ id?: string; title?: string; status?: string; assignee?: string }>;
  blockers?: Array<{ id?: string; title?: string }>;
  handoffs?: Array<{ id?: string; from?: string; to?: string }>;
  checkpoints?: Array<{ id?: string; label?: string; at?: string }>;
  assertions?: Array<{ id?: string; statement?: string; status?: string }>;
  memory_corrections?: Array<{ id?: string; note?: string }>;
  active_agents?: Array<{ id?: string; agent?: string; task_id?: string }>;
};

type ExecResult =
  | { ok: true; command: string; writes: boolean; stdout: string }
  | { ok: false; command: string; error: string; stdout: string | null; stderr: string | null };

const READ_COMMANDS = [
  { key: "status", label: "Status" },
  { key: "task status", label: "Task status" },
  { key: "mission-control --json", label: "Mission control (JSON)" },
  { key: "mission-control --preview", label: "Mission control (preview)" },
  { key: "validate show", label: "Validate show" },
  { key: "memory-compile", label: "Memory compile" },
] as const;

const WRITE_COMMANDS = [
  { key: "init", label: "Init project", danger: "Writes .maestro/ in this directory." },
  { key: "task ready", label: "Task → ready" },
  { key: "task claim", label: "Task → claim" },
  { key: "task update", label: "Task update" },
  { key: "handoff", label: "Handoff" },
  { key: "handoff pickup", label: "Handoff pickup" },
  { key: "checkpoint save", label: "Checkpoint save" },
  { key: "memory-correct", label: "Memory correct" },
] as const;

function StatusPill({ kind }: { kind: "ok" | "warn" | "err" | "muted" }) {
  const tone = {
    ok: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.45)", fg: "#34d399" },
    warn: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.45)", fg: "#fcd34d" },
    err: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.45)", fg: "#fca5a5" },
    muted: { bg: "rgba(113,113,122,0.10)", border: "rgba(113,113,122,0.30)", fg: "#a1a1aa" },
  }[kind];
  const label = { ok: "OK", warn: "Setup needed", err: "Error", muted: "—" }[kind];
  return (
    <span
      className="text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5"
      style={{ background: tone.bg, borderColor: tone.border, color: tone.fg }}
    >
      {label}
    </span>
  );
}

function MissionSnapshot({ mc }: { mc: MaestroMissionControl | null }) {
  const [open, setOpen] = useState(true);
  if (!mc) {
    return (
      <div className="text-[12px] text-zinc-500" data-testid="maestro-mc-empty">
        No mission-control snapshot. Run <code className="text-zinc-300">maestro init</code> +
        create a mission, then refresh.
      </div>
    );
  }
  const rows: Array<{ key: keyof MaestroMissionControl; label: string }> = [
    { key: "missions", label: "Missions" },
    { key: "milestones", label: "Milestones" },
    { key: "features", label: "Features" },
    { key: "tasks", label: "Tasks" },
    { key: "blockers", label: "Blockers" },
    { key: "handoffs", label: "Handoffs" },
    { key: "checkpoints", label: "Checkpoints" },
    { key: "assertions", label: "Assertions" },
    { key: "memory_corrections", label: "Memory corrections" },
    { key: "active_agents", label: "Active agents" },
  ];
  return (
    <div data-testid="maestro-mc-snapshot">
      <button
        type="button"
        className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-2 inline-flex items-center gap-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Mission Control snapshot
      </button>
      {open && (
        <div className="grid gap-2 md:grid-cols-2 mt-2">
          {rows.map((r) => {
            const arr = (mc[r.key] as Array<unknown> | undefined) ?? [];
            return (
              <div
                key={r.key as string}
                data-testid={`maestro-mc-${String(r.key)}`}
                className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2"
              >
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-mono">
                  {r.label}
                </div>
                <div className="text-[13px] font-semibold text-zinc-100">{arr.length}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MaestroPanel() {
  const [status, setStatus] = useState<MaestroStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [runOutput, setRunOutput] = useState<ExecResult | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch("/__maestro_status", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "probe failed");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runCommand(key: string, writes: boolean) {
    if (writes) {
      const conf = window.confirm(
        `Run \`maestro ${key}\` in ${status?.cwd ?? "this directory"}?\nThis WRITES to the filesystem and may modify .maestro/.`,
      );
      if (!conf) return;
    }
    setRunning(key);
    setRunOutput(null);
    try {
      const r = await fetch("/__maestro_exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: key, cwd: status?.cwd }),
      });
      const json = (await r.json()) as ExecResult;
      setRunOutput(json);
    } catch (e) {
      setRunOutput({
        ok: false,
        command: key,
        error: e instanceof Error ? e.message : "exec failed",
        stdout: null,
        stderr: null,
      });
    } finally {
      setRunning(null);
      // Re-read status after any writable command so the snapshot stays fresh.
      if (writes) void refresh();
    }
  }

  const installed = !!status?.installed;
  const initialized = !!status?.project_initialized;

  // Routing HQ — air-traffic-control over missions (graph-first; emits replay).
  const [mission, setMission] = useState("");
  const [decision, setDecision] = useState<RoutingDecision | null>(null);
  const routeNow = useCallback(async () => {
    if (!mission.trim()) return;
    let files: string[] = [];
    try {
      const r = await fetch(`/__graphify?q=${encodeURIComponent(mission)}`);
      const j = await r.json();
      files = (j.results ?? []).map((n: { path: string }) => n.path).slice(0, 6);
    } catch {
      /* graph optional */
    }
    const d = routeMission({ mission, graphFiles: files });
    setDecision(d);
    try {
      recordMission(
        `Maestro: ${mission}`.slice(0, 80),
        mission,
        maestroReplayEvents(d, Date.now()),
      );
    } catch {
      /* replay optional */
    }
  }, [mission]);

  return (
    <div className="space-y-5" data-testid="maestro-panel">
      {/* Routing HQ — orchestration command layer */}
      <div
        className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
        data-testid="maestro-routing-hq"
      >
        <div className="mb-1 text-sm font-semibold">Maestro · Orchestration HQ</div>
        <p className="mb-2 text-[11px] text-white/45">
          Air traffic control for the workforce — routes every mission across{" "}
          {MAESTRO_DIMENSIONS.join(" · ")}. Graph-first; each routed mission is replayable.
        </p>
        <div className="mb-2"><GraphifyAwareness context="maestro orchestration routing" compact /></div>
        <div className="flex gap-2">
          <input
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void routeNow()}
            placeholder="e.g. Build a sales follow-up campaign and launch it"
            className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            data-testid="maestro-mission-input"
          />
          <button
            onClick={() => void routeNow()}
            className="rounded-md px-4 py-2 text-sm font-semibold text-black"
            style={{ backgroundColor: TONE }}
          >
            Route
          </button>
        </div>
        {decision && (
          <div className="mt-3 grid gap-2 sm:grid-cols-5" data-testid="maestro-decision">
            {[
              { k: "Mission → Lane", v: decision.lane },
              { k: "Workforce", v: decision.workforce.join(", ") },
              { k: "Provider", v: `${decision.provider.chosen}` },
              { k: "Approval", v: decision.approval.required ? "required" : "auto" },
              { k: "Cost", v: decision.cost.tier },
            ].map((c) => (
              <div key={c.k} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-[9px] uppercase tracking-widest text-white/40">{c.k}</div>
                <div className="text-[11px] text-white/85">{c.v}</div>
              </div>
            ))}
          </div>
        )}
        {decision && (
          <div className="mt-3">
            <AgentActivity
              agentId="maestro"
              runtime="Maestro"
              provider={decision.provider.chosen}
            />
          </div>
        )}
      </div>

      {/* Header */}
      <header
        className="rounded-2xl border overflow-hidden p-5"
        style={{
          borderColor: `${TONE}33`,
          background: `linear-gradient(135deg, ${TONE}10 0%, rgba(0,0,0,0.30) 100%)`,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
          >
            <Activity size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: `${TONE}cc` }}>
              Local-first conductor
            </div>
            <h2 className="text-xl font-semibold mt-1" style={{ color: "#e9d5ff" }}>
              Maestro
            </h2>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
              Maestro coordinates missions, tasks, handoffs, checkpoints, validation, and memory
              across your local agent runs. This panel reads{" "}
              <code>maestro mission-control --json</code> and surfaces the writable subcommands
              behind explicit confirmation.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            data-testid="maestro-refresh"
            className="text-[11px] font-semibold rounded-md border px-3 py-1.5 transition-opacity hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: `${TONE}1a`, borderColor: `${TONE}55`, color: TONE }}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {/* Install + project status */}
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="maestro-state"
      >
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3">
          Local state
        </h3>
        {error && <div className="text-[12px] text-red-300/85 mb-3">Probe failed: {error}</div>}
        {!status && !error && <div className="text-[12px] text-zinc-500">Loading…</div>}
        {status && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-zinc-100">CLI install</div>
                <div
                  className="text-[11px] text-zinc-500 font-mono truncate"
                  data-testid="maestro-bin"
                >
                  {status.bin ?? "not on PATH or any standard install dir"}
                </div>
                {status.version && (
                  <div
                    className="text-[11px] text-zinc-400 font-mono mt-0.5"
                    data-testid="maestro-version"
                  >
                    {status.version}
                  </div>
                )}
              </div>
              <StatusPill kind={installed ? "ok" : "warn"} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-zinc-100">Project initialized</div>
                <div
                  className="text-[11px] text-zinc-500 font-mono truncate"
                  data-testid="maestro-dir"
                >
                  {status.maestro_dir ?? `(${status.cwd}/.maestro not found)`}
                </div>
              </div>
              <StatusPill kind={initialized ? "ok" : installed ? "warn" : "muted"} />
            </div>
          </div>
        )}
      </section>

      {/* Setup card — only when something's missing */}
      {status && !installed && (
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: `${TONE}40`, background: `${TONE}0a` }}
          data-testid="maestro-setup"
        >
          <h3
            className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-2"
            style={{ color: `${TONE}cc` }}
          >
            <Sparkles size={12} className="inline mr-1" />
            Setup Maestro
          </h3>
          <ol className="text-[13px] text-zinc-300 space-y-2 list-decimal list-inside">
            <li>
              Install the Maestro CLI on this machine:
              <pre className="mt-1 text-[11px] font-mono bg-black/40 border border-zinc-800 rounded p-2 overflow-x-auto">
                npm install -g maestro # or: pip install maestro-orchestrator
              </pre>
            </li>
            <li>
              Run <code className="text-[11px] bg-black/40 px-1 rounded">maestro --version</code> to
              confirm install, then hit Refresh.
            </li>
            <li>
              From your project root, run{" "}
              <code className="text-[11px] bg-black/40 px-1 rounded">maestro init</code> (or use the
              &quot;Init project&quot; action below once the CLI is installed) to create{" "}
              <code>.maestro/</code>.
            </li>
          </ol>
        </section>
      )}

      {/* Mission Control snapshot */}
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="maestro-mission-control"
      >
        <MissionSnapshot mc={status?.mission_control ?? null} />
      </section>

      {/* Commands */}
      {installed && (
        <section
          className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
          data-testid="maestro-commands"
        >
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3">
            Commands
          </h3>

          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-mono mb-2">
              Read-only
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {READ_COMMANDS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => runCommand(c.key, false)}
                  disabled={running !== null}
                  data-testid={`maestro-cmd-${c.key.replace(/[^a-z0-9]+/g, "-")}`}
                  className="text-left rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 hover:border-zinc-600 disabled:opacity-40"
                >
                  <div className="text-[12.5px] font-semibold text-zinc-100">{c.label}</div>
                  <code className="text-[11px] text-zinc-500 font-mono">maestro {c.key}</code>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-amber-400/80 font-mono mb-2">
              Writable — confirms before running
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {WRITE_COMMANDS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => runCommand(c.key, true)}
                  disabled={running !== null || (c.key !== "init" && !initialized)}
                  data-testid={`maestro-cmd-${c.key.replace(/[^a-z0-9]+/g, "-")}`}
                  className="text-left rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2 hover:border-amber-500/60 disabled:opacity-40"
                  title={"danger" in c ? c.danger : undefined}
                >
                  <div className="text-[12.5px] font-semibold text-zinc-100 flex items-center gap-1.5">
                    <Play size={10} className="text-amber-300" />
                    {c.label}
                  </div>
                  <code className="text-[11px] text-zinc-500 font-mono">maestro {c.key}</code>
                </button>
              ))}
            </div>
          </div>

          {running && (
            <div className="mt-3 text-[12px] text-zinc-400" data-testid="maestro-running">
              Running <code className="text-zinc-200">maestro {running}</code>…
            </div>
          )}
        </section>
      )}

      {/* Last output */}
      {runOutput && (
        <section
          className="rounded-xl border p-4"
          style={{
            borderColor: runOutput.ok ? "rgba(113,113,122,0.40)" : "rgba(239,68,68,0.45)",
            background: runOutput.ok ? "rgba(0,0,0,0.30)" : "rgba(239,68,68,0.04)",
          }}
          data-testid="maestro-output"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-mono inline-flex items-center gap-1.5">
              {runOutput.ok ? (
                <CheckCircle2 size={12} className="text-emerald-400" />
              ) : (
                <AlertCircle size={12} className="text-red-400" />
              )}
              maestro {runOutput.command}
            </span>
          </div>
          {runOutput.ok && runOutput.stdout && (
            <pre className="text-[11px] font-mono text-zinc-300 bg-black/50 rounded p-3 overflow-x-auto max-h-80">
              {runOutput.stdout}
            </pre>
          )}
          {!runOutput.ok && (
            <>
              <div className="text-[12px] text-red-200/90 mb-1">{runOutput.error}</div>
              {runOutput.stderr && (
                <pre className="text-[11px] font-mono text-red-300/85 bg-black/50 rounded p-3 overflow-x-auto max-h-60">
                  {runOutput.stderr}
                </pre>
              )}
            </>
          )}
        </section>
      )}

      {/* Cross-link */}
      <p className="text-[11px] text-zinc-500 inline-flex items-center gap-2 flex-wrap">
        <Terminal size={12} />
        Local-only. To mirror Maestro events + proofs to Mission Control cloud, see{" "}
        <Link to="/maestro" className="underline hover:text-zinc-300">
          #63 MC Mirroring (event/proof sync)
        </Link>
        .
        <a
          href="https://www.npmjs.com/package/maestro"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-300 inline-flex items-center gap-1"
        >
          Maestro docs <ExternalLink size={10} />
        </a>
      </p>
    </div>
  );
}
