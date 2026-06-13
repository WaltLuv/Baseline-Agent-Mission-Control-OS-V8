/**
 * Readiness badge mapping + wiring. The statuses come from
 * computeAgentReadiness / the capability matrix — no hardcoded fake states.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { READINESS_META } from '../readiness-badge'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('readiness badge', () => {
  it('maps every readiness status to a label + color', () => {
    for (const s of ['ready', 'native_workflow_ready', 'runtime_connected', 'needs_runtime', 'needs_credentials', 'demo_only', 'api_connected', 'browser_automation_ready', 'visible_only', 'offline']) {
      expect(READINESS_META[s], s).toBeTruthy()
      expect(READINESS_META[s].label, s).toBeTruthy()
    }
    expect(READINESS_META.demo_only.label).toBe('Demo Only')
    expect(READINESS_META.needs_runtime.label).toBe('Needs Runtime')
    expect(READINESS_META.native_workflow_ready.label).toBe('Native Workflow Ready')
  })

  it('badge is rendered on org-chart nodes and the agent detail panel', () => {
    expect(read('src/components/panels/org-chart-panel.tsx')).toContain('<AgentReadinessBadge')
    const tabs = read('src/components/panels/agent-detail-tabs.tsx')
    expect(tabs).toContain('<AgentReadinessPanel')
  })

  it('badge component fetches readiness from the canonical API (no hardcoded state)', () => {
    const src = read('src/components/agents/readiness-badge.tsx')
    expect(src).toContain('/api/agents/readiness')
    expect(src).toContain("'Context Harness'")
  })
})
