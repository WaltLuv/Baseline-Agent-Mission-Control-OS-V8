/**
 * Maestro Orchestration HQ (Mission Control) — routing engine + panel parity.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { routeMission, maestroReplayEvents, MAESTRO_DIMENSIONS } from '@/lib/maestro'
import { getSurface } from '@/lib/parity/surfaces'

describe('MC Maestro routing engine', () => {
  it('routes across the five dimensions', () => {
    const d = routeMission({ mission: 'launch a marketing campaign to clients', graphFiles: ['src/lib/x.ts'] })
    expect(d.lane).toBe('growth')
    expect(d.approval.required).toBe(true) // 'launch' + 'clients'
    expect(d.graphFirst).toBe(true)
    expect(MAESTRO_DIMENSIONS).toContain('Cost')
  })
  it('replay trail covers route + approval + agents', () => {
    const ev = maestroReplayEvents(routeMission({ mission: 'deploy to production' }), 1)
    expect(ev.some((e) => /routed →/.test(e.label))).toBe(true)
    expect(ev.some((e) => e.kind === 'approval')).toBe(true)
  })
})

describe('MC Orchestration HQ panel + route', () => {
  const panel = readFileSync('src/components/panels/orchestration-hq-panel.tsx', 'utf8')
  const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
  it('panel routes graph-first + records replay + shows Agent Activity', () => {
    expect(panel).toContain('data-testid="orchestration-hq-panel"')
    expect(panel).toContain('data-testid="maestro-decision"')
    expect(panel).toContain('/api/graphify?q=')
    expect(panel).toContain("fetch('/api/replay'")
    expect(panel).toContain('agentId="maestro"')
  })
  it('orchestration is a live, dedicated route', () => {
    expect(router).toContain("case 'orchestration'")
    expect(getSurface('orchestration')?.status).toBe('live')
    expect(getSurface('orchestration')?.mcRoute).toBe('/app/orchestration')
  })
})
