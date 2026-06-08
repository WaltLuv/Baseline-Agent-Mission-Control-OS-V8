/**
 * AI Agent Workforce Setup — data + wiring tests.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { SERVICE_OFFERS, STRATEGIC_PILLARS, BUILD_PROCESS, WORKFORCE_REPOS, POSITIONING, getOffer } from '@/lib/agent-workforce-setup'
import { getSurface } from '@/lib/parity/surfaces'

describe('AI Agent Workforce Setup', () => {
  it('has the three productized offers with price + timeline', () => {
    expect(SERVICE_OFFERS.map((o) => o.id)).toEqual(['audit', 'hermes-setup', 'full-buildout'])
    for (const o of SERVICE_OFFERS) {
      expect(o.price).toMatch(/\$/)
      expect(o.timeline.length).toBeGreaterThan(0)
      expect(o.outcome.length).toBeGreaterThan(0)
    }
    expect(getOffer('full-buildout')!.price).toMatch(/15,000/)
  })

  it('has the 5 strategic pillars and a 9-step build process', () => {
    expect(STRATEGIC_PILLARS.length).toBe(5)
    expect(BUILD_PROCESS.length).toBe(9)
    expect(BUILD_PROCESS[0].name).toBe('Constitution')
    expect(BUILD_PROCESS[BUILD_PROCESS.length - 1].name).toBe('Maintain')
  })

  it('lists the four public build/spec repos', () => {
    const names = WORKFORCE_REPOS.map((r) => r.name)
    for (const n of ['agent-workforce-setup', 'the-real-prop-control-saas', 'the-real-voice-ops', 'Vision-Ops-production']) {
      expect(names).toContain(n)
    }
    for (const r of WORKFORCE_REPOS) expect(r.url).toMatch(/^https:\/\/github\.com\/WaltLuv\//)
  })

  it('carries customer-safe positioning (no Slim / private voice id)', () => {
    expect(POSITIONING.length).toBeGreaterThan(0)
    const blob = JSON.stringify({ SERVICE_OFFERS, STRATEGIC_PILLARS, BUILD_PROCESS, WORKFORCE_REPOS, POSITIONING }).toLowerCase()
    expect(blob).not.toMatch(/slim charles|rwyjfemz6pxkhqd3wgc/)
  })

  it('is routed + nav-visible', () => {
    const surface = getSurface('agent-workforce-setup')
    expect(surface?.mcRoute).toBe('/app/agent-workforce-setup')
    expect(surface?.status).toBe('live')

    const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
    expect(router).toContain("case 'agent-workforce-setup'")
    expect(router).toContain('AgentWorkforceSetupPanel')

    const nav = readFileSync('src/components/layout/nav-rail.tsx', 'utf8')
    expect(nav).toContain("id: 'agent-workforce-setup'")
  })
})
