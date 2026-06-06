/**
 * Cloud orchestration — store-level lifecycle + security invariants.
 *
 * Walt's required cases pinned here:
 *   · create mission + create task
 *   · dependency readiness — task with unmet deps is 'todo', not 'ready'
 *   · blocked task cannot be claimed
 *   · ready task can be claimed once (atomic single-claim)
 *   · stale claim recovery
 *   · complete writes event
 *   · fail writes event
 *   · proof receipt attaches
 *   · JSON export shape
 *   · workspace isolation (cross-workspace reads/writes refused)
 *   · runtime key mismatch on update is rejected
 */
import { describe, it, expect, beforeAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import {
  addDependency,
  attachProof,
  claimReadyTask,
  createMission,
  createTask,
  exportMaestro,
  getMission,
  getTask,
  listEvents,
  listMissions,
  listTasks,
  recoverStaleClaims,
  updateTask,
} from '@/lib/orchestration/store'

beforeAll(() => {
  runMigrations(getDatabase())
})

function suffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Each test takes a fresh workspace so the ready queue is isolated. SQLite
 * tests run in one process; without fresh slots, leftover ready tasks
 * from earlier tests get claimed by surprise.
 */
function freshWorkspace(): number {
  const db = getDatabase()
  const res = db
    .prepare(
      `INSERT INTO workspaces (slug, name, tenant_id, created_at, updated_at)
       VALUES (?, ?, 1, unixepoch(), unixepoch())`,
    )
    .run(`orch-test-${suffix()}`, 'Orchestration test ws')
  return Number(res.lastInsertRowid)
}

describe('orchestration — mission + task lifecycle', () => {
  it('create mission + create independent task lands status=ready and emits task.created', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `m-${suffix()}`, title: 'Test mission' })
    const t = createTask({ workspaceId: ws, missionId: m.id, title: 'first task' })
    expect(t.status).toBe('ready')
    const events = listEvents(ws, t.id)
    expect(events.some((e) => e.event_type === 'task.created')).toBe(true)
  })

  it('task with unmet dependencies is created as todo (not ready) and cannot be claimed', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `m-${suffix()}`, title: 'Deps mission' })
    const parent = createTask({ workspaceId: ws, missionId: m.id, title: 'parent' })
    const child = createTask({ workspaceId: ws, missionId: m.id, title: 'child', depends_on: [parent.id] })
    expect(child.status).toBe('todo')

    // Claiming should pick parent (ready) and ignore the child entirely.
    const claimed = claimReadyTask({ workspaceId: ws, runtimeKeyId: 7 })
    expect(claimed).not.toBeNull()
    expect(claimed!.id).toBe(parent.id)
  })

  it('completing the parent cascades the child to ready and the next claim picks it up', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `m-${suffix()}`, title: 'Cascade' })
    const parent = createTask({ workspaceId: ws, missionId: m.id, title: 'p' })
    const child = createTask({ workspaceId: ws, missionId: m.id, title: 'c', depends_on: [parent.id] })
    const claimed = claimReadyTask({ workspaceId: ws, runtimeKeyId: 11 })
    expect(claimed!.id).toBe(parent.id)
    updateTask({ workspaceId: ws, taskId: parent.id, runtimeKeyId: 11, status: 'done' })
    const afterChild = getTask(ws, child.id)
    expect(afterChild!.status).toBe('ready')
  })

  it('ready task can be claimed only once — second claim returns null when queue is empty', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `solo-${suffix()}`, title: 'Solo' })
    const only = createTask({ workspaceId: ws, missionId: m.id, title: 'solo' })
    const first = claimReadyTask({ workspaceId: ws, runtimeKeyId: 1 })
    expect(first?.id).toBe(only.id)
    const second = claimReadyTask({ workspaceId: ws, runtimeKeyId: 2 })
    expect(second).toBeNull()
  })

  it('stale claim recovery flips in_progress back to ready when heartbeat is older than TTL', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `stale-${suffix()}`, title: 'Stale' })
    const t = createTask({ workspaceId: ws, missionId: m.id, title: 'stale-task' })
    claimReadyTask({ workspaceId: ws, runtimeKeyId: 99 })
    // Force heartbeat into the past.
    const db = getDatabase()
    db.prepare(`UPDATE orchestration_tasks SET heartbeat_at = 1 WHERE id = ?`).run(t.id)
    const recovered = recoverStaleClaims(ws, 10)
    expect(recovered).toBeGreaterThanOrEqual(1)
    const after = getTask(ws, t.id)
    expect(after!.status).toBe('ready')
    expect(after!.claimed_by_runtime_key_id).toBeNull()
  })

  it('completing writes task.done event; failing writes task.failed event', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `done-${suffix()}`, title: 'Done' })
    const t1 = createTask({ workspaceId: ws, missionId: m.id, title: 't1' })
    claimReadyTask({ workspaceId: ws, runtimeKeyId: 3 })
    updateTask({ workspaceId: ws, taskId: t1.id, runtimeKeyId: 3, status: 'done' })
    expect(listEvents(ws, t1.id).some((e) => e.event_type === 'task.done')).toBe(true)

    const t2 = createTask({ workspaceId: ws, missionId: m.id, title: 't2' })
    claimReadyTask({ workspaceId: ws, runtimeKeyId: 3 })
    updateTask({ workspaceId: ws, taskId: t2.id, runtimeKeyId: 3, status: 'failed', error: 'boom' })
    const evs = listEvents(ws, t2.id)
    expect(evs.some((e) => e.event_type === 'task.failed')).toBe(true)
  })

  it('proof receipt attaches; second runtime key cannot mutate the row it did not claim', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `proof-${suffix()}`, title: 'Proof' })
    const t = createTask({ workspaceId: ws, missionId: m.id, title: 'p' })
    claimReadyTask({ workspaceId: ws, runtimeKeyId: 88 })
    const proof = attachProof({
      workspaceId: ws,
      taskId: t.id,
      proofType: 'log',
      proofSha256: 'deadbeef',
      runtimeKeyId: 88,
    })
    expect(proof.proof_type).toBe('log')

    // Different runtime key tries to attach → runtime_key_mismatch.
    expect(() =>
      attachProof({ workspaceId: ws, taskId: t.id, proofType: 'log', runtimeKeyId: 999 }),
    ).toThrow(/runtime_key_mismatch/)
  })

  it('exportMaestro emits the maestro-compatible shape with tasks + deps + proofs', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `export-${suffix()}`, title: 'Export' })
    const p = createTask({ workspaceId: ws, missionId: m.id, title: 'p' })
    const c = createTask({ workspaceId: ws, missionId: m.id, title: 'c', depends_on: [p.id] })
    claimReadyTask({ workspaceId: ws, runtimeKeyId: 5 })
    attachProof({ workspaceId: ws, taskId: p.id, proofType: 'doc', proofUri: 'urn:test', runtimeKeyId: 5 })
    const doc = exportMaestro(ws)
    expect(doc.format).toBe('maestro-mission-control/v1')
    const mission = doc.missions.find((mm) => mm.id === m.id)!
    expect(mission).toBeDefined()
    const child = mission.tasks.find((t) => t.id === c.id)!
    expect(child.depends_on).toContain(p.id)
    const parent = mission.tasks.find((t) => t.id === p.id)!
    expect(parent.proofs.length).toBeGreaterThanOrEqual(1)
  })
})

