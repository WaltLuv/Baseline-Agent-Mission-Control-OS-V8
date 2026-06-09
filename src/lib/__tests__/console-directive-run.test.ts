/**
 * Console-directive / mission integration (Mission Control) — directives + the
 * interactive workforce demo participate in Replay/Proof/AgentActivity/Graphify/
 * Knowledge OS, parity with Baseline OS.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { directiveToReplayEvents, directiveIntegrations } from '@/lib/console-directive-run'
import { getDirective } from '@/lib/workforce-console'

describe('MC console-directive 5-system engine', () => {
  it('produces the full replay trail for a directive', () => {
    const d = getDirective('visionops')!
    const ev = directiveToReplayEvents(d, ['src/lib/foo.ts'], 1)
    expect(ev[0].kind).toBe('trigger')
    expect(ev.some((e) => /Graphify/.test(e.label))).toBe(true)
    expect(ev.some((e) => e.kind === 'proof')).toBe(true)
    expect(ev.filter((e) => e.kind === 'agent_start').length).toBe(d.agentMap.length)
  })
  it('reports participation in all five systems', () => {
    expect(directiveIntegrations(getDirective('voiceops')!)).toEqual({
      graphify: true, agentActivity: true, replay: true, proof: true, knowledgeOs: true,
    })
  })
})

describe('MC workforce demo emits a graph-first replay on run', () => {
  const demo = readFileSync('src/components/workforce/dynamic-workflow-demo.tsx', 'utf8')
  it('startMission queries Graphify + POSTs a replay mission', () => {
    expect(demo).toContain('/api/graphify?q=')
    expect(demo).toContain("fetch('/api/replay'")
    expect(demo).toContain("kind: 'trigger'")
    expect(demo).toContain("kind: 'proof'")
  })
})
