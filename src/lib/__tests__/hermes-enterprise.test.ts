/**
 * Hermes MCP Enterprise (Mission Control) — operator engine + panel parity.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { buildOperatorView, defaultRegistries, resolveApproval } from '@/lib/hermes-enterprise'
import { getSurface } from '@/lib/parity/surfaces'

describe('MC Hermes Enterprise engine', () => {
  it('organizes registries + honest counts; nothing fabricated', () => {
    const v = buildOperatorView({ ...defaultRegistries(), mcpOnline: false })
    expect(v.providers.every((p) => p.state === 'setup_needed')).toBe(true) // need creds
    expect(v.tools.find((t) => t.id === 'graphify')?.state).toBe('connected') // internal
    expect(v.counts.tools).toBeGreaterThan(0)
  })
  it('approval engine resolves a decision', () => {
    const out = resolveApproval([{ ts: 1, action: 'deploy', decision: 'pending' }], 0, 'denied', 'admin', 5)
    expect(out[0].decision).toBe('denied')
  })
})

describe('MC Hermes Enterprise panel + surface', () => {
  const panel = readFileSync('src/components/panels/hermes-enterprise-panel.tsx', 'utf8')
  const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')

  it('panel shows all registries + logs + Agent Activity', () => {
    for (const t of ['hermes-enterprise-panel', 'hermes-approvals', 'hermes-execlog']) {
      expect(panel, `missing ${t}`).toContain(`data-testid="${t}"`)
    }
    for (const t of ['hermes-mcp-status', 'hermes-tools', 'hermes-skills', 'hermes-providers', 'hermes-runtimes']) {
      expect(panel, `missing ${t}`).toContain(`testid="${t}"`)
    }
    expect(panel).toContain('agentId="hermes"')
    expect(panel).toContain('/api/agent-runtimes') // live runtime probe
  })

  it('hermes surface is LIVE + routed (no longer a pairing shell)', () => {
    expect(getSurface('hermes')?.status).toBe('live')
    expect(router).toContain('HermesEnterprisePanel')
    expect(router).toContain("case 'hermes':\n      return <HermesEnterprisePanel")
  })

  it('is customer-safe (no Slim Charles)', () => {
    expect(panel.toLowerCase()).not.toContain('slim charles')
  })
})
