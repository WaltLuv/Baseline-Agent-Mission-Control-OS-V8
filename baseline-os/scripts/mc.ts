#!/usr/bin/env bun
/**
 * mc — Baseline OS Operator Control Surface.
 *
 * The directive: "The CLI is the Operator Control Surface. It is NOT a
 * Claude Code competitor." Every command is non-interactive, returns either
 * a human-readable table or `--json` for piping, and exits non-zero on
 * health failure so it composes with cron / scripts.
 *
 * Phase 1 surface (Runtime Registry):
 *
 *   mc help
 *   mc health
 *   mc status
 *   mc runtime list                     [--json]
 *   mc runtime inspect <id>             [--json]
 *   mc runtime doctor                   [--json]
 *   mc runtime heartbeat <id>           [--failed] [--active-tasks N]
 *   mc runtime capabilities <id>        [--json]
 *   mc runtime skills <id>              [--json]
 *   mc runtime tasks <id>               [--json]
 *   mc runtime logs <id>                [--lines N]
 *
 * Phases 2-6 will add: router, tool, approval, template, memory subcommands.
 * Keep this file small and dispatching only — every runtime/* command is a
 * thin wrapper over src/lib/runtime-registry.ts.
 */

import {
  discoverRuntimes,
  listRuntimes,
  getRuntime,
  heartbeat as runtimeHeartbeat,
  doctor as runtimeDoctor,
  doctorAll,
  inferStatus,
  type RuntimeRecord,
  type RuntimeStatus,
} from "../src/lib/runtime-registry";
import {
  pushRuntimes,
  pushHeartbeats,
  pullSnapshot,
  pullTasks,
  syncDoctor,
  syncStatus,
  flushOfflineQueue,
  publishRoutingDecision,
  createTask,
  publishApprovalEvent,
} from "../src/lib/mission-control-sync";
import {
  routeTask,
  previewRoute,
  readAuditTail,
  TASK_CATEGORIES,
} from "../src/lib/workforce-router";
import {
  buildDailyBrief,
} from "../src/lib/daily-brief";
import {
  buildValueRoi,
} from "../src/lib/roi";
import {
  listEntries as listTools,
  getEntry as getTool,
  setEnabled as setToolEnabled,
  executeTool,
  readAuditTail as readToolAudit,
  ensureSeeded,
  seedRegistry,
  validateArgs as validateToolArgs,
} from "../src/lib/tool-registry";
import {
  listRequests as listApprovals,
  getRequest as getApproval,
  approveRequest,
  denyRequest,
  readHistoryTail as readApprovalHistory,
  getStats as approvalStats,
} from "../src/lib/approval-engine";

// ─────────────────────────────────────────────────────────────────────────────
// argv parsing — intentionally tiny; no minimist, no commander.
// ─────────────────────────────────────────────────────────────────────────────

interface Args {
  cmd: string[];
  flags: Record<string, string | true>;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const cmd: string[] = [];
  const flags: Record<string, string | true> = {};
  let i = 0;
  while (i < argv.length) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("--")) { flags[key] = next; i += 2; }
      else { flags[key] = true; i += 1; }
    } else { cmd.push(t); i += 1; }
  }
  return { cmd, flags, json: flags.json === true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  dim:   "\x1b[2m",
  bold:  "\x1b[1m",
  green: "\x1b[32m",
  yellow:"\x1b[33m",
  red:   "\x1b[31m",
  blue:  "\x1b[34m",
  cyan:  "\x1b[36m",
  gray:  "\x1b[90m",
};
const noColor = process.env.NO_COLOR != null || process.env.MC_NO_COLOR != null;
const c = (clr: keyof typeof C, s: string): string => noColor ? s : `${C[clr]}${s}${C.reset}`;

function statusPaint(s: RuntimeStatus): string {
  switch (s) {
    case "healthy":  return c("green",  "● healthy");
    case "warning":  return c("yellow", "● warning");
    case "critical": return c("red",    "● critical");
    case "offline":  return c("gray",   "○ offline");
  }
}

function fmtAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function padR(s: string, w: number): string {
  // Pad accounting for ANSI escape sequences (visible width vs raw length).
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "").length;
  return s + " ".repeat(Math.max(0, w - visible));
}

