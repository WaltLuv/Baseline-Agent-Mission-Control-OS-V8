/**
 * Daily Brief — Baseline OS contract producer (Phase 5.5).
 *
 * Reads the live audit ledgers + workforce template + (best-effort) the MC
 * task surface, and emits a typed DailyBriefPayload. This file is the
 * intelligence; Mission Control is the display.
 *
 * NO UI. NO Mission Control panel. NO email template. Those belong to MC.
 *
 * Lane rule: Baseline OS produces decisions + reasoning + proof. Mission
 * Control consumes the payload and renders it. If MC needs a different
 * shape, the contract is versioned (see `payload.version`).
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig, mcFetch } from "./mission-control-sync";
import { getTemplate, getInstallState } from "./workforce-installer";

// ─────────────────────────────────────────────────────────────────────────────
// Public contract — version 1
// ─────────────────────────────────────────────────────────────────────────────

export const DAILY_BRIEF_CONTRACT_VERSION = 1 as const;

export interface DateRange {
  mode: "since_yesterday" | "since_last_visit" | "custom";
  start: string;   // ISO
  end: string;     // ISO
}

export interface Counters {
  tasks_completed: number;
  tasks_in_flight: number;
  approvals_requested: number;
  approvals_granted: number;
  approvals_denied: number;
  approvals_pending: number;
  tool_executions: number;
  proofs_delivered: number;
  failures: number;
  blocked_refusals: number;
}

export interface PolicyBreakdown {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  BLOCKED: number;
}

export interface AttentionItem {
  id: string;                // stable id ("attn_…") so MC can dedupe across polls
  kind: "approval_pending" | "execution_failure" | "blocked_refusal" | "high_priority_task" | "expired_approval";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  reason: string;
  employee_id: string | null;
  task_id: string | number | null;
  audit_id: string | null;
  occurred_at: string;
  deep_link: string;         // hint for MC; can be replaced when rendered
}

export interface PersonaSummary {
  employee_id: string;
  name: string;
  role: string;
  tasks_done: number;
  tasks_in_progress: number;
  tool_executions: number;
  last_action_at: string | null;
}

export interface ProofLink {
  audit_id: string;
  tool_id: string;
  verb: string;
  task_id: string | number | null;
  finished_at: string;
  effective_risk: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  stdout_sha256: string;
  args_fingerprint: string;
  approval_request_id: string | null;
  proof_url: string;         // canonical deep link MC can render
}

export interface EstimatedHoursSaved {
  total: number;             // hours, two decimal precision
  method: string;            // human-readable description of the formula
  breakdown: {
    by_risk_tier: { LOW: number; MEDIUM: number; HIGH: number };  // hours saved per tier
    task_closure: number;    // hours from tasks closed in window
  };
  per_action_minutes: { LOW: number; MEDIUM: number; HIGH: number; task_closed: number };
}

export interface DailyBriefPayload {
  version: typeof DAILY_BRIEF_CONTRACT_VERSION;
  generated_at: string;
  generator: { name: "baseline-os"; component: "daily-brief"; engine_version: string };
  source_endpoints: {
    tasks:              { kind: "mc_api"; method: "GET"; path: string };
    executions:         { kind: "file";   path: string };
    approvals_history:  { kind: "file";   path: string };
    approvals_queue:    { kind: "file";   path: string };
    routing_decisions:  { kind: "file";   path: string };
    workforce_template: { kind: "file";   path: string };
  };
  scope: {
    workspace_id: number | string;
    workforce_slug: string | null;
    date_range: DateRange;
  };
  headline: string;
  summary: string;
  counters: Counters;
  policy_breakdown: PolicyBreakdown;
  estimated_hours_saved: EstimatedHoursSaved;
  attention_items: AttentionItem[];
  persona_breakdown: PersonaSummary[];
  proof_links: ProofLink[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

export interface BriefInput {
  workspace_id?: number | string;
  workforce_slug?: string | null;
  /** Either a concrete ISO start, or a mode that resolves to one. */
  since?: string;
  mode?: DateRange["mode"];
  /** Optional ISO end; defaults to now. */
  until?: string;
  /** Soft cap on attention items + proof links returned. */
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimated-hours-saved formula — declared in code so the contract doc + CLI
// + future ROI page all reference exactly the same constants.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single source of truth for the hours-saved formula. Exported so ROI + any
 * future Baseline OS surface uses the same constants — Daily Brief and ROI
 * cannot drift on this.
 */
