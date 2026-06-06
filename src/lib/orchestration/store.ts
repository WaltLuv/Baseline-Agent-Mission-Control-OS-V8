/**
 * Cloud orchestration store — pure data layer.
 *
 * Contract (the rules every caller can rely on):
 *   · Every read and write is workspace-scoped via UNIQUE / WHERE clauses.
 *   · `claimReadyTask()` uses a single UPDATE … WHERE so two concurrent
 *     workers cannot double-claim the same task even under race.
 *   · Stale claims (in_progress + heartbeat older than the TTL) can be
 *     recovered via `recoverStaleClaims()`. Recovered tasks flip back to
 *     'ready' and emit a 'claim_recovered' event.
 *   · `addDependency()` does NOT auto-promote: we promote on
 *     `markDone()` so a single transaction handles done + cascade.
 *   · Events are append-only — never UPDATE or DELETE.
 */

import { getDatabase, logAuditEvent } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'

export type TaskStatus =
  | 'todo'
  | 'ready'
  | 'in_progress'
  | 'approval_required'
  | 'blocked'
  | 'failed'
  | 'done'

export type Mission = {
  id: number
  workspace_id: number
  slug: string
  title: string
  description: string | null
  status: 'active' | 'done' | 'archived'
  tags: string[]
  metadata: Record<string, unknown>
  source: 'cloud' | 'baseline-local' | 'maestro-import'
  created_by_user_id: number | null
  created_at: number
  updated_at: number
}

export type Task = {
  id: number
  workspace_id: number
  mission_id: number
  title: string
  description: string | null
  status: TaskStatus
  tag: string | null
  assignee: string | null
  runtime_hint: string | null
  priority: number
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  claimed_by_runtime_key_id: number | null
  claimed_at: number | null
  heartbeat_at: number | null
  completed_at: number | null
  approval_policy: 'auto' | 'operator' | 'required'
  source: 'cloud' | 'baseline-local' | 'maestro-import'
  maestro_task_id: string | null
  created_at: number
  updated_at: number
  /** Computed at read time — slugs of tasks that block this one. */
  blocked_by: number[]
}

export type Event = {
  id: number
  workspace_id: number
  task_id: number | null
  mission_id: number | null
  event_type: string
  actor: string
  actor_user_id: number | null
  actor_runtime_key_id: number | null
  payload: Record<string, unknown>
  source: string
  created_at: number
}

export type Proof = {
  id: number
  workspace_id: number
  task_id: number
  proof_type: string
  proof_uri: string | null
  proof_sha256: string | null
  metadata: Record<string, unknown>
  posted_by_runtime_key_id: number | null
  posted_by_user_id: number | null
  created_at: number
}

