/**
 * Gemini Flow (Mission Control) — graph-first engine + panel parity.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { planFromGoal, flowStats, flowReplayEvents } from '@/lib/gemini-flow'
import { getSurface } from '@/lib/parity/surfaces'

describe('MC Gemini Flow', () => {
  it('plans a graph-first task graph (context→agent→provider→tasks→artifacts)', () => {
    const wf = planFromGoal('launch campaign', ['src/lib/billing.ts'], { now: 1 })
    expect(wf.graphFirst).toBe(true)
    expect(wf.nodes.some((n) => n.kind === 'context')).toBe(true)
    expect(wf.nodes.filter((n) => n.kind === 'task').length).toBeGreaterThanOrEqual(5)
    expect(flowStats(wf).graphFirst).toBe(true)
    expect(flowReplayEvents(wf, 1).some((e) => /Graphify/.test(e.label))).toBe(true)
  })

  it('panel is a real workspace (canvas/artifacts/agents) + AgentActivity, graph-first', () => {
    const panel = readFileSync('src/components/panels/gemini-flow-panel.tsx', 'utf8')
    for (const t of ['gemini-flow-panel', 'flow-canvas', 'flow-artifacts', 'flow-agents']) {
      expect(panel, `missing ${t}`).toContain(`data-testid="${t}"`)
    }
    expect(panel).toContain('/api/graphify?q=')
    expect(panel).toContain('planFromGoal')
    expect(panel).toContain('agentId="gemini-flow"')
  })

  it('gemini surface is now LIVE + routed (no longer a setup-needed shell)', () => {
    expect(getSurface('gemini')?.status).toBe('live')
    const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
    expect(router).toContain('GeminiFlowPanel')
    expect(router).toContain("case 'gemini':\n      return <GeminiFlowPanel")
  })

  it('is customer-safe (no Slim Charles / Walt-private data)', () => {
    const panel = readFileSync('src/components/panels/gemini-flow-panel.tsx', 'utf8')
    expect(panel.toLowerCase()).not.toContain('slim charles')
  })
})
