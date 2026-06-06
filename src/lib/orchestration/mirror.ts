/**
 * Mirror ingest hard limits + allowlist.
 *
 * Walt's #63 rules: bounded payloads, rejected unknown event types, no
 * raw secrets land in any column.
 */
export const MAX_EVENT_PAYLOAD_BYTES = 64 * 1024 // 64 KB per event payload
export const ALLOWED_EVENT_TYPES = new Set<string>([
  'task.created',
  'task.ready',
  'task.in_progress',
  'task.approval_required',
  'task.blocked',
  'task.failed',
  'task.done',
  'task.claimed',
  'task.claim_recovered',
  'task.dependency_added',
  'task.event',
  'proof.attached',
  'dispatcher.run.started',
  'dispatcher.run.completed',
])

/**
 * Mirror ingest — Baseline OS → Mission Control event/proof sync.
 *
 * Contract (Walt's #63 rule): **event/proof sync only, NOT database
 * replication.** The local kanban emits events into kanban-events.jsonl;
 * a tailer batches them and POSTs to /api/orchestration/mirror. The cloud
 * appends each event to orchestration_events with source='baseline-local'.
 *
 * Idempotency:
 *   · Each incoming event carries an `external_id` (the line offset / id
 *     the emitter owns). UNIQUE(workspace_id, source, external_id)
 *     guarantees retries are no-ops.
 *   · Caller-provided `event_type` is honoured verbatim (we never
 *     synthesise events on the cloud side from mirror data).
 *
 * Proof rows arrive as events with `event_type='proof.attached'` and a
 * payload that carries the proof_sha256 + uri + metadata. The mirror
 * upserts a matching `orchestration_proofs` row when the event names a
 * cloud `task_external_id` that already exists locally.
 */

import { getDatabase, logAuditEvent } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'

export type IncomingEvent = {
  /** Stable id from the source system (e.g. kanban-events.jsonl line offset). */
  external_id: string
  event_type: string
  /** ISO seconds when the event was emitted upstream. */
  occurred_at: number
  /** The upstream task id (string in kanban) — we resolve to local id if known. */
  task_external_id?: string | null
  payload: Record<string, unknown>
  /** Optional proof data carried alongside a proof.attached event. */
  proof?: {
    proof_type: string
    proof_uri?: string | null
    proof_sha256?: string | null
    metadata?: Record<string, unknown>
  } | null
  /** Optional actor reference from upstream. */
  actor?: string
}

export type MirrorResult = {
  accepted: number
  duplicates: number
  proofs: number
  errors: Array<{ external_id: string; error: string }>
}

export type IngestArgs = {
  workspaceId: number
  source: 'baseline-local' | 'maestro-import'
  events: IncomingEvent[]
  /** When provided, ingestion is also audited under this user. */
  userId?: number | null
  /** Optional cap so a malicious mirror cannot blow up the table. */
  maxBatch?: number
}