const STALE_CLAIM_TTL_SECONDS = 600 // 10 min without heartbeat → recoverable

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function tryJSON<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function rowToMission(r: {
  id: number
  workspace_id: number
  slug: string
  title: string
  description: string | null
  status: Mission['status']
  tags_json: string | null
  metadata_json: string | null
  source: Mission['source']
  created_by_user_id: number | null
  created_at: number
  updated_at: number
}): Mission {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    status: r.status,
    tags: tryJSON<string[]>(r.tags_json, []),
    metadata: tryJSON<Record<string, unknown>>(r.metadata_json, {}),
    source: r.source,
    created_by_user_id: r.created_by_user_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function rowToTask(r: Record<string, unknown> & { id: number; workspace_id: number; mission_id: number }, blocked_by: number[] = []): Task {
  return {
    id: r.id as number,
    workspace_id: r.workspace_id,
    mission_id: r.mission_id,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    status: r.status as TaskStatus,
    tag: (r.tag as string | null) ?? null,
    assignee: (r.assignee as string | null) ?? null,
    runtime_hint: (r.runtime_hint as string | null) ?? null,
    priority: (r.priority as number) ?? 0,
    payload: tryJSON<Record<string, unknown>>((r.payload_json as string | null) ?? null, {}),
    result: r.result_json ? (tryJSON<Record<string, unknown>>(r.result_json as string, {})) : null,
    error: (r.error as string | null) ?? null,
    claimed_by_runtime_key_id: (r.claimed_by_runtime_key_id as number | null) ?? null,
    claimed_at: (r.claimed_at as number | null) ?? null,
    heartbeat_at: (r.heartbeat_at as number | null) ?? null,
    completed_at: (r.completed_at as number | null) ?? null,
    approval_policy: r.approval_policy as Task['approval_policy'],
    source: r.source as Task['source'],
    maestro_task_id: (r.maestro_task_id as string | null) ?? null,
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
    blocked_by,
  }
}

export type CreateMissionInput = {
  workspaceId: number
  slug: string
  title: string
  description?: string
  source?: Mission['source']
  tags?: string[]
  metadata?: Record<string, unknown>
  userId?: number
}

export function createMission(input: CreateMissionInput): Mission {
  const db = getDatabase()
  runMigrations(db)
  const now = nowSec()
  const res = db
    .prepare(
      `INSERT INTO orchestration_missions
         (workspace_id, slug, title, description, status, tags_json, metadata_json, source, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.workspaceId,
      input.slug,
      input.title,
      input.description ?? null,
      JSON.stringify(input.tags ?? []),
      JSON.stringify(input.metadata ?? {}),
      input.source ?? 'cloud',
      input.userId ?? null,
      now,
      now,
    )
  const mission = getMission(input.workspaceId, Number(res.lastInsertRowid))
  if (!mission) throw new Error('createMission readback failed')
  logAuditEvent({
    action: 'orchestration_mission_created',
    actor: input.userId ? `user:${input.userId}` : 'system',
    target_type: 'orchestration_mission',
    target_id: mission.id,
  })
  return mission
}

export function getMission(workspaceId: number, id: number): Mission | null {
  const db = getDatabase()
  runMigrations(db)
  const row = db
    .prepare(
      `SELECT id, workspace_id, slug, title, description, status, tags_json,
              metadata_json, source, created_by_user_id, created_at, updated_at
         FROM orchestration_missions
        WHERE workspace_id = ? AND id = ?`,
    )
    .get(workspaceId, id) as Parameters<typeof rowToMission>[0] | undefined
  return row ? rowToMission(row) : null
}

export function listMissions(workspaceId: number): Mission[] {
  const db = getDatabase()
  runMigrations(db)
  const rows = db
    .prepare(
      `SELECT id, workspace_id, slug, title, description, status, tags_json,
              metadata_json, source, created_by_user_id, created_at, updated_at
         FROM orchestration_missions
        WHERE workspace_id = ?
        ORDER BY updated_at DESC`,
    )
    .all(workspaceId) as Parameters<typeof rowToMission>[0][]
  return rows.map(rowToMission)
}

export type CreateTaskInput = {
  workspaceId: number
  missionId: number
  title: string
  description?: string
  tag?: string
  assignee?: string
  runtime_hint?: string
  priority?: number
  payload?: Record<string, unknown>
  approval_policy?: Task['approval_policy']
  source?: Task['source']
  maestro_task_id?: string
  /** Tasks the new task depends on; the task is created with status='todo' if any. */
  depends_on?: number[]
  userId?: number
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDatabase()
  runMigrations(db)
  const now = nowSec()
  const initialStatus: TaskStatus = (input.depends_on?.length ?? 0) > 0 ? 'todo' : 'ready'

  return db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO orchestration_tasks
           (workspace_id, mission_id, title, description, status, tag, assignee, runtime_hint, priority,
            payload_json, approval_policy, source, maestro_task_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.workspaceId,
        input.missionId,
        input.title,
        input.description ?? null,
        initialStatus,
        input.tag ?? null,
        input.assignee ?? null,
        input.runtime_hint ?? null,
        input.priority ?? 0,
        JSON.stringify(input.payload ?? {}),
        input.approval_policy ?? 'auto',
        input.source ?? 'cloud',
        input.maestro_task_id ?? null,
        now,
        now,
      )
    const taskId = Number(res.lastInsertRowid)
    if (input.depends_on && input.depends_on.length > 0) {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO orchestration_task_dependencies (task_id, depends_on_task_id, created_at)
         VALUES (?, ?, ?)`,
      )
      for (const dep of input.depends_on) {
        // Cross-workspace dependency is rejected (foreign key would allow it but
        // semantically nonsensical). Verify the dep's workspace matches.
        const depWs = db
          .prepare(`SELECT workspace_id FROM orchestration_tasks WHERE id = ?`)
          .get(dep) as { workspace_id: number } | undefined
        if (!depWs || depWs.workspace_id !== input.workspaceId) {
          throw new Error(`dependency ${dep} not found in workspace ${input.workspaceId}`)
        }
        stmt.run(taskId, dep, now)
      }
    }
    appendEvent(input.workspaceId, {
      task_id: taskId,
      mission_id: input.missionId,
      event_type: 'task.created',
      actor: input.userId ? `user:${input.userId}` : 'system',
      actor_user_id: input.userId ?? null,
      payload: { status: initialStatus, depends_on: input.depends_on ?? [] },
    })
    const out = getTask(input.workspaceId, taskId)
    if (!out) throw new Error('createTask readback failed')
    return out
  })()
}