export const HOURS_FORMULA_PER_ACTION_MINUTES = {
  LOW: 2,       // a read/search/status saves ~2 minutes of human time
  MEDIUM: 10,   // a draft/create/log saves ~10 minutes
  HIGH: 30,     // a co-signed send/publish saves ~30 minutes (operator co-signs but agent prepped)
  task_closed: 5, // operator triage time saved per closed task
} as const;

export const HOURS_FORMULA_METHOD =
  "hours = (LOW×2min + MEDIUM×10min + HIGH×30min + tasks_completed×5min) / 60. " +
  "Defaults reflect the median human time for each tier; operators can override per workforce template later. " +
  "BLOCKED refusals contribute zero (the action never happened).";

// ─────────────────────────────────────────────────────────────────────────────
// File helpers — single-pass jsonl reads with cheap window filtering
// ─────────────────────────────────────────────────────────────────────────────

const STATE_DIR = join(homedir(), ".claude-os");
const EXEC_PATH        = join(STATE_DIR, "tool-executions.jsonl");
const APPROVAL_HIST    = join(STATE_DIR, "approval-history.jsonl");
const APPROVAL_QUEUE   = join(STATE_DIR, "approval-queue.json");
const ROUTING_LEDGER   = join(STATE_DIR, "router-decisions.jsonl");

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch { return []; }
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")) as T; } catch { return null; }
}

function resolveDateRange(input: BriefInput): DateRange {
  const end = input.until ?? new Date().toISOString();
  if (input.since) {
    return { mode: input.mode ?? "custom", start: input.since, end };
  }
  const mode: DateRange["mode"] = input.mode ?? "since_yesterday";
  if (mode === "since_yesterday") {
    const d = new Date(end);
    d.setUTCHours(d.getUTCHours() - 24);
    return { mode, start: d.toISOString(), end };
  }
  if (mode === "since_last_visit") {
    // Without a last_visit input we fall back to 24h.
    const d = new Date(end);
    d.setUTCHours(d.getUTCHours() - 24);
    return { mode, start: d.toISOString(), end };
  }
  return { mode, start: end, end };
}