export function ingestMirrorBatch(args: IngestArgs): MirrorResult {
  const db = getDatabase()
  runMigrations(db)

  const cap = Math.min(args.maxBatch ?? 500, 1000)
  const events = args.events.slice(0, cap)

  const result: MirrorResult = { accepted: 0, duplicates: 0, proofs: 0, errors: [] }

  // Resolve task_external_id → local id once per batch.
  const taskCache = new Map<string, number | null>()
  const resolveTaskId = (extId: string | null | undefined): number | null => {
    if (!extId) return null
    const hit = taskCache.get(extId)
    if (hit !== undefined) return hit
    const row = db
      .prepare(
        `SELECT id FROM orchestration_tasks
          WHERE workspace_id = ? AND maestro_task_id = ?
          LIMIT 1`,
      )
      .get(args.workspaceId, extId) as { id: number } | undefined
    const v = row?.id ?? null
    taskCache.set(extId, v)
    return v
  }

  const insertEvent = db.prepare(
    `INSERT INTO orchestration_events
       (workspace_id, task_id, mission_id, event_type, actor, actor_user_id,
        actor_runtime_key_id, payload_json, source, external_id, created_at)
     VALUES (?, NULL, NULL, ?, ?, ?, NULL, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, source, external_id) DO NOTHING`,
  )
  const setTaskOnEvent = db.prepare(
    `UPDATE orchestration_events SET task_id = ? WHERE id = ? AND task_id IS NULL`,
  )
  const insertProof = db.prepare(
    `INSERT INTO orchestration_proofs
       (workspace_id, task_id, proof_type, proof_uri, proof_sha256, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )

  db.transaction(() => {
    for (const ev of events) {
      try {
        if (!ev.external_id || !ev.event_type || !Number.isFinite(ev.occurred_at)) {
          result.errors.push({ external_id: ev.external_id ?? '?', error: 'malformed_event' })
          continue
        }
        if (!ALLOWED_EVENT_TYPES.has(ev.event_type)) {
          result.errors.push({ external_id: ev.external_id, error: 'event_type_not_allowed' })
          continue
        }
        const payloadJson = JSON.stringify(ev.payload ?? {})
        if (Buffer.byteLength(payloadJson, 'utf8') > MAX_EVENT_PAYLOAD_BYTES) {
          result.errors.push({ external_id: ev.external_id, error: 'payload_too_large' })
          continue
        }
        const taskId = resolveTaskId(ev.task_external_id)
        const ts = Math.floor(ev.occurred_at)
        const res = insertEvent.run(
          args.workspaceId,
          ev.event_type.slice(0, 120),
          (ev.actor ?? 'baseline-local').slice(0, 120),
          args.userId ?? null,
          payloadJson,
          args.source,
          ev.external_id.slice(0, 200),
          ts,
        )
        if (res.changes === 0) {
          result.duplicates += 1
          continue
        }
        const insertedId = Number(res.lastInsertRowid)
        if (taskId !== null) {
          setTaskOnEvent.run(taskId, insertedId)
        }
        if (ev.event_type === 'proof.attached' && ev.proof && taskId !== null) {
          insertProof.run(
            args.workspaceId,
            taskId,
            ev.proof.proof_type.slice(0, 64),
            ev.proof.proof_uri ? ev.proof.proof_uri.slice(0, 1024) : null,
            ev.proof.proof_sha256 ? ev.proof.proof_sha256.slice(0, 128) : null,
            JSON.stringify(ev.proof.metadata ?? {}).slice(0, 256 * 1024),
            ts,
          )
          result.proofs += 1
        }
        result.accepted += 1
      } catch (e) {
        result.errors.push({
          external_id: ev.external_id,
          error: e instanceof Error ? e.message : 'ingest_error',
        })
      }
    }
  })()

  logAuditEvent({
    action: 'orchestration_mirror_ingested',
    actor: args.userId ? `user:${args.userId}` : 'mirror',
    target_type: 'orchestration_events',
    detail: {
      workspace_id: args.workspaceId,
      source: args.source,
      accepted: result.accepted,
      duplicates: result.duplicates,
      proofs: result.proofs,
      errors: result.errors.length,
    },
  })
  return result
}

/**
 * Returns the latest mirror checkpoint summary for the workspace — useful
 * for monitoring lag from /app/orchestration. Honest empty state when no
 * mirror traffic has arrived yet.
 */
export function getMirrorStatus(workspaceId: number): {
  total_mirrored: number
  by_source: Record<string, number>
  latest_event_at: number | null
} {
  const db = getDatabase()
  runMigrations(db)
  const total = db
    .prepare(
      `SELECT COUNT(*) AS n FROM orchestration_events
        WHERE workspace_id = ? AND source != 'cloud'`,
    )
    .get(workspaceId) as { n: number }
  const bySource = db
    .prepare(
      `SELECT source, COUNT(*) AS n FROM orchestration_events
        WHERE workspace_id = ? AND source != 'cloud'
        GROUP BY source`,
    )
    .all(workspaceId) as Array<{ source: string; n: number }>
  const latest = db
    .prepare(
      `SELECT MAX(created_at) AS m FROM orchestration_events
        WHERE workspace_id = ? AND source != 'cloud'`,
    )
    .get(workspaceId) as { m: number | null }
  return {
    total_mirrored: total.n,
    by_source: Object.fromEntries(bySource.map((r) => [r.source, r.n])),
    latest_event_at: latest.m ?? null,
  }
}