export function getTask(workspaceId: number, taskId: number): Task | null {
  const db = getDatabase()
  runMigrations(db)
  const row = db
    .prepare(
      `SELECT * FROM orchestration_tasks WHERE workspace_id = ? AND id = ?`,
    )
    .get(workspaceId, taskId) as Record<string, unknown> | undefined
  if (!row) return null
  const deps = db
    .prepare(
      `SELECT depends_on_task_id AS d FROM orchestration_task_dependencies WHERE task_id = ?`,
    )
    .all(taskId) as { d: number }[]
  return rowToTask(row as Record<string, unknown> & { id: number; workspace_id: number; mission_id: number }, deps.map((r) => r.d))
}

export function listTasks(workspaceId: number, filter: { mission_id?: number; status?: TaskStatus } = {}): Task[] {
  const db = getDatabase()
  runMigrations(db)
  const clauses: string[] = ['workspace_id = ?']
  const args: unknown[] = [workspaceId]
  if (filter.mission_id !== undefined) {
    clauses.push('mission_id = ?')
    args.push(filter.mission_id)
  }
  if (filter.status) {
    clauses.push('status = ?')
    args.push(filter.status)
  }
  const rows = db
    .prepare(
      `SELECT * FROM orchestration_tasks WHERE ${clauses.join(' AND ')}
       ORDER BY priority DESC, updated_at DESC`,
    )
    .all(...args) as Array<Record<string, unknown> & { id: number; workspace_id: number; mission_id: number }>
  return rows.map((r) => rowToTask(r, []))
}

export function addDependency(args: { workspaceId: number; taskId: number; dependsOn: number; userId?: number }): boolean {
  const db = getDatabase()
  runMigrations(db)
  const now = nowSec()
  // Both rows must live in the same workspace.
  const both = db
    .prepare(
      `SELECT
         (SELECT workspace_id FROM orchestration_tasks WHERE id = ?) AS a,
         (SELECT workspace_id FROM orchestration_tasks WHERE id = ?) AS b`,
    )
    .get(args.taskId, args.dependsOn) as { a: number | null; b: number | null }
  if (both.a !== args.workspaceId || both.b !== args.workspaceId) return false

  const res = db
    .prepare(
      `INSERT OR IGNORE INTO orchestration_task_dependencies (task_id, depends_on_task_id, created_at)
       VALUES (?, ?, ?)`,
    )
    .run(args.taskId, args.dependsOn, now)
  // If the task was 'ready' but is now blocked by a real dep that isn't 'done',
  // bump it back to 'todo'.
  const depStatus = db
    .prepare(`SELECT status FROM orchestration_tasks WHERE id = ?`)
    .get(args.dependsOn) as { status: TaskStatus } | undefined
  if (depStatus && depStatus.status !== 'done') {
    db.prepare(
      `UPDATE orchestration_tasks
          SET status = 'todo', updated_at = ?
        WHERE id = ? AND workspace_id = ? AND status = 'ready'`,
    ).run(now, args.taskId, args.workspaceId)
  }
  if (res.changes > 0) {
    appendEvent(args.workspaceId, {
      task_id: args.taskId,
      mission_id: null,
      event_type: 'task.dependency_added',
      actor: args.userId ? `user:${args.userId}` : 'system',
      actor_user_id: args.userId ?? null,
      payload: { depends_on: args.dependsOn },
    })
  }
  return res.changes > 0
}

