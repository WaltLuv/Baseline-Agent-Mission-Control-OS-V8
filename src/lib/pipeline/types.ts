/**
 * Pipeline — client-safe types, constants, and pure helpers (no db import).
 */
export const PIPELINE_STAGES = [
  'idea', 'plan', 'route', 'approve', 'build', 'test', 'ship', 'proof',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export interface PipelineIdea {
  id: string
  title: string
  detail: string
  stage: PipelineStage
  routedTo: string
  approved: boolean
  approvedBy: string | null
  proof: string
  artifact: string
  createdAt: number
  updatedAt: number
}

/** Stage ordering helper (pure). */
export function nextStage(stage: PipelineStage): PipelineStage | null {
  const i = PIPELINE_STAGES.indexOf(stage)
  return i >= 0 && i < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[i + 1] : null
}
