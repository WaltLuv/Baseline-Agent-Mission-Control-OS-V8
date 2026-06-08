/**
 * AI Org Chart — workspace-scoped CRUD + hierarchy + isolation against the real
 * sqlite store. Proves each customer workspace only sees its own agents.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import {
  createOrgAgent, updateOrgAgent, archiveOrgAgent, deleteOrgAgent, listOrgAgents,
  reorderOrgAgents, buildHierarchy, getOrgAgent,
} from '@/lib/org-chart/store'

const WS_A = 101
const WS_B = 202

beforeAll(() => { runMigrations(getDatabase()) })

describe('org chart CRUD (workspace-scoped)', () => {
  it('creates, edits, archives, deletes an agent within a workspace', () => {
    const now = 1_000
    const a = createOrgAgent(WS_A, { name: 'Aegis', role: 'Orchestrator', skills: ['triage'] }, now)
    expect(a.id).toMatch(/^org_/)
    expect(getOrgAgent(WS_A, a.id)?.name).toBe('Aegis')

    const updated = updateOrgAgent(WS_A, a.id, { role: 'Chief', permissions: ['dispatch'] }, now + 1)
    expect(updated?.role).toBe('Chief')
    expect(updated?.permissions).toEqual(['dispatch'])

    expect(archiveOrgAgent(WS_A, a.id, now + 2)).toBe(true)
    expect(listOrgAgents(WS_A, false).find((x) => x.id === a.id)).toBeUndefined()
    expect(listOrgAgents(WS_A, true).find((x) => x.id === a.id)?.archived).toBe(true)

    expect(deleteOrgAgent(WS_A, a.id)).toBe(true)
    expect(getOrgAgent(WS_A, a.id)).toBeNull()
  })

  it('builds a manager → reports hierarchy and reorders', () => {
    const now = 2_000
    const boss = createOrgAgent(WS_A, { name: 'Boss' }, now)
    const rep = createOrgAgent(WS_A, { name: 'Rep', managerId: boss.id }, now + 1)
    const tree = buildHierarchy(listOrgAgents(WS_A).filter((a) => a.id === boss.id || a.id === rep.id))
    expect(tree.find((n) => n.id === boss.id)?.reports.some((r) => r.id === rep.id)).toBe(true)

    reorderOrgAgents(WS_A, [rep.id, boss.id], now + 2)
    expect(getOrgAgent(WS_A, rep.id)?.sortOrder).toBe(0)
    expect(getOrgAgent(WS_A, boss.id)?.sortOrder).toBe(1)

    deleteOrgAgent(WS_A, boss.id)
    expect(getOrgAgent(WS_A, rep.id)?.managerId).toBeNull()
    deleteOrgAgent(WS_A, rep.id)
  })

  it('enforces workspace isolation — no cross-workspace leakage', () => {
    const now = 3_000
    const mine = createOrgAgent(WS_A, { name: 'Acme Agent' }, now)
    createOrgAgent(WS_B, { name: 'Other Co Agent' }, now + 1)

    // Each workspace only sees its own agents.
    const aNames = listOrgAgents(WS_A).map((a) => a.name)
    const bNames = listOrgAgents(WS_B).map((a) => a.name)
    expect(aNames).toContain('Acme Agent')
    expect(aNames).not.toContain('Other Co Agent')
    expect(bNames).toContain('Other Co Agent')
    expect(bNames).not.toContain('Acme Agent')

    // Workspace B cannot read, edit, or delete workspace A's agent.
    expect(getOrgAgent(WS_B, mine.id)).toBeNull()
    expect(updateOrgAgent(WS_B, mine.id, { role: 'hacked' }, now + 2)).toBeNull()
    expect(deleteOrgAgent(WS_B, mine.id)).toBe(false)
    expect(getOrgAgent(WS_A, mine.id)?.role).not.toBe('hacked') // untouched

    deleteOrgAgent(WS_A, mine.id)
    listOrgAgents(WS_B).forEach((a) => deleteOrgAgent(WS_B, a.id))
  })

  it('does not seed any Walt-private agent (no Slim Charles) into a workspace', () => {
    const fresh = listOrgAgents(999_999)
    expect(fresh).toEqual([])
    // The customer org chart only ever contains what the workspace creates.
    expect(fresh.some((a) => /slim/i.test(a.name))).toBe(false)
  })
})