describe('orchestration — workspace isolation', () => {
  it('workspace A cannot read workspace B missions', () => {
    const wsA = freshWorkspace()
    const wsB = freshWorkspace()
    const mB = createMission({ workspaceId: wsB, slug: `iso-${suffix()}`, title: 'WS B private' })
    const missionsForA = listMissions(wsA)
    expect(missionsForA.find((m) => m.id === mB.id)).toBeUndefined()
    // getMission scoped to A cannot fetch the B row even with the real id.
    expect(getMission(wsA, mB.id)).toBeNull()
  })

  it('workspace A cannot claim or update tasks from workspace B', () => {
    const wsA = freshWorkspace()
    const wsB = freshWorkspace()
    const m = createMission({ workspaceId: wsB, slug: `iso2-${suffix()}`, title: 'WS B tasks' })
    const t = createTask({ workspaceId: wsB, missionId: m.id, title: 't' })

    // claimReadyTask is scoped to A → empty queue, no claim possible.
    const wsAClaim = claimReadyTask({ workspaceId: wsA, runtimeKeyId: 1 })
    expect(wsAClaim).toBeNull()

    // updateTask under A cannot mutate a B row — returns null because the
    // workspace-scoped read doesn't find it.
    const updated = updateTask({ workspaceId: wsA, taskId: t.id, status: 'done' })
    expect(updated).toBeNull()
    const stillIntact = getTask(wsB, t.id)!
    expect(stillIntact.status).toBe('ready')
  })

  it('cross-workspace dependency is refused', () => {
    const wsA = freshWorkspace()
    const wsB = freshWorkspace()
    const mA = createMission({ workspaceId: wsA, slug: `cw-${suffix()}`, title: 'WS A' })
    const tA = createTask({ workspaceId: wsA, missionId: mA.id, title: 't-a' })
    const mB = createMission({ workspaceId: wsB, slug: `cw-${suffix()}`, title: 'WS B' })
    expect(() =>
      createTask({ workspaceId: wsB, missionId: mB.id, title: 'cross', depends_on: [tA.id] }),
    ).toThrow()
  })
})

describe('orchestration — addDependency on already-ready tasks', () => {
  it('adds dependency and pushes a ready task back to todo when the new dep is not done', () => {
    const ws = freshWorkspace()
    const m = createMission({ workspaceId: ws, slug: `addep-${suffix()}`, title: 'AddDep' })
    const blocker = createTask({ workspaceId: ws, missionId: m.id, title: 'blocker' })
    const target = createTask({ workspaceId: ws, missionId: m.id, title: 'target' })
    expect(target.status).toBe('ready')
    const ok = addDependency({ workspaceId: ws, taskId: target.id, dependsOn: blocker.id })
    expect(ok).toBe(true)
    const refreshed = getTask(ws, target.id)!
    expect(refreshed.status).toBe('todo')
  })
})
