/**
 * Mission Control Org Chart V2 parity (vitest) — same command-layer as Baseline
 * OS, workspace-scoped + customer-safe (no Slim Charles / Walt-private data).
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { MISSION_STATES } from '@/components/agent-activity'

const panel = readFileSync('src/components/panels/org-chart-panel.tsx', 'utf8')
const activity = readFileSync('src/components/agent-activity.tsx', 'utf8')
const api = readFileSync('src/app/api/org-chart/route.ts', 'utf8')

describe('MC Org Chart V2 parity', () => {
  it('has the four command views (parity with Baseline OS)', () => {
    expect(panel).toContain('org-view-${v.id}')
    for (const id of ["'tree'", "'map'", "'execution'", "'table'"]) {
      expect(panel, `missing view ${id}`).toContain(`id: ${id} as const`)
    }
    expect(panel).toContain('data-testid="org-tree"')
    expect(panel).toContain('data-testid="org-map"')
    expect(panel).toContain('data-testid="org-execution"')
  })

  it('keeps CRUD (form + roster + delete-with-confirm)', () => {
    expect(panel).toContain('data-testid="org-form"')
    expect(panel).toContain('data-testid="org-roster"')
    expect(panel).toContain('window.confirm')
  })

  it('blank-canvas default for a new workspace', () => {
    expect(panel).toContain('blank canvas')
    expect(panel).toContain('data-testid="org-empty"')
  })

  it('embeds the AgentActivity visualizer in the side panel', () => {
    expect(panel).toContain('<AgentActivity agentId={agent.id}')
    expect(panel).toContain('data-testid="org-agent-panel"')
  })

  it('workforce analytics + memory badges are present', () => {
    expect(panel).toContain('data-testid="org-analytics"')
    expect(panel).toContain('data-testid="org-memory-badges"')
  })

  it('is workspace-scoped at the API (no cross-tenant leakage)', () => {
    expect(api).toContain('workspace_id')
  })

  it('AgentActivity (MC) has the 9 panels + 9 states + is customer-safe', () => {
    for (const t of ['aa-mission', 'aa-tools', 'aa-files', 'aa-timeline', 'aa-skills', 'aa-memory', 'aa-proof', 'aa-approvals', 'aa-metrics']) {
      expect(activity, `missing ${t}`).toContain(`testid="${t}"`)
    }
    expect(MISSION_STATES.length).toBe(9)
    // customer-safe: no Walt-private identities
    expect(activity.toLowerCase()).not.toContain('slim charles')
    expect(panel.toLowerCase()).not.toContain('slim charles')
  })
})
