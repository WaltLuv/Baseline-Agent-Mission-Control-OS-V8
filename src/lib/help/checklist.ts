/**
 * Setup Checklist Derivation
 *
 * Derives checklist status honestly from real workspace state — no fake ticks.
 * Each item is satisfied by a measurable condition (agents > 0, skills > 0, etc.).
 */
import { CHECKLIST_ITEMS, type ChecklistItemDef } from './content'

export interface ChecklistInput {
  workspaceConfigured: boolean
  templateSelected: boolean
  agentCount: number
  installedSkillsCount: number
  memorySourcesCount: number
  runtimesConnectedCount: number
  billingConfigured: boolean
  taskCount: number
  approvalsReviewedCount: number
  briefingGenerated: boolean
  trackedSkillRoiCount: number
}

export interface ChecklistItemStatus extends ChecklistItemDef {
  done: boolean
}

export function deriveChecklist(input: ChecklistInput): ChecklistItemStatus[] {
  const lookup: Record<string, boolean> = {
    workspace: input.workspaceConfigured,
    template: input.templateSelected,
    employee: input.agentCount > 0,
    skill: input.installedSkillsCount > 0,
    memory: input.memorySourcesCount > 0,
    runtime: input.runtimesConnectedCount > 0,
    billing: input.billingConfigured,
    task: input.taskCount > 0,
    approval: input.approvalsReviewedCount > 0,
    briefing: input.briefingGenerated,
    roi: input.trackedSkillRoiCount > 0,
  }
  return CHECKLIST_ITEMS.map((item) => ({ ...item, done: !!lookup[item.id] }))
}

export function completionPercent(items: ChecklistItemStatus[]): number {
  if (items.length === 0) return 0
  const done = items.filter((i) => i.done).length
  return Math.round((done / items.length) * 100)
}
