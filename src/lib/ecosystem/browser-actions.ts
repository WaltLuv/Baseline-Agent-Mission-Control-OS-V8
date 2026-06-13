/**
 * Browser Action Registry — the ONLY browser/iframe actions Mission Control
 * agents may perform against ecosystem apps. Controlled runtime mode:
 *   · allowlisted app + URL pattern only (no arbitrary navigation)
 *   · least-privilege role + permission required
 *   · sensitive/destructive/outbound/payment actions are approval-gated
 *   · every execution captures proof + emits a replay event
 *   · PI Agent injects a context package BEFORE any browser action runs
 *
 * Data only. The actual driving happens in a connected Browser-Use / Computer-
 * Use / Flight Deck runtime — if none is connected the caller shows
 * "Browser automation setup needed" (never a fake execution).
 */
import type { EcosystemAppId } from './apps'

export type AgentPermission =
  | 'read_context'
  | 'create_work_order'
  | 'dispatch_vendor'
  | 'send_message'
  | 'request_approval'
  | 'approve_spend'
  | 'run_code'
  | 'browser_use'
  | 'file_access'
  | 'computer_use'
  | 'market_swarm'
  | 'vision_analysis'
  | 'voice_calling'
  | 'billing_action'

export type Role = 'admin' | 'operator' | 'viewer'

export interface BrowserAction {
  app: EcosystemAppId
  actionId: string
  description: string
  /** Regex (as string) the target URL MUST match — blocks cross-domain. */
  allowedUrlPattern: string
  requiredRole: Role
  requiredPermission: AgentPermission
  /** Natural-language browser task / selector plan for the runtime. */
  task: string
  approvalRequired: boolean
  expectedResult: string
  proofCapture: 'screenshot' | 'dom_snapshot' | 'none'
  replayEvent: string
}

