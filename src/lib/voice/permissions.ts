/**
 * Slim Charles action-permission policy.
 *
 * Slim can autonomously approve non-destructive, generative work. Anything that
 * deletes, destroys, spends above threshold, touches credentials/secrets, or
 * reaches outside the workspace requires explicit approval from Walt — Slim can
 * never auto-approve those, no matter how it is asked.
 */

export type ApprovalDecision = 'auto' | 'requires-walt'

export interface ActionPolicy {
  action: string
  decision: ApprovalDecision
  reason: string
}

/** Actions Slim may carry out on its own. */
export const AUTO_APPROVE_ACTIONS = [
  'research',
  'drafting',
  'planning',
  'file-creation',
  'file-editing',
  'app-scaffolding',
  'workflow-creation',
  'agent-dispatch',
  'browser-use-research',
  'non-destructive-computer-use',
] as const

/** Actions only Walt can approve — Slim must escalate, never auto-approve. */
export const REQUIRES_WALT_ACTIONS = [
  'delete-files',
  'delete-records',
  'destructive-command',
  'billing-change',
  'production-deploy',
  'expose-secrets',
  'send-external-message',
  'spend-above-threshold',
  'change-credentials',
] as const

export type AutoApproveAction = (typeof AUTO_APPROVE_ACTIONS)[number]
export type RequiresWaltAction = (typeof REQUIRES_WALT_ACTIONS)[number]

const AUTO = new Set<string>(AUTO_APPROVE_ACTIONS)
const WALT = new Set<string>(REQUIRES_WALT_ACTIONS)

/**
 * Keyword heuristics that force escalation even when an action isn't an exact
 * match in REQUIRES_WALT_ACTIONS — destructive/financial/secret intent always
 * routes to Walt. Default-deny: unknown actions require Walt.
 */
const DESTRUCTIVE_RX = /\b(delete|remove|rm\s|drop\s|destroy|wipe|purge|truncate|deploy\s+(to\s+)?prod|production\s+deploy|charge|refund|payout|wire|transfer\s+funds|rotate\s+key|reveal\s+secret|export\s+secret|ssh|sudo\s+rm)\b/i

export function classifyAction(action: string): ApprovalDecision {
  const a = action.trim().toLowerCase()
  if (WALT.has(a)) return 'requires-walt'
  if (DESTRUCTIVE_RX.test(a)) return 'requires-walt'
  if (AUTO.has(a)) return 'auto'
  // Default-deny: anything not explicitly safe escalates to Walt.
  return 'requires-walt'
}

export function canSlimAutoApprove(action: string): boolean {
  return classifyAction(action) === 'auto'
}

/** The full policy table, for display in the Voice UI safety panel. */
export function policyTable(): ActionPolicy[] {
  return [
    ...AUTO_APPROVE_ACTIONS.map((action) => ({ action, decision: 'auto' as const, reason: 'Non-destructive / generative — Slim proceeds.' })),
    ...REQUIRES_WALT_ACTIONS.map((action) => ({ action, decision: 'requires-walt' as const, reason: 'Destructive, financial, or secret-touching — only Walt approves.' })),
  ]
}
