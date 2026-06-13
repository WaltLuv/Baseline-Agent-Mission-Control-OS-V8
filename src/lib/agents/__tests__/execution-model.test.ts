/**
 * Agent Execution Architecture — levels, runtime assignment, readiness.
 * No fake green states: Level-3 agents are Needs Runtime until connected.
 */
import { describe, it, expect } from 'vitest'
import {
  profileForAgent,
  computeAgentReadiness,
  agentReadiness,
  EXECUTION_PROFILES,
} from '../execution-model'
import { computeCapabilityMatrix, type CapabilityRow } from '@/lib/workspace/capability-matrix'

const WS = 8100

function matrixWith(overrides: Record<string, string> = {}): CapabilityRow[] {
  const base = computeCapabilityMatrix(WS, { now: 1000 })
  return base.map((r) => (overrides[r.id] ? { ...r, status: overrides[r.id] as CapabilityRow['status'] } : r))
}

describe('execution profiles', () => {
  it('every profile has an execution level 1–3', () => {
    for (const p of EXECUTION_PROFILES) expect([1, 2, 3]).toContain(p.level)
  })
  it('resolves known agents to the right level + runtime', () => {
    expect(profileForAgent({ name: 'Maintenance Dispatcher' })).toMatchObject({ level: 2, runtime: 'workflow-engine' })
    expect(profileForAgent({ name: 'Vendor Coordinator' })).toMatchObject({ level: 2 })
    expect(profileForAgent({ name: 'Owner Relations' })).toMatchObject({ level: 2 })
    expect(profileForAgent({ name: 'Claude Code Engineer' })).toMatchObject({ level: 3, runtime: 'claude-code' })
    expect(profileForAgent({ name: 'Codex Agent' })).toMatchObject({ level: 3, runtime: 'codex' })
    expect(profileForAgent({ name: 'OpenClaw' })).toMatchObject({ level: 3, runtime: 'openclaw' })
    expect(profileForAgent({ name: 'PI Agent' })).toMatchObject({ level: 3, isContextHarness: true })
  })
  it('unmatched personas default to a Level-2 native worker', () => {
    expect(profileForAgent({ name: 'Some New Persona' })).toMatchObject({ level: 2, runtime: 'workflow-engine' })
  })
  it('demo agents are Level 1', () => {
    expect(profileForAgent({ name: 'X', demo: true }).level).toBe(1)
  })
})

describe('readiness — no fake green states', () => {
  const matrix = matrixWith()

  it('Level 1 → Demo Only', () => {
    expect(computeAgentReadiness(profileForAgent({ demo: true }), matrix).status).toBe('demo_only')
  })

  it('Level 2 → Native Workflow Ready (no external runtime required)', () => {
    const r = computeAgentReadiness(profileForAgent({ name: 'Maintenance Dispatcher' }), matrix)
    expect(r.status).toBe('native_workflow_ready')
    expect(r.runtimeStatus).toBe('native')
    expect(r.tools).toContain('work_orders')
    expect(r.permissions).toContain('create_work_order')
  })

  it('Level 3 → Needs Runtime when the runtime is not connected', () => {
    const r = agentReadiness({ name: 'Claude Code Engineer' }, matrix)
    expect(r.status).toBe('needs_runtime')
    expect(r.runtimeStatus).toBe('not_connected')
    expect(r.blockers.length).toBeGreaterThan(0)
    expect(r.setupNeeded.length).toBeGreaterThan(0)
  })

  it('Level 3 → Runtime Connected when the capability is connected', () => {
    const connected = matrixWith({ claude_code: 'connected' })
    const r = agentReadiness({ name: 'Claude Code Engineer' }, connected)
    expect(r.status).toBe('runtime_connected')
    expect(r.runtimeStatus).toBe('connected')
  })

  it('PI Agent is the context harness (ready), not the sole runtime', () => {
    const r = agentReadiness({ name: 'PI Agent' }, matrix)
    expect(r.isContextHarness).toBe(true)
    expect(r.status).toBe('ready')
  })
})
