/**
 * Kanban Dispatcher — Baseline OS port of the Tonbi/Hermes SQLite Kanban.
 *
 * Multi-agent task state machine on a single SQLite board:
 *   · Tasks survive restarts (durable disk DB)
 *   · Atomic claim — two dispatchers can't double-spawn the same task
 *   · Parent/child fan-in: a child stays Todo until every parent → Done
 *   · Scoring rubric: frequency + pain + solvability (max 100)
 *   · Single human approval gate via Telegram before Builders/Publishers run
 *   · Conservative dispatch caps + restart-safe
 *
 * Reference repo: github.com/WaltLuv/hermes-multi-agent-workflow
 *
 * On-disk:
 *   ~/.claude-os/kanban.sqlite       — the board
 *   ~/.claude-os/kanban-events.jsonl — append-only event ledger (for MC sync)
 *
 * The dispatcher LOOP is NOT inside this file — it's exposed via mc CLI as
 * `mc kanban dispatch` (single tick) and `mc kanban daemon` (continuous).
 * Baseline OS owns the engine; Mission Control will observe + approve + show
 * proofs via the existing MC sync path.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Types — wire shape
// ─────────────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "todo"               // waiting on parents
  | "ready"              // claim-eligible
  | "in_progress"        // a dispatcher claimed it
  | "approval_required"  // paused for human gate
  | "done"
  | "blocked"
  | "failed";

export interface Task {
  id: string;
  title: string;
  body: string;
  assignee: string;
  status: TaskStatus;
  priority: number;
  payload_json: string | null;
  parent_id: string | null;
  workspace_id: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  claimed_at: number | null;
  completed_at: number | null;
  error: string | null;
  proof_payload: string | null;
}

export interface TaskEvent {
  id: number;
  task_id: string;
  event_type: string;
  actor: string;
  payload_json: string | null;
  created_at: number;
}

export interface DispatcherRun {
  id: string;
  task_id: string;
  assignee: string;
  status: "running" | "ok" | "failed" | "timeout";
  started_at: number;
  ended_at: number | null;
  exit_code: number | null;
  stdout_hash: string | null;
  stderr_hash: string | null;
}

export interface ApprovalRequest {
  id: string;
  task_id: string;
  status: "pending" | "approved" | "shelved" | "modified";
  reason: string | null;
  telegram_message_id: string | null;
  approved_by: string | null;
  created_at: number;
  decided_at: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database
// ─────────────────────────────────────────────────────────────────────────────

const STATE_DIR = join(homedir(), ".claude-os");
const DB_PATH = join(STATE_DIR, "kanban.sqlite");
const EVENTS_PATH = join(STATE_DIR, "kanban-events.jsonl");

function ensureStateDir(): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

let _db: Database | null = null;
export function db(): Database {
  if (_db) return _db;
  ensureStateDir();
  const d = new Database(DB_PATH);
  d.exec("PRAGMA journal_mode = WAL");
  d.exec("PRAGMA foreign_keys = ON");
  d.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('todo','ready','in_progress','approval_required','done','blocked','failed')),
      priority INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT,
      parent_id TEXT,
      workspace_id TEXT NOT NULL DEFAULT 'local',
      created_by TEXT NOT NULL DEFAULT 'mc',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      claimed_at INTEGER,
      completed_at INTEGER,
      error TEXT,
      proof_payload TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);

    CREATE TABLE IF NOT EXISTS task_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      payload_json TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id);

    CREATE TABLE IF NOT EXISTS dispatcher_runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      assignee TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running','ok','failed','timeout')),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      exit_code INTEGER,
      stdout_hash TEXT,
      stderr_hash TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_runs_task ON dispatcher_runs(task_id);

    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('pending','approved','shelved','modified')),
      reason TEXT,
      telegram_message_id TEXT,
      approved_by TEXT,
      created_at INTEGER NOT NULL,
      decided_at INTEGER,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);
  _db = d;
  return d;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(3).toString("hex")}`;
}

function now(): number { return Date.now(); }

function appendEventLog(event: Record<string, unknown>): void {
  try { appendFileSync(EVENTS_PATH, JSON.stringify(event) + "\n"); } catch { /* skip */ }
}

