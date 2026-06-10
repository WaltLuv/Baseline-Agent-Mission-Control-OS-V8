/**
 * Value / ROI Contract producer — Phase 5.6.
 *
 * Reads the live audit ledgers + workforce template + (best-effort) MC tasks,
 * and emits a typed ValueRoiPayload v1. Intelligence only — Mission Control
 * owns every customer-facing surface (in-app ROI page, "Show your boss"
 * email, etc.).
 *
 * The hours-saved formula is imported from `daily-brief.ts` so the two
 * Baseline OS surfaces cannot drift. Labor-value adds a single monetization
 * lever on top: `total_hours × hourly_rate_usd`.
 *
 * NO UI. NO MC pages. NO dollar guesses we can't defend.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig, mcFetch } from "./mission-control-sync";
import {
  HOURS_FORMULA_METHOD,
  HOURS_FORMULA_PER_ACTION_MINUTES,
  type ProofLink,
} from "./daily-brief";
import { getTemplate, getInstallState, type WorkforceTemplate } from "./workforce-installer";

// ─────────────────────────────────────────────────────────────────────────────
// Contract v1
// ─────────────────────────────────────────────────────────────────────────────

export const VALUE_ROI_CONTRACT_VERSION = 1 as const;

/** Matches the existing UI default in src/lib/time-saved.ts. Customers can
 *  override via ~/.claude-os/config.json → { "roi": { "hourly_rate_usd": N } } */
export const ROI_DEFAULT_HOURLY_RATE_USD = 120;

export type RoiDateMode =
  | "since_install"
  | "last_7d"
  | "last_30d"
  | "mtd"          // month-to-date
  | "qtd"          // quarter-to-date
  | "ytd"          // year-to-date
  | "custom";

export interface RoiDateRange {
  mode: RoiDateMode;
  start: string;
  end: string;
}

export interface RoiInputs {
  hourly_rate_usd: number;
  rate_source: "config" | "default";
  per_action_minutes: { LOW: number; MEDIUM: number; HIGH: number; task_closed: number };
  formula_method: string;
}

export interface RoiTotals {
  hours_saved: number;
  labor_value_usd: number;
  tool_executions: number;
  proofs_delivered: number;
  tasks_completed: number;
  approvals_granted: number;
  blocked_refusals: number;
}

export interface RoiPriorPeriod {
  start: string;
  end: string;
  hours_saved: number;
  labor_value_usd: number;
  delta_pct: number | null;        // null when prior == 0
}

export interface RoiPersonaRow {
  employee_id: string;
  name: string;
  role: string;
  hours_saved: number;
  labor_value_usd: number;
  tool_executions: number;
  proofs_delivered: number;
}

export interface RoiWorkflowRow {
  workflow_id: string;
  name: string;
  employee_id: string | null;
  hours_saved: number;
  labor_value_usd: number;
  runs: number;
  proofs: number;
}

export interface RoiByTier {
  LOW:     { count: number; hours: number; labor_value_usd: number };
  MEDIUM:  { count: number; hours: number; labor_value_usd: number };
  HIGH:    { count: number; hours: number; labor_value_usd: number };
  BLOCKED: { count: number; note: string };
}

export interface RoiProofRollup {
  total: number;
  by_tier: { LOW: number; MEDIUM: number; HIGH: number };
  most_recent: ProofLink[];
}

export interface RoiApprovalThroughput {
  requested: number;
  granted: number;
  denied: number;
  grant_rate: number | null;            // granted / (granted + denied), null if 0/0
  avg_decision_minutes: number | null;  // avg (decided_at − requested_at) over decided requests
}

