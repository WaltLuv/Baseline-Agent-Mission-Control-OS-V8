/**
 * AI Org Chart — CRUD + hierarchy against the real sqlite store.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import {
  createOrgAgent, updateOrgAgent, archiveOrgAgent, deleteOrgAgent, listOrgAgents,
  reorderOrgAgents, buildHierarchy, getOrgAgent,
} from '@/lib/org-chart/store'

beforeAll(() => { runMigrations(getDatabase()) })

describe('org chart CRUD', () => {
  it('creates, edits, archives, deletes an agent', () => {
    const now = 1_000
    const a = createOrgAgent({ name: 'Aegis', role: 'Orchestrator', skills: ['triage'] }, now)
    expect(a.id).toMatch(/^org_/)
    expect(getOrgAgent(a.id)?.name).toBe('Aegis')

    const updated = updateOrgAgent(a.id, { role: 'Chief', permissions: ['dispatch'] }, now + 1)
    expect(updated?.role).toBe('Chief')
    expect(updated?.permissions).toEqual(['dispatch'])

    expect(archiveOrgAgent(a.id, now + 2)).toBe(true)
    expect(listOrgAgents(false).find((x) => x.id === a.id)).toBeUndefined()
    expect(listOrgAgents(true).find((x) => x.id === a.id)?.archived).toBe(true)

    expect(deleteOrgAgent(a.id)).toBe(true)
    expect(getOrgAgent(a.id)).toBeNull()
  })

  it('builds a manager → reports hierarchy and reorders', () => {
    const now = 2_000
    const boss = createOrgAgent({ name: 'Boss' }, now)
    const rep = createOrgAgent({ name: 'Rep', managerId: boss.id }, now + 1)
    const tree = buildHierarchy(listOrgAgents().filter((a) => a.id === boss.id || a.id === rep.id))
    const root = tree.find((n) => n.id === boss.id)
    expect(root?.reports.some((r) => r.id === rep.id)).toBe(true)

    reorderOrgAgents([rep.id, boss.id], now + 2)
    expect(getOrgAgent(rep.id)?.sortOrder).toBe(0)
    expect(getOrgAgent(boss.id)?.sortOrder).toBe(1)

    // deleting a manager re-parents reports (no dangling hierarchy)
    deleteOrgAgent(boss.id)
    expect(getOrgAgent(rep.id)?.managerId).toBeNull()
    deleteOrgAgent(rep.id)
  })
})
