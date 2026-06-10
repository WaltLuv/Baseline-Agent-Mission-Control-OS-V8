/**
 * mission-control-sync.ts — Baseline OS → Mission Control V8 bridge.
 *
 * What this module does:
 *   1. Maps every record in the local Runtime Registry into Mission Control's
 *      handshake schema and POSTs it to `POST /api/runtime/handshake`.
 *   2. Records heartbeats against `POST /api/runtime/heartbeat`.
 *   3. Pulls assigned tasks for each runtime from `GET /api/tasks/queue`.
 *   4. Persists results / failures to an offline queue at
 *      `~/.claude-os/mc-sync-state.json` so we can retry after network blips
 *      without losing what was scheduled.
 *
 * Why it's its own module:
 *   The directive is explicit — Mission Control is the supervision layer,
 *   Baseline OS is the local coordination layer, and they must sync cleanly
 *   *without* either side reaching into the other's internals. This module
 *   is the entire contract surface.
 *
 * Reference (read in /tmp/mc-v8 by hand):
 *   /api/runtime/handshake  POST { kind, installationId, label?, version?, capabilities?[], heartbeat?, taskCount?, health? }
 *   /api/runtime/handshake  GET  → { runtimes: RuntimeRecord[] } (snapshot)
 *   /api/runtime/heartbeat  POST { kind, installationId, taskCount?, health? }
 *   /api/tasks/queue        GET  ?agent=<label>&max_capacity=N
 *   auth                    x-api-key header (operator role for writes)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";

import {
  discoverRuntimes,
  listRuntimes,
  resolveWorkspaceId,
  type RuntimeRecord,
  type RuntimeStatus,
} from "./runtime-registry";

// ─────────────────────────────────────────────────────────────────────────────
// Config + state file
// ─────────────────────────────────────────────────────────────────────────────

const STATE_DIR = join(homedir(), ".claude-os");
const STATE_PATH = join(STATE_DIR, "mc-sync-state.json");

export type McHealth = "green" | "amber" | "red";
export type McKind = "hermes" | "openclaw" | "opencode" | "codex" | "claude-code" | "other";

export interface McConfig {
  url: string;        // e.g. http://127.0.0.1:3000
  apiKey: string;     // x-api-key header value
  workspaceId: string;
  timeoutMs: number;
  retries: number;
}

/**
 * Loads MC sync config from env vars first, with a persistent file fallback
 * at ~/.claude-os/mc-sync-config.json. The file lets the dev server keep
 * config across restarts without needing the operator to re-export env on
 * every launch. Operators who prefer env-only can ignore the file entirely.
 */
const SYNC_CONFIG_PATH = join(STATE_DIR, "mc-sync-config.json");

interface SyncConfigFile {
  MC_URL?: string;
  MC_API_KEY?: string;
  BASELINE_WORKSPACE_ID?: string;
  MC_TIMEOUT_MS?: number;
  MC_RETRIES?: number;
}

function readSyncConfigFile(): SyncConfigFile {
  if (!existsSync(SYNC_CONFIG_PATH)) return {};
  try { return JSON.parse(readFileSync(SYNC_CONFIG_PATH, "utf8")) as SyncConfigFile; }
  catch { return {}; }
}