export const BROWSER_ACTIONS: BrowserAction[] = [
  // ── PropControl ──
  { app: 'propcontrol', actionId: 'create_work_order', description: 'Create a work order in PropControl.', allowedUrlPattern: '^https://(app\\.)?propcontrolempire\\.com/.*', requiredRole: 'operator', requiredPermission: 'create_work_order', task: 'Open Work Orders → New, fill request/property/unit, submit.', approvalRequired: false, expectedResult: 'Work order created with an id.', proofCapture: 'screenshot', replayEvent: 'browser:create_work_order' },
  { app: 'propcontrol', actionId: 'update_work_order', description: 'Update a work order status/notes.', allowedUrlPattern: '^https://(app\\.)?propcontrolempire\\.com/.*', requiredRole: 'operator', requiredPermission: 'create_work_order', task: 'Open the work order, update status/notes, save.', approvalRequired: false, expectedResult: 'Work order updated.', proofCapture: 'screenshot', replayEvent: 'browser:update_work_order' },
  { app: 'propcontrol', actionId: 'upload_proof', description: 'Upload completion proof to a work order.', allowedUrlPattern: '^https://(app\\.)?propcontrolempire\\.com/.*', requiredRole: 'operator', requiredPermission: 'file_access', task: 'Attach before/after photos to the work order proof section.', approvalRequired: false, expectedResult: 'Proof attached.', proofCapture: 'screenshot', replayEvent: 'browser:upload_proof' },
  { app: 'propcontrol', actionId: 'request_owner_approval', description: 'Request owner approval for spend.', allowedUrlPattern: '^https://(app\\.)?propcontrolempire\\.com/.*', requiredRole: 'operator', requiredPermission: 'request_approval', task: 'Open approval flow, set amount + reason, send to owner.', approvalRequired: true, expectedResult: 'Owner approval request sent.', proofCapture: 'screenshot', replayEvent: 'browser:request_owner_approval' },

  // ── VisionOps ──
  { app: 'visionops', actionId: 'review_inspection_media', description: 'Review inspection media.', allowedUrlPattern: '^https://rehab-vision\\.emergent\\.host/.*', requiredRole: 'operator', requiredPermission: 'vision_analysis', task: 'Open the inspection, page through media, note defects.', approvalRequired: false, expectedResult: 'Defect notes captured.', proofCapture: 'screenshot', replayEvent: 'browser:review_inspection_media' },
  { app: 'visionops', actionId: 'generate_visual_proof', description: 'Generate visual proof from inspection.', allowedUrlPattern: '^https://rehab-vision\\.emergent\\.host/.*', requiredRole: 'operator', requiredPermission: 'vision_analysis', task: 'Run the proof generator on the selected media.', approvalRequired: false, expectedResult: 'Visual proof package created.', proofCapture: 'screenshot', replayEvent: 'browser:generate_visual_proof' },
  { app: 'visionops', actionId: 'create_inspection_report', description: 'Create an inspection report.', allowedUrlPattern: '^https://rehab-vision\\.emergent\\.host/.*', requiredRole: 'operator', requiredPermission: 'vision_analysis', task: 'Compile findings into a report and save.', approvalRequired: true, expectedResult: 'Inspection report saved.', proofCapture: 'dom_snapshot', replayEvent: 'browser:create_inspection_report' },

  // ── VoiceOps ──
  { app: 'voiceops', actionId: 'view_call_log', description: 'View call log.', allowedUrlPattern: '^https://.*', requiredRole: 'viewer', requiredPermission: 'read_context', task: 'Open the call log list.', approvalRequired: false, expectedResult: 'Call log read.', proofCapture: 'none', replayEvent: 'browser:view_call_log' },
  { app: 'voiceops', actionId: 'create_follow_up_task', description: 'Create a follow-up task from a call.', allowedUrlPattern: '^https://.*', requiredRole: 'operator', requiredPermission: 'create_work_order', task: 'Open the call, create a follow-up task.', approvalRequired: false, expectedResult: 'Follow-up task created.', proofCapture: 'screenshot', replayEvent: 'browser:create_follow_up_task' },
  { app: 'voiceops', actionId: 'escalate_call', description: 'Escalate a call.', allowedUrlPattern: '^https://.*', requiredRole: 'operator', requiredPermission: 'send_message', task: 'Open the call, trigger escalation flow.', approvalRequired: true, expectedResult: 'Call escalated + notified.', proofCapture: 'screenshot', replayEvent: 'browser:escalate_call' },

  // ── PropControl Empire (game/simulator — learning layer) ──
  { app: 'propcontrol-empire', actionId: 'launch_game', description: 'Launch the PropControl Empire simulator.', allowedUrlPattern: '^https://(app\\.)?propcontrolempire\\.com/.*', requiredRole: 'viewer', requiredPermission: 'read_context', task: 'Open the game home.', approvalRequired: false, expectedResult: 'Game launched.', proofCapture: 'none', replayEvent: 'browser:launch_game' },
  { app: 'propcontrol-empire', actionId: 'open_scenario', description: 'Open a learning scenario.', allowedUrlPattern: '^https://(app\\.)?propcontrolempire\\.com/.*', requiredRole: 'viewer', requiredPermission: 'read_context', task: 'Open a scenario.', approvalRequired: false, expectedResult: 'Scenario opened.', proofCapture: 'none', replayEvent: 'browser:open_scenario' },
  { app: 'propcontrol-empire', actionId: 'save_learning_progress', description: 'Save learning progress to history.', allowedUrlPattern: '^https://(app\\.)?propcontrolempire\\.com/.*', requiredRole: 'operator', requiredPermission: 'read_context', task: 'Persist the current learning checkpoint.', approvalRequired: false, expectedResult: 'Progress saved.', proofCapture: 'none', replayEvent: 'browser:save_learning_progress' },
  { app: 'propcontrol-empire', actionId: 'review_game_decision', description: 'Review a past game decision for coaching.', allowedUrlPattern: '^https://(app\\.)?propcontrolempire\\.com/.*', requiredRole: 'viewer', requiredPermission: 'read_context', task: 'Open a decision replay.', approvalRequired: false, expectedResult: 'Decision reviewed.', proofCapture: 'none', replayEvent: 'browser:review_game_decision' },
]

export function listBrowserActions(app: EcosystemAppId): BrowserAction[] {
  return BROWSER_ACTIONS.filter((a) => a.app === app)
}
export function getBrowserAction(app: EcosystemAppId, actionId: string): BrowserAction | undefined {
  return BROWSER_ACTIONS.find((a) => a.app === app && a.actionId === actionId)
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 }

export interface BrowserActionCheck {
  allowed: boolean
  reason?: string
  needsApproval: boolean
}

/**
 * Gate a browser action: enforce allowlisted URL, role, permission, and flag
 * approval. NEVER permits cross-domain navigation or a missing permission.
 */
export function checkBrowserAction(
  action: BrowserAction,
  ctx: { url: string; role: Role; permissions: AgentPermission[]; approved?: boolean },
): BrowserActionCheck {
  if (!new RegExp(action.allowedUrlPattern).test(ctx.url)) {
    return { allowed: false, reason: `URL not in allowlist for ${action.app}.${action.actionId}`, needsApproval: action.approvalRequired }
  }
  if (ROLE_RANK[ctx.role] < ROLE_RANK[action.requiredRole]) {
    return { allowed: false, reason: `Role ${ctx.role} below required ${action.requiredRole}`, needsApproval: action.approvalRequired }
  }
  if (!ctx.permissions.includes(action.requiredPermission)) {
    return { allowed: false, reason: `Missing permission: ${action.requiredPermission}`, needsApproval: action.approvalRequired }
  }
  if (action.approvalRequired && !ctx.approved) {
    return { allowed: false, reason: 'Action requires human approval', needsApproval: true }
  }
  return { allowed: true, needsApproval: action.approvalRequired }
}
