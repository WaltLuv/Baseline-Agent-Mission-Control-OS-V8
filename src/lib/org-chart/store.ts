/**
 * AI Org Chart — CRUD store that unifies every AI agent/persona in one place.
 *
 * This is the "pull the best org-chart idea from a competitor, build it better"
 * surface: create / edit / update / archive (soft-delete with confirmation) /
 * reorder agents, assign department, manager, skills, memory access, runtime,
 * and permissions, and categorize personas. Backed by the real sqlite db.
 */
import { getDatabase } from '@/lib/db'
import { type OrgAgent, type OrgAgentInput } from '@/lib/org-chart/types'

export { type OrgAgent, type OrgAgentInput, type OrgNode, ORG_DEPARTMENTS, buildHierarchy } from '@/lib/org-chart/types'

interface Row {
  id: string; name: string; role: string; department: string; category: string
  manager_id: string | null; skills: string; memory_access: string; runtime: string
  permissions: string; archived: number; sort_order: number; created_at: number; updated_at: number
}

function toAgent(r: Row): OrgAgent {
  const arr = (s: string): string[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] } }
  return {
    id: r.id, name: r.name, role: r.role, department: r.department, category: r.category,
    managerId: r.manager_id, skills: arr(r.skills), memoryAccess: arr(r.memory_access),
    runtime: r.runtime, permissions: arr(r.permissions), archived: !!r.archived,
    sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export function listOrgAgents(includeArchived = false): OrgAgent[] {
  const db = getDatabase()
  const rows = db
    .prepare(`SELECT * FROM org_agents ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY sort_order ASC, created_at ASC`)
    .all() as Row[]
  return rows.map(toAgent)
}

export function getOrgAgent(id: string): OrgAgent | null {
  const r = getDatabase().prepare('SELECT * FROM org_agents WHERE id = ?').get(id) as Row | undefined
  return r ? toAgent(r) : null
}

let counter = 0
function newId(now: number): string {
  // Deterministic-ish id without Math.random (not available in some contexts).
  counter = (counter + 1) % 100000
  return `org_${now.toString(36)}${counter.toString(36)}`
}

export function createOrgAgent(input: OrgAgentInput, now: number): OrgAgent {
  const db = getDatabase()
  const id = newId(now)
  db.prepare(`
    INSERT INTO org_agents (id, name, role, department, category, manager_id, skills, memory_access, runtime, permissions, archived, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id, input.name, input.role ?? '', input.department ?? '', input.category ?? '',
    input.managerId ?? null, JSON.stringify(input.skills ?? []), JSON.stringify(input.memoryAccess ?? []),
    input.runtime ?? '', JSON.stringify(input.permissions ?? []), input.sortOrder ?? 0, now, now,
  )
  return getOrgAgent(id)!
}

export function updateOrgAgent(id: string, patch: Partial<OrgAgentInput>, now: number): OrgAgent | null {
  const existing = getOrgAgent(id)
  if (!existing) return null
  const merged = { ...existing, ...patch }
  getDatabase().prepare(`
    UPDATE org_agents SET name=?, role=?, department=?, category=?, manager_id=?, skills=?, memory_access=?, runtime=?, permissions=?, sort_order=?, updated_at=?
    WHERE id=?
  `).run(
    merged.name, merged.role, merged.department, merged.category, merged.managerId ?? null,
    JSON.stringify(merged.skills), JSON.stringify(merged.memoryAccess), merged.runtime,
    JSON.stringify(merged.permissions), merged.sortOrder, now, id,
  )
  return getOrgAgent(id)
}

/** Soft-delete (archive) — destructive removal requires explicit confirmation at the API/UI layer. */
export function archiveOrgAgent(id: string, now: number): boolean {
  const res = getDatabase().prepare('UPDATE org_agents SET archived=1, updated_at=? WHERE id=?').run(now, id)
  return res.changes > 0
}

/** Hard delete — only when the caller has confirmed. */
export function deleteOrgAgent(id: string): boolean {
  const res = getDatabase().prepare('DELETE FROM org_agents WHERE id=?').run(id)
  // Re-parent any reports so the hierarchy doesn't dangle.
  getDatabase().prepare('UPDATE org_agents SET manager_id=NULL WHERE manager_id=?').run(id)
  return res.changes > 0
}

/** Persist a new ordering (drag/reorder). */
export function reorderOrgAgents(orderedIds: string[], now: number): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE org_agents SET sort_order=?, updated_at=? WHERE id=?')
  db.transaction(() => orderedIds.forEach((id, i) => stmt.run(i, now, id)))()
}