function emit(args: Args, payload: unknown, humanLines: string[]): void {
  if (args.json) { console.log(JSON.stringify(payload, null, 2)); return; }
  for (const line of humanLines) console.log(line);
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcommands
// ─────────────────────────────────────────────────────────────────────────────

function cmdHealth(args: Args): number {
  discoverRuntimes();
  const all = listRuntimes();
  const counts = { healthy: 0, warning: 0, critical: 0, offline: 0 };
  for (const r of all) counts[r.status]++;
  const overall: RuntimeStatus =
    counts.critical > 0 ? "critical" :
    counts.offline > all.length / 2 ? "warning" :
    counts.warning > 0 ? "warning" : "healthy";
  emit(args, { ok: overall === "healthy", overall, counts, total: all.length }, [
    `${c("bold", "Baseline OS Health")}  ${statusPaint(overall)}`,
    `${all.length} runtimes  ·  ${c("green", String(counts.healthy))} healthy  ·  ${c("yellow", String(counts.warning))} warning  ·  ${c("red", String(counts.critical))} critical  ·  ${c("gray", String(counts.offline))} offline`,
  ]);
  return overall === "healthy" ? 0 : overall === "warning" ? 0 : 2;
}

function cmdStatus(args: Args): number {
  // Alias for health + a brief runtime list summary.
  discoverRuntimes();
  const all = listRuntimes();
  emit(args, { ok: true, runtimes: all }, [
    c("bold", "Baseline OS · Runtimes"),
    "",
    ...all.map((r) =>
      `  ${statusPaint(r.status)}  ${padR(c("cyan", r.runtime_id), 50)}  ${padR(r.version ?? "?", 24)}  ${c("dim", fmtAgo(r.last_seen))}`,
    ),
  ]);
  return 0;
}

function cmdRuntimeList(args: Args): number {
  discoverRuntimes();
  const all = listRuntimes();
  if (all.length === 0) {
    emit(args, { ok: true, runtimes: [] }, [c("dim", "No runtimes registered yet. Try: mc runtime doctor")]);
    return 0;
  }
  emit(args, { ok: true, runtimes: all }, [
    `${c("bold", padR("RUNTIME", 38))} ${padR("STATUS", 12)} ${padR("VERSION", 26)} ${padR("LAST SEEN", 14)} ${padR("TASKS", 7)} ${padR("HEALTH", 7)}`,
    c("gray", "─".repeat(110)),
    ...all.map((r) =>
      `${padR(c("cyan", r.runtime_id), 38)} ${padR(statusPaint(r.status), 12)} ${padR(r.version ?? "?", 26)} ${padR(c("dim", fmtAgo(r.last_seen)), 14)} ${padR(String(r.active_tasks), 7)} ${padR(`${r.health_score}/100`, 7)}`,
    ),
  ]);
  return 0;
}

function cmdRuntimeInspect(args: Args): number {
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc runtime inspect <id>"); return 64; }
  const r = getRuntime(id);
  if (!r) { console.error(c("red", `runtime "${id}" not found. List with: mc runtime list`)); return 4; }
  emit(args, { ok: true, runtime: r }, [
    c("bold", r.runtime_id),
    c("dim", "─".repeat(60)),
    `name             ${r.name}`,
    `type             ${r.runtime_type}`,
    `workspace        ${r.workspace_id}`,
    `host             ${r.host}`,
    `environment      ${r.environment}`,
    `version          ${r.version ?? "—"}`,
    `status           ${statusPaint(r.status)}  (${r.health_score}/100)`,
    `last_seen        ${r.last_seen ? `${r.last_seen}  (${fmtAgo(r.last_seen)})` : c("gray", "never")}`,
    `heartbeat_every  ${r.heartbeat_interval_sec}s`,
    `active_tasks     ${r.active_tasks}`,
    `failures (24h)   ${r.failure_count_24h}  ·  consecutive ${r.consecutive_failures}`,
    `cost_today       $${r.cost_today_usd.toFixed(4)}`,
    `cost_month       $${r.cost_month_usd.toFixed(2)}`,
    "",
    c("dim", `capabilities (${r.capabilities.length}):`),
    ...r.capabilities.map((cap) => `  · ${cap}`),
    "",
    c("dim", `installed_tools (${r.installed_tools.length}):`),
    ...r.installed_tools.slice(0, 30).map((t) => `  · ${t}`),
    ...(r.installed_tools.length > 30 ? [c("gray", `  …and ${r.installed_tools.length - 30} more`)] : []),
    "",
    c("dim", `installed_skills (${r.installed_skills.length}):`),
    ...r.installed_skills.slice(0, 30).map((s) => `  · ${s}`),
    ...(r.installed_skills.length > 30 ? [c("gray", `  …and ${r.installed_skills.length - 30} more`)] : []),
    "",
    c("dim", "metadata:"),
    ...JSON.stringify(r.metadata, null, 2).split("\n").map((l) => `  ${l}`),
  ]);
  return 0;
}

function cmdRuntimeDoctor(args: Args): number {
  discoverRuntimes();
  const entries = doctorAll();
  const exit = entries.some((e) => e.checks.some((c) => !c.ok)) ? 1 : 0;
  emit(args, { ok: exit === 0, entries }, [
    c("bold", "Runtime Doctor"),
    c("gray", "─".repeat(60)),
    ...entries.flatMap((e) => [
      `${statusPaint(e.status)}  ${c("cyan", e.runtime_id)}`,
      ...e.checks.map((chk) =>
        `    ${chk.ok ? c("green", "✓") : c("red", "✗")} ${padR(chk.name, 18)} ${c("dim", chk.detail)}`),
      "",
    ]),
  ]);
  return exit;
}

function cmdRuntimeHeartbeat(args: Args): number {
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc runtime heartbeat <id> [--failed] [--active-tasks N]"); return 64; }
  const patch: { failed?: boolean; active_tasks?: number; cost_today_usd?: number } = {};
  if (args.flags.failed === true) patch.failed = true;
  if (typeof args.flags["active-tasks"] === "string") patch.active_tasks = parseInt(args.flags["active-tasks"] as string, 10);
  if (typeof args.flags.cost === "string") patch.cost_today_usd = parseFloat(args.flags.cost as string);
  const updated = runtimeHeartbeat(id, patch);
  if (!updated) { console.error(c("red", `runtime "${id}" not found.`)); return 4; }
  emit(args, { ok: true, runtime: updated }, [
    `${statusPaint(updated.status)}  ${c("cyan", updated.runtime_id)}  ${c("dim", "heartbeat recorded")}`,
    `  last_seen ${updated.last_seen}  ·  consecutive_failures ${updated.consecutive_failures}  ·  active_tasks ${updated.active_tasks}`,
  ]);
  return 0;
}

function cmdRuntimeCapabilities(args: Args): number {
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc runtime capabilities <id>"); return 64; }
  const r = getRuntime(id);
  if (!r) { console.error(c("red", `runtime "${id}" not found.`)); return 4; }
  emit(args, { ok: true, runtime_id: r.runtime_id, capabilities: r.capabilities }, [
    c("bold", `${r.runtime_id} · capabilities (${r.capabilities.length})`),
    ...r.capabilities.map((cap) => `  · ${cap}`),
  ]);
  return 0;
}

function cmdRuntimeSkills(args: Args): number {
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc runtime skills <id>"); return 64; }
  const r = getRuntime(id);
  if (!r) { console.error(c("red", `runtime "${id}" not found.`)); return 4; }
  emit(args, { ok: true, runtime_id: r.runtime_id, installed_skills: r.installed_skills }, [
    c("bold", `${r.runtime_id} · skills (${r.installed_skills.length})`),
    ...r.installed_skills.map((s) => `  · ${s}`),
  ]);
  return 0;
}

function cmdRuntimeTasks(args: Args): number {
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc runtime tasks <id>"); return 64; }
  const r = getRuntime(id);
  if (!r) { console.error(c("red", `runtime "${id}" not found.`)); return 4; }
  emit(args, { ok: true, runtime_id: r.runtime_id, active_tasks: r.active_tasks }, [
    c("bold", `${r.runtime_id} · active_tasks: ${r.active_tasks}`),
    c("dim", "Per-task breakdown will land in Phase 2 (Workforce Router)."),
  ]);
  return 0;
}

async function cmdRuntimeLogs(args: Args): Promise<number> {
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc runtime logs <id> [--lines N]"); return 64; }
  const lines = typeof args.flags.lines === "string" ? parseInt(args.flags.lines as string, 10) : 40;
  // Proxy through the API so the CLI and the UI use the same code path.
  const res = await fetch(`http://localhost:8081/api/runtimes/${encodeURIComponent(id)}/logs`).catch(() => null);
  if (!res || !res.ok) {
    console.error(c("red", "Could not reach Baseline OS API at :8081. Is the dashboard running?"));
    return 5;
  }
  const j = await res.json() as { ok: boolean; lines: string[]; error?: string };
  if (!j.ok) { console.error(c("red", j.error ?? "unknown error")); return 4; }
  emit(args, j, [
    c("bold", `${id} · last ${Math.min(lines, j.lines.length)} log lines`),
    c("gray", "─".repeat(60)),
    ...j.lines.slice(-lines),
  ]);
  return 0;
}

function cmdHelp(): number {
  console.log(`${c("bold", "mc — Baseline OS Operator Control Surface")}

${c("dim", "Health")}
  mc health                          Overall health (exit 2 on critical)
  mc status                          Brief status of all runtimes

${c("dim", "Runtime Registry · Phase 1")}
  mc runtime list                    Tabular list of all runtimes
  mc runtime inspect <id>            Full record + capabilities + skills
  mc runtime doctor                  Deep health pass on every runtime
  mc runtime heartbeat <id>          Record a heartbeat
                                       --failed             mark as failed
                                       --active-tasks N     update task count
                                       --cost N             cost since last beat
  mc runtime capabilities <id>       Capability verbs the runtime exposes
  mc runtime skills <id>             Installed skill ids
  mc runtime tasks <id>              Active task count
  mc runtime logs <id> [--lines N]   Tail recent log lines

${c("dim", "Mission Control sync · Phase 1.5 (gate to Phase 2)")}
  mc sync status                     Show config + offline queue + counters
  mc sync doctor                     Verify MC_URL / MC_API_KEY / endpoints
  mc sync push                       Handshake every local runtime to MC
  mc sync pull                       Pull MC's view + any assigned tasks
  mc sync watch [--interval N]       Heartbeat loop (default 30s)
  mc sync flush                      Drain the offline queue to MC

  Env vars:
    MC_URL                http://127.0.0.1:3000 (no trailing slash)
    MC_API_KEY            Mission Control API key (x-api-key)
    BASELINE_WORKSPACE_ID Workspace id Baseline OS will sync as
    MC_WORKSPACE_ID       Alias, takes precedence if BASELINE_WORKSPACE_ID unset

${c("dim", "Global flags")}
  --json                             Machine-readable output
  --help                             Show this help

${c("dim", "Approval Engine · Phase 4")}
  mc approval list [--status pending]   Queue (newest first)
  mc approval inspect <id>              Full request — args, risk, decision, token state
  mc approval approve <id> [--reason]   Issue a single-use token bound to (tool,verb,args)
  mc approval deny <id> [--reason]      Mark denied; no token issued
  mc approval history [--lines N]       Audit ledger tail
  mc approval stats                     Counters

${c("dim", "Daily Brief · Phase 5.5  (Mission Control consumes; Baseline OS produces)")}
  mc daily-brief                                 Emit DailyBriefPayload as JSON (stdout)
    [--workspace-id N] [--workforce <slug>]      Scope
    [--mode since_yesterday|since_last_visit|custom]
    [--since ISO] [--until ISO]                  Window
    [--limit N]                                  Cap attention items + proof links
    [--pretty]                                   Human-readable instead of JSON

${c("dim", "Value / ROI · Phase 5.6  (Mission Control consumes; Baseline OS produces)")}
  mc roi                                         Emit ValueRoiPayload as JSON (stdout)
    [--workspace-id N] [--workforce <slug>]      Scope
    [--mode since_install|last_7d|last_30d|mtd|qtd|ytd|custom]
    [--since ISO] [--until ISO]                  Window
    [--rate N]                                   Override hourly rate (USD)
    [--limit N]                                  Cap proof_rollup.most_recent
    [--pretty]                                   Human-readable instead of JSON

${c("dim", "Tool Registry · Phase 3")}
  mc tool list [--installed-only]     Operator-grade registry table
  mc tool inspect <id>                Full entry + actions + schemas
  mc tool schema <id> [--verb V]      Per-verb input/output schema
  mc tool validate <id> --verb V --args 'k=v,k=v'    Dry-run validation
  mc tool run <id> --verb V [--args 'k=v,k=v'] [--task-id N] [--approval-token T]
                                       Execute a tool action with audit
  mc tool enable <id>                 Enable for workspace
  mc tool disable <id>                Disable
  mc tool audit [--lines N] [--tool ID]  Execution audit ledger tail
  mc tool seed [--force]              (Re-)install canonical 3 entries

${c("dim", "Workforce Router · Phase 2")}
  mc route preview <task...>         Dry-run a routing decision (no audit, no publish)
  mc route run <task...>             Route + publish to MC (needs --task-id <id>)
  mc route proof <task...>           End-to-end: create task in MC → route → publish
                                       --title <title>      (required for proof)
  mc route audit [--lines N]         Tail recent routing decisions
  mc route categories                List supported categories

  Routing returns a typed RoutingDecision:
    { selected_runtime, selected_skill, selected_tool, approval{required,risk},
      memory_hint{keys,reason}, proof_contract, confidence_score, rationale }

${c("dim", "Future phases (not yet implemented)")}
  mc gateway health                  Phase 3 · Tool Registry
  mc task list                       Phase 2 · Workforce Router
  mc workspace list                  Phase 2 · Workforce Router
  mc employee list                   Phase 5 · Workforce Templates
  mc skill list                      Phase 3 · Tool Registry
  mc flightdeck doctor               Phase 1.5 · Flight Deck
  mc deploy health                   Phase 7+

Docs: ./BASELINE_OS_PHASE1.md  ·  ./MISSION_CONTROL_SYNC.md  ·  ./BASELINE_OS_PHASE2.md`);
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// mc route · *
// ─────────────────────────────────────────────────────────────────────────────

function paintDecision(d: any): string[] {
  const sr = d.selected_runtime;
  const st = d.selected_tool;
  const sk = d.selected_skill;
  const ap = d.approval;
  const riskColor = (r: string) => r === "blocked" ? "red" : r === "approval" ? "yellow" : "green";
  return [
    `  ${c("bold", "category")}      ${c("cyan", d.category)}  (confidence ${c("bold", `${d.confidence_score}/100`)})`,
    `  ${c("bold", "runtime")}       ${sr ? c("cyan", sr.runtime_id) + ` (score ${sr.score})` : c("red", "NONE")}`,
    `  ${c("bold", "skill")}         ${sk ? c("cyan", sk.id) + c("dim", ` · ${sk.reason}`) : c("dim", "(none matched)")}`,
    `  ${c("bold", "tool")}          ${st ? c("cyan", st.id) + c("dim", ` · ${st.reason}`) : c("dim", "(none matched)")}`,
    `  ${c("bold", "approval")}      ${c(riskColor(ap.risk) as any, ap.risk)} · ${c("dim", ap.reason)}`,
    `  ${c("bold", "proof")}         ${c("dim", d.proof_contract)}`,
    `  ${c("bold", "memory hint")}   ${c("dim", `${d.memory_hint.keys.length} keys (${d.memory_hint.keys.slice(0, 6).join(", ")}…)`)}`,
    `  ${c("bold", "alternatives")}  ${d.alternatives.slice(0, 3).map((a: any) => `${a.runtime_id.split("@")[0]}(${a.score})`).join(" · ") || "(none)"}`,
    `  ${c("bold", "decision_id")}   ${c("dim", d.decision_id)}`,
  ];
}

function cmdRoutePreview(args: Args): number {
  const description = args.cmd.slice(2).filter((s) => !s.startsWith("--")).join(" ");
  if (!description) { console.error("Usage: mc route preview <task description...>"); return 64; }
  const decision = previewRoute({ description });
  emit(args, { ok: true, decision }, [
    c("bold", "mc route preview"),
    c("gray", "─".repeat(60)),
    `  task: ${c("dim", description.slice(0, 100))}`,
    "",
    ...paintDecision(decision),
  ]);
  return 0;
}

async function cmdRouteRun(args: Args): Promise<number> {
  const description = args.cmd.slice(2).filter((s) => !s.startsWith("--")).join(" ");
  if (!description) { console.error("Usage: mc route run <task description...> --task-id <id>"); return 64; }
  const taskId = args.flags["task-id"];
  if (!taskId || typeof taskId !== "string") { console.error("--task-id <id> required for `mc route run` (use `mc route preview` for dry-run)"); return 64; }
  const decision = routeTask({ description });
  const publish = await publishRoutingDecision(taskId, {
    assigned_runtime: decision.selected_runtime?.runtime_id ?? "UNASSIGNED",
    selected_tool: decision.selected_tool?.id ?? null,
    selected_skill: decision.selected_skill?.id ?? null,
    routing_reason: decision.rationale.join(" · "),
    routing_confidence: decision.confidence_score / 100,
    approval_required: decision.approval.required,
    decision_id: decision.decision_id,
    category: decision.category,
    alternatives: decision.alternatives.map((a) => ({ runtime_id: a.runtime_id, score: a.score })),
  });
  emit(args, { ok: "ok" in publish ? publish.ok : false, decision, publish }, [
    c("bold", "mc route run"),
    c("gray", "─".repeat(60)),
    `  task_id: ${c("cyan", String(taskId))}`,
    ...paintDecision(decision),
    "",
    "ok" in publish && publish.ok
      ? `${c("green", "✓")} published to MC via ${c("cyan", publish.endpoint)}  (HTTP ${publish.status})`
      : `${c("red", "✗")} publish failed: ${("error" in publish ? publish.error : "unknown")}`,
  ]);
  return ("ok" in publish && publish.ok) ? 0 : 1;
}

async function cmdRouteProof(args: Args): Promise<number> {
  const description = args.cmd.slice(2).filter((s) => !s.startsWith("--")).join(" ");
  const title = typeof args.flags.title === "string" ? (args.flags.title as string) : description.slice(0, 60);
  if (!description) { console.error("Usage: mc route proof <task description...> --title <title>"); return 64; }
  const created = await createTask({ title, description });
  if ("error" in created || !created.ok) { console.error(c("red", `MC task create failed: ${"error" in created ? created.error : created.body}`)); return 2; }
  const taskId = (created.body as any)?.task?.id ?? (created.body as any)?.id;
  if (!taskId) { console.error(c("red", "MC created the task but did not return an id")); return 2; }
  const decision = routeTask({ description });
  const publish = await publishRoutingDecision(taskId, {
    assigned_runtime: decision.selected_runtime?.runtime_id ?? "UNASSIGNED",
    selected_tool: decision.selected_tool?.id ?? null,
    selected_skill: decision.selected_skill?.id ?? null,
    routing_reason: decision.rationale.join(" · "),
    routing_confidence: decision.confidence_score / 100,
    approval_required: decision.approval.required,
    decision_id: decision.decision_id,
    category: decision.category,
    alternatives: decision.alternatives.map((a) => ({ runtime_id: a.runtime_id, score: a.score })),
  });
  emit(args, { ok: "ok" in publish ? publish.ok : false, taskId, decision, publish }, [
    c("bold", "mc route proof — end-to-end"),
    c("gray", "─".repeat(60)),
    `  ${c("green", "✓")} task created in MC  (id ${c("cyan", String(taskId))})`,
    ...paintDecision(decision),
    "",
    "ok" in publish && publish.ok
      ? `${c("green", "✓")} routing published via ${c("cyan", publish.endpoint)}  (HTTP ${publish.status})`
      : `${c("red", "✗")} publish failed: ${("error" in publish ? publish.error : "unknown")}`,
  ]);
  return ("ok" in publish && publish.ok) ? 0 : 1;
}

function cmdRouteAudit(args: Args): number {
  const lines = typeof args.flags.lines === "string" ? parseInt(args.flags.lines as string, 10) : 20;
  const decisions = readAuditTail(lines);
  emit(args, { ok: true, decisions }, [
    c("bold", `Routing audit · last ${decisions.length} decisions`),
    c("gray", "─".repeat(60)),
    ...decisions.slice(-lines).map((d) => {
      const sr = d.selected_runtime?.runtime_id ?? "NONE";
      return `  ${c("dim", d.generated_at.slice(11, 19))}  ${c("cyan", d.category.padEnd(11))}  ${sr.padEnd(40)}  conf=${d.confidence_score}/100  ${d.approval.risk === "auto" ? c("green", "✓") : d.approval.risk === "approval" ? c("yellow", "⚑") : c("red", "✗")}  ${c("dim", d.task_summary.slice(0, 60))}`;
    }),
  ]);
  return 0;
}

function cmdRouteCategories(args: Args): number {
  emit(args, { ok: true, categories: TASK_CATEGORIES }, [
    c("bold", "Supported routing categories"),
    ...TASK_CATEGORIES.map((c2) => `  · ${c("cyan", c2)}`),
  ]);
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// mc tool · *
// ─────────────────────────────────────────────────────────────────────────────

function parseKvFlag(raw: string | true | undefined): Record<string, string> {
  if (typeof raw !== "string" || !raw) return {};
  const out: Record<string, string> = {};
  // Support k=v,k=v but also allow values containing spaces if quoted upstream.
  // Split top-level commas only outside any "..." pair.
  let cur = "";
  let inQ = false;
  const tokens: string[] = [];
  for (const ch of raw) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { tokens.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  for (const t of tokens) {
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function riskPaint(r: string): string {
  if (r === "LOW") return c("green", r);
  if (r === "MEDIUM") return c("yellow", r);
  if (r === "HIGH") return c("red", r);
  if (r === "BLOCKED") return c("red", r);
  return r;
}

function cmdToolList(args: Args): number {
  ensureSeeded();
  const installedOnly = args.flags["installed-only"] === true;
  const all = listTools().filter((e) => !installedOnly || e.installed_status === "installed");
  emit(args, { ok: true, entries: all }, [
    c("bold", `Tool Registry · ${all.length} ${installedOnly ? "installed" : "total"} ${all.length === 1 ? "tool" : "tools"}`),
    c("gray", "─".repeat(110)),
    `${padR(c("bold", "ID"), 12)} ${padR(c("bold","CLI"), 38)} ${padR(c("bold","STATUS"), 12)} ${padR(c("bold","RISK"), 9)} ${padR(c("bold","ENABLED"), 10)} ${padR(c("bold","ACTIONS"), 8)} ${padR(c("bold","RUNS"), 6)} ${c("bold","LAST USED")}`,
    ...all.map((e) =>
      `${padR(c("cyan", e.id), 12)} ${padR(e.cli_name.length > 36 ? "…" + e.cli_name.slice(-35) : e.cli_name, 38)} ${padR(e.installed_status === "installed" ? c("green", "installed") : c("yellow", e.installed_status), 12)} ${padR(riskPaint(e.risk_level), 9)} ${padR(e.enabled_status === "enabled" ? c("green", "enabled") : c("yellow", "disabled"), 10)} ${padR(String(e.supported_actions.length), 8)} ${padR(String(e.success_count + e.failure_count), 6)} ${c("dim", e.last_used_at ? fmtAgo(e.last_used_at) : "never")}`,
    ),
  ]);
  return 0;
}

function cmdToolInspect(args: Args): number {
  ensureSeeded();
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc tool inspect <id>"); return 64; }
  const e = getTool(id);
  if (!e) { console.error(c("red", `tool "${id}" not registered`)); return 4; }
  emit(args, { ok: true, entry: e }, [
    c("bold", e.id),
    c("gray", "─".repeat(60)),
    `cli_name           ${e.cli_name}`,
    `category           ${e.category}`,
    `description        ${e.description}`,
    `workspace_id       ${e.workspace_id}`,
    `installed_status   ${e.installed_status === "installed" ? c("green", e.installed_status) : c("yellow", e.installed_status)}`,
    `enabled_status     ${e.enabled_status}`,
    `risk_level         ${riskPaint(e.risk_level)}`,
    `approval_policy    ${e.approval_policy}`,
    `audit_required     ${e.audit_required}`,
    `allowed_runtimes   ${e.allowed_runtimes.join(", ") || "(none)"}`,
    `required_secrets   ${e.required_secrets.length === 0 ? c("dim", "(none)") : e.required_secrets.map((s) => process.env[s] ? c("green", `${s}✓`) : c("red", `${s}✗ missing`)).join(", ")}`,
    `last_used_at       ${e.last_used_at ?? c("dim", "never")}`,
    `success/fail/avg   ${e.success_count} / ${e.failure_count} / ${e.average_runtime_ms}ms`,
    "",
    c("dim", `actions (${e.supported_actions.length}):`),
    ...e.supported_actions.flatMap((a) => [
      `  ${c("cyan", a.verb)}  ${c("dim", `risk=${a.risk_level ?? e.risk_level}`)}`,
      `    ${c("dim", a.description)}`,
      `    argv: ${a.argv.map((t) => /\$\{/.test(t) ? c("yellow", t) : c("dim", t)).join(" ")}`,
      `    input: ${Object.entries(a.input_schema).map(([k, v]) => `${k}:${v.type}${v.required ? "*" : ""}`).join(", ") || "(none)"}`,
    ]),
  ]);
  return 0;
}

function cmdToolSchema(args: Args): number {
  ensureSeeded();
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc tool schema <id> [--verb V]"); return 64; }
  const e = getTool(id);
  if (!e) { console.error(c("red", `tool "${id}" not registered`)); return 4; }
  const verbFlag = typeof args.flags.verb === "string" ? args.flags.verb as string : null;
  if (verbFlag) {
    const a = e.supported_actions.find((x) => x.verb === verbFlag);
    if (!a) { console.error(c("red", `verb "${verbFlag}" not on tool`)); return 4; }
    emit(args, { ok: true, verb: a.verb, input_schema: a.input_schema, output_schema: a.output_schema }, [
      c("bold", `${e.id}.${a.verb} schema`),
      `input  ${JSON.stringify(a.input_schema, null, 2)}`,
      `output ${JSON.stringify(a.output_schema, null, 2)}`,
    ]);
    return 0;
  }
  emit(args, { ok: true, actions: e.supported_actions }, [
    c("bold", `${e.id} · ${e.supported_actions.length} actions`),
    ...e.supported_actions.map((a) =>
      `  ${c("cyan", a.verb)} ${c("dim", "input keys:")} ${Object.keys(a.input_schema).join(", ") || "(none)"}`),
  ]);
  return 0;
}

function cmdToolValidate(args: Args): number {
  ensureSeeded();
  const id = args.cmd[2];
  const verb = typeof args.flags.verb === "string" ? args.flags.verb as string : null;
  if (!id || !verb) { console.error("Usage: mc tool validate <id> --verb V --args 'k=v,k=v'"); return 64; }
  const e = getTool(id);
  if (!e) { console.error(c("red", `tool "${id}" not registered`)); return 4; }
  const a = e.supported_actions.find((x) => x.verb === verb);
  if (!a) { console.error(c("red", `verb "${verb}" not on tool`)); return 4; }
  const argsMap = parseKvFlag(args.flags.args);
  const v = validateToolArgs(a, argsMap);
  emit(args, v, [
    `${v.ok ? c("green", "✓ valid") : c("red", "✗ invalid")}`,
    ...v.errors.map((er) => `  ${c("red", "•")} ${er}`),
  ]);
  return v.ok ? 0 : 1;
}

async function cmdToolRun(args: Args): Promise<number> {
  ensureSeeded();
  const id = args.cmd[2];
  const verb = typeof args.flags.verb === "string" ? args.flags.verb as string : null;
  if (!id || !verb) { console.error("Usage: mc tool run <id> --verb V [--args 'k=v,k=v'] [--task-id N] [--approval-token T]"); return 64; }
  const argsMap = parseKvFlag(args.flags.args);
  const result = await executeTool({
    tool_id: id,
    verb,
    args: argsMap,
    workspace_id: undefined,
    task_id: typeof args.flags["task-id"] === "string" ? args.flags["task-id"] as string : null,
    decision_id: typeof args.flags["decision-id"] === "string" ? args.flags["decision-id"] as string : null,
    approval_token: typeof args.flags["approval-token"] === "string" ? args.flags["approval-token"] as string : null,
  });
  emit(args, result, [
    c("bold", "mc tool run"),
    c("gray", "─".repeat(60)),
    `  ${result.ok ? c("green", "✓ ok") : (result.approved ? c("yellow", "✗ exit") : c("red", "✗ refused"))} ${c("cyan", id)}.${c("cyan", verb)}  ${c("dim", `audit_id=${result.audit_id}  duration=${result.duration_ms}ms  exit=${result.exit_code}`)}`,
    ...(result.refused_reason ? [`  ${c("red", "refused:")} ${result.refused_reason}`] : []),
    "",
    ...(result.stdout ? [c("dim", "stdout:"), ...result.stdout.split("\n").slice(0, 20).map((l) => "  " + l)] : []),
    ...(result.stderr ? ["", c("dim", "stderr:"), ...result.stderr.split("\n").slice(0, 20).map((l) => "  " + c("red", l))] : []),
  ]);
  return result.ok ? 0 : (result.approved ? 1 : 2);
}

function cmdToolEnable(args: Args, on: boolean): number {
  ensureSeeded();
  const id = args.cmd[2];
  if (!id) { console.error(`Usage: mc tool ${on ? "enable" : "disable"} <id>`); return 64; }
  const e = setToolEnabled(id, on);
  if (!e) { console.error(c("red", `tool "${id}" not registered`)); return 4; }
  emit(args, { ok: true, entry: e }, [
    `${on ? c("green", "enabled") : c("yellow", "disabled")} ${c("cyan", id)}`,
  ]);
  return 0;
}

function cmdToolAudit(args: Args): number {
  ensureSeeded();
  const lines = typeof args.flags.lines === "string" ? parseInt(args.flags.lines as string, 10) : 20;
  const filter = typeof args.flags.tool === "string" ? args.flags.tool as string : undefined;
  const rows = readToolAudit(lines, filter);
  emit(args, { ok: true, audit: rows }, [
    c("bold", `Tool execution audit · last ${rows.length} entries${filter ? ` for ${filter}` : ""}`),
    c("gray", "─".repeat(110)),
    ...rows.map((r) =>
      `  ${c("dim", r.started_at.slice(11, 19))}  ${padR(c("cyan", r.tool_id), 12)} ${padR(c("cyan", r.verb), 18)} ${r.ok ? c("green", "✓") : r.approved ? c("yellow", "exit") : c("red", "✗refused")}  exit=${r.exit_code}  ${r.duration_ms}ms  ${c("dim", `task=${r.task_id ?? "—"}`)}  ${c("dim", r.refused_reason ?? "")}`),
  ]);
  return 0;
}

function cmdToolSeed(args: Args): number {
  const r = seedRegistry(args.flags.force === true);
  emit(args, { ok: true, ...r }, [
    `${c("green", "✓")} inserted: ${r.inserted.join(", ") || "(none)"}`,
    `  existing: ${r.existing.join(", ") || "(none)"}`,
  ]);
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// mc approval · *
// ─────────────────────────────────────────────────────────────────────────────

function paintStatus(s: string): string {
  if (s === "pending") return c("yellow", "⚑ pending");
  if (s === "approved") return c("green", "✓ approved");
  if (s === "consumed") return c("green", "✔ consumed");
  if (s === "denied") return c("red", "✗ denied");
  if (s === "expired") return c("dim", "○ expired");
  return s;
}

function paintRisk(r: string): string {
  if (r === "LOW") return c("green", r);
  if (r === "MEDIUM") return c("yellow", r);
  if (r === "HIGH") return c("red", r);
  if (r === "BLOCKED") return c("red", "✗" + r);
  return r;
}

function cmdApprovalList(args: Args): number {
  const status = typeof args.flags.status === "string" ? args.flags.status as any : undefined;
  const rows = listApprovals(status ? { status } : undefined);
  emit(args, { ok: true, count: rows.length, requests: rows }, [
    c("bold", `Approval queue · ${rows.length} ${status ?? "total"}`),
    c("gray", "─".repeat(110)),
    `${padR(c("bold","ID"), 26)} ${padR(c("bold","TOOL.VERB"), 26)} ${padR(c("bold","RISK"), 9)} ${padR(c("bold","STATUS"), 14)} ${padR(c("bold","TASK"), 6)} ${padR(c("bold","REQUESTED"), 14)} ${c("bold","REASON")}`,
    ...rows.map((r) =>
      `${padR(c("cyan", r.id), 26)} ${padR(c("cyan", `${r.tool_id}.${r.verb}`), 26)} ${padR(paintRisk(r.risk_level), 9)} ${padR(paintStatus(r.status), 14)} ${padR(String(r.task_id ?? "—"), 6)} ${padR(c("dim", fmtAgo(r.requested_at)), 14)} ${c("dim", (r.reason || "").slice(0, 60))}`),
  ]);
  return 0;
}

function cmdApprovalInspect(args: Args): number {
  const id = args.cmd[2];
  if (!id) { console.error("Usage: mc approval inspect <id>"); return 64; }
  const r = getApproval(id, true);
  if (!r) { console.error(c("red", `request "${id}" not found`)); return 4; }
  emit(args, { ok: true, request: r }, [
    c("bold", r.id),
    c("gray", "─".repeat(70)),
    `status            ${paintStatus(r.status)}`,
    `tool / verb       ${c("cyan", `${r.tool_id}.${r.verb}`)}`,
    `risk_level        ${paintRisk(r.risk_level)}`,
    `requested_by      ${r.requested_by}`,
    `requested_at      ${r.requested_at}`,
    `expires_at        ${r.expires_at}`,
    `workspace_id      ${r.workspace_id}`,
    `task_id           ${r.task_id ?? c("dim", "—")}`,
    `decision_id       ${r.decision_id ?? c("dim", "—")}`,
    `decided_by        ${r.decided_by ?? c("dim", "—")}`,
    `decided_at        ${r.decided_at ?? c("dim", "—")}`,
    `decision_reason   ${r.decision_reason ?? c("dim", "—")}`,
    `consumed_at       ${r.consumed_at ?? c("dim", "—")}`,
    `consumed_audit_id ${r.consumed_audit_id ?? c("dim", "—")}`,
    `args_fingerprint  ${r.args_fingerprint}`,
    `token state       ${r.approval_token ? c("green", "ISSUED (use POST /api/tools/.../run)") : c("dim", "(none)")}`,
    "",
    c("dim", "args:"),
    ...JSON.stringify(r.args, null, 2).split("\n").map((l) => `  ${l}`),
    "",
    c("dim", "engine reason:"),
    `  ${r.reason}`,
  ]);
  return 0;
}

async function cmdApprovalDecide(args: Args, accept: boolean): Promise<number> {
  const id = args.cmd[2];
  if (!id) { console.error(`Usage: mc approval ${accept ? "approve" : "deny"} <id> [--reason]`); return 64; }
  const reason = typeof args.flags.reason === "string" ? args.flags.reason as string : (accept ? "approved via mc CLI" : "denied via mc CLI");
  const decided_by = typeof args.flags.as === "string" ? args.flags.as as string : "operator";
  const fn = accept ? approveRequest : denyRequest;
  const result = fn(id, { decided_by, reason });
  if ("error" in result) { console.error(c("red", result.error)); return 4; }
  // Fanout to MC so the API + CLI paths produce identical telemetry.
  // The CLI is a one-shot process — we MUST await the publish or bun exits
  // before the fetch reaches the wire.
  if (result.task_id != null) {
    await publishApprovalEvent({
      task_id: result.task_id,
      request_id: result.id,
      event: accept ? "approved" : "denied",
      tool_id: result.tool_id, verb: result.verb, risk_level: result.risk_level,
      decided_by: result.decided_by, decided_at: result.decided_at, decision_reason: result.decision_reason,
      args: result.args, decision_id: result.decision_id ?? null,
    }).catch(() => ({ ok: false, status: 0 }));
  }
  emit(args, { ok: true, request: result }, [
    accept ? c("green", `✓ approved ${result.id}`) : c("red", `✗ denied ${result.id}`),
    `  decided_by: ${result.decided_by}`,
    `  reason:     ${result.decision_reason}`,
    `  status:     ${paintStatus(result.status)}`,
    ...(accept && result.approval_token ? [
      "",
      c("bold", "Issued token (single-use, bound to args fingerprint):"),
      `  ${c("yellow", result.approval_token!)}`,
      "",
      c("dim", "Retry the original tool call with this token:"),
      `  ${c("dim", `curl -s -X POST http://localhost:8081/api/tools/${result.tool_id}/run \\\\`)}\n  ${c("dim", `    -H 'Content-Type: application/json' \\\\`)}\n  ${c("dim", `    -d '{"verb":"${result.verb}","args":${JSON.stringify(result.args)},"approval_token":"${result.approval_token}"}'`)}`,
    ] : []),
  ]);
  return 0;
}

function cmdApprovalHistory(args: Args): number {
  const lines = typeof args.flags.lines === "string" ? parseInt(args.flags.lines as string, 10) : 30;
  const rows = readApprovalHistory(lines) as any[];
  emit(args, { ok: true, history: rows }, [
    c("bold", `Approval history · last ${rows.length} events`),
    c("gray", "─".repeat(110)),
    ...rows.map((h) =>
      `  ${c("dim", h.ts.slice(11, 19))}  ${padR(h.event, 10)}  by ${padR(h.actor, 14)}  ${c("cyan", `${h.request?.tool_id}.${h.request?.verb}`)}  ${paintRisk(h.request?.risk_level)}  ${c("dim", h.request?.id)}`),
  ]);
  return 0;
}

function cmdApprovalStats(args: Args): number {
  const s = approvalStats();
  emit(args, { ok: true, stats: s }, [
    c("bold", "Approval engine · stats"),
    c("gray", "─".repeat(60)),
    `  total              ${s.total}`,
    `  ${c("yellow", "pending")}            ${s.pending}`,
    `  ${c("green", "approved")}           ${s.approved}`,
    `  ${c("green", "consumed")}           ${s.consumed}`,
    `  ${c("red", "denied")}             ${s.denied}`,
    `  ${c("dim", "expired")}            ${s.expired}`,
    `  ${c("red", "BLOCKED")} refusals/24h  ${s.blocked_refusals_24h}`,
  ]);
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// mc sync · *
// ─────────────────────────────────────────────────────────────────────────────

async function cmdSyncStatus(args: Args): Promise<number> {
  const s = syncStatus();
  emit(args, { ok: s.ok, cfg: s.cfg && { url: s.cfg.url, workspaceId: s.cfg.workspaceId, retries: s.cfg.retries, timeoutMs: s.cfg.timeoutMs, apiKeyChars: s.cfg.apiKey.length }, state: s.state }, [
    c("bold", "Mission Control sync · status"),
    c("gray", "─".repeat(60)),
    s.cfg
      ? `${c("green", "✓")} MC_URL          ${c("cyan", s.cfg.url)}`
      : `${c("red", "✗")} MC_URL          ${c("yellow", "not set")}`,
    s.cfg
      ? `${c("green", "✓")} MC_API_KEY      ${c("dim", `set (${s.cfg.apiKey.length} chars)`)}`
      : `${c("red", "✗")} MC_API_KEY      ${c("yellow", "not set")}`,
    `  workspace_id   ${c("cyan", s.state ? (s.cfg?.workspaceId ?? "?") : "?")}`,
    "",
    c("dim", "Counters:"),
    `  handshakes     ${s.state.totals.handshakes}`,
    `  heartbeats     ${s.state.totals.heartbeats}`,
    `  failures       ${s.state.totals.failures}`,
    `  tasks pulled   ${s.state.totals.tasks_pulled}`,
    "",
    c("dim", "Offline queue:"),
    `  pending        ${s.state.offline_queue.length}`,
    "",
    c("dim", "Last push by runtime:"),
    ...Object.entries(s.state.last_push).map(([id, p]) =>
      `  ${c("cyan", id)}  ${p.health === "green" ? c("green", "● green") : p.health === "amber" ? c("yellow", "● amber") : c("red", "● red")}  tasks=${p.active_tasks}  last_seen=${c("dim", p.last_seen)}`),
  ]);
  return s.ok ? 0 : 2;
}

async function cmdSyncDoctor(args: Args): Promise<number> {
  const checks = await syncDoctor();
  const exit = checks.some((c2) => !c2.ok) ? 1 : 0;
  emit(args, { ok: exit === 0, checks }, [
    c("bold", "Mission Control sync · doctor"),
    c("gray", "─".repeat(60)),
    ...checks.map((chk) =>
      `${chk.ok ? c("green", "✓") : c("red", "✗")} ${padR(chk.name, 36)} ${c("dim", chk.detail)}`),
  ]);
  return exit;
}

async function cmdSyncPush(args: Args): Promise<number> {
  const r = await pushRuntimes();
  if ("error" in r) { console.error(c("red", r.error)); return 2; }
  emit(args, r, [
    c("bold", "Mission Control sync · push"),
    c("gray", "─".repeat(60)),
    `${c("green", "✓")} pushed  ${r.pushed}`,
    `${c("yellow", "○")} queued  ${r.queued}    ${c("dim", "(MC unreachable — will retry via `mc sync flush`)")}`,
    `${c("red", "✗")} failed  ${r.failed}`,
    "",
    ...r.details.map((d) => {
      const icon = d.status === "ok" ? c("green", "✓") : d.status === "queued" ? c("yellow", "○") : c("red", "✗");
      return `  ${icon} ${c("cyan", d.runtime_id)} ${d.reason ? c("dim", `· ${d.reason}`) : ""}`;
    }),
  ]);
  return r.failed === 0 ? 0 : 1;
}

async function cmdSyncPull(args: Args): Promise<number> {
  const snap = await pullSnapshot();
  if (typeof snap === "object" && snap !== null && "error" in (snap as any)) {
    console.error(c("red", String((snap as any).error)));
    return 2;
  }
  const runtimesAtMC = (snap as any)?.runtimes ?? [];
  const taskPull = await pullTasks(1);
  emit(args, { snapshot: snap, tasks: taskPull }, [
    c("bold", "Mission Control sync · pull"),
    c("gray", "─".repeat(60)),
    `MC sees ${runtimesAtMC.length} runtime(s) in workspace`,
    ...runtimesAtMC.slice(0, 20).map((r: any) =>
      `  ${c("cyan", `${r.kind}/${r.installationId}`)}  ${c("dim", r.label ?? "")}  health=${r.health}`),
    "",
    "tasks_pulled:",
    ...("tasks" in taskPull ? taskPull.tasks : []).map((t) =>
      `  ${c("cyan", t.runtime_id)} → ${t.reason}`),
  ]);
  return 0;
}

async function cmdSyncFlush(args: Args): Promise<number> {
  const r = await flushOfflineQueue();
  emit(args, r, [
    c("bold", "Mission Control sync · flush"),
    `${c("green", "✓")} flushed   ${r.flushed}`,
    `${c("yellow", "○")} remaining ${r.remaining}`,
    ...r.errors.slice(0, 10).map((e) => `  ${c("red", "✗")} ${e}`),
  ]);
  return r.remaining === 0 ? 0 : 1;
}

async function cmdSyncWatch(args: Args): Promise<number> {
  const interval = typeof args.flags.interval === "string" ? Math.max(5, parseInt(args.flags.interval as string, 10)) : 30;
  console.log(c("bold", `mc sync watch · heartbeat every ${interval}s (Ctrl+C to stop)`));
  let tick = 0;
  const beat = async () => {
    tick++;
    const r = await pushHeartbeats();
    if ("error" in r) { console.error(`[${new Date().toISOString()}] ${c("red", r.error)}`); return; }
    console.log(`[${new Date().toISOString()}] tick ${tick} · ${c("green", String(r.pushed))} ok · ${c("yellow", String(r.queued))} queued · ${c("red", String(r.failed))} failed`);
  };
  await beat();
  await new Promise<void>((resolve) => {
    const t = setInterval(beat, interval * 1000);
    const stop = () => { clearInterval(t); resolve(); };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.help === true || args.cmd[0] === "help" || args.cmd.length === 0) return cmdHelp();
  const [a, b] = args.cmd;
  if (a === "health") return cmdHealth(args);
  if (a === "status") return cmdStatus(args);
  if (a === "runtime") {
    if (b === "list" || b == null) return cmdRuntimeList(args);
    if (b === "inspect") return cmdRuntimeInspect(args);
    if (b === "doctor") return cmdRuntimeDoctor(args);
    if (b === "heartbeat") return cmdRuntimeHeartbeat(args);
    if (b === "capabilities") return cmdRuntimeCapabilities(args);
    if (b === "skills") return cmdRuntimeSkills(args);
    if (b === "tasks") return cmdRuntimeTasks(args);
    if (b === "logs") return await cmdRuntimeLogs(args);
    console.error(`Unknown runtime subcommand: ${b}. Try: mc help`);
    return 64;
  }
  if (a === "sync") {
    if (b === "status" || b == null) return await cmdSyncStatus(args);
    if (b === "doctor") return await cmdSyncDoctor(args);
    if (b === "push") return await cmdSyncPush(args);
    if (b === "pull") return await cmdSyncPull(args);
    if (b === "flush") return await cmdSyncFlush(args);
    if (b === "watch") return await cmdSyncWatch(args);
    console.error(`Unknown sync subcommand: ${b}. Try: mc help`);
    return 64;
  }
  if (a === "route") {
    if (b === "preview" || b == null) return cmdRoutePreview(args);
    if (b === "run") return await cmdRouteRun(args);
    if (b === "proof") return await cmdRouteProof(args);
    if (b === "audit") return cmdRouteAudit(args);
    if (b === "categories") return cmdRouteCategories(args);
    console.error(`Unknown route subcommand: ${b}. Try: mc help`);
    return 64;
  }
  if (a === "tool") {
    if (b === "list" || b == null) return cmdToolList(args);
    if (b === "inspect") return cmdToolInspect(args);
    if (b === "schema") return cmdToolSchema(args);
    if (b === "validate") return cmdToolValidate(args);
    if (b === "run") return await cmdToolRun(args);
    if (b === "enable") return cmdToolEnable(args, true);
    if (b === "disable") return cmdToolEnable(args, false);
    if (b === "audit") return cmdToolAudit(args);
    if (b === "seed") return cmdToolSeed(args);
    console.error(`Unknown tool subcommand: ${b}. Try: mc help`);
    return 64;
  }
  if (a === "approval") {
    if (b === "list" || b == null) return cmdApprovalList(args);
    if (b === "inspect") return cmdApprovalInspect(args);
    if (b === "approve") return await cmdApprovalDecide(args, true);
    if (b === "deny") return await cmdApprovalDecide(args, false);
    if (b === "history") return cmdApprovalHistory(args);
    if (b === "stats") return cmdApprovalStats(args);
    console.error(`Unknown approval subcommand: ${b}. Try: mc help`);
    return 64;
  }
  if (a === "daily-brief") return await cmdDailyBrief(args);
  if (a === "roi") return await cmdRoi(args);
  if (a === "kanban") return await cmdKanban(args);
  if (a === "mirror") return await cmdMirror(args);
  console.error(`Unknown command: ${a}. Try: mc help`);
  return 64;
}

// ─────────────────────────────────────────────────────────────────────────────
// mc kanban — Tonbi/Hermes SQLite Kanban Dispatcher
// ─────────────────────────────────────────────────────────────────────────────
async function cmdKanban(args: Args): Promise<number> {
  const k = await import("../src/lib/kanban");
  const sub = args.cmd[1];

  if (sub === "doctor") {
    const h = k.doctor();
    if (args.flags.json) { console.log(JSON.stringify(h, null, 2)); return 0; }
    const lines = [
      c("bold", "Kanban · doctor"),
      c("gray", "─".repeat(60)),
      `  db_path                 ${h.db_path}`,
      `  ${c("yellow", "todo")}                    ${h.counts.todo}`,
      `  ${c("green", "ready")}                   ${h.counts.ready}`,
      `  ${c("cyan", "in_progress")}             ${h.counts.in_progress}`,
      `  ${c("yellow", "approval_required")}       ${h.counts.approval_required}`,
      `  ${c("green", "done")}                    ${h.counts.done}`,
      `  ${c("red", "failed")}                  ${h.counts.failed}`,
      `  ${c("red", "blocked")}                 ${h.counts.blocked}`,
      `  pending_approvals       ${h.pending_approvals}`,
      `  oldest in_progress age  ${h.oldest_in_progress_age_minutes ?? "—"} min`,
    ];
    console.log(lines.join("\n"));
    return 0;
  }

  if (sub === "list") {
    const status = args.flags.status as any;
    const rows = k.listTasks({ status, limit: 200 });
    if (args.flags.json) { console.log(JSON.stringify({ ok: true, count: rows.length, tasks: rows }, null, 2)); return 0; }
    const lines = [
      c("bold", `Kanban board · ${rows.length} ${status ?? "tasks"}`),
      c("gray", "─".repeat(110)),
      `${padR(c("bold","ID"), 22)} ${padR(c("bold","TITLE"), 38)} ${padR(c("bold","ASSIGNEE"), 18)} ${padR(c("bold","STATUS"), 18)}  PRIO`,
      ...rows.map((r) =>
        `${padR(c("cyan", r.id), 22)} ${padR(r.title.slice(0,38), 38)} ${padR(c("dim", r.assignee), 18)} ${padR(paintStatusK(r.status), 18)}  ${r.priority}`),
    ];
    console.log(lines.join("\n"));
    return 0;
  }

  if (sub === "add") {
    const rest = args.cmd.slice(2).filter((s) => !s.startsWith("--"));
    const title = rest.join(" ");
    if (!title) { console.error("Usage: mc kanban add <title…> --assignee <agent> [--parent <id>] [--priority N]"); return 64; }
    const assignee = (args.flags.assignee as string) ?? "scout";
    const parent = args.flags.parent as string | undefined;
    const priority = args.flags.priority ? parseInt(args.flags.priority as string, 10) : 0;
    const t = k.createTask({ title, assignee, parent_id: parent, priority });
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "inspect") {
    const id = args.cmd[2];
    if (!id) { console.error("Usage: mc kanban inspect <id>"); return 64; }
    const t = k.getTask(id);
    if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
    console.log(JSON.stringify(t, null, 2));
    return 0;
  }

  if (sub === "events") {
    const id = args.cmd[2];
    if (!id) { console.error("Usage: mc kanban events <id> [--limit N]"); return 64; }
    const limit = args.flags.limit ? parseInt(args.flags.limit as string, 10) : 50;
    console.log(JSON.stringify(k.listEvents(id, limit), null, 2));
    return 0;
  }

  if (sub === "dispatch") {
    const max = args.flags.max ? parseInt(args.flags.max as string, 10) : 1;
    const promoted = k.promoteReady();
    const claimed: any[] = [];
    for (let i = 0; i < max; i++) {
      const t = k.claimNext();
      if (!t) break;
      claimed.push(t);
    }
    console.log(JSON.stringify({ promoted, claimed: claimed.length, tasks: claimed }, null, 2));
    return 0;
  }

  if (sub === "daemon") {
    const intervalMs = args.flags.interval ? parseInt(args.flags.interval as string, 10) : 2000;
    console.log(c("bold", `Kanban daemon · tick every ${intervalMs}ms · Ctrl-C to stop`));
    let ticks = 0;
    while (true) {
      const { promoted, claimed } = k.dispatchOnce();
      if (promoted > 0 || claimed) {
        const ts = new Date().toISOString().slice(11, 19);
        console.log(`  ${c("dim", ts)}  promoted=${promoted}  claimed=${claimed ? claimed.id + " → " + claimed.assignee : "—"}`);
      }
      ticks += 1;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  if (sub === "approve") {
    const id = args.cmd[2];
    if (!id) { console.error("Usage: mc kanban approve <task-id> [--reason …] [--as user]"); return 64; }
    const r = k.decideApproval(id, "approved", { approved_by: (args.flags.as as string) ?? "operator", reason: args.flags.reason as string | undefined });
    console.log(JSON.stringify({ ok: true, ...r }, null, 2));
    return 0;
  }

  if (sub === "shelve") {
    const id = args.cmd[2];
    if (!id) { console.error("Usage: mc kanban shelve <task-id> [--reason …]"); return 64; }
    const r = k.decideApproval(id, "shelved", { approved_by: (args.flags.as as string) ?? "operator", reason: args.flags.reason as string | undefined });
    console.log(JSON.stringify({ ok: true, ...r }, null, 2));
    return 0;
  }

  if (sub === "approvals") {
    const rows = k.pendingApprovals();
    if (args.flags.json) { console.log(JSON.stringify({ count: rows.length, approvals: rows }, null, 2)); return 0; }
    if (rows.length === 0) { console.log("(no pending approvals)"); return 0; }
    for (const a of rows) {
      console.log(`  ${c("yellow", "⚑")} ${c("cyan", a.id)}  task=${a.task_id}  ${c("dim", new Date(a.created_at).toISOString())}`);
      if (a.reason) console.log(`    reason: ${a.reason}`);
    }
    return 0;
  }

  // ── Walt's #62 CLI surface — wrap the engine functions one-to-one ──

  if (sub === "init") {
    // The engine auto-creates the SQLite DB on first use; init is a no-op
    // that just runs the doctor probe so the operator sees the freshly-
    // initialised state.
    const h = k.doctor();
    console.log(JSON.stringify({ ok: true, db_path: h.db_path, note: "kanban DB ready" }, null, 2));
    return 0;
  }

  if (sub === "create") {
    // Alias of `add` — included so the docs Walt enumerated match.
    const rest = args.cmd.slice(2).filter((s) => !s.startsWith("--"));
    const title = rest.join(" ");
    if (!title) { console.error("Usage: mc kanban create <title…> --assignee <agent> [--parent <id>] [--priority N]"); return 64; }
    const assignee = (args.flags.assignee as string) ?? "scout";
    const parent = args.flags.parent as string | undefined;
    const priority = args.flags.priority ? parseInt(args.flags.priority as string, 10) : 0;
    const t = k.createTask({ title, assignee, parent_id: parent, priority });
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "ready") {
    const id = args.cmd[2];
    if (!id) { console.error("Usage: mc kanban ready <task-id>"); return 64; }
    const t = k.markReady(id, (args.flags.as as string) ?? "operator");
    if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "claim") {
    // `mc kanban claim <id>` claims a specific task; `mc kanban claim` (no
    // id) picks the highest-scoring ready row via the engine's claimNext.
    const id = args.cmd[2];
    if (id) {
      const t = k.getTask(id);
      if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
      if (t.status !== "ready") { console.error(c("red", `task ${id} is ${t.status}, not ready`)); return 9; }
      const claimed = k.setStatus(id, "in_progress", { actor: (args.flags.as as string) ?? "operator" });
      console.log(JSON.stringify({ ok: true, task: claimed }, null, 2));
      return 0;
    }
    const t = k.claimNext({ assignee: args.flags.assignee as string | undefined });
    if (!t) { console.log(JSON.stringify({ ok: true, task: null, message: "no ready tasks" }, null, 2)); return 0; }
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "update") {
    const id = args.cmd[2];
    const status = args.flags.status as string | undefined;
    if (!id || !status) { console.error("Usage: mc kanban update <task-id> --status <state>"); return 64; }
    const t = k.setStatus(id, status as any, {
      actor: (args.flags.as as string) ?? "operator",
      error: args.flags.error as string | undefined,
    });
    if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "complete") {
    const id = args.cmd[2];
    if (!id) { console.error("Usage: mc kanban complete <task-id> [--proof <json>]"); return 64; }
    let proof: Record<string, unknown> | undefined;
    if (args.flags.proof) {
      try { proof = JSON.parse(String(args.flags.proof)); } catch { console.error("--proof must be JSON"); return 64; }
    }
    const t = k.markDone(id, proof);
    if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "fail") {
    const id = args.cmd[2];
    const error = String(args.flags.error ?? args.flags.reason ?? "");
    if (!id || !error) { console.error("Usage: mc kanban fail <task-id> --error <message>"); return 64; }
    const t = k.markFailed(id, error);
    if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "block") {
    const id = args.cmd[2];
    const reason = String(args.flags.reason ?? args.flags.error ?? "");
    if (!id || !reason) { console.error("Usage: mc kanban block <task-id> --reason <…>"); return 64; }
    const t = k.markBlocked(id, reason);
    if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "unblock") {
    const id = args.cmd[2];
    if (!id) { console.error("Usage: mc kanban unblock <task-id>"); return 64; }
    const t = k.markReady(id, (args.flags.as as string) ?? "operator");
    if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "proof") {
    const id = args.cmd[2];
    if (!id) { console.error("Usage: mc kanban proof <task-id> --payload <json>"); return 64; }
    const payload = args.flags.payload ?? args.flags.proof;
    if (!payload) { console.error("--payload <json> required"); return 64; }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(String(payload)); } catch { console.error("--payload must be JSON"); return 64; }
    const t = k.attachProof(id, parsed, (args.flags.as as string) ?? "operator");
    if (!t) { console.error(c("red", `task ${id} not found`)); return 4; }
    console.log(JSON.stringify({ ok: true, task: t }, null, 2));
    return 0;
  }

  if (sub === "export") {
    // JSON snapshot of every task + their event log. Maestro-compatible
    // mapping is documented in claude-os/architecture/maestro-vs-kanban.md.
    const tasks = k.listTasks({ limit: 10_000 });
    const snapshot = {
      format: "kanban-snapshot/v1",
      exported_at: new Date().toISOString(),
      db_path: k.doctor().db_path,
      tasks: tasks.map((t) => ({
        ...t,
        events: k.listEvents(t.id, 500),
      })),
    };
    console.log(JSON.stringify(snapshot, null, 2));
    return 0;
  }

  console.error(`Unknown kanban subcommand: ${sub}. Try: mc kanban {doctor|init|list|add|create|inspect|events|dispatch|daemon|approvals|approve|shelve|ready|claim|update|complete|fail|block|unblock|proof|export}`);
  return 64;
}

// ─────────────────────────────────────────────────────────────────────────────
// mc mirror — Baseline OS → Mission Control event/proof sync (#63).
//
// Walt's #63 contract: event/proof sync only, NOT database replication.
// This CLI is a thin tailer over ~/.claude-os/kanban-events.jsonl that
// POSTs new lines to <MC>/api/orchestration/mirror, then advances a
// cursor at ~/.claude-os/mirror-cursor.json so retries are cheap and
// duplicate sends are idempotent server-side (UNIQUE on workspace +
// source + external_id).
//
// MC URL + API key come from the credentials store (~/.claude-os/
// credentials.local.json) — see /settings/api-keys in the dashboard.
// Override via env: MC_MIRROR_URL, MC_MIRROR_API_KEY.
// ─────────────────────────────────────────────────────────────────────────────
async function cmdMirror(args: Args): Promise<number> {
  const sub = args.cmd[1];
  const fs = await import("node:fs/promises");
  const fsSync = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");

  const EVENT_LOG = path.join(os.homedir(), ".claude-os", "kanban-events.jsonl");
  const CURSOR_FILE = path.join(os.homedir(), ".claude-os", "mirror-cursor.json");

  type Cursor = { byte_offset: number; updated_at: string };
  async function readCursor(): Promise<Cursor> {
    try { return JSON.parse(await fs.readFile(CURSOR_FILE, "utf8")) as Cursor; }
    catch { return { byte_offset: 0, updated_at: new Date(0).toISOString() }; }
  }
  async function writeCursor(c: Cursor): Promise<void> {
    if (!fsSync.existsSync(path.dirname(CURSOR_FILE))) {
      fsSync.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true, mode: 0o700 });
    }
    await fs.writeFile(CURSOR_FILE, JSON.stringify(c, null, 2), { mode: 0o600 });
  }

  async function readMirrorTarget(): Promise<{ url: string; api_key: string } | null> {
    const url = process.env.MC_MIRROR_URL ?? "";
    const key = process.env.MC_MIRROR_API_KEY ?? "";
    if (url && key) return { url: url.replace(/\/+$/, ""), api_key: key };
    try {
      const credPath = path.join(os.homedir(), ".claude-os", "credentials.local.json");
      if (!fsSync.existsSync(credPath)) return null;
      const raw = await fs.readFile(credPath, "utf8");
      const store = JSON.parse(raw) as { providers?: Record<string, { secrets?: Record<string, string>; public_config?: Record<string, string> }> };
      const mirror = store.providers?.["mission_control_mirror"];
      if (!mirror?.secrets?.api_key || !mirror.public_config?.url) return null;
      return { url: mirror.public_config.url.replace(/\/+$/, ""), api_key: mirror.secrets.api_key };
    } catch { return null; }
  }

  async function readBatch(startOffset: number, max: number): Promise<{ events: Array<Record<string, unknown> & { external_id: string }>; newOffset: number }> {
    if (!fsSync.existsSync(EVENT_LOG)) return { events: [], newOffset: startOffset };
    const stat = fsSync.statSync(EVENT_LOG);
    if (startOffset > stat.size) startOffset = 0;
    const buf = fsSync.readFileSync(EVENT_LOG, { encoding: "utf8" });
    const tail = buf.slice(startOffset);
    const lines = tail.split("\n");
    const events: Array<Record<string, unknown> & { external_id: string }> = [];
    let consumed = 0;
    for (const line of lines) {
      if (events.length >= max) break;
      if (!line.trim()) { consumed += line.length + 1; continue; }
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        // external_id: use byte offset within the file so it's deterministic
        // and dedupable across re-runs.
        const ext = `kanban-events.jsonl#${startOffset + consumed}`;
        const occurred_at = Math.floor(((obj as any).ts as number ?? Date.now()) / 1000);
        events.push({
          external_id: ext,
          event_type: String((obj as any).event_type ?? "task.event"),
          occurred_at,
          task_external_id: (obj as any).task_id ?? null,
          payload: obj,
          actor: String((obj as any).actor ?? "kanban"),
        } as any);
        consumed += line.length + 1;
      } catch {
        consumed += line.length + 1;
        // Skip malformed line but advance past it so the next tick doesn't replay.
      }
    }
    return { events, newOffset: startOffset + consumed };
  }

  if (sub === "status") {
    const target = await readMirrorTarget();
    const cursor = await readCursor();
    const stat = fsSync.existsSync(EVENT_LOG) ? fsSync.statSync(EVENT_LOG) : null;
    const lag = stat ? stat.size - cursor.byte_offset : 0;
    if (args.flags.json) {
      console.log(JSON.stringify({
        event_log: EVENT_LOG,
        cursor,
        lag_bytes: lag,
        mirror_target: target ? { url: target.url, api_key_hint: target.api_key.slice(0, 4) + "…" + target.api_key.slice(-4) } : null,
      }, null, 2));
      return 0;
    }
    console.log(c("bold", "Mirror · status"));
    console.log(c("gray", "─".repeat(60)));
    console.log(`  event_log    ${EVENT_LOG}${stat ? `  (${stat.size}B)` : "  (missing)"}`);
    console.log(`  cursor       ${cursor.byte_offset}B at ${cursor.updated_at}`);
    console.log(`  lag          ${lag}B`);
    if (target) console.log(`  target       ${target.url}  key=${target.api_key.slice(0, 4)}…${target.api_key.slice(-4)}`);
    else console.log(c("yellow", "  target       (no credentials saved; set MC_MIRROR_URL + MC_MIRROR_API_KEY or save in /settings/api-keys)"));
    return 0;
  }

  if (sub === "push") {
    const target = await readMirrorTarget();
    if (!target) {
      console.error(c("red", "no mirror target configured"));
      console.error("set MC_MIRROR_URL + MC_MIRROR_API_KEY env vars, OR save credentials under provider 'mission_control_mirror' in /settings/api-keys");
      return 2;
    }
    const cursor = await readCursor();
    const max = args.flags["max"] ? parseInt(String(args.flags["max"]), 10) : 100;
    const { events, newOffset } = await readBatch(cursor.byte_offset, max);
    if (events.length === 0) {
      console.log(JSON.stringify({ ok: true, pushed: 0, message: "no new events" }, null, 2));
      return 0;
    }
    const res = await fetch(`${target.url}/api/orchestration/mirror`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": target.api_key,
      },
      body: JSON.stringify({ source: "baseline-local", events }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(c("red", `mirror push failed: HTTP ${res.status}`));
      console.error(text.slice(0, 400));
      return 3;
    }
    const out = await res.json().catch(() => ({})) as Record<string, unknown>;
    await writeCursor({ byte_offset: newOffset, updated_at: new Date().toISOString() });
    console.log(JSON.stringify({ ok: true, posted: events.length, server: out, cursor: newOffset }, null, 2));
    return 0;
  }

  if (sub === "daemon") {
    const intervalMs = args.flags["interval"] ? parseInt(String(args.flags["interval"]), 10) : 5000;
    console.log(c("bold", `Mirror daemon · tick every ${intervalMs}ms · Ctrl-C to stop`));
    while (true) {
      const target = await readMirrorTarget();
      if (target) {
        const cursor = await readCursor();
        const { events, newOffset } = await readBatch(cursor.byte_offset, 100);
        if (events.length > 0) {
          try {
            const res = await fetch(`${target.url}/api/orchestration/mirror`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": target.api_key },
              body: JSON.stringify({ source: "baseline-local", events }),
            });
            if (res.ok) {
              await writeCursor({ byte_offset: newOffset, updated_at: new Date().toISOString() });
              const ts = new Date().toISOString().slice(11, 19);
              console.log(`  ${c("dim", ts)}  posted=${events.length}  cursor=${newOffset}`);
            } else {
              console.error(c("red", `  HTTP ${res.status} — will retry`));
            }
          } catch (err) {
            console.error(c("red", `  network error: ${(err as Error).message}`));
          }
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  if (sub === "configure") {
    // Persist MC mirror target into ~/.claude-os/credentials.local.json
    // under provider 'mission_control_mirror'. Walt's #63 rule: no raw
    // secret echoed back to stdout.
    const url = args.flags["url"] as string | undefined;
    const apiKey = args.flags["api-key"] as string | undefined;
    if (!url || !apiKey) {
      console.error("Usage: mc mirror configure --url <https://mc.example> --api-key <key>");
      return 64;
    }
    const credPath = path.join(os.homedir(), ".claude-os", "credentials.local.json");
    let store: { version: 1; providers: Record<string, { secrets?: Record<string, string>; public_config?: Record<string, string> }> };
    try {
      store = JSON.parse(await fs.readFile(credPath, "utf8"));
      if (store.version !== 1) store = { version: 1, providers: {} };
    } catch { store = { version: 1, providers: {} }; }
    store.providers["mission_control_mirror"] = {
      secrets: { api_key: apiKey.trim() },
      public_config: { url: url.replace(/\/+$/, "") },
    };
    if (!fsSync.existsSync(path.dirname(credPath))) {
      fsSync.mkdirSync(path.dirname(credPath), { recursive: true, mode: 0o700 });
    }
    await fs.writeFile(credPath, JSON.stringify(store, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ ok: true, url: store.providers["mission_control_mirror"].public_config!.url, api_key_hint: apiKey.slice(0, 4) + "…" + apiKey.slice(-4) }, null, 2));
    return 0;
  }

  if (sub === "tail") {
    // Show the most recent N events from the local event log without
    // touching the mirror cursor. Pure read-only.
    const n = args.flags["n"] ? parseInt(String(args.flags["n"]), 10) : 20;
    if (!fsSync.existsSync(EVENT_LOG)) {
      console.log("(event log does not exist yet)");
      return 0;
    }
    const lines = fsSync.readFileSync(EVENT_LOG, "utf8").split("\n").filter((l) => l.trim()).slice(-Math.max(1, n));
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        const ts = new Date(((obj.ts as number | undefined) ?? Date.now())).toISOString();
        console.log(`  ${c("dim", ts)}  ${c("cyan", String(obj.event_type ?? "?"))}  task=${obj.task_id ?? "—"}`);
      } catch {
        console.log(`  ${c("red", "(malformed line)")} ${line.slice(0, 80)}`);
      }
    }
    return 0;
  }

  if (sub === "retry") {
    // Rewind the cursor by N bytes (default to start) so the next push
    // re-sends events. Cloud dedup (ON CONFLICT DO NOTHING on
    // (workspace_id, source, external_id)) makes the replay a no-op for
    // anything already ingested.
    const rewindTo = args.flags["from"] ? parseInt(String(args.flags["from"]), 10) : 0;
    await writeCursor({ byte_offset: Math.max(0, rewindTo), updated_at: new Date().toISOString() });
    console.log(JSON.stringify({ ok: true, cursor: rewindTo, note: "next `mc mirror push` will resend from this offset; duplicates are deduped server-side" }, null, 2));
    return 0;
  }

  if (sub === "disable") {
    // Clear the configured target so subsequent pushes refuse. Cursor
    // is preserved; re-enable via `mc mirror configure`.
    const credPath = path.join(os.homedir(), ".claude-os", "credentials.local.json");
    if (!fsSync.existsSync(credPath)) { console.log("(no mirror target configured; nothing to disable)"); return 0; }
    const store = JSON.parse(await fs.readFile(credPath, "utf8")) as { version: 1; providers: Record<string, unknown> };
    delete store.providers["mission_control_mirror"];
    await fs.writeFile(credPath, JSON.stringify(store, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ ok: true, disabled: true }, null, 2));
    return 0;
  }

  if (sub === "doctor") {
    // Status + a live connection probe to the configured target.
    const target = await readMirrorTarget();
    const cursor = await readCursor();
    const stat = fsSync.existsSync(EVENT_LOG) ? fsSync.statSync(EVENT_LOG) : null;
    const lag = stat ? stat.size - cursor.byte_offset : 0;
    const out: Record<string, unknown> = {
      event_log: EVENT_LOG,
      event_log_exists: !!stat,
      event_log_size_bytes: stat?.size ?? 0,
      cursor,
      lag_bytes: lag,
      target_configured: !!target,
    };
    if (target) {
      out.target_url = target.url;
      out.target_api_key_hint = target.api_key.slice(0, 4) + "…" + target.api_key.slice(-4);
      try {
        const res = await fetch(`${target.url}/api/orchestration/mirror/status`, {
          method: "GET",
          headers: { "x-api-key": target.api_key },
        });
        out.target_reachable = res.ok;
        out.target_http_status = res.status;
        if (res.ok) out.target_status = await res.json().catch(() => null);
      } catch (err) {
        out.target_reachable = false;
        out.target_error = (err as Error).message;
      }
    }
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  console.error(`Unknown mirror subcommand: ${sub}. Try: mc mirror {status|configure|push|tail|retry|disable|daemon|doctor}`);
  return 64;
}

function paintStatusK(s: string): string {
  if (s === "todo") return c("dim", "○ todo");
  if (s === "ready") return c("green", "● ready");
  if (s === "in_progress") return c("cyan", "▶ in_progress");
  if (s === "approval_required") return c("yellow", "⚑ approval");
  if (s === "done") return c("green", "✓ done");
  if (s === "failed") return c("red", "✗ failed");
  if (s === "blocked") return c("red", "■ blocked");
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// mc roi — emits the Phase 5.6 ValueRoiPayload to stdout.
// CLI mirror of GET /api/roi. Default output is JSON for piping into MC.
// ─────────────────────────────────────────────────────────────────────────────
async function cmdRoi(args: Args): Promise<number> {
  const workspace_id = typeof args.flags["workspace-id"] === "string" ? (args.flags["workspace-id"] as string) : undefined;
  const workforce_slug = typeof args.flags["workforce"] === "string" ? (args.flags["workforce"] as string) : undefined;
  const since = typeof args.flags["since"] === "string" ? (args.flags["since"] as string) : undefined;
  const until = typeof args.flags["until"] === "string" ? (args.flags["until"] as string) : undefined;
  const mode = typeof args.flags["mode"] === "string" ? (args.flags["mode"] as any) : undefined;
  const hourly_rate_usd = typeof args.flags["rate"] === "string" ? Number(args.flags["rate"] as string) : undefined;
  const limit = typeof args.flags["limit"] === "string" ? parseInt(args.flags["limit"] as string, 10) : undefined;
  const pretty = args.flags["pretty"] === true;

  const payload = await buildValueRoi({ workspace_id, workforce_slug, since, until, mode, hourly_rate_usd, limit });

  if (!pretty) { console.log(JSON.stringify(payload, null, 2)); return 0; }

  const fmt = (n: number) => "$" + Math.round(n).toLocaleString();
  const lines: string[] = [
    c("bold", "Value / ROI report"),
    c("gray", "─".repeat(80)),
    `  ${c("dim", "workspace")}    ${payload.scope.workspace_id}`,
    `  ${c("dim", "workforce")}    ${payload.scope.workforce_slug ?? "(all)"}`,
    `  ${c("dim", "window")}       ${payload.scope.date_range.start} → ${payload.scope.date_range.end}  (${payload.scope.date_range.mode})`,
    `  ${c("dim", "rate")}         ${fmt(payload.inputs.hourly_rate_usd)} /hr (${payload.inputs.rate_source})`,
    "",
    `  ${c("bold", "HEADLINE")}    ${payload.headline}`,
    `  ${c("dim",  "summary")}     ${payload.summary}`,
    "",
    c("bold", "  Totals"),
    `    hours_saved   ${c("green", payload.totals.hours_saved + "h")}    labor_value  ${c("green", fmt(payload.totals.labor_value_usd))}`,
    `    executions=${payload.totals.tool_executions}  proofs=${payload.totals.proofs_delivered}  tasks_completed=${payload.totals.tasks_completed}  approvals_granted=${payload.totals.approvals_granted}  ${c("red", "blocked=" + payload.totals.blocked_refusals)}`,
    "",
    c("bold", `  Prior period (${payload.prior_period.start.slice(0,10)} → ${payload.prior_period.end.slice(0,10)})`),
    `    ${payload.prior_period.hours_saved}h  ${fmt(payload.prior_period.labor_value_usd)}  ${payload.prior_period.delta_pct == null ? "(no baseline)" : (payload.prior_period.delta_pct > 0 ? c("green", "+" + payload.prior_period.delta_pct + "%") : c("red", payload.prior_period.delta_pct + "%"))}`,
    "",
    c("bold", "  By tier"),
    `    LOW    count=${payload.by_tier.LOW.count}     hours=${payload.by_tier.LOW.hours}     value=${fmt(payload.by_tier.LOW.labor_value_usd)}`,
    `    MEDIUM count=${payload.by_tier.MEDIUM.count}  hours=${payload.by_tier.MEDIUM.hours}  value=${fmt(payload.by_tier.MEDIUM.labor_value_usd)}`,
    `    HIGH   count=${payload.by_tier.HIGH.count}    hours=${payload.by_tier.HIGH.hours}    value=${fmt(payload.by_tier.HIGH.labor_value_usd)}`,
    `    BLOCKED count=${payload.by_tier.BLOCKED.count}  (${c("dim", "no $ attributed; prevented-harm value modeled separately")})`,
    "",
    c("bold", `  By persona (${payload.by_persona.length})`),
    ...payload.by_persona.slice(0, 8).map((p) => `    ${p.name.padEnd(20)} ${p.role.padEnd(30)}  hours=${p.hours_saved.toString().padStart(5)}  value=${fmt(p.labor_value_usd).padStart(7)}  exec=${p.tool_executions}`),
    "",
    c("bold", `  By workflow (${payload.by_workflow.length})`),
    ...payload.by_workflow.slice(0, 8).map((w) => `    ${w.name.padEnd(40)} runs=${w.runs}  proofs=${w.proofs}  ${w.hours_saved}h  ${fmt(w.labor_value_usd)}`),
    "",
    c("bold", "  Approval throughput"),
    `    requested=${payload.approval_throughput.requested}  granted=${payload.approval_throughput.granted}  denied=${payload.approval_throughput.denied}  grant_rate=${payload.approval_throughput.grant_rate ?? "n/a"}  avg_decision=${payload.approval_throughput.avg_decision_minutes ?? "n/a"}min`,
  ];
  console.log(lines.join("\n"));
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// mc daily-brief — emits the Phase 5.5 DailyBriefPayload to stdout.
// CLI mirror of GET /api/daily-brief. Default output is JSON so it pipes
// cleanly into MC's email/dashboard pipeline. --pretty for human reading.
// ─────────────────────────────────────────────────────────────────────────────
async function cmdDailyBrief(args: Args): Promise<number> {
  const workspace_id = typeof args.flags["workspace-id"] === "string" ? (args.flags["workspace-id"] as string) : undefined;
  const workforce_slug = typeof args.flags["workforce"] === "string" ? (args.flags["workforce"] as string) : undefined;
  const since = typeof args.flags["since"] === "string" ? (args.flags["since"] as string) : undefined;
  const until = typeof args.flags["until"] === "string" ? (args.flags["until"] as string) : undefined;
  const mode = typeof args.flags["mode"] === "string" ? (args.flags["mode"] as any) : undefined;
  const limit = typeof args.flags["limit"] === "string" ? parseInt(args.flags["limit"] as string, 10) : undefined;
  const pretty = args.flags["pretty"] === true;

  const payload = await buildDailyBrief({ workspace_id, workforce_slug, since, until, mode, limit });

  // JSON-by-default so it pipes into MC. --pretty gives a quick human read.
  if (!pretty) { console.log(JSON.stringify(payload, null, 2)); return 0; }

  const lines: string[] = [
    c("bold", "Daily Brief"),
    c("gray", "─".repeat(80)),
    `  ${c("dim", "workspace")}   ${payload.scope.workspace_id}`,
    `  ${c("dim", "workforce")}   ${payload.scope.workforce_slug ?? "(all)"}`,
    `  ${c("dim", "window")}      ${payload.scope.date_range.start} → ${payload.scope.date_range.end} (${payload.scope.date_range.mode})`,
    "",
    `  ${c("bold", "HEADLINE")}    ${payload.headline}`,
    `  ${c("dim",  "summary")}     ${payload.summary}`,
    "",
    c("bold", "  Counters"),
    `    tasks_completed=${payload.counters.tasks_completed}  in_flight=${payload.counters.tasks_in_flight}`,
    `    approvals  requested=${payload.counters.approvals_requested}  granted=${payload.counters.approvals_granted}  denied=${payload.counters.approvals_denied}  pending=${payload.counters.approvals_pending}`,
    `    executions=${payload.counters.tool_executions}  proofs=${payload.counters.proofs_delivered}  failures=${payload.counters.failures}  ${c("red", `blocked=${payload.counters.blocked_refusals}`)}`,
    `    policy: LOW=${payload.policy_breakdown.LOW}  MEDIUM=${payload.policy_breakdown.MEDIUM}  HIGH=${payload.policy_breakdown.HIGH}  BLOCKED=${payload.policy_breakdown.BLOCKED}`,
    "",
    `  ${c("bold", "Hours saved")}  ${c("green", payload.estimated_hours_saved.total + "h")}  ${c("dim", "(method: " + payload.estimated_hours_saved.method.slice(0,60) + "…)")}`,
    "",
    c("bold", `  Attention (${payload.attention_items.length})`),
    ...payload.attention_items.slice(0, 10).map((a) => `    [${a.severity}] ${a.title} — ${a.reason.slice(0, 90)}`),
    "",
    c("bold", `  Personas (${payload.persona_breakdown.length})`),
    ...payload.persona_breakdown.slice(0, 10).map((p) => `    ${p.name.padEnd(20)} ${p.role.padEnd(28)} done=${p.tasks_done}  exec=${p.tool_executions}`),
    "",
    c("bold", `  Proof links (${payload.proof_links.length})`),
    ...payload.proof_links.slice(0, 10).map((p) => `    ${p.tool_id}.${p.verb}  ${c("dim", p.audit_id)}  ${p.proof_url}`),
  ];
  console.log(lines.join("\n"));
  return 0;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error(c("red", `mc: fatal: ${e?.message ?? String(e)}`));
  process.exit(1);
});