/**
 * Atomic single-claim. Picks the highest-priority `ready` task in the
 * workspace and flips it to `in_progress` in a single UPDATE … WHERE.
 * Returns the claimed task, or null if there's nothing ready.
 *
 * The runtime key id is captured so we can identify who claimed it for
 * billing, stale recovery, and the runtime-key view on /app/orchestration.
 */
export function claimReadyTask(args: {
  workspaceId: number
  runtimeKeyId: number | null
  /** Optional filter to claim only tasks assigned to a specific runtime hint. */
  runtimeHint?: string
}): Task | null {
  const db = getDatabase()
  runMigrations(db)
  const now = nowSec()
  const candidate = db
    .prepare(
      `SELECT id FROM orchestration_tasks
        WHERE workspace_id = ?
          AND status = 'ready'
          ${args.runtimeHint ? 'AND (runtime_hint IS NULL OR runtime_hint = ?)' : ''}
        ORDER BY priority DESC, created_at ASC
        LIMIT 1`,
    )
    .get(...(args.runtimeHint ? [args.workspaceId, args.runtimeHint] : [args.workspaceId])) as { id: number } | undefined
  if (!candidate) return null

  const res = db
    .prepare(
      `UPDATE orchestration_tasks
          SET status = 'in_progress',
              claimed_by_runtime_key_id = ?,
              claimed_at = ?,
              heartbeat_at = ?,
              updated_at = ?
        WHERE id = ? AND workspace_id = ? AND status = 'ready'`,
    )
    .run(args.runtimeKeyId, now, now, now, candidate.id, args.workspaceId)
  if (res.changes === 0) return null // somebody else beat us to it

  appendEvent(args.workspaceId, {
    task_id: candidate.id,
    mission_id: null,
    event_type: 'task.claimed',
    actor: args.runtimeKeyId ? `runtime_key:${args.runtimeKeyId}` : 'system',
    actor_runtime_key_id: args.runtimeKeyId,
    payload: {},
  })
  return getTask(args.workspaceId, candidate.id)
}

export type UpdateTaskInput = {
  workspaceId: number
  taskId: number
  runtimeKeyId?: number | null
  userId?: number | null
  status?: TaskStatus
  heartbeat?: boolean
  result?: Record<string, unknown>
  error?: string
}