function emit(taskId: string, eventType: string, actor: string, payload?: unknown): void {
  const d = db();
  d.prepare(
    `INSERT INTO task_events (task_id, event_type, actor, payload_json, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(taskId, eventType, actor, payload ? JSON.stringify(payload) : null, now());
  appendEventLog({ ts: new Date().toISOString(), task_id: taskId, event_type: eventType, actor, payload: payload ?? null });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  body?: string;
  assignee: string;            // agent slug (e.g. "scout-reddit", "orchestrator", "builder")
  parent_id?: string | null;
  priority?: number;
  payload?: Record<string, unknown>;
  workspace_id?: string;
  created_by?: string;
}

export function createTask(input: CreateTaskInput): Task {
  const d = db();
  const id = uid("t");
  const ts = now();
  // If we have a parent, start as todo; the dispatcher promotes to ready
  // once every parent → done. No-parent tasks go straight to ready.
  const status: TaskStatus = input.parent_id ? "todo" : "ready";
  d.prepare(
    `INSERT INTO tasks (id, title, body, assignee, status, priority, payload_json, parent_id, workspace_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.title, input.body ?? "", input.assignee, status, input.priority ?? 0,
    input.payload ? JSON.stringify(input.payload) : null,
    input.parent_id ?? null,
    input.workspace_id ?? "local",
    input.created_by ?? "mc",
    ts, ts,
  );
  emit(id, "created", input.created_by ?? "mc", { assignee: input.assignee, parent_id: input.parent_id ?? null });
  return getTask(id)!;
}

export function getTask(id: string): Task | null {
  return db().prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as Task | null;
}

export function listTasks(opts?: { status?: TaskStatus; assignee?: string; limit?: number }): Task[] {
  let q = `SELECT * FROM tasks WHERE 1=1`;
  const args: unknown[] = [];
  if (opts?.status) { q += ` AND status = ?`; args.push(opts.status); }
  if (opts?.assignee) { q += ` AND assignee = ?`; args.push(opts.assignee); }
  q += ` ORDER BY priority DESC, created_at ASC LIMIT ?`;
  args.push(opts?.limit ?? 200);
  return db().prepare(q).all(...args) as Task[];
}

export function listEvents(taskId: string, limit = 50): TaskEvent[] {
  return db().prepare(
    `SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
  ).all(taskId, limit) as TaskEvent[];
}

/**
 * Promote eligible Todo tasks to Ready.
 * Eligible = no parent OR every parent is `done`.
 */
export function promoteReady(): number {
  const d = db();
  const candidates = d.prepare(
    `SELECT id, parent_id FROM tasks WHERE status = 'todo'`,
  ).all() as Array<{ id: string; parent_id: string | null }>;
  let promoted = 0;
  const tx = d.transaction((rows: Array<{ id: string; parent_id: string | null }>) => {
    for (const row of rows) {
      if (row.parent_id) {
        const parent = d.prepare(`SELECT status FROM tasks WHERE id = ?`).get(row.parent_id) as { status: string } | null;
        if (!parent || parent.status !== "done") continue;
      }
      d.prepare(`UPDATE tasks SET status = 'ready', updated_at = ? WHERE id = ? AND status = 'todo'`).run(now(), row.id);
      emit(row.id, "promoted_to_ready", "dispatcher");
      promoted += 1;
    }
  });
  tx(candidates);
  return promoted;
}

/**
 * Atomic claim — pick the highest-priority Ready task and flip it to
 * in_progress under a row lock. Returns the claimed task or null.
 */
export function claimNext(opts?: { assignee?: string }): Task | null {
  const d = db();
  let claimed: Task | null = null;
  const tx = d.transaction(() => {
    let candidate: { id: string } | null;
    if (opts?.assignee) {
      candidate = d.prepare(
        `SELECT id FROM tasks WHERE status = 'ready' AND assignee = ? ORDER BY priority DESC, created_at ASC LIMIT 1`,
      ).get(opts.assignee) as { id: string } | null;
    } else {
      candidate = d.prepare(
        `SELECT id FROM tasks WHERE status = 'ready' ORDER BY priority DESC, created_at ASC LIMIT 1`,
      ).get() as { id: string } | null;
    }
    if (!candidate) return;
    const ts = now();
    const res = d.prepare(
      `UPDATE tasks SET status = 'in_progress', claimed_at = ?, updated_at = ? WHERE id = ? AND status = 'ready'`,
    ).run(ts, ts, candidate.id);
    if (res.changes === 1) {
      claimed = getTask(candidate.id);
      emit(candidate.id, "claimed", "dispatcher", { claimed_at: ts });
    }
  });
  tx();
  return claimed;
}

export function markDone(id: string, proof?: Record<string, unknown>): Task | null {
  const d = db();
  const ts = now();
  d.prepare(
    `UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ?, proof_payload = ? WHERE id = ?`,
  ).run(ts, ts, proof ? JSON.stringify(proof) : null, id);
  emit(id, "done", "dispatcher", proof ?? null);
  return getTask(id);
}

export function markFailed(id: string, error: string): Task | null {
  const d = db();
  const ts = now();
  d.prepare(`UPDATE tasks SET status = 'failed', completed_at = ?, updated_at = ?, error = ? WHERE id = ?`).run(ts, ts, error, id);
  emit(id, "failed", "dispatcher", { error });
  // Any direct children become Blocked (parent failed → child can't satisfy fan-in)
  d.prepare(
    `UPDATE tasks SET status = 'blocked', updated_at = ? WHERE parent_id = ? AND status IN ('todo','ready')`,
  ).run(ts, id);
  return getTask(id);
}

export function markBlocked(id: string, reason: string): Task | null {
  const d = db();
  const ts = now();
  d.prepare(`UPDATE tasks SET status = 'blocked', updated_at = ?, error = ? WHERE id = ?`).run(ts, reason, id);
  emit(id, "blocked", "dispatcher", { reason });
  return getTask(id);
}

/**
 * Promote a single task from 'todo' or 'blocked' back to 'ready' without
 * waiting for the cascade. Used by `mc kanban ready` + `mc kanban unblock`.
 */
export function markReady(id: string, actor = "operator"): Task | null {
  const d = db();
  const ts = now();
  d.prepare(`UPDATE tasks SET status = 'ready', updated_at = ?, error = NULL WHERE id = ?`).run(ts, id);
  emit(id, "ready", actor, { manual: true });
  return getTask(id);
}

/**
 * Attach a proof payload to a task without changing its status. For tasks
 * whose dispatcher_run already recorded proof, this is a manual override
 * path used by `mc kanban proof`.
 */
export function attachProof(id: string, proof: Record<string, unknown>, actor = "operator"): Task | null {
  const d = db();
  const ts = now();
  d.prepare(`UPDATE tasks SET proof_payload = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(proof),
    ts,
    id,
  );
  emit(id, "proof_attached", actor, proof);
  return getTask(id);
}

/**
 * Free-form status update (the CLI `mc kanban update` thin wrapper). Caller
 * must pass a valid TaskStatus; we don't validate here so the engine stays
 * a pure data layer.
 */
export function setStatus(
  id: string,
  status: TaskStatus,
  opts: { error?: string; proof?: Record<string, unknown>; actor?: string } = {},
): Task | null {
  const d = db();
  const ts = now();
  d.prepare(
    `UPDATE tasks SET status = ?, updated_at = ?, error = COALESCE(?, error),
                       proof_payload = COALESCE(?, proof_payload)
        WHERE id = ?`,
  ).run(status, ts, opts.error ?? null, opts.proof ? JSON.stringify(opts.proof) : null, id);
  emit(id, `status:${status}`, opts.actor ?? "operator", {
    error: opts.error ?? null,
    proof: opts.proof ?? null,
  });
  return getTask(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring rubric — frequency (0-35) + pain (0-35) + solvability (0-30) = 100
// score < 65 → shelve   ·   score ≥ 65 → advance (typically: spawn researchers)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  frequency: number;     // 0..35
  pain_intensity: number;// 0..35
  solvability: number;   // 0..30
  reason: string;
  evidence?: string[];
  confidence?: number;   // 0..1
  source_links?: string[];
}

export interface ScoreResult {
  total: number;
  advance: boolean;
  threshold: 65;
  breakdown: ScoreBreakdown;
}

export function scoreCandidate(b: ScoreBreakdown): ScoreResult {
  const freq = Math.max(0, Math.min(35, Math.round(b.frequency)));
  const pain = Math.max(0, Math.min(35, Math.round(b.pain_intensity)));
  const solv = Math.max(0, Math.min(30, Math.round(b.solvability)));
  const total = freq + pain + solv;
  return {
    total,
    advance: total >= 65,
    threshold: 65,
    breakdown: { ...b, frequency: freq, pain_intensity: pain, solvability: solv },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval gate — Telegram-mediated human in the loop
// ─────────────────────────────────────────────────────────────────────────────

export function requestApproval(taskId: string, reason: string): ApprovalRequest {
  const d = db();
  const id = uid("ap");
  const ts = now();
  d.prepare(
    `INSERT INTO approval_requests (id, task_id, status, reason, created_at) VALUES (?, ?, 'pending', ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET status='pending', reason=excluded.reason, decided_at=NULL, telegram_message_id=NULL, approved_by=NULL`,
  ).run(id, taskId, reason, ts);
  d.prepare(`UPDATE tasks SET status = 'approval_required', updated_at = ? WHERE id = ?`).run(ts, taskId);
  emit(taskId, "approval_requested", "orchestrator", { reason });
  return d.prepare(`SELECT * FROM approval_requests WHERE task_id = ?`).get(taskId) as ApprovalRequest;
}

export function decideApproval(
  taskId: string,
  decision: "approved" | "shelved" | "modified",
  opts: { approved_by: string; reason?: string; telegram_message_id?: string },
): { task: Task | null; approval: ApprovalRequest | null } {
  const d = db();
  const ts = now();
  d.prepare(
    `UPDATE approval_requests SET status = ?, approved_by = ?, decided_at = ?, telegram_message_id = COALESCE(?, telegram_message_id), reason = COALESCE(?, reason)
     WHERE task_id = ?`,
  ).run(decision, opts.approved_by, ts, opts.telegram_message_id ?? null, opts.reason ?? null, taskId);
  let newStatus: TaskStatus;
  if (decision === "approved") newStatus = "ready";
  else if (decision === "shelved") newStatus = "done";
  else newStatus = "todo"; // modified → back to operator for edit
  d.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, ts, taskId);
  emit(taskId, `approval_${decision}`, opts.approved_by, { reason: opts.reason ?? null, telegram_message_id: opts.telegram_message_id ?? null });
  return {
    task: getTask(taskId),
    approval: d.prepare(`SELECT * FROM approval_requests WHERE task_id = ?`).get(taskId) as ApprovalRequest | null,
  };
}

export function pendingApprovals(): ApprovalRequest[] {
  return db().prepare(`SELECT * FROM approval_requests WHERE status = 'pending' ORDER BY created_at ASC`).all() as ApprovalRequest[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher runs (for proof of execution)
// ─────────────────────────────────────────────────────────────────────────────

export function startDispatcherRun(taskId: string, assignee: string): DispatcherRun {
  const d = db();
  const id = uid("r");
  const ts = now();
  d.prepare(
    `INSERT INTO dispatcher_runs (id, task_id, assignee, status, started_at) VALUES (?, ?, ?, 'running', ?)`,
  ).run(id, taskId, assignee, ts);
  return d.prepare(`SELECT * FROM dispatcher_runs WHERE id = ?`).get(id) as DispatcherRun;
}

export function endDispatcherRun(
  runId: string,
  result: { status: "ok" | "failed" | "timeout"; exit_code?: number; stdout_hash?: string; stderr_hash?: string },
): DispatcherRun | null {
  const d = db();
  d.prepare(
    `UPDATE dispatcher_runs SET status = ?, ended_at = ?, exit_code = ?, stdout_hash = ?, stderr_hash = ? WHERE id = ?`,
  ).run(result.status, now(), result.exit_code ?? null, result.stdout_hash ?? null, result.stderr_hash ?? null, runId);
  return d.prepare(`SELECT * FROM dispatcher_runs WHERE id = ?`).get(runId) as DispatcherRun | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Doctor — health snapshot for `mc kanban doctor`
// ─────────────────────────────────────────────────────────────────────────────

export interface KanbanHealth {
  db_path: string;
  counts: Record<TaskStatus, number>;
  pending_approvals: number;
  oldest_in_progress_age_minutes: number | null;
  ready_tasks: number;
  approval_required_tasks: number;
}

export function doctor(): KanbanHealth {
  const d = db();
  const counts: Record<string, number> = { todo: 0, ready: 0, in_progress: 0, approval_required: 0, done: 0, blocked: 0, failed: 0 };
  for (const row of d.prepare(`SELECT status, COUNT(*) AS n FROM tasks GROUP BY status`).all() as Array<{ status: string; n: number }>) {
    counts[row.status] = row.n;
  }
  const pending = d.prepare(`SELECT COUNT(*) AS n FROM approval_requests WHERE status='pending'`).get() as { n: number };
  const oldest = d.prepare(
    `SELECT MIN(claimed_at) AS oldest FROM tasks WHERE status='in_progress'`,
  ).get() as { oldest: number | null };
  return {
    db_path: DB_PATH,
    counts: counts as Record<TaskStatus, number>,
    pending_approvals: pending.n,
    oldest_in_progress_age_minutes: oldest.oldest ? Math.round((now() - oldest.oldest) / 60_000) : null,
    ready_tasks: counts.ready,
    approval_required_tasks: counts.approval_required,
  };
}

/**
 * Dispatch a single tick: promote-ready, claim one task, return it.
 * The caller (mc kanban dispatch / daemon) is responsible for spawning the
 * assignee runtime + reporting back via markDone/markFailed.
 */
export function dispatchOnce(opts?: { assignee?: string }): { promoted: number; claimed: Task | null } {
  const promoted = promoteReady();
  const claimed = claimNext(opts);
  return { promoted, claimed };
}
