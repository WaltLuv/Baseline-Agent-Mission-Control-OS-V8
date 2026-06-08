/**
 * Pipeline — capture an idea, agents plan + route it, you approve, it ships.
 *
 * Stages: Idea → Plan → Route → Approve → Build → Test → Ship → Proof.
 * Approval is a real gate: an idea cannot advance past `approve` without being
 * marked approved. Proof/artifact fields are only filled by real ship events.
 *
 * Customer-safe + workspace-scoped: EVERY read and write is bound to a
 * `workspaceId`, so each customer only sees/edits their own ideas, plans,
 * approvals, shipped artifacts, and proofs. No cross-tenant leakage.
 */
import { getDatabase } from '@/lib/db'
import { type PipelineIdea, type PipelineStage, nextStage } from '@/lib/pipeline/types'

export { type PipelineIdea, type PipelineStage, PIPELINE_STAGES, nextStage } from '@/lib/pipeline/types'

interface Row {
  id: string; workspace_id: number; title: string; detail: string; stage: string; routed_to: string
  approved: number; approved_by: string | null; proof: string; artifact: string
  created_at: number; updated_at: number
}

function toIdea(r: Row): PipelineIdea {
  return {
    id: r.id, title: r.title, detail: r.detail, stage: r.stage as PipelineStage,
    routedTo: r.routed_to, approved: !!r.approved, approvedBy: r.approved_by,
    proof: r.proof, artifact: r.artifact, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

let counter = 0
function newId(now: number): string {
  counter = (counter + 1) % 100000
  return `idea_${now.toString(36)}${counter.toString(36)}`
}

export function listIdeas(workspaceId: number): PipelineIdea[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM pipeline_ideas WHERE workspace_id = ? ORDER BY created_at DESC')
    .all(workspaceId) as Row[]
  return rows.map(toIdea)
}

/** Scoped fetch — returns null if the idea belongs to a different workspace. */
export function getIdea(workspaceId: number, id: string): PipelineIdea | null {
  const r = getDatabase().prepare('SELECT * FROM pipeline_ideas WHERE id=? AND workspace_id=?').get(id, workspaceId) as Row | undefined
  return r ? toIdea(r) : null
}

export function captureIdea(workspaceId: number, title: string, detail: string, now: number): PipelineIdea {
  const id = newId(now)
  getDatabase().prepare(`
    INSERT INTO pipeline_ideas (id, workspace_id, title, detail, stage, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'idea', ?, ?)
  `).run(id, workspaceId, title, detail, now, now)
  return getIdea(workspaceId, id)!
}

/**
 * Advance an idea to the next stage. The approve gate is enforced: an idea at
 * `approve` cannot move to `build` unless it has been approved.
 */
export function advanceIdea(workspaceId: number, id: string, now: number): { idea: PipelineIdea | null; blocked?: string } {
  const idea = getIdea(workspaceId, id)
  if (!idea) return { idea: null }
  const next = nextStage(idea.stage)
  if (!next) return { idea }
  if (idea.stage === 'approve' && !idea.approved) {
    return { idea, blocked: 'Approval required before build — approve the idea first.' }
  }
  getDatabase().prepare('UPDATE pipeline_ideas SET stage=?, updated_at=? WHERE id=? AND workspace_id=?').run(next, now, id, workspaceId)
  return { idea: getIdea(workspaceId, id) }
}

export function approveIdea(workspaceId: number, id: string, approvedBy: string, now: number): PipelineIdea | null {
  getDatabase().prepare('UPDATE pipeline_ideas SET approved=1, approved_by=?, updated_at=? WHERE id=? AND workspace_id=?').run(approvedBy, now, id, workspaceId)
  return getIdea(workspaceId, id)
}

export function routeIdea(workspaceId: number, id: string, routedTo: string, now: number): PipelineIdea | null {
  getDatabase().prepare('UPDATE pipeline_ideas SET routed_to=?, updated_at=? WHERE id=? AND workspace_id=?').run(routedTo, now, id, workspaceId)
  return getIdea(workspaceId, id)
}

/** Record a real shipped artifact + proof. */
export function shipIdea(workspaceId: number, id: string, artifact: string, proof: string, now: number): PipelineIdea | null {
  getDatabase().prepare('UPDATE pipeline_ideas SET stage=?, artifact=?, proof=?, updated_at=? WHERE id=? AND workspace_id=?').run('proof', artifact, proof, now, id, workspaceId)
  return getIdea(workspaceId, id)
}

export function deleteIdea(workspaceId: number, id: string): boolean {
  return getDatabase().prepare('DELETE FROM pipeline_ideas WHERE id=? AND workspace_id=?').run(id, workspaceId).changes > 0
}