function inWindow(ts: string | null | undefined, range: DateRange): boolean {
  if (!ts) return false;
  return ts >= range.start && ts <= range.end;
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline + summary generators — rule-based, deterministic. NO LLM.
// ─────────────────────────────────────────────────────────────────────────────

function generateHeadline(c: Counters): string {
  if (c.blocked_refusals > 0) return `${c.blocked_refusals} BLOCKED refusal${c.blocked_refusals === 1 ? "" : "s"} in window — review immediately.`;
  if (c.approvals_pending > 0) return `${c.approvals_pending} approval${c.approvals_pending === 1 ? "" : "s"} waiting on you.`;
  if (c.failures > 0) return `${c.failures} tool execution${c.failures === 1 ? "" : "s"} failed — needs your eye.`;
  if (c.tasks_completed === 0 && c.tool_executions === 0) return "Quiet window — nothing of consequence.";
  return `${c.tasks_completed} task${c.tasks_completed === 1 ? "" : "s"} closed, ${c.tool_executions} tool execution${c.tool_executions === 1 ? "" : "s"} run.`;
}

function generateSummary(c: Counters, hours: EstimatedHoursSaved, personas: PersonaSummary[]): string {
  const parts: string[] = [];
  const topPersona = personas.slice().sort((a, b) => (b.tasks_done + b.tool_executions) - (a.tasks_done + a.tool_executions))[0];
  if (topPersona && (topPersona.tasks_done + topPersona.tool_executions) > 0) {
    parts.push(`${topPersona.name} (${topPersona.role}) led the window with ${topPersona.tasks_done} closed and ${topPersona.tool_executions} tool execution${topPersona.tool_executions === 1 ? "" : "s"}.`);
  }
  if (c.proofs_delivered > 0) parts.push(`${c.proofs_delivered} cryptographically-signed proof${c.proofs_delivered === 1 ? "" : "s"} delivered.`);
  if (c.approvals_granted > 0) parts.push(`Operator granted ${c.approvals_granted} approval${c.approvals_granted === 1 ? "" : "s"}.`);
  if (hours.total >= 0.25) parts.push(`Estimated ${hours.total.toFixed(2)}h of operator time saved.`);
  if (parts.length === 0) return "No significant activity in window.";
  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────────────────────

export async function buildDailyBrief(input: BriefInput = {}): Promise<DailyBriefPayload> {
  const cfg = loadConfig();
  const mc_url = "error" in cfg ? "(MC unreachable)" : cfg.url;
  const workspace_id = input.workspace_id ?? ("error" in cfg ? "local" : cfg.workspaceId);
  const workforce_slug = input.workforce_slug ?? null;
  const date_range = resolveDateRange(input);
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));

  // ── 1) load every source we'll aggregate ──
  const executions = readJsonl<any>(EXEC_PATH);
  const approval_history = readJsonl<any>(APPROVAL_HIST);
  const approval_queue = readJson<any>(APPROVAL_QUEUE);

  const template = workforce_slug ? getTemplate(workforce_slug) : null;
  const install_state = workforce_slug ? getInstallState(workforce_slug) : null;
  const seed_task_ids = new Set<string | number>(install_state?.created_task_ids ?? []);

  // ── 2) (best-effort) pull MC tasks in scope ──
  let mc_tasks: any[] = [];
  if (!("error" in cfg)) {
    try {
      const r = await mcFetch<any>(cfg, "GET", `/api/tasks?workspace_id=${encodeURIComponent(String(workspace_id))}&limit=200`);
      if (r.ok) {
        const body = r.body as any;
        mc_tasks = Array.isArray(body?.tasks) ? body.tasks : Array.isArray(body) ? body : [];
        // Workforce filter: tasks must be tagged with the workforce slug OR be in the install's created_task_ids list.
        if (workforce_slug) {
          mc_tasks = mc_tasks.filter((t) => {
            if (seed_task_ids.has(t.id)) return true;
            const meta = t.metadata ?? {};
            if (meta.workforce_id === workforce_slug) return true;
            const tags: string[] = Array.isArray(t.tags) ? t.tags : [];
            return tags.includes(`workforce:${workforce_slug}`) || tags.includes(workforce_slug);
          });
        }
      }
    } catch { /* offline → mc_tasks stays empty; brief still produced from local sources */ }
  }

  // ── 3) windowed slices ──
  const exec_window = executions.filter((e) => inWindow(e.finished_at, date_range));
  const exec_ok = exec_window.filter((e) => e.ok === true);
  const exec_failed = exec_window.filter((e) => e.approved === true && e.ok === false);
  const exec_blocked = exec_window.filter((e) => (e.proof?.effective_risk === "BLOCKED") || /BLOCKED/i.test(e.refused_reason ?? ""));

  // workforce filter on executions — if a workforce slug is given, restrict to its tool ids
  const workforce_tool_ids = template ? new Set([
    ...template.new_tools.map((t) => t.id),
    ...template.skills.map((s) => s.tool_id),
  ]) : null;
  const exec_scoped = workforce_tool_ids ? exec_window.filter((e) => workforce_tool_ids.has(e.tool_id)) : exec_window;
  const exec_ok_scoped = exec_scoped.filter((e) => e.ok === true);

  const approval_events_window = approval_history.filter((h) => inWindow(h.ts, date_range));
  const approvals_requested = approval_events_window.filter((h) => h.event === "requested").length;
  const approvals_granted = approval_events_window.filter((h) => h.event === "approved" || h.event === "consumed").length;
  const approvals_denied = approval_events_window.filter((h) => h.event === "denied").length;
  const approvals_pending = (approval_queue?.requests ?? []).filter((r: any) => r.status === "pending").length;

  // ── 4) counters ──
  const tasks_completed = mc_tasks.filter((t) => ["completed", "done", "closed"].includes((t.status ?? "").toLowerCase())).length;
  const tasks_in_flight = mc_tasks.filter((t) => !["completed", "done", "closed", "archived"].includes((t.status ?? "").toLowerCase())).length;

  const counters: Counters = {
    tasks_completed,
    tasks_in_flight,
    approvals_requested,
    approvals_granted,
    approvals_denied,
    approvals_pending,
    tool_executions: exec_scoped.length,
    proofs_delivered: exec_ok_scoped.length,
    failures: exec_failed.length,
    blocked_refusals: exec_blocked.length,
  };

  // ── 5) policy breakdown ──
  const policy_breakdown: PolicyBreakdown = { LOW: 0, MEDIUM: 0, HIGH: 0, BLOCKED: 0 };
  for (const e of exec_scoped) {
    const tier = e.proof?.effective_risk ?? "LOW";
    if (tier in policy_breakdown) (policy_breakdown as any)[tier] += 1;
  }

  // ── 6) estimated hours saved ──
  const hours_by_tier = {
    LOW:    (policy_breakdown.LOW    * HOURS_FORMULA_PER_ACTION_MINUTES.LOW)    / 60,
    MEDIUM: (policy_breakdown.MEDIUM * HOURS_FORMULA_PER_ACTION_MINUTES.MEDIUM) / 60,
    HIGH:   (policy_breakdown.HIGH   * HOURS_FORMULA_PER_ACTION_MINUTES.HIGH)   / 60,
  };
  const hours_from_tasks = (counters.tasks_completed * HOURS_FORMULA_PER_ACTION_MINUTES.task_closed) / 60;
  const total_hours = Number((hours_by_tier.LOW + hours_by_tier.MEDIUM + hours_by_tier.HIGH + hours_from_tasks).toFixed(2));
  const estimated_hours_saved: EstimatedHoursSaved = {
    total: total_hours,
    method: HOURS_FORMULA_METHOD,
    breakdown: { by_risk_tier: { LOW: hours_by_tier.LOW, MEDIUM: hours_by_tier.MEDIUM, HIGH: hours_by_tier.HIGH }, task_closure: hours_from_tasks },
    per_action_minutes: { ...HOURS_FORMULA_PER_ACTION_MINUTES },
  };

  // ── 7) persona breakdown ──
  const personas: PersonaSummary[] = (template?.employees ?? []).map((e) => {
    const taskMatches = mc_tasks.filter((t) => (t.metadata?.employee_id ?? null) === e.id || (Array.isArray(t.tags) && t.tags.includes(`employee:${e.id}`)));
    const persona_skills = new Set(e.skill_ids ?? []);
    const persona_tool_ids = new Set((template?.skills ?? []).filter((s) => persona_skills.has(s.id)).map((s) => s.tool_id));
    const persona_execs = exec_scoped.filter((x) => persona_tool_ids.has(x.tool_id));
    const last = persona_execs.slice().sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1))[0];
    return {
      employee_id: e.id,
      name: e.name,
      role: e.role,
      tasks_done: taskMatches.filter((t) => ["completed","done","closed"].includes((t.status ?? "").toLowerCase())).length,
      tasks_in_progress: taskMatches.filter((t) => !["completed","done","closed","archived"].includes((t.status ?? "").toLowerCase())).length,
      tool_executions: persona_execs.length,
      last_action_at: last?.finished_at ?? null,
    };
  });

  // ── 8) attention items ──
  const attn: AttentionItem[] = [];
  const mcDeep = (path: string) => `${mc_url}${path}`;

  // (a) Pending approvals
  for (const r of (approval_queue?.requests ?? []) as any[]) {
    if (r.status !== "pending") continue;
    const ageHours = (Date.now() - new Date(r.requested_at).getTime()) / 3_600_000;
    const sev: AttentionItem["severity"] = ageHours > 4 ? "HIGH" : ageHours > 1 ? "MEDIUM" : "LOW";
    attn.push({
      id: `attn_pending_${r.id}`,
      kind: "approval_pending",
      severity: sev,
      title: `Approval pending · ${r.tool_id}.${r.verb}`,
      reason: r.reason || "operator approval required",
      employee_id: null,
      task_id: r.task_id ?? null,
      audit_id: null,
      occurred_at: r.requested_at,
      deep_link: r.task_id ? mcDeep(`/app/tasks/${r.task_id}`) : `cli://approvals/${r.id}`,
    });
  }
  // (b) Failures + (c) BLOCKED refusals
  for (const e of exec_failed) {
    attn.push({
      id: `attn_fail_${e.audit_id}`,
      kind: "execution_failure",
      severity: "MEDIUM",
      title: `Execution failed · ${e.tool_id}.${e.verb}`,
      reason: (e.stderr || "").slice(0, 280) || `exit_code=${e.exit_code}`,
      employee_id: null,
      task_id: e.task_id ?? null,
      audit_id: e.audit_id,
      occurred_at: e.finished_at,
      deep_link: e.task_id ? mcDeep(`/app/tasks/${e.task_id}`) : `cli://audit/${e.audit_id}`,
    });
  }
  for (const e of exec_blocked) {
    attn.push({
      id: `attn_blk_${e.audit_id}`,
      kind: "blocked_refusal",
      severity: "CRITICAL",
      title: `BLOCKED · ${e.tool_id}.${e.verb}`,
      reason: e.refused_reason || "policy: BLOCKED",
      employee_id: null,
      task_id: e.task_id ?? null,
      audit_id: e.audit_id,
      occurred_at: e.finished_at,
      deep_link: e.task_id ? mcDeep(`/app/tasks/${e.task_id}`) : `cli://audit/${e.audit_id}`,
    });
  }
  // (d) High-priority tasks still in flight
  for (const t of mc_tasks) {
    if (t.priority !== "high" && t.priority !== "urgent") continue;
    const status = (t.status ?? "").toLowerCase();
    if (["completed","done","closed","archived"].includes(status)) continue;
    attn.push({
      id: `attn_hp_${t.id}`,
      kind: "high_priority_task",
      severity: t.priority === "urgent" ? "CRITICAL" : "HIGH",
      title: t.title ?? `Task ${t.id}`,
      reason: `priority=${t.priority}, status=${status || "?"}`,
      employee_id: (t.metadata?.employee_id) ?? null,
      task_id: t.id,
      audit_id: null,
      occurred_at: new Date((t.updated_at ?? t.created_at) * 1000).toISOString().replace(/\.000Z$/, "Z"),
      deep_link: mcDeep(`/app/tasks/${t.id}`),
    });
  }
  // sort by severity then most-recent first, then trim
  const SEV_RANK: Record<AttentionItem["severity"], number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  attn.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || (b.occurred_at.localeCompare(a.occurred_at)));
  const attention_items = attn.slice(0, limit);

  // ── 9) proof links ──
  const proof_links: ProofLink[] = exec_ok_scoped
    .slice()
    .sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1))
    .slice(0, limit)
    .map((e) => ({
      audit_id: e.audit_id,
      tool_id: e.tool_id,
      verb: e.verb,
      task_id: e.task_id ?? null,
      finished_at: e.finished_at,
      effective_risk: e.proof?.effective_risk ?? "LOW",
      stdout_sha256: e.proof?.stdout_sha256 ?? "",
      args_fingerprint: e.proof?.args_fingerprint ?? "",
      approval_request_id: e.proof?.approval_request_id ?? null,
      proof_url: e.task_id ? mcDeep(`/app/tasks/${e.task_id}?audit=${e.audit_id}`) : `cli://audit/${e.audit_id}`,
    }));

  // ── 10) headline + summary ──
  const headline = generateHeadline(counters);
  const summary = generateSummary(counters, estimated_hours_saved, personas);

  return {
    version: DAILY_BRIEF_CONTRACT_VERSION,
    generated_at: new Date().toISOString(),
    generator: { name: "baseline-os", component: "daily-brief", engine_version: process.env.BASELINE_OS_VERSION ?? "1.0" },
    source_endpoints: {
      tasks:              { kind: "mc_api", method: "GET", path: `${mc_url}/api/tasks` },
      executions:         { kind: "file",   path: EXEC_PATH },
      approvals_history:  { kind: "file",   path: APPROVAL_HIST },
      approvals_queue:    { kind: "file",   path: APPROVAL_QUEUE },
      routing_decisions:  { kind: "file",   path: ROUTING_LEDGER },
      workforce_template: { kind: "file",   path: template ? `src/data/workforces/${workforce_slug}.json` : "(none)" },
    },
    scope: { workspace_id, workforce_slug, date_range },
    headline,
    summary,
    counters,
    policy_breakdown,
    estimated_hours_saved,
    attention_items,
    persona_breakdown: personas,
    proof_links,
  };
}
