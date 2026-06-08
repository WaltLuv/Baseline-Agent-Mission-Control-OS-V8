/**
 * Pipeline — capture an idea, agents plan + route it, you approve, it ships.
 *
 * Stages: Idea → Plan → Route → Approve → Build → Test → Ship → Proof.
 * Approval is a real gate: an idea cannot advance past `approve` without being
 * marked approved. Proof/artifact fields are only filled by real ship events.
 */
import { getDatabase } from '@/lib/db'
import { type PipelineIdea, type PipelineStage, nextStage } from '@/lib/pipeline/types'

export { type PipelineIdea, type PipelineStage, PIPELINE_STAGES, nextStage } from '@/lib/pipeline/types'

interface Row {
  id: string; title: string; detail: string; stage: string; routed_to: string
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

export function listIdeas(): PipelineIdea[] {
  const rows = getDatabase().prepare('SELECT * FROM pipeline_ideas ORDER BY created_at DESC').all() as Row[]
  return rows.map(toIdea)
}

export function getIdea(id: string): PipelineIdea | null {
  const r = getDatabase().prepare('SELECT * FROM pipeline_ideas WHERE id=?').get(id) as Row | undefined
  return r ? toIdea(r) : null
}

export function captureIdea(title: string, detail: string, now: number): PipelineIdea {
  const id = newId(now)
  getDatabase().prepare(`
    INSERT INTO pipeline_ideas (id, title, detail, stage, created_at, updated_at)
    VALUES (?, ?, ?, 'idea', ?, ?)
  `).run(id, title, detail, now, now)
  return getIdea(id)!
}

/**
 * Advance an idea to the next stage. The approve gate is enforced: an idea at
 * `approve` cannot move to `build` unless it has been approved.
 */
export function advanceIdea(id: string, now: number): { idea: PipelineIdea | null; blocked?: string } {
  const idea = getIdea(id)
  if (!idea) return { idea: null }
  const next = nextStage(idea.stage)
  if (!next) return { idea }
  if (idea.stage === 'approve' && !idea.approved) {
    return { idea, blocked: 'Approval required before build — approve the idea first.' }
  }
  getDatabase().prepare('UPDATE pipeline_ideas SET stage=?, updated_at=? WHERE id=?').run(next, now, id)
  return { idea: getIdea(id) }
}

export function approveIdea(id: string, approvedBy: string, now: number): PipelineIdea | null {
  getDatabase().prepare('UPDATE pipeline_ideas SET approved=1, approved_by=?, updated_at=? WHERE id=?').run(approvedBy, now, id)
  return getIdea(id)
}

export function routeIdea(id: string, routedTo: string, now: number): PipelineIdea | null {
  getDatabase().prepare('UPDATE pipeline_ideas SET routed_to=?, updated_at=? WHERE id=?').run(routedTo, now, id)
  return getIdea(id)
}

/** Record a real shipped artifact + proof. */
export function shipIdea(id: string, artifact: string, proof: string, now: number): PipelineIdea | null {
  getDatabase().prepare('UPDATE pipeline_ideas SET stage=?, artifact=?, proof=?, updated_at=? WHERE id=?').run('proof', artifact, proof, now, id)
  return getIdea(id)
}

export function deleteIdea(id: string): boolean {
  return getDatabase().prepare('DELETE FROM pipeline_ideas WHERE id=?').run(id).changes > 0
}
