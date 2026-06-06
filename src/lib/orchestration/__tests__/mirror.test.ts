/**
 * Mirror ingest — security + idempotency invariants.
 *
 * Walt's #63 rules pinned here:
 *   · Event/proof sync, NOT database replication.
 *   · Idempotent — replay the same batch, get the same row count.
 *   · Workspace-scoped — the auth's workspace_id is the only one that
 *     ever lands in the row (caller cannot fake it).
 *   · Proof events get a paired orchestration_proofs row only when the
 *     task is known locally.
 *   · No raw secret values land in payload — caller's responsibility,
 *     verified by truncation tests.
 */
import { describe, it, expect, beforeAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createMission, createTask, listEvents } from '@/lib/orchestration/store'
import { ingestMirrorBatch, getMirrorStatus, type IncomingEvent } from '@/lib/orchestration/mirror'

beforeAll(() => {
  runMigrations(getDatabase())
})

function suffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function freshWorkspace(): number {
  const db = getDatabase()
  const res = db
    .prepare(
      `INSERT INTO workspaces (slug, name, tenant_id, created_at, updated_at)
       VALUES (?, ?, 1, unixepoch(), unixepoch())`,
    )
    .run(`mirror-test-${suffix()}`, 'Mirror test ws')
  return Number(res.lastInsertRowid)
}

function makeEvent(overrides: Partial<IncomingEvent> = {}): IncomingEvent {
  return {
    external_id: `kanban:evt:${suffix()}`,
    event_type: 'task.claimed',
    occurred_at: Math.floor(Date.now() / 1000),
    payload: { test: true },
    ...overrides,
  }
}

describe('mirror — ingest contract', () => {
  it('accepts a batch and records each event with source=baseline-local', () => {
    const ws = freshWorkspace()
    const events = [makeEvent(), makeEvent({ event_type: 'task.completed' })]
    const result = ingestMirrorBatch({ workspaceId: ws, source: 'baseline-local', events })
    expect(result.accepted).toBe(2)
    expect(result.duplicates).toBe(0)
    expect(result.errors).toHaveLength(0)

    const rows = listEvents(ws)
    expect(rows.filter((r) => r.source === 'baseline-local')).toHaveLength(2)
  })

  it('is idempotent — replaying the same batch produces 0 new rows and N duplicates', () => {
    const ws = freshWorkspace()
    const events = [makeEvent(), makeEvent()]
    ingestMirrorBatch({ workspaceId: ws, source: 'baseline-local', events })
    const second = ingestMirrorBatch({ workspaceId: ws, source: 'baseline-local', events })
    expect(second.accepted).toBe(0)
    expect(second.duplicates).toBe(2)
  })

  it('rejects malformed events but accepts the rest of the batch', () => {
    const ws = freshWorkspace()
    const result = ingestMirrorBatch({
      workspaceId: ws,
      source: 'baseline-local',
      events: [
        makeEvent(),
        // Malformed — missing occurred_at.
        { external_id: 'bad', event_type: 'task.x', payload: {} } as unknown as IncomingEvent,
        makeEvent({ event_type: 'task.failed' }),
      ],
    })
    expect(result.accepted).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ external_id: 'bad' })
  })

  it('caps batch size — caller cannot blow up the table by posting 100k events', () => {
    const ws = freshWorkspace()
    const events: IncomingEvent[] = Array.from({ length: 10_000 }, (_, i) =>
      makeEvent({ external_id: `bulk:${i}` }),
    )
    const result = ingestMirrorBatch({
      workspaceId: ws,
      source: 'baseline-local',
      events,
      maxBatch: 100,
    })
    // Only the first 100 should land.
    expect(result.accepted + result.duplicates).toBe(100)
  })

  it('proof.attached event for a known task creates an orchestration_proofs row', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `m-${suffix()}`, title: 'Mirror proof' })
    // Create the local task with a known maestro_task_id so the mirror can
    // resolve task_external_id → local id.
    const t = createTask({
      workspaceId: ws,
      missionId: m.id,
      title: 'p',
      maestro_task_id: 'kanban:task:abc',
    })
    const evt = makeEvent({
      event_type: 'proof.attached',
      task_external_id: 'kanban:task:abc',
      proof: {
        proof_type: 'log',
        proof_sha256: 'deadbeef',
        metadata: { url: 'urn:test' },
      },
    })
    const result = ingestMirrorBatch({ workspaceId: ws, source: 'baseline-local', events: [evt] })
    expect(result.accepted).toBe(1)
    expect(result.proofs).toBe(1)

    const db = getDatabase()
    const proofRow = db
      .prepare(`SELECT proof_type, proof_sha256 FROM orchestration_proofs WHERE workspace_id = ? AND task_id = ?`)
      .get(ws, t.id) as { proof_type: string; proof_sha256: string } | undefined
    expect(proofRow?.proof_sha256).toBe('deadbeef')
    expect(proofRow?.proof_type).toBe('log')
  })

  it('proof.attached event for an UNKNOWN task does not create a proof row (sync, not replication)', () => {
    const ws = freshWorkspace()
    const evt = makeEvent({
      event_type: 'proof.attached',
      task_external_id: 'kanban:task:never-seen',
      proof: { proof_type: 'log', proof_sha256: 'cafebabe' },
    })
    const result = ingestMirrorBatch({ workspaceId: ws, source: 'baseline-local', events: [evt] })
    expect(result.accepted).toBe(1)
    expect(result.proofs).toBe(0) // task wasn't local, so no proof row
  })

  it('workspace isolation — events ingested for workspace A do not appear in workspace B', () => {
    const wsA = freshWorkspace()
    const wsB = freshWorkspace()
    ingestMirrorBatch({ workspaceId: wsA, source: 'baseline-local', events: [makeEvent()] })
    const eventsB = listEvents(wsB).filter((e) => e.source === 'baseline-local')
    expect(eventsB).toHaveLength(0)
    const statusA = getMirrorStatus(wsA)
    const statusB = getMirrorStatus(wsB)
    expect(statusA.total_mirrored).toBeGreaterThan(0)
    expect(statusB.total_mirrored).toBe(0)
  })

  it('status endpoint surfaces count + latest event timestamp per source', () => {
    const ws = freshWorkspace()
    const events = [
      makeEvent(),
      makeEvent({ event_type: 'task.completed' }),
    ]
    ingestMirrorBatch({ workspaceId: ws, source: 'baseline-local', events })
    const status = getMirrorStatus(ws)
    expect(status.total_mirrored).toBeGreaterThanOrEqual(2)
    expect(status.by_source['baseline-local']).toBeGreaterThanOrEqual(2)
    expect(status.latest_event_at).not.toBeNull()
  })
})
