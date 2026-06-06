/**
 * Setup Checklist Derivation
 *
 * Walt's P0 model — deterministic, no fake ticks:
 *   · 5 required items (workspace, template, credentials, runtime, task)
 *     each weighted 20% → 100% at the finish line.
 *   · N optional items (team, google, flightdeck, marketplace, briefing)
 *     improve the experience but don't block 100%.
 *
 * Per-item predicates:
 *   workspace   — user is signed in (true once the API returns at all).
 *   template    — workforce template has been installed (agent rows whose
 *                 source starts with "workforce-template:" exist).
 *   credentials — at least one saved credential has a non-null secret
 *                 preview OR the workspace's credit balance > 0.
 *   runtime     — at least one runtime is registered or has heart-beat.
 *   task        — a workforce task or orchestration task exists.
 *
 * Optional predicates are best-effort; failure to measure → false (not
 * surfaced as broken).
 */
import { CHECKLIST_ITEMS, type ChecklistItemDef } from './content'

export interface ChecklistInput {
  workspaceConfigured: boolean
  templateSelected: boolean
  credentialsOrCreditsConfigured: boolean
  runtimesConnectedCount: number
  taskCount: number
  // Optional:
  teamInvitedCount?: number
  googleConnected?: boolean
  flightDeckInstalled?: boolean
  marketplacePurchasesCount?: number
  briefingGenerated?: boolean
}

export interface ChecklistItemStatus extends ChecklistItemDef {
  done: boolean
}

export function deriveChecklist(input: ChecklistInput): ChecklistItemStatus[] {
  const lookup: Record<string, boolean> = {
    workspace: input.workspaceConfigured,
    template: input.templateSelected,
    credentials: input.credentialsOrCreditsConfigured,
    runtime: input.runtimesConnectedCount > 0,
    task: input.taskCount > 0,
    team: (input.teamInvitedCount ?? 0) > 0,
    google: !!input.googleConnected,
    flightdeck: !!input.flightDeckInstalled,
    marketplace: (input.marketplacePurchasesCount ?? 0) > 0,
    briefing: !!input.briefingGenerated,
  }
  return CHECKLIST_ITEMS.map((item) => ({ ...item, done: !!lookup[item.id] }))
}

/**
 * Required-tier weighted percent (0-100). Optional items never push the
 * bar past 100; they appear as bonus rows in the UI.
 */
export function completionPercent(items: ChecklistItemStatus[]): number {
  const required = items.filter((i) => i.tier === 'required')
  if (required.length === 0) return 0
  const totalWeight = required.reduce((sum, i) => sum + (i.weight ?? 0), 0) || 100
  const doneWeight = required
    .filter((i) => i.done)
    .reduce((sum, i) => sum + (i.weight ?? 0), 0)
  return Math.round((doneWeight / totalWeight) * 100)
}

/**
 * Returns the next undone required item — drives the "Continue setup"
 * CTA. Falls back to the first undone optional item if all required are
 * done. Returns null when everything's complete.
 */
export function nextStep(items: ChecklistItemStatus[]): ChecklistItemStatus | null {
  const requiredOpen = items.find((i) => i.tier === 'required' && !i.done)
  if (requiredOpen) return requiredOpen
  const optionalOpen = items.find((i) => i.tier === 'optional' && !i.done)
  return optionalOpen ?? null
}