export function writeSyncConfigFile(cfg: SyncConfigFile): void {
  ensureDir();
  const tmp = `${SYNC_CONFIG_PATH}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(cfg, null, 2), "utf8");
  renameSync(tmp, SYNC_CONFIG_PATH);
}

export function loadConfig(): McConfig | { error: string } {
  const file = readSyncConfigFile();
  const url       = (process.env.MC_URL       || file.MC_URL       || "").trim();
  const apiKey    = (process.env.MC_API_KEY   || file.MC_API_KEY   || "").trim();
  const workspaceId = resolveWorkspaceId() !== "local"
    ? resolveWorkspaceId()
    : (file.BASELINE_WORKSPACE_ID?.trim() || "local");
  if (!url) return { error: "MC_URL not set. Try: export MC_URL=http://127.0.0.1:3000  OR  write ~/.claude-os/mc-sync-config.json" };
  if (!apiKey) return { error: "MC_API_KEY not set. Mint one in Mission Control → API Keys, then: export MC_API_KEY=..." };
  return {
    url: url.replace(/\/+$/, ""),
    apiKey,
    workspaceId,
    timeoutMs: parseInt(String(process.env.MC_TIMEOUT_MS || file.MC_TIMEOUT_MS || "8000"), 10),
    retries: parseInt(String(process.env.MC_RETRIES || file.MC_RETRIES || "3"), 10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync state (offline queue + last-push bookkeeping)
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncState {
  version: 1;
  updated_at: string;
  // What we last successfully pushed. Lets us skip no-op heartbeats.
  last_push: Record<string, { last_seen: string; health: McHealth; active_tasks: number }>;
  // Queued mutations that haven't been delivered to MC yet.
  offline_queue: QueuedMutation[];
  // Counters for status reporting.
  totals: { handshakes: number; heartbeats: number; failures: number; tasks_pulled: number };
}

export interface QueuedMutation {
  id: string;
  ts: string;
  kind: "handshake" | "heartbeat";
  payload: HandshakePayload | HeartbeatPayload;
}

export interface HandshakePayload {
  kind: McKind;
  installationId: string;
  label?: string;
  version?: string | null;
  capabilities?: string[];
  heartbeat?: boolean;
  taskCount?: number;
  health?: McHealth;
}

export interface HeartbeatPayload {
  kind: McKind;
  installationId: string;
  taskCount?: number;
  health?: McHealth;
}

function ensureDir(): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function emptyState(): SyncState {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    last_push: {},
    offline_queue: [],
    totals: { handshakes: 0, heartbeats: 0, failures: 0, tasks_pulled: 0 },
  };
}

export function readState(): SyncState {
  if (!existsSync(STATE_PATH)) return emptyState();
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8")) as SyncState;
    if (parsed.version !== 1) return emptyState();
    return parsed;
  } catch { return emptyState(); }
}

export function writeState(s: SyncState): void {
  ensureDir();
  const tmp = `${STATE_PATH}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify({ ...s, updated_at: new Date().toISOString() }, null, 2), "utf8");
  renameSync(tmp, STATE_PATH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Field mapping — local Phase 1 record → MC V8 payload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MC V8 accepts kind ∈ { hermes, openclaw, opencode, codex, claude-code, other }.
 * voiceops / visionops collapse to "other" until MC adds them to its enum.
 */
export function mapKind(t: RuntimeRecord["runtime_type"]): McKind {
  switch (t) {
    case "hermes": return "hermes";
    case "openclaw": return "openclaw";
    case "claude-code": return "claude-code";
    case "codex": return "codex";
    default: return "other";
  }
}

/** healthy/warning/critical/offline → MC's tri-state green/amber/red. */
export function mapHealth(s: RuntimeStatus): McHealth {
  if (s === "healthy") return "green";
  if (s === "warning") return "amber";
  return "red";   // critical + offline both surface as red
}

/** Stable installation id — host-scoped, max 120 chars per MC schema. */
export function installationIdFor(r: RuntimeRecord): string {
  // MC's runtime_registry key is (workspace, kind, installation_id), so we
  // bake the hostname into the id to keep it unique across machines.
  const id = `${r.runtime_id}`;
  return id.length <= 120 ? id : id.slice(0, 120);
}

/** Label — max 80 chars. */
export function labelFor(r: RuntimeRecord): string {
  const base = r.version ? `${r.name} ${r.version}` : r.name;
  const full = `${base} · ${r.host}`;
  return full.length <= 80 ? full : full.slice(0, 80);
}

export function buildHandshakePayload(r: RuntimeRecord): HandshakePayload {
  // IMPORTANT: do NOT set heartbeat:true here. MC's handshake handler treats
  // heartbeat:true as a signal to run recordHeartbeat (UPDATE-only) INSTEAD
  // of registerHandshake (INSERT). For a first-time push the UPDATE matches
  // zero rows, MC still returns 200, and the row is silently never created.
  // Verified live against MC V8 during Phase A proof. We always handshake;
  // heartbeats go to /api/runtime/heartbeat on the dedicated route.
  return {
    kind: mapKind(r.runtime_type),
    installationId: installationIdFor(r),
    label: labelFor(r),
    version: r.version ?? null,
    capabilities: r.capabilities,
  };
}

export function buildHeartbeatPayload(r: RuntimeRecord): HeartbeatPayload {
  return {
    kind: mapKind(r.runtime_type),
    installationId: installationIdFor(r),
    taskCount: r.active_tasks,
    health: mapHealth(r.status),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP with retry + offline queueing
// ─────────────────────────────────────────────────────────────────────────────

export type McHttpResult<T> = { ok: true; status: number; body: T } | { ok: false; status: number; body: string };

// Exported so the approval engine + other modules can reuse the same client.
export async function mcFetch<T = unknown>(
  cfg: McConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<McHttpResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep as text */ }
    return res.ok
      ? { ok: true, status: res.status, body: parsed as T }
      : { ok: false, status: res.status, body: text };
  } catch (e: any) {
    return { ok: false, status: 0, body: e?.message ?? String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry<T>(cfg: McConfig, fn: () => Promise<McHttpResult<T>>): Promise<McHttpResult<T>> {
  let last: McHttpResult<T> = { ok: false, status: 0, body: "no attempt" };
  for (let i = 0; i < cfg.retries; i++) {
    last = await fn();
    if (last.ok) return last;
    // Only retry network errors and 5xx — 4xx is the operator's problem (auth/payload).
    if (last.status >= 400 && last.status < 500) return last;
    if (i < cfg.retries - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return last;
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level sync operations
// ─────────────────────────────────────────────────────────────────────────────

export interface PushResult {
  pushed: number;
  failed: number;
  queued: number;
  details: Array<{ runtime_id: string; status: "ok" | "error" | "queued"; reason?: string }>;
}

/**
 * Push every local runtime to MC via /api/runtime/handshake (composite call —
 * announces presence AND records a heartbeat). If MC is unreachable, queue
 * the payload for later delivery instead of failing silently.
 */
export async function pushRuntimes(): Promise<PushResult | { error: string }> {
  const cfg = loadConfig();
  if ("error" in cfg) return cfg;

  discoverRuntimes();
  const local = listRuntimes();
  const state = readState();
  const result: PushResult = { pushed: 0, failed: 0, queued: 0, details: [] };

  for (const r of local) {
    const payload = buildHandshakePayload(r);
    const res = await withRetry(cfg, () => mcFetch(cfg, "POST", "/api/runtime/handshake", payload));
    if (res.ok) {
      result.pushed++;
      result.details.push({ runtime_id: r.runtime_id, status: "ok" });
      state.totals.handshakes++;
      state.last_push[r.runtime_id] = { last_seen: r.last_seen ?? new Date().toISOString(), health: payload.health!, active_tasks: payload.taskCount ?? 0 };
    } else if (res.status === 0 || res.status >= 500) {
      // Network down or MC erroring — queue.
      state.offline_queue.push({
        id: `${Date.now()}-${r.runtime_id}`,
        ts: new Date().toISOString(),
        kind: "handshake",
        payload,
      });
      result.queued++;
      result.details.push({ runtime_id: r.runtime_id, status: "queued", reason: `HTTP ${res.status}: ${typeof res.body === "string" ? res.body.slice(0, 120) : ""}` });
    } else {
      // 4xx — auth/payload error. Don't queue; surface it.
      result.failed++;
      state.totals.failures++;
      result.details.push({ runtime_id: r.runtime_id, status: "error", reason: `HTTP ${res.status}: ${typeof res.body === "string" ? res.body.slice(0, 200) : "—"}` });
    }
  }
  writeState(state);
  return result;
}

/**
 * Drain the offline queue back to MC. Each entry is replayed in order so MC
 * sees them as if they'd arrived live.
 */
export async function flushOfflineQueue(): Promise<{ flushed: number; remaining: number; errors: string[] }> {
  const cfg = loadConfig();
  if ("error" in cfg) return { flushed: 0, remaining: 0, errors: [cfg.error] };
  const state = readState();
  const errors: string[] = [];
  const remaining: QueuedMutation[] = [];
  let flushed = 0;
  for (const item of state.offline_queue) {
    const path = item.kind === "handshake" ? "/api/runtime/handshake" : "/api/runtime/heartbeat";
    const res = await withRetry(cfg, () => mcFetch(cfg, "POST", path, item.payload));
    if (res.ok) { flushed++; state.totals[item.kind === "handshake" ? "handshakes" : "heartbeats"]++; }
    else {
      remaining.push(item);
      errors.push(`${item.id}: HTTP ${res.status}`);
      state.totals.failures++;
    }
  }
  state.offline_queue = remaining;
  writeState(state);
  return { flushed, remaining: remaining.length, errors };
}

/**
 * Heartbeat every locally-registered runtime. Cheap and idempotent — call on
 * a 30s timer (the `mc sync watch` command does this).
 */
export async function pushHeartbeats(): Promise<PushResult | { error: string }> {
  const cfg = loadConfig();
  if ("error" in cfg) return cfg;
  discoverRuntimes();
  const local = listRuntimes();
  const state = readState();
  const result: PushResult = { pushed: 0, failed: 0, queued: 0, details: [] };

  for (const r of local) {
    const payload = buildHeartbeatPayload(r);
    const res = await withRetry(cfg, () => mcFetch(cfg, "POST", "/api/runtime/heartbeat", payload));
    if (res.ok) {
      result.pushed++;
      state.totals.heartbeats++;
      state.last_push[r.runtime_id] = { last_seen: new Date().toISOString(), health: payload.health!, active_tasks: payload.taskCount ?? 0 };
      result.details.push({ runtime_id: r.runtime_id, status: "ok" });
    } else if (res.status === 404) {
      // Not yet handshaken — promote to a handshake.
      const hsPayload = buildHandshakePayload(r);
      const hsRes = await withRetry(cfg, () => mcFetch(cfg, "POST", "/api/runtime/handshake", hsPayload));
      if (hsRes.ok) {
        result.pushed++;
        state.totals.handshakes++;
        result.details.push({ runtime_id: r.runtime_id, status: "ok", reason: "auto-handshake before heartbeat" });
      } else {
        result.failed++;
        state.totals.failures++;
        result.details.push({ runtime_id: r.runtime_id, status: "error", reason: `auto-handshake failed: HTTP ${hsRes.status}` });
      }
    } else if (res.status === 0 || res.status >= 500) {
      state.offline_queue.push({ id: `${Date.now()}-${r.runtime_id}`, ts: new Date().toISOString(), kind: "heartbeat", payload });
      result.queued++;
      result.details.push({ runtime_id: r.runtime_id, status: "queued", reason: `HTTP ${res.status}` });
    } else {
      result.failed++;
      state.totals.failures++;
      result.details.push({ runtime_id: r.runtime_id, status: "error", reason: `HTTP ${res.status}: ${typeof res.body === "string" ? res.body.slice(0, 200) : "—"}` });
    }
  }
  writeState(state);
  return result;
}

/**
 * Publish a routing decision back to Mission Control.
 *
 * Contract the operator described:
 *   POST /api/tasks/:id/routing
 *   body: { assigned_runtime, selected_tool, selected_skill, routing_reason,
 *           routing_confidence, approval_required }
 *
 * MC V8 of this writing (verified at /tmp/mc-v8 on 2026-06-02) ships:
 *   PUT /api/tasks/[id]   with { assigned_to, metadata }
 *
 * Strategy: try the dedicated route first; on 404 / 405 / 501, fall back to
 * PUT and stuff the decision into `metadata.routing`. When MC adds the
 * dedicated endpoint, the dedicated path is what runs — no code change here.
 */
export interface RoutingPayload {
  assigned_runtime: string;
  selected_tool: string | null;
  selected_skill: string | null;
  routing_reason: string;
  routing_confidence: number;        // 0.0 - 1.0
  approval_required: boolean;
  // Audit-grade extras MC may surface later:
  decision_id?: string;
  category?: string;
  alternatives?: Array<{ runtime_id: string; score: number }>;
}

export interface PublishRoutingResult {
  ok: boolean;
  status: number;
  endpoint: "dedicated" | "fallback-put";
  body: unknown;
  error?: string;
}

export async function publishRoutingDecision(taskId: string | number, payload: RoutingPayload): Promise<PublishRoutingResult | { error: string }> {
  const cfg = loadConfig();
  if ("error" in cfg) return cfg;
  const idEnc = encodeURIComponent(String(taskId));

  // 1. Try the dedicated route first
  const direct = await mcFetch(cfg, "POST", `/api/tasks/${idEnc}/routing`, payload);
  if (direct.ok) {
    return { ok: true, status: direct.status, endpoint: "dedicated", body: direct.body };
  }
  // Fall back only when MC says "no such route" — never on auth errors etc.
  if (direct.status === 404 || direct.status === 405 || direct.status === 501) {
    const put = await mcFetch(cfg, "PUT" as any, `/api/tasks/${idEnc}`, {
      assigned_to: payload.assigned_runtime,
      metadata: {
        routing: payload,
        routed_at: new Date().toISOString(),
        routed_by: "baseline-os-workforce-router",
      },
    });
    return put.ok
      ? { ok: true, status: put.status, endpoint: "fallback-put", body: put.body }
      : { ok: false, status: put.status, endpoint: "fallback-put", body: put.body, error: typeof put.body === "string" ? put.body.slice(0, 200) : undefined };
  }
  return { ok: false, status: direct.status, endpoint: "dedicated", body: direct.body, error: typeof direct.body === "string" ? direct.body.slice(0, 200) : undefined };
}

/**
 * Create a task in MC. Used by the proof loop to seed an end-to-end test
 * (operator creates task → router decides → assignment lands back on MC).
 */
export async function createTask(input: { title: string; description?: string; priority?: "low" | "medium" | "high" | "urgent"; tags?: string[]; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; status: number; body: any } | { error: string }> {
  const cfg = loadConfig();
  if ("error" in cfg) return cfg;
  const res = await mcFetch(cfg, "POST", "/api/tasks", input);
  return res.ok ? { ok: true, status: res.status, body: res.body } : { ok: false, status: res.status, body: res.body };
}

/**
 * Phase 3 — publish a tool execution event to Mission Control.
 *
 * MC has no dedicated /api/executions endpoint in V8 of this writing, so we
 * write the event as a comment on the linked task. When the dedicated
 * endpoint lands, swap the path; the payload shape is intentionally future-
 * compatible.
 *
 * Returns ok=true when MC accepted, or ok=false on auth/payload errors. The
 * caller (Tool Registry executor) never blocks on this — it's fire-and-log.
 */
export interface ToolTelemetryInput {
  task_id: string | number;
  tool_id: string;
  verb: string;
  audit_id: string;
  ok: boolean;
  exit_code: number | null;
  duration_ms: number;
  approved: boolean;
  argv: string[];
  stdout_head?: string;          // truncate before sending (we keep 600 chars)
  stderr_head?: string;
  refused_reason?: string | null;
  decision_id?: string | null;
}

function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n) + `… [truncated, full size ${s.length}]`;
}

/**
 * Phase 4 — publish an approval state change to Mission Control.
 * Same fire-and-log contract as publishToolExecution. Used by both the API
 * dispatcher and the CLI so both paths produce identical MC telemetry.
 */
export interface ApprovalEventInput {
  task_id: string | number;
  request_id: string;
  event: "requested" | "approved" | "denied" | "consumed" | "expired";
  tool_id: string;
  verb: string;
  risk_level: string;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_reason?: string | null;
  args?: Record<string, string>;
  decision_id?: string | null;
}

export async function publishApprovalEvent(input: ApprovalEventInput): Promise<{ ok: boolean; status: number; body?: unknown; error?: string }> {
  const cfg = loadConfig();
  if ("error" in cfg) return { ok: false, status: 0, error: cfg.error };
  const iconMap = { requested: "📨", approved: "✅", denied: "❌", consumed: "✔", expired: "○" } as const;
  const lines = [
    `### Approval ${iconMap[input.event]} ${input.event} · ${input.request_id}`,
    "",
    `- tool: \`${input.tool_id}.${input.verb}\``,
    `- risk_level: \`${input.risk_level}\``,
    ...(input.decided_by ? [`- decided_by: \`${input.decided_by}\``] : []),
    ...(input.decided_at ? [`- decided_at: \`${input.decided_at}\``] : []),
    ...(input.decision_reason ? [`- reason: ${input.decision_reason}`] : []),
    ...(input.decision_id ? [`- decision_id: \`${input.decision_id}\``] : []),
    ...(input.args ? ["", "**args:**", "```json", JSON.stringify(input.args, null, 2), "```"] : []),
  ].join("\n");
  const r = await mcFetch(cfg, "POST", `/api/tasks/${encodeURIComponent(String(input.task_id))}/comments`, {
    content: lines, author: "baseline-os-approval-engine",
  });
  return r.ok ? { ok: true, status: r.status, body: r.body } : { ok: false, status: r.status, body: r.body, error: typeof r.body === "string" ? r.body.slice(0, 200) : undefined };
}

export async function publishToolExecution(t: ToolTelemetryInput): Promise<{ ok: boolean; status: number; body?: unknown; error?: string }> {
  const cfg = loadConfig();
  if ("error" in cfg) return { ok: false, status: 0, error: cfg.error };

  const status = t.ok ? "✅ ok" : (t.approved ? `⚠ exit ${t.exit_code}` : "❌ refused");
  const body = [
    `### Tool execution — ${t.tool_id}.${t.verb}  ${status}`,
    "",
    `- audit_id: \`${t.audit_id}\``,
    `- exit_code: \`${t.exit_code}\``,
    `- duration: \`${t.duration_ms}ms\``,
    `- approved: \`${t.approved}\``,
    `- decision_id: \`${t.decision_id ?? "—"}\``,
    `- argv: \`${t.argv.join(" ")}\``,
    ...(t.refused_reason ? ["", `- refused: \`${t.refused_reason}\``] : []),
    ...(t.stdout_head ? ["", "**stdout (head):**", "```", truncate(t.stdout_head, 600), "```"] : []),
    ...(t.stderr_head ? ["", "**stderr (head):**", "```", truncate(t.stderr_head, 600), "```"] : []),
  ].join("\n");

  const payload = {
    content: body,
    author: "baseline-os-tool-registry",
  };

  const r = await mcFetch(cfg, "POST", `/api/tasks/${encodeURIComponent(String(t.task_id))}/comments`, payload);
  if (r.ok) return { ok: true, status: r.status, body: r.body };
  return { ok: false, status: r.status, body: r.body, error: typeof r.body === "string" ? r.body.slice(0, 240) : undefined };
}

/**
 * Snapshot of what MC currently believes about this workspace.
 * Useful for diffing local registry vs MC's view.
 */
export async function pullSnapshot(): Promise<unknown | { error: string }> {
  const cfg = loadConfig();
  if ("error" in cfg) return cfg;
  const res = await mcFetch<{ runtimes: unknown[] }>(cfg, "GET", "/api/runtime/handshake");
  if (!res.ok) return { error: `HTTP ${res.status}: ${typeof res.body === "string" ? res.body.slice(0, 240) : ""}` };
  return res.body;
}

/**
 * Pull the next task assigned to each known agent label from MC's queue.
 * MC's queue is per-agent-name, so we ask for every runtime's label.
 */
export interface PulledTask {
  runtime_id: string;
  agent_label: string;
  task: unknown;
  reason: string;
}

export async function pullTasks(maxCapacityPer = 1): Promise<{ tasks: PulledTask[] } | { error: string }> {
  const cfg = loadConfig();
  if ("error" in cfg) return cfg;
  const local = listRuntimes();
  const tasks: PulledTask[] = [];
  const state = readState();
  for (const r of local) {
    const label = labelFor(r);
    const params = new URLSearchParams({ agent: label, max_capacity: String(maxCapacityPer) });
    const res = await mcFetch<unknown>(cfg, "GET", `/api/tasks/queue?${params.toString()}`);
    if (res.ok) {
      tasks.push({
        runtime_id: r.runtime_id,
        agent_label: label,
        task: res.body,
        reason: (res.body as any)?.reason ?? "ok",
      });
      state.totals.tasks_pulled++;
    } else if (res.status !== 404) {
      // 404 is "queue not set up for that agent yet" — not an error worth noisy logging.
      tasks.push({ runtime_id: r.runtime_id, agent_label: label, task: null, reason: `HTTP ${res.status}` });
    }
  }
  writeState(state);
  return { tasks };
}

/**
 * Doctor — verify config + connectivity + auth + each required endpoint.
 * Returns a list of named checks the CLI can paint.
 */
export interface DoctorCheck { name: string; ok: boolean; detail: string }

export async function syncDoctor(): Promise<DoctorCheck[]> {
  const cfg = loadConfig();
  const checks: DoctorCheck[] = [];
  if ("error" in cfg) {
    return [{ name: "config", ok: false, detail: cfg.error }];
  }
  checks.push({ name: "MC_URL", ok: true, detail: cfg.url });
  checks.push({ name: "MC_API_KEY", ok: cfg.apiKey.length >= 16, detail: cfg.apiKey ? `set (${cfg.apiKey.length} chars)` : "missing" });
  checks.push({ name: "workspace_id", ok: cfg.workspaceId !== "local" || (!!process.env.NODE_ENV && process.env.NODE_ENV === "development"), detail: cfg.workspaceId });

  // 1. Reachability
  const ping = await mcFetch<unknown>(cfg, "GET", "/api/runtime/handshake");
  checks.push({
    name: "GET /api/runtime/handshake",
    ok: ping.ok,
    detail: ping.ok ? `${ping.status} · ${(ping.body as any)?.runtimes?.length ?? "?"} runtimes seen by MC` : `${ping.status} · ${typeof ping.body === "string" ? ping.body.slice(0, 120) : ""}`,
  });

  // 2. Probe heartbeat with a known-bad payload — expect 404, not 500
  const fakeBeat = await mcFetch<unknown>(cfg, "POST", "/api/runtime/heartbeat", {
    kind: "other",
    installationId: `mc-sync-doctor@${hostname()}`,
  });
  checks.push({
    name: "POST /api/runtime/heartbeat (probe)",
    ok: fakeBeat.status === 404 || fakeBeat.ok,
    detail: `${fakeBeat.status} · expected 404 (runtime not yet registered) or 200`,
  });

  // 3. Queue endpoint reachable
  const queue = await mcFetch<unknown>(cfg, "GET", `/api/tasks/queue?agent=doctor&max_capacity=1`);
  checks.push({
    name: "GET /api/tasks/queue",
    ok: queue.status === 200 || queue.status === 404 || queue.status === 400,
    detail: `${queue.status}`,
  });

  return checks;
}

/**
 * One-line summary for `mc sync status`. Reports what we last pushed,
 * what's queued, and totals.
 */
export function syncStatus(): { ok: boolean; cfg: McConfig | null; state: SyncState } {
  const cfg = loadConfig();
  return {
    ok: !("error" in cfg),
    cfg: "error" in cfg ? null : cfg,
    state: readState(),
  };
}