export interface ValueRoiPayload {
  version: typeof VALUE_ROI_CONTRACT_VERSION;
  generated_at: string;
  generator: { name: "baseline-os"; component: "roi"; engine_version: string };
  source_endpoints: {
    tasks:              { kind: "mc_api"; method: "GET"; path: string };
    executions:         { kind: "file";   path: string };
    approvals_history:  { kind: "file";   path: string };
    approvals_queue:    { kind: "file";   path: string };
    routing_decisions:  { kind: "file";   path: string };
    workforce_template: { kind: "file";   path: string };
    config:             { kind: "file";   path: string };
  };
  scope: {
    workspace_id: number | string;
    workforce_slug: string | null;
    date_range: RoiDateRange;
  };
  inputs: RoiInputs;
  totals: RoiTotals;
  prior_period: RoiPriorPeriod;
  by_persona: RoiPersonaRow[];
  by_workflow: RoiWorkflowRow[];
  by_tier: RoiByTier;
  proof_rollup: RoiProofRollup;
  approval_throughput: RoiApprovalThroughput;
  headline: string;
  summary: string;
}

export interface RoiInput {
  workspace_id?: number | string;
  workforce_slug?: string | null;
  mode?: RoiDateMode;
  since?: string;
  until?: string;
  hourly_rate_usd?: number;     // explicit override; rate_source becomes "config"
  limit?: number;               // caps proof_rollup.most_recent (1..200)
}

// ─────────────────────────────────────────────────────────────────────────────
// Files
// ─────────────────────────────────────────────────────────────────────────────

const STATE_DIR = join(homedir(), ".claude-os");
const EXEC_PATH      = join(STATE_DIR, "tool-executions.jsonl");
const APPROVAL_HIST  = join(STATE_DIR, "approval-history.jsonl");
const APPROVAL_QUEUE = join(STATE_DIR, "approval-queue.json");
const ROUTING_LEDGER = join(STATE_DIR, "router-decisions.jsonl");
const CONFIG_PATH    = join(STATE_DIR, "config.json");

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

// ─────────────────────────────────────────────────────────────────────────────
// Date-range resolution — owns the canonical interpretation of every mode
// ─────────────────────────────────────────────────────────────────────────────

function isoEndNow(until?: string): string { return until ?? new Date().toISOString(); }

function resolveDateRange(input: RoiInput, install_at: string | null): RoiDateRange {
  const end = isoEndNow(input.until);
  const endDate = new Date(end);
  const mode: RoiDateMode = input.mode ?? "last_30d";

  if (mode === "custom") {
    if (!input.since) throw new Error("mode=custom requires --since");
    return { mode, start: input.since, end };
  }
  if (mode === "since_install") {
    const start = install_at ?? new Date(endDate.getTime() - 30 * 86_400_000).toISOString();
    return { mode, start, end };
  }
  if (mode === "last_7d") {
    return { mode, start: new Date(endDate.getTime() - 7 * 86_400_000).toISOString(), end };
  }
  if (mode === "last_30d") {
    return { mode, start: new Date(endDate.getTime() - 30 * 86_400_000).toISOString(), end };
  }
  if (mode === "mtd") {
    const d = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    return { mode, start: d.toISOString(), end };
  }
  if (mode === "qtd") {
    const q = Math.floor(endDate.getUTCMonth() / 3) * 3;
    const d = new Date(Date.UTC(endDate.getUTCFullYear(), q, 1));
    return { mode, start: d.toISOString(), end };
  }
  if (mode === "ytd") {
    const d = new Date(Date.UTC(endDate.getUTCFullYear(), 0, 1));
    return { mode, start: d.toISOString(), end };
  }
  // unreachable
  return { mode, start: end, end };
}

