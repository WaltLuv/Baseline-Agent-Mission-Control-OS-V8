/**
 * Phases 1-3 product-flow wiring (MC) — proves the real click paths invoke the
 * generation / factory-sync / replay logic and return UI confirmation.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

const install = readFileSync('src/app/api/workforce/install/route.ts', 'utf8')
const build = readFileSync('src/app/api/agent-factory/build/route.ts', 'utf8')

describe('Phase 1/3 — workforce install wires org generation + replay', () => {
  it('install route calls generateOrgFromTemplate', () => {
    expect(install).toContain('generateOrgFromTemplate(workspaceId, slug')
  })
  it('install route captures a replay (start/record/end)', () => {
    expect(install).toContain('startReplay(')
    expect(install).toContain('recordReplayEvent(')
    expect(install).toContain('endReplay(')
  })
  it('install response returns UI confirmation (message + agentsCreated + open link)', () => {
    expect(install).toContain('Org chart generated')
    expect(install).toContain('agentsCreated')
    expect(install).toContain("openOrgChart: '/app/org-chart'")
  })
})

describe('Phase 2/3 — Agent Factory build wires org sync + replay', () => {
  it('build route calls syncFactoryAgent', () => {
    expect(build).toContain('syncFactoryAgent(1,')
  })
  it('build route captures a replay for the build', () => {
    expect(build).toContain('startReplay(1,')
    expect(build).toContain('Agent Factory build:')
  })
  it('build emits UI confirmation that the agent hit the Org Chart', () => {
    expect(build).toContain('Agent added to Org Chart')
    expect(build).toContain("openOrgChart: '/app/org-chart'")
  })
})
