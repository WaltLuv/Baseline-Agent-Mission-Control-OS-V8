/**
 * AI Org Chart — CRUD store for a workspace's AI workforce hierarchy.
 *
 * Customer-safe + workspace-scoped: EVERY read and write is bound to a
 * `workspaceId`, so each customer only ever sees and mutates their own agents.
 * No cross-workspace leakage, and no Walt-private agents are ever seeded here —
 * the org chart only contains what a workspace explicitly creates.
 *
 * (Baseline OS runs the same module against the private/local instance, where
 * Walt's own private org chart lives.)
 */
import { getDatabase } from '@/lib/db'
import { type OrgAgent, type OrgAgentInput } from '@/lib/org-chart/types'

export { type OrgAgent, type OrgAgentInput, type OrgNode, ORG_DEPARTMENTS, buildHierarchy } from '@/lib/org-chart/types'

interface Row {
  id: string; workspace_id: number; name: string; role: string; department: string; category: string
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

export function listOrgAgents(workspaceId: number, includeArchived = false): OrgAgent[] {
  const rows = getDatabase()
    .prepare(`SELECT * FROM org_agents WHERE workspace_id = ? ${includeArchived ? '' : 'AND archived = 0'} ORDER BY sort_order ASC, created_at ASC`)
    .all(workspaceId) as Row[]
  return rows.map(toAgent)
}

/** Scoped fetch — returns null if the agent belongs to a different workspace. */
export function getOrgAgent(workspaceId: number, id: string): OrgAgent | null {
  const r = getDatabase().prepare('SELECT * FROM org_agents WHERE id = ? AND workspace_id = ?').get(id, workspaceId) as Row | undefined
  return r ? toAgent(r) : null
}

let counter = 0
function newId(now: number): string {
  // Deterministic-ish id without Math.random (not available in some contexts).
  counter = (counter + 1) % 100000
  return `org_${now.toString(36)}${counter.toString(36)}`
}

export function createOrgAgent(workspaceId: number, input: OrgAgentInput, now: number): OrgAgent {
  const db = getDatabase()
  const id = newId(now)
  db.prepare(`
    INSERT INTO org_agents (id, workspace_id, name, role, department, category, manager_id, skills, memory_access, runtime, permissions, archived, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id, workspaceId, input.name, input.role ?? '', input.department ?? '', input.category ?? '',
    input.managerId ?? null, JSON.stringify(input.skills ?? []), JSON.stringify(input.memoryAccess ?? []),
    input.runtime ?? '', JSON.stringify(input.permissions ?? []), input.sortOrder ?? 0, now, now,
  )
  return getOrgAgent(workspaceId, id)!
}

export function updateOrgAgent(workspaceId: number, id: string, patch: Partial<OrgAgentInput>, now: number): OrgAgent | null {
  const existing = getOrgAgent(workspaceId, id)
  if (!existing) return null // not found OR belongs to another workspace
  const merged = { ...existing, ...patch }
  getDatabase().prepare(`
    UPDATE org_agents SET name=?, role=?, department=?, category=?, manager_id=?, skills=?, memory_access=?, runtime=?, permissions=?, sort_order=?, updated_at=?
    WHERE id=? AND workspace_id=?
  `).run(
    merged.name, merged.role, merged.department, merged.category, merged.managerId ?? null,
    JSON.stringify(merged.skills), JSON.stringify(merged.memoryAccess), merged.runtime,
    JSON.stringify(merged.permissions), merged.sortOrder, now, id, workspaceId,
  )
  return getOrgAgent(workspaceId, id)
}

/** Soft-delete (archive) — destructive removal requires explicit confirmation at the API/UI layer. */
export function archiveOrgAgent(workspaceId: number, id: string, now: number): boolean {
  const res = getDatabase().prepare('UPDATE org_agents SET archived=1, updated_at=? WHERE id=? AND workspace_id=?').run(now, id, workspaceId)
  return res.changes > 0
}

/** Hard delete — only when the caller has confirmed; scoped to the workspace. */
export function deleteOrgAgent(workspaceId: number, id: string): boolean {
  const db = getDatabase()
  const res = db.prepare('DELETE FROM org_agents WHERE id=? AND workspace_id=?').run(id, workspaceId)
  // Re-parent any reports within the same workspace so the hierarchy doesn't dangle.
  db.prepare('UPDATE org_agents SET manager_id=NULL WHERE manager_id=? AND workspace_id=?').run(id, workspaceId)
  return res.changes > 0
}

/** Persist a new ordering (drag/reorder) — only affects this workspace's rows. */
export function reorderOrgAgents(workspaceId: number, orderedIds: string[], now: number): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE org_agents SET sort_order=?, updated_at=? WHERE id=? AND workspace_id=?')
  db.transaction(() => orderedIds.forEach((id, i) => stmt.run(i, now, id, workspaceId)))()
}

// ── Phase 1: workforce template → org auto-generation (idempotent) ───
import { orgPlanFromTemplate } from '@/lib/org-chart/from-template'

/**
 * Generate (or reconcile) the org chart for an installed workforce template.
 * Idempotent: agents already present for this template+name are skipped, so a
 * reinstall never duplicates org nodes. Lead is created first; reports are
 * wired to the lead's id. Workspace-scoped.
 */
export function generateOrgFromTemplate(workspaceId: number, slug: string, now: number): { created: number; skipped: number; leadId: string | null } {
  const plan = orgPlanFromTemplate(slug)
  if (plan.length === 0) return { created: 0, skipped: 0, leadId: null }
  const existing = listOrgAgents(workspaceId, true)
  const has = (name: string) => existing.some((a) => a.name === name && a.category === `template:${slug}`)

  let created = 0
  let skipped = 0
  let leadId: string | null = existing.find((a) => a.category === `template:${slug}` && !a.managerId)?.id ?? null

  // Create lead first so reports can point at it.
  const lead = plan.find((e) => e.isLead)
  if (lead) {
    if (has(lead.input.name)) { skipped++; leadId = leadId ?? existing.find((a) => a.name === lead.input.name)?.id ?? null }
    else { const a = createOrgAgent(workspaceId, lead.input, now); leadId = a.id; created++ }
  }
  for (const entry of plan) {
    if (entry.isLead) continue
    if (has(entry.input.name)) { skipped++; continue }
    createOrgAgent(workspaceId, { ...entry.input, managerId: leadId }, now)
    created++
  }
  return { created, skipped, leadId }
}

// ── Phase 2: Agent Factory → org auto-sync (idempotent, no orphans) ──
export interface FactoryAgentRef { name: string; role?: string; department?: string; runtime?: string; skills?: string[] }

/** Upsert an Agent-Factory-created agent into the org chart. Idempotent by name+category. */
export function syncFactoryAgent(workspaceId: number, ref: FactoryAgentRef, now: number): { created: boolean; id: string } {
  const existing = listOrgAgents(workspaceId, true).find((a) => a.name === ref.name && a.category === 'agent-factory')
  if (existing) {
    updateOrgAgent(workspaceId, existing.id, { role: ref.role ?? existing.role, department: ref.department ?? existing.department, runtime: ref.runtime ?? existing.runtime, skills: ref.skills ?? existing.skills }, now)
    return { created: false, id: existing.id }
  }
  const a = createOrgAgent(workspaceId, {
    name: ref.name, role: ref.role ?? '', department: ref.department ?? 'Engineering', category: 'agent-factory',
    managerId: null, skills: ref.skills ?? [], memoryAccess: ['workspace'], runtime: ref.runtime ?? 'claude-code', permissions: ['auto'],
  }, now)
  return { created: true, id: a.id }
}

/** Remove a factory agent from the org chart (archive) — no orphan reports. */
export function removeFactoryAgent(workspaceId: number, name: string, now: number): boolean {
  const a = listOrgAgents(workspaceId, true).find((x) => x.name === name && x.category === 'agent-factory')
  if (!a) return false
  return archiveOrgAgent(workspaceId, a.id, now)
}