/** Prior period of the same duration immediately preceding `range`. */
function priorRangeOf(range: RoiDateRange): { start: string; end: string } {
  const startMs = Date.parse(range.start);
  const endMs = Date.parse(range.end);
  const dur = endMs - startMs;
  return {
    start: new Date(startMs - dur).toISOString(),
    end: range.start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hourly rate sourcing
// ─────────────────────────────────────────────────────────────────────────────

function resolveHourlyRate(input: RoiInput): { hourly_rate_usd: number; rate_source: "config" | "default" } {
  if (typeof input.hourly_rate_usd === "number" && input.hourly_rate_usd > 0) {
    return { hourly_rate_usd: input.hourly_rate_usd, rate_source: "config" };
  }
  const cfg = readJson<any>(CONFIG_PATH);
  const fromCfg = cfg?.roi?.hourly_rate_usd ?? cfg?.hourlyRate ?? cfg?.hourly_rate;
  if (typeof fromCfg === "number" && fromCfg > 0) {
    return { hourly_rate_usd: fromCfg, rate_source: "config" };
  }
  return { hourly_rate_usd: ROI_DEFAULT_HOURLY_RATE_USD, rate_source: "default" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hours / labor-value derivation — all roads point back to the same per-tier
// minutes table from daily-brief.ts.
// ─────────────────────────────────────────────────────────────────────────────

function minutesPerExecution(effective_risk: string): number {
  if (effective_risk === "LOW")    return HOURS_FORMULA_PER_ACTION_MINUTES.LOW;
  if (effective_risk === "MEDIUM") return HOURS_FORMULA_PER_ACTION_MINUTES.MEDIUM;
  if (effective_risk === "HIGH")   return HOURS_FORMULA_PER_ACTION_MINUTES.HIGH;
  return 0;     // BLOCKED contributes 0 — the action never happened
}

function hoursFromExecutions(execs: any[]): number {
  let mins = 0;
  for (const e of execs) {
    if (e.ok !== true) continue;
    mins += minutesPerExecution(e.proof?.effective_risk ?? "LOW");
  }
  return mins / 60;
}

const round2 = (n: number) => Number(n.toFixed(2));

// ─────────────────────────────────────────────────────────────────────────────
// Window + scope filters
// ─────────────────────────────────────────────────────────────────────────────

function inWindow(ts: string | null | undefined, range: { start: string; end: string }): boolean {
  if (!ts) return false;
  return ts >= range.start && ts <= range.end;
}

/** All tool_ids the workforce template introduces or binds skills against. */
function workforceToolIds(t: WorkforceTemplate | null): Set<string> | null {
  if (!t) return null;
  return new Set([...t.new_tools.map((x) => x.id), ...t.skills.map((s) => s.tool_id)]);
}

/** Build (tool_id, verb) → skill_id map, then skill_id → workflow_id map. */
function attributionMaps(t: WorkforceTemplate | null): { skillByCall: Map<string, string>; workflowBySkill: Map<string, string>; workflowsById: Map<string, string> } {
  const skillByCall = new Map<string, string>();
  const workflowBySkill = new Map<string, string>();
  const workflowsById = new Map<string, string>();
  if (!t) return { skillByCall, workflowBySkill, workflowsById };
  for (const s of t.skills) skillByCall.set(`${s.tool_id}.${s.verb}`, s.id);
  for (const w of t.workflows) {
    workflowsById.set(w.id, w.name);
    for (const sid of w.skill_ids) workflowBySkill.set(sid, w.id);
  }
  return { skillByCall, workflowBySkill, workflowsById };
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline + summary — deterministic, no LLM
// ─────────────────────────────────────────────────────────────────────────────

function pretty(n: number): string { return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0); }
function usd(n: number): string { return "$" + Math.round(n).toLocaleString(); }

function generateHeadline(t: RoiTotals): string {
  if (t.hours_saved < 0.1 && t.tool_executions === 0) return "No ROI activity in window yet.";
  return `${pretty(t.hours_saved)}h saved · ${usd(t.labor_value_usd)} of operator time covered.`;
}

function generateSummary(p: ValueRoiPayload): string {
  const dt = p.prior_period.delta_pct;
  const trend = dt == null
    ? "No prior-period baseline for comparison."
    : (dt > 0
        ? `Up ${pretty(dt)}% vs the prior period.`
        : dt < 0
          ? `Down ${pretty(Math.abs(dt))}% vs the prior period.`
          : "Flat vs the prior period.");
  const topPersona = p.by_persona.slice().sort((a, b) => b.hours_saved - a.hours_saved)[0];
  const personaLine = topPersona && topPersona.hours_saved > 0
    ? `${topPersona.name} (${topPersona.role}) carried ${pretty(topPersona.hours_saved)}h / ${usd(topPersona.labor_value_usd)}.`
    : "";
  const proofLine = p.totals.proofs_delivered > 0
    ? `${p.totals.proofs_delivered} cryptographically-signed proofs delivered.`
    : "";
  return [trend, personaLine, proofLine].filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────────────────────

export async function buildValueRoi(input: RoiInput = {}): Promise<ValueRoiPayload> {
  const cfg = loadConfig();
  const mc_url = "error" in cfg ? "(MC unreachable)" : cfg.url;
  const workspace_id = input.workspace_id ?? ("error" in cfg ? "local" : cfg.workspaceId);
  const workforce_slug = input.workforce_slug ?? null;
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));

  const template = workforce_slug ? getTemplate(workforce_slug) : null;
  const install_state = workforce_slug ? getInstallState(workforce_slug) : null;
  const install_at = install_state?.installed_at ?? null;
  const date_range = resolveDateRange(input, install_at);
  const prior_window = priorRangeOf(date_range);

  const { hourly_rate_usd, rate_source } = resolveHourlyRate(input);

  // ── load sources ──
  const executions = readJsonl<any>(EXEC_PATH);
  const approval_history = readJsonl<any>(APPROVAL_HIST);
  const approval_queue = readJson<any>(APPROVAL_QUEUE);

  // ── tasks (best-effort) ──
  let mc_tasks: any[] = [];
  if (!("error" in cfg)) {
    try {
      const r = await mcFetch<any>(cfg, "GET", `/api/tasks?workspace_id=${encodeURIComponent(String(workspace_id))}&limit=200`);
      if (r.ok) {
        const body = r.body as any;
        const tasks = Array.isArray(body?.tasks) ? body.tasks : Array.isArray(body) ? body : [];
        const seed_task_ids = new Set<string | number>(install_state?.created_task_ids ?? []);
        mc_tasks = workforce_slug
          ? tasks.filter((t: any) => seed_task_ids.has(t.id) || (t.metadata?.workforce_id === workforce_slug) || (Array.isArray(t.tags) && (t.tags.includes(`workforce:${workforce_slug}`) || t.tags.includes(workforce_slug))))
          : tasks;
      }
    } catch { /* offline → mc_tasks empty */ }
  }

  // ── windowed slices ──
  const tool_ids_scope = workforceToolIds(template);
  const inScope = (e: any) => tool_ids_scope ? tool_ids_scope.has(e.tool_id) : true;

  const exec_window = executions.filter((e) => inScope(e) && inWindow(e.finished_at, date_range));
  const exec_ok = exec_window.filter((e) => e.ok === true);
  const exec_blocked = exec_window.filter((e) => (e.proof?.effective_risk === "BLOCKED") || /BLOCKED/i.test(e.refused_reason ?? ""));

  const exec_prior = executions.filter((e) => inScope(e) && inWindow(e.finished_at, prior_window));

  // ── totals ──
  const hours_saved = round2(hoursFromExecutions(exec_ok) + (mc_tasks.filter((t) => ["completed","done","closed"].includes((t.status ?? "").toLowerCase())).length * HOURS_FORMULA_PER_ACTION_MINUTES.task_closed) / 60);
  const labor_value_usd = round2(hours_saved * hourly_rate_usd);

  const tasks_completed = mc_tasks.filter((t) => ["completed","done","closed"].includes((t.status ?? "").toLowerCase())).length;
  const approvals_granted = approval_history.filter((h) => (h.event === "approved" || h.event === "consumed") && inWindow(h.ts, date_range)).length;
  const blocked_refusals = exec_blocked.length;

  const totals: RoiTotals = {
    hours_saved,
    labor_value_usd,
    tool_executions: exec_window.length,
    proofs_delivered: exec_ok.length,
    tasks_completed,
    approvals_granted,
    blocked_refusals,
  };

  // ── prior period ──
  const prior_hours = round2(hoursFromExecutions(exec_prior.filter((e) => e.ok === true)));
  const prior_value = round2(prior_hours * hourly_rate_usd);
  const delta_pct = prior_hours === 0 ? null : round2(((hours_saved - prior_hours) / prior_hours) * 100);
  const prior_period: RoiPriorPeriod = {
    start: prior_window.start,
    end: prior_window.end,
    hours_saved: prior_hours,
    labor_value_usd: prior_value,
    delta_pct,
  };

  // ── by tier ──
  const by_tier: RoiByTier = {
    LOW:     { count: 0, hours: 0, labor_value_usd: 0 },
    MEDIUM:  { count: 0, hours: 0, labor_value_usd: 0 },
    HIGH:    { count: 0, hours: 0, labor_value_usd: 0 },
    BLOCKED: { count: blocked_refusals, note: "BLOCKED refusals prevent the action from happening — no dollar value is attributed by default. Mission Control may model 'prevented-harm' value separately." },
  };
  for (const e of exec_ok) {
    const tier = (e.proof?.effective_risk ?? "LOW") as "LOW" | "MEDIUM" | "HIGH";
    if (tier === "LOW" || tier === "MEDIUM" || tier === "HIGH") {
      by_tier[tier].count += 1;
      const mins = minutesPerExecution(tier);
      by_tier[tier].hours += mins / 60;
      by_tier[tier].labor_value_usd += (mins / 60) * hourly_rate_usd;
    }
  }
  for (const k of ["LOW","MEDIUM","HIGH"] as const) {
    by_tier[k].hours = round2(by_tier[k].hours);
    by_tier[k].labor_value_usd = round2(by_tier[k].labor_value_usd);
  }

  // ── by persona ──
  const by_persona: RoiPersonaRow[] = (template?.employees ?? []).map((e) => {
    const persona_skills = new Set(e.skill_ids ?? []);
    const persona_tool_ids = new Set((template?.skills ?? []).filter((s) => persona_skills.has(s.id)).map((s) => s.tool_id));
    const owned_execs_ok = exec_ok.filter((x) => persona_tool_ids.has(x.tool_id));
    const hrs = round2(hoursFromExecutions(owned_execs_ok));
    return {
      employee_id: e.id,
      name: e.name,
      role: e.role,
      hours_saved: hrs,
      labor_value_usd: round2(hrs * hourly_rate_usd),
      tool_executions: exec_window.filter((x) => persona_tool_ids.has(x.tool_id)).length,
      proofs_delivered: owned_execs_ok.length,
    };
  }).sort((a, b) => b.hours_saved - a.hours_saved);

  // ── by workflow ──
  const { skillByCall, workflowBySkill } = attributionMaps(template);
  const wf_acc = new Map<string, { hours: number; runs: number; proofs: number }>();
  const wf_name = new Map<string, { name: string; employee_id: string }>();
  if (template) for (const w of template.workflows) wf_name.set(w.id, { name: w.name, employee_id: w.employee_id });

  for (const e of exec_window) {
    const sid = skillByCall.get(`${e.tool_id}.${e.verb}`);
    const wid = sid ? workflowBySkill.get(sid) : undefined;
    if (!wid) continue;
    const slot = wf_acc.get(wid) ?? { hours: 0, runs: 0, proofs: 0 };
    slot.runs += 1;
    if (e.ok === true) {
      slot.proofs += 1;
      slot.hours += minutesPerExecution(e.proof?.effective_risk ?? "LOW") / 60;
    }
    wf_acc.set(wid, slot);
  }
  const by_workflow: RoiWorkflowRow[] = [...wf_acc.entries()].map(([wid, v]) => ({
    workflow_id: wid,
    name: wf_name.get(wid)?.name ?? wid,
    employee_id: wf_name.get(wid)?.employee_id ?? null,
    hours_saved: round2(v.hours),
    labor_value_usd: round2(v.hours * hourly_rate_usd),
    runs: v.runs,
    proofs: v.proofs,
  })).sort((a, b) => b.hours_saved - a.hours_saved);

  // ── proof rollup ──
  const proof_rollup: RoiProofRollup = {
    total: exec_ok.length,
    by_tier: { LOW: by_tier.LOW.count, MEDIUM: by_tier.MEDIUM.count, HIGH: by_tier.HIGH.count },
    most_recent: exec_ok
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
        proof_url: e.task_id ? `${mc_url}/app/tasks/${e.task_id}?audit=${e.audit_id}` : `cli://audit/${e.audit_id}`,
      })),
  };

  // ── approval throughput ──
  const requested_in_window = approval_history.filter((h) => h.event === "requested" && inWindow(h.ts, date_range));
  const decided_in_window = approval_history.filter((h) => (h.event === "approved" || h.event === "denied") && inWindow(h.ts, date_range));
  const granted = approval_history.filter((h) => h.event === "approved" && inWindow(h.ts, date_range)).length;
  const denied = approval_history.filter((h) => h.event === "denied" && inWindow(h.ts, date_range)).length;
  const grant_rate = (granted + denied) === 0 ? null : round2(granted / (granted + denied));

  // Avg decision time: match each `approved`/`denied` event to its `requested_at`.
  const requestedTsById = new Map<string, string>();
  for (const h of approval_history) {
    if (h.event === "requested" && h.request?.id && h.request?.requested_at) {
      requestedTsById.set(h.request.id, h.request.requested_at);
    }
  }
  const decisionDeltas: number[] = [];
  for (const h of decided_in_window) {
    const rid = h.request?.id;
    const reqTs = rid ? requestedTsById.get(rid) : null;
    if (!reqTs) continue;
    const dt = (Date.parse(h.ts) - Date.parse(reqTs)) / 60_000;
    if (Number.isFinite(dt) && dt >= 0) decisionDeltas.push(dt);
  }
  const avg_decision_minutes = decisionDeltas.length === 0 ? null
    : round2(decisionDeltas.reduce((a, b) => a + b, 0) / decisionDeltas.length);

  const approval_throughput: RoiApprovalThroughput = {
    requested: requested_in_window.length,
    granted,
    denied,
    grant_rate,
    avg_decision_minutes,
  };

  // ── assemble ──
  const payload: ValueRoiPayload = {
    version: VALUE_ROI_CONTRACT_VERSION,
    generated_at: new Date().toISOString(),
    generator: { name: "baseline-os", component: "roi", engine_version: process.env.BASELINE_OS_VERSION ?? "1.0" },
    source_endpoints: {
      tasks:              { kind: "mc_api", method: "GET", path: `${mc_url}/api/tasks` },
      executions:         { kind: "file",   path: EXEC_PATH },
      approvals_history:  { kind: "file",   path: APPROVAL_HIST },
      approvals_queue:    { kind: "file",   path: APPROVAL_QUEUE },
      routing_decisions:  { kind: "file",   path: ROUTING_LEDGER },
      workforce_template: { kind: "file",   path: template ? `src/data/workforces/${workforce_slug}.json` : "(none)" },
      config:             { kind: "file",   path: CONFIG_PATH },
    },
    scope: { workspace_id, workforce_slug, date_range },
    inputs: {
      hourly_rate_usd,
      rate_source,
      per_action_minutes: { ...HOURS_FORMULA_PER_ACTION_MINUTES },
      formula_method: HOURS_FORMULA_METHOD,
    },
    totals,
    prior_period,
    by_persona,
    by_workflow,
    by_tier,
    proof_rollup,
    approval_throughput,
    headline: "",
    summary: "",
  };
  payload.headline = generateHeadline(totals);
  payload.summary = generateSummary(payload);
  return payload;
}
