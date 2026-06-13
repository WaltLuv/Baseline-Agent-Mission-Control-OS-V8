/**
 * PI Agent harness — proves PI is the brain/memory layer that WRAPS specialized
 * sub-agents: it injects context BEFORE execution, routes correctly, gates
 * policy, indexes proof/replay, and writes post-task memory updates — while the
 * specialized sub-agents still do the actual execution.
 */
import { describe, it, expect } from 'vitest'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import {
  runThroughPiAgent,
  routeAgent,
  evaluatePolicy,
  getContextPackage,
  type SubAgentInput,
  type SubAgentResult,
} from '../harness'

const WS = 7001
function seedKnowledge() {
  const db = getDatabase()
  runMigrations(db)
  const now = Math.floor(Date.now() / 1000)
  try {
    db.prepare(`INSERT INTO agents (name, role, status, created_at, updated_at, workspace_id) VALUES (?,?,?,?,?,?)`)
      .run('Marcus Doyle', 'Maintenance Dispatcher', 'busy', now, now, WS)
  } catch { /* ok */ }
  try {
    db.prepare(`INSERT INTO activities (type, entity_type, entity_id, actor, description, workspace_id) VALUES (?,?,?,?,?,?)`)
      .run('work_order', 'work_order', '1', 'system', 'HVAC leak at Maple Court 4B triaged', WS)
  } catch { /* ok */ }
}

describe('PI Agent — routing', () => {
  it('routes by intent to the right specialized sub-agent', () => {
    expect(routeAgent('Review HVAC leak and dispatch a plumber').chosen).toBe('vendor-coordinator')
    expect(routeAgent('triage this maintenance work order').chosen).toBe('maintenance-dispatcher')
    expect(routeAgent('prepare owner approval for the repair').chosen).toBe('owner-approvals')
    expect(routeAgent('refactor this code and open a PR').chosen).toBe('claude-code')
    expect(routeAgent('say hello').chosen).toBe('hermes') // default runtime
    expect(routeAgent('do anything', 'codex').chosen).toBe('codex') // explicit
  })
})

describe('PI Agent — policy gate', () => {
  it('blocks destructive requests and viewer execution', () => {
    expect(evaluatePolicy('please drop table users', 'admin').decision).toBe('deny')
    expect(evaluatePolicy('wipe the workspace', 'operator').decision).toBe('deny')
    expect(evaluatePolicy('triage a work order', 'viewer').decision).toBe('deny')
    expect(evaluatePolicy('triage a work order', 'operator').decision).toBe('allow')
  })
})

describe('PI Agent — injects context BEFORE the sub-agent executes', () => {
  it('hands the assembled context package to the sub-agent', async () => {
    seedKnowledge()
    let received: SubAgentInput | null = null
    let contextWasReadyAtExecution = false
    const executor = async (input: SubAgentInput): Promise<SubAgentResult> => {
      received = input
      // Context must already be assembled when the sub-agent runs.
      contextWasReadyAtExecution =
        !!input.context &&
        typeof input.context.workspaceKnowledge.agents === 'number' &&
        Array.isArray(input.context.memory.hits) &&
        typeof input.context.graph.available === 'boolean'
      return { output: { ok: true }, proofRef: 'wo_test_1' }
    }

    const res = await runThroughPiAgent(
      { workspaceId: WS, request: 'triage maintenance work order for HVAC leak', role: 'operator', actor: 'tester' },
      executor,
    )

    expect(received).not.toBeNull()
    expect(contextWasReadyAtExecution).toBe(true)
    // workspace knowledge reflects seeded data
    expect(received!.context.workspaceKnowledge.agents).toBeGreaterThanOrEqual(1)
    // package persisted + replay linked + proof recorded
    const pkg = getContextPackage(WS, res.package.id)!
    expect(pkg.status).toBe('completed')
    expect(pkg.replayId).toBeTruthy()
    expect(pkg.proofRef).toBe('wo_test_1')
    // memory events: context injected BEFORE post-task update (correct order)
    const kinds = pkg.memoryEvents.map((e) => e.kind)
    expect(kinds).toContain('context_injected')
    expect(kinds).toContain('post_task_update')
    expect(kinds.indexOf('context_injected')).toBeLessThan(kinds.indexOf('post_task_update'))
    // routing log recorded
    expect(pkg.routing?.chosen).toBe('maintenance-dispatcher')
    // the PI 'context package injected' replay event precedes the sub-agent output
    const replay = getDatabase().prepare(`SELECT events FROM mission_replays WHERE id = ?`).get(pkg.replayId) as { events: string }
    const evs = JSON.parse(replay.events) as Array<{ kind: string; label: string; agent?: string }>
    const ctxIdx = evs.findIndex((e) => e.label.includes('context package injected'))
    const outIdx = evs.findIndex((e) => e.kind === 'output')
    expect(ctxIdx).toBeGreaterThanOrEqual(0)
    expect(ctxIdx).toBeLessThan(outIdx)
  })
})

describe('PI Agent — sub-agents still execute specialized tasks', () => {
  it('the specialized sub-agent runs and returns its own output', async () => {
    let ran = false
    const maintenanceExecutor = async (input: SubAgentInput): Promise<SubAgentResult> => {
      expect(input.agent).toBe('maintenance-dispatcher')
      ran = true
      return { output: { workOrderId: 'WO-42', vendor: 'AceHVAC', dispatched: true }, proofRef: 'WO-42' }
    }
    const res = await runThroughPiAgent(
      { workspaceId: WS, request: 'maintenance: HVAC repair work order', role: 'operator', actor: 'tester' },
      maintenanceExecutor,
    )
    expect(ran).toBe(true)
    expect(res.blocked).toBe(false)
    expect(res.output).toEqual({ workOrderId: 'WO-42', vendor: 'AceHVAC', dispatched: true })
    expect(res.routing.chosen).toBe('maintenance-dispatcher')
    expect(res.replayId).toBeTruthy()
  })
})

describe('PI Agent — policy-blocked requests never reach a sub-agent', () => {
  it('does not call the executor when policy denies', async () => {
    let called = false
    const executor = async (): Promise<SubAgentResult> => {
      called = true
      return { output: null }
    }
    const res = await runThroughPiAgent(
      { workspaceId: WS, request: 'drop table tenants now', role: 'admin', actor: 'tester' },
      executor,
    )
    expect(called).toBe(false)
    expect(res.blocked).toBe(true)
    expect(res.package.status).toBe('blocked')
    expect(res.replayId).toBeNull()
    const pkg = getContextPackage(WS, res.package.id)!
    expect(pkg.policy_decision).toBe('deny')
    expect(pkg.memoryEvents.some((e) => e.kind === 'policy_block')).toBe(true)
  })
})
