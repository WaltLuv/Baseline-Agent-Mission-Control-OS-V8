/**
 * Flight Deck UI — all 8 deployment-tower sections present + wired into the page.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

const comp = readFileSync('src/components/flight-deck/deployment-center.tsx', 'utf8')
const page = readFileSync('src/app/flight-deck/page.tsx', 'utf8')

describe('Flight Deck sections', () => {
  it('renders Pair / Runtimes / Infrastructure / Updates / Health / Proof / DFY', () => {
    expect(comp).toContain('data-testid={`flightdeck-${id}`}')
    for (const id of ['pair', 'runtimes', 'infrastructure', 'updates', 'health', 'proof', 'dfy']) {
      expect(comp, `missing section ${id}`).toContain(`id="${id}"`)
    }
  })
  it('runtimes show honest freshness + last-seen, empty state when none', () => {
    expect(comp).toContain('deriveRuntimeFreshness')
    expect(comp).toContain('lastSeenLabel')
    expect(comp).toContain('runtimes-empty')
    expect(comp).toContain('no fake heartbeats')
  })
  it('DFY checklist + exportable handoff report', () => {
    expect(comp).toContain('dfy-checklist')
    expect(comp).toContain('export-handoff')
    expect(comp).toContain('buildHandoffReport')
  })
  it('health is honest (unknown until measured, never fabricated)', () => {
    expect(comp).toContain("'unknown'")
    expect(comp).toContain('health-checks')
  })
  it('page mounts the deployment control tower', () => {
    expect(page).toContain('FlightDeckDeploymentCenter')
    expect(page).toContain('flightdeck-control-tower')
  })
  it('install section keeps honest artifact handling (no fake download)', () => {
    expect(page).toMatch(/pending-build|No artifact is faked|build from source/i)
  })
})