export function updateTask(input: UpdateTaskInput): Task | null {
  const db = getDatabase()
  runMigrations(db)
  const now = nowSec()
  return db.transaction(() => {
    const existing = getTask(input.workspaceId, input.taskId)
    if (!existing) return null
    // A runtime key can only update a task it claimed.
    if (input.runtimeKeyId !== undefined && input.runtimeKeyId !== null
        && existing.claimed_by_runtime_key_id !== input.runtimeKeyId) {
      throw new Error('runtime_key_mismatch')
    }
    const status = input.status ?? existing.status
    const completed_at = (status === 'done' || status === 'failed') ? now : existing.completed_at
    db.prepare(
      `UPDATE orchestration_tasks SET
         status = ?,
         result_json = COALESCE(?, result_json),
         error = COALESCE(?, error),
         heartbeat_at = CASE WHEN ? = 1 THEN ? ELSE heartbeat_at END,
         completed_at = ?,
         updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
    ).run(
      status,
      input.result ? JSON.stringify(input.result) : null,
      input.error ?? null,
      input.heartbeat ? 1 : 0,
      now,
      completed_at,
      now,
      input.taskId,
      input.workspaceId,
    )
    appendEvent(input.workspaceId, {
      task_id: input.taskId,
      mission_id: null,
      event_type: `task.${status}`,
      actor: input.runtimeKeyId ? `runtime_key:${input.runtimeKeyId}` : input.userId ? `user:${input.userId}` : 'system',
      actor_user_id: input.userId ?? null,
      actor_runtime_key_id: input.runtimeKeyId ?? null,
      payload: {
        from: existing.status,
        to: status,
        error: input.error ?? null,
      },
    })

    // If the task just became 'done', cascade: any task whose deps are all
    // 'done' flips from 'todo' to 'ready' so the next claim cycle picks it up.
    if (status === 'done') {
      const downstream = db
        .prepare(
          `SELECT t.id
             FROM orchestration_tasks t
             JOIN orchestration_task_dependencies d ON d.task_id = t.id
            WHERE t.workspace_id = ? AND t.status = 'todo'
              AND d.depends_on_task_id = ?`,
        )
        .all(input.workspaceId, input.taskId) as { id: number }[]
      for (const cand of downstream) {
        const unfinished = db
          .prepare(
            `SELECT COUNT(*) AS n
               FROM orchestration_task_dependencies d
               JOIN orchestration_tasks t ON t.id = d.depends_on_task_id
              WHERE d.task_id = ? AND t.status != 'done'`,
          )
          .get(cand.id) as { n: number }
        if (unfinished.n === 0) {
          db.prepare(
            `UPDATE orchestration_tasks SET status = 'ready', updated_at = ?
              WHERE id = ? AND workspace_id = ? AND status = 'todo'`,
          ).run(now, cand.id, input.workspaceId)
          appendEvent(input.workspaceId, {
            task_id: cand.id,
            mission_id: null,
            event_type: 'task.ready',
            actor: 'system',
            payload: { reason: 'dependencies_satisfied' },
          })
        }
      }
    }
    return getTask(input.workspaceId, input.taskId)
  })()
}

export type AttachProofInput = {
  workspaceId: number
  taskId: number
  proofType: string
  proofUri?: string
  proofSha256?: string
  metadata?: Record<string, unknown>
  runtimeKeyId?: number | null
  userId?: number | null
}

export function attachProof(input: AttachProofInput): Proof {
  const db = getDatabase()
  runMigrations(db)
  const now = nowSec()
  const task = getTask(input.workspaceId, input.taskId)
  if (!task) throw new Error('task not found')
  if (input.runtimeKeyId !== undefined && input.runtimeKeyId !== null
      && task.claimed_by_runtime_key_id !== input.runtimeKeyId) {
    throw new Error('runtime_key_mismatch')
  }
  // Bound metadata so a runaway runtime can't fill the table.
  const meta = JSON.stringify(input.metadata ?? {}).slice(0, 256 * 1024)
  const res = db
    .prepare(
      `INSERT INTO orchestration_proofs
         (workspace_id, task_id, proof_type, proof_uri, proof_sha256, metadata_json,
          posted_by_runtime_key_id, posted_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.workspaceId,
      input.taskId,
      input.proofType,
      input.proofUri ?? null,
      input.proofSha256 ?? null,
      meta,
      input.runtimeKeyId ?? null,
      input.userId ?? null,
      now,
    )
  appendEvent(input.workspaceId, {
    task_id: input.taskId,
    mission_id: null,
    event_type: 'proof.attached',
    actor: input.runtimeKeyId ? `runtime_key:${input.runtimeKeyId}` : input.userId ? `user:${input.userId}` : 'system',
    actor_user_id: input.userId ?? null,
    actor_runtime_key_id: input.runtimeKeyId ?? null,
    payload: { proof_type: input.proofType, sha256: input.proofSha256 ?? null },
  })
  const row = db
    .prepare(
      `SELECT id, workspace_id, task_id, proof_type, proof_uri, proof_sha256,
              metadata_json, posted_by_runtime_key_id, posted_by_user_id, created_at
         FROM orchestration_proofs WHERE id = ?`,
    )
    .get(Number(res.lastInsertRowid)) as Record<string, unknown>
  return {
    id: row.id as number,
    workspace_id: row.workspace_id as number,
    task_id: row.task_id as number,
    proof_type: row.proof_type as string,
    proof_uri: (row.proof_uri as string | null) ?? null,
    proof_sha256: (row.proof_sha256 as string | null) ?? null,
    metadata: tryJSON<Record<string, unknown>>((row.metadata_json as string | null) ?? null, {}),
    posted_by_runtime_key_id: (row.posted_by_runtime_key_id as number | null) ?? null,
    posted_by_user_id: (row.posted_by_user_id as number | null) ?? null,
    created_at: row.created_at as number,
  }
}

export function listProofs(workspaceId: number, taskId: number): Proof[] {
  const db = getDatabase()
  runMigrations(db)
  const rows = db
    .prepare(
      `SELECT id, workspace_id, task_id, proof_type, proof_uri, proof_sha256,
              metadata_json, posted_by_runtime_key_id, posted_by_user_id, created_at
         FROM orchestration_proofs WHERE workspace_id = ? AND task_id = ?
         ORDER BY created_at DESC`,
    )
    .all(workspaceId, taskId) as Array<Record<string, unknown>>
  return rows.map((r) => ({
    id: r.id as number,
    workspace_id: r.workspace_id as number,
    task_id: r.task_id as number,
    proof_type: r.proof_type as string,
    proof_uri: (r.proof_uri as string | null) ?? null,
    proof_sha256: (r.proof_sha256 as string | null) ?? null,
    metadata: tryJSON<Record<string, unknown>>((r.metadata_json as string | null) ?? null, {}),
    posted_by_runtime_key_id: (r.posted_by_runtime_key_id as number | null) ?? null,
    posted_by_user_id: (r.posted_by_user_id as number | null) ?? null,
    created_at: r.created_at as number,
  }))
}

function appendEvent(workspaceId: number, input: {
  task_id: number | null
  mission_id: number | null
  event_type: string
  actor: string
  actor_user_id?: number | null
  actor_runtime_key_id?: number | null
  payload?: Record<string, unknown>
  source?: string
}): void {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO orchestration_events
       (workspace_id, task_id, mission_id, event_type, actor, actor_user_id,
        actor_runtime_key_id, payload_json, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workspaceId,
    input.task_id,
    input.mission_id,
    input.event_type,
    input.actor,
    input.actor_user_id ?? null,
    input.actor_runtime_key_id ?? null,
    JSON.stringify(input.payload ?? {}),
    input.source ?? 'cloud',
    nowSec(),
  )
}

export function listEvents(workspaceId: number, taskId?: number, limit = 100): Event[] {
  const db = getDatabase()
  runMigrations(db)
  const rows = (taskId === undefined
    ? db
        .prepare(
          `SELECT id, workspace_id, task_id, mission_id, event_type, actor, actor_user_id,
                  actor_runtime_key_id, payload_json, source, created_at
             FROM orchestration_events
            WHERE workspace_id = ?
            ORDER BY created_at DESC LIMIT ?`,
        )
        .all(workspaceId, limit)
    : db
        .prepare(
          `SELECT id, workspace_id, task_id, mission_id, event_type, actor, actor_user_id,
                  actor_runtime_key_id, payload_json, source, created_at
             FROM orchestration_events
            WHERE workspace_id = ? AND task_id = ?
            ORDER BY created_at DESC LIMIT ?`,
        )
        .all(workspaceId, taskId, limit)) as Array<Record<string, unknown>>
  return rows.map((r) => ({
    id: r.id as number,
    workspace_id: r.workspace_id as number,
    task_id: (r.task_id as number | null) ?? null,
    mission_id: (r.mission_id as number | null) ?? null,
    event_type: r.event_type as string,
    actor: r.actor as string,
    actor_user_id: (r.actor_user_id as number | null) ?? null,
    actor_runtime_key_id: (r.actor_runtime_key_id as number | null) ?? null,
    payload: tryJSON<Record<string, unknown>>((r.payload_json as string | null) ?? null, {}),
    source: r.source as string,
    created_at: r.created_at as number,
  }))
}

/**
 * Scan workspace for in_progress tasks whose heartbeat is older than the
 * TTL and flip them back to 'ready' so the next dispatcher tick can
 * recover. Emits a 'claim_recovered' event per row so the operator sees
 * the stale recovery in the activity feed.
 */
export function recoverStaleClaims(workspaceId: number, ttlSeconds = STALE_CLAIM_TTL_SECONDS): number {
  const db = getDatabase()
  runMigrations(db)
  const now = nowSec()
  const stale = db
    .prepare(
      `SELECT id, claimed_by_runtime_key_id FROM orchestration_tasks
        WHERE workspace_id = ? AND status = 'in_progress'
          AND (heartbeat_at IS NULL OR heartbeat_at < ?)`,
    )
    .all(workspaceId, now - ttlSeconds) as { id: number; claimed_by_runtime_key_id: number | null }[]
  let recovered = 0
  for (const row of stale) {
    const res = db
      .prepare(
        `UPDATE orchestration_tasks
            SET status = 'ready',
                claimed_by_runtime_key_id = NULL,
                claimed_at = NULL,
                heartbeat_at = NULL,
                updated_at = ?
          WHERE id = ? AND workspace_id = ? AND status = 'in_progress'`,
      )
      .run(now, row.id, workspaceId)
    if (res.changes > 0) {
      recovered += 1
      appendEvent(workspaceId, {
        task_id: row.id,
        mission_id: null,
        event_type: 'task.claim_recovered',
        actor: 'system',
        actor_runtime_key_id: row.claimed_by_runtime_key_id,
        payload: { reason: 'stale_heartbeat' },
      })
    }
  }
  return recovered
}

export type MaestroExport = {
  format: 'maestro-mission-control/v1'
  exported_at: string
  workspace_id: number
  missions: Array<{
    id: number
    slug: string
    title: string
    description: string | null
    status: string
    tasks: Array<{
      id: number
      title: string
      description: string | null
      status: string
      tag: string | null
      assignee: string | null
      runtime_hint: string | null
      priority: number
      depends_on: number[]
      proofs: Array<{ proof_type: string; sha256: string | null; uri: string | null; created_at: number }>
      maestro_task_id: string | null
    }>
  }>
}

export function exportMaestro(workspaceId: number): MaestroExport {
  const missions = listMissions(workspaceId)
  const out: MaestroExport = {
    format: 'maestro-mission-control/v1',
    exported_at: new Date().toISOString(),
    workspace_id: workspaceId,
    missions: missions.map((m) => {
      const tasks = listTasks(workspaceId, { mission_id: m.id })
      return {
        id: m.id,
        slug: m.slug,
        title: m.title,
        description: m.description,
        status: m.status,
        tasks: tasks.map((t) => {
          const full = getTask(workspaceId, t.id)!
          const proofs = listProofs(workspaceId, t.id).map((p) => ({
            proof_type: p.proof_type,
            sha256: p.proof_sha256,
            uri: p.proof_uri,
            created_at: p.created_at,
          }))
          return {
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            tag: t.tag,
            assignee: t.assignee,
            runtime_hint: t.runtime_hint,
            priority: t.priority,
            depends_on: full.blocked_by,
            proofs,
            maestro_task_id: t.maestro_task_id,
          }
        }),
      }
    }),
  }
  return out
}

export const __test = { STALE_CLAIM_TTL_SECONDS }
