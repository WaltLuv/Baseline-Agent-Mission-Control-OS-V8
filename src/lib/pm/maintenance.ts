/**
 * Live maintenance execution (F2). Maintenance request → AI triage → context →
 * work order → vendor match → owner-approval gate (if spend ≥ threshold) →
 * dispatch (live or honest dry-run based on comms status) → proof + replay +
 * agent-activity trail. Workspace-scoped. Never fakes a dispatch.
 */
import { getDatabase } from '@/lib/db'
import { startReplay, recordReplayEvent, endReplay } from '@/lib/replay/store'
import { sendMessage, MESSAGE_TEMPLATES, credsPresent } from '@/lib/pm/comms'

export interface MaintenanceInput {
  request: string
  property?: string
  unit?: string
  tenant?: string
  tenantContact?: string
  ownerContact?: string
  vendorContact?: string
  costThreshold?: number
}

let seq = 0
function id(now: number, p: string) { seq = (seq + 1) % 1e6; return `${p}_${now.toString(36)}${seq.toString(36)}` }

/** Deterministic AI triage: urgency + category + a note. */
export function triage(request: string): { urgency: 'high' | 'medium' | 'low'; category: string; note: string; estimate: number } {
  const r = request.toLowerCase()
  const urgency = /\b(leak|flood|fire|gas|no heat|no water|electrical|sparks|emergency|burst)\b/.test(r)
    ? 'high' : /\b(cosmetic|paint|minor|squeak|light bulb)\b/.test(r) ? 'low' : 'medium'
  const category = /\b(leak|drain|toilet|pipe|water|plumb)\b/.test(r) ? 'plumbing'
    : /\b(electric|outlet|spark|breaker|light)\b/.test(r) ? 'electrical'
    : /\b(heat|hvac|ac|furnace|cool)\b/.test(r) ? 'hvac' : 'general'
  const estimate = urgency === 'high' ? 850 : urgency === 'medium' ? 350 : 120
  return { urgency, category, note: `Classified ${category} · urgency ${urgency}`, estimate }
}

const VENDORS: Record<string, string> = { plumbing: 'AquaFix Plumbing', electrical: 'BrightSpark Electric', hvac: 'ClimateCare HVAC', general: 'AllPro Handyman' }

export interface ExecResult {
  workOrder: any
  approvalId: string | null
  replayId: string
  dispatch: { status: string; reason?: string } | null
  liveComms: boolean
}

/** Execute (or dry-run) a maintenance request end-to-end up to the approval gate. */
export async function executeMaintenance(ws: number, input: MaintenanceInput, now: number): Promise<ExecResult> {
  const db = getDatabase()
  const t = triage(input.request)
  const vendor = VENDORS[t.category]
  const threshold = input.costThreshold ?? 500
  const woId = id(now, 'wo')
  const liveComms = credsPresent('sms').live

  // Replay: capture the whole mission.
  const replay = startReplay(ws, `Maintenance: ${input.request}`.slice(0, 80), input.request, now)
  recordReplayEvent(ws, replay.id, { ts: now, kind: 'agent_start', agent: 'Maintenance Dispatcher', label: 'AI triage', detail: t.note })
  recordReplayEvent(ws, replay.id, { ts: now, kind: 'tool_call', agent: 'Maintenance Dispatcher', label: `matched context · ${input.property ?? 'property'} ${input.unit ?? ''}` })
  recordReplayEvent(ws, replay.id, { ts: now, kind: 'tool_call', agent: 'Vendor Coordinator', label: `vendor match → ${vendor}`, detail: `est $${t.estimate}` })

  const needsApproval = t.estimate >= threshold
  const status = needsApproval ? 'awaiting_approval' : 'dispatched'

  db.prepare(`INSERT INTO work_orders (id, workspace_id, request, urgency, triage, property, unit, tenant, vendor, cost_estimate, status, replay_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(woId, ws, input.request, t.urgency, t.note, input.property ?? '', input.unit ?? '', input.tenant ?? '', vendor, t.estimate, status, replay.id, now)

  // Acknowledge the tenant (live or dry-run).
  await sendMessage(ws, { channel: 'sms', to: input.tenantContact ?? 'tenant', role: 'tenant', body: fill(MESSAGE_TEMPLATES.tenant_received.body, { tenant: input.tenant, unit: input.unit, wo: woId }), template: 'tenant_received', workOrderId: woId }, now)

  let approvalId: string | null = null
  let dispatch: { status: string; reason?: string } | null = null

  if (needsApproval) {
    approvalId = id(now, 'apr')
    db.prepare(`INSERT INTO owner_approvals (id, workspace_id, work_order_id, cost, threshold, status, context, audit, created_at)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, '[]', ?)`)
      .run(approvalId, ws, woId, t.estimate, threshold, JSON.stringify({ request: input.request, property: input.property, unit: input.unit, tenant: input.tenant, vendor, urgency: t.urgency }), now)
    db.prepare('UPDATE work_orders SET approval_id = ? WHERE id = ? AND workspace_id = ?').run(approvalId, woId, ws)
    recordReplayEvent(ws, replay.id, { ts: now, kind: 'approval', label: 'Owner approval required before spend', detail: `$${t.estimate} ≥ $${threshold}` })
    // Notify owner (live or dry-run).
    await sendMessage(ws, { channel: 'email', to: input.ownerContact ?? 'owner', role: 'owner', body: fill(MESSAGE_TEMPLATES.owner_approval.body, { request: input.request, property: input.property, unit: input.unit, cost: t.estimate, wo: woId }), template: 'owner_approval', workOrderId: woId }, now)
    recordReplayEvent(ws, replay.id, { ts: now, kind: 'output', label: 'Work order created · awaiting owner approval' })
    endReplay(ws, replay.id, 'completed', now)
  } else {
    dispatch = await dispatchWorkOrder(ws, woId, now, input.vendorContact)
    recordReplayEvent(ws, replay.id, { ts: now, kind: 'output', label: `Dispatch ${dispatch.status}` })
    endReplay(ws, replay.id, 'completed', now)
  }

  return { workOrder: getWorkOrder(ws, woId), approvalId, replayId: replay.id, dispatch, liveComms }
}

/** Dispatch a work order to the matched vendor (live or honest dry-run). */
export async function dispatchWorkOrder(ws: number, woId: string, now: number, vendorContact?: string): Promise<{ status: string; reason?: string }> {
  const db = getDatabase()
  const wo = getWorkOrder(ws, woId)
  if (!wo) return { status: 'blocked', reason: 'work order not found' }
  const res = await sendMessage(ws, { channel: 'sms', to: vendorContact ?? 'vendor', role: 'vendor', body: fill(MESSAGE_TEMPLATES.vendor_dispatch.body, { wo: woId, request: wo.request, property: wo.property, unit: wo.unit }), template: 'vendor_dispatch', workOrderId: woId }, now)
  const woStatus = res.status === 'sent' ? 'dispatched' : res.status === 'dry_run' ? 'dry_run_dispatch' : 'blocked'
  db.prepare('UPDATE work_orders SET status = ? WHERE id = ? AND workspace_id = ?').run(woStatus, woId, ws)
  if (wo.replay_id) recordReplayEvent(ws, wo.replay_id, { ts: now, kind: 'tool_call', agent: 'Vendor Coordinator', label: `dispatch → ${woStatus}`, detail: res.reason })
  return { status: woStatus, reason: res.reason }
}

function fill(tpl: string, v: Record<string, unknown>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? '—'))
}

export function getWorkOrder(ws: number, woId: string): any {
  return getDatabase().prepare('SELECT * FROM work_orders WHERE id = ? AND workspace_id = ?').get(woId, ws)
}
export function listWorkOrders(ws: number, limit = 50): any[] {
  return getDatabase().prepare('SELECT * FROM work_orders WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?').all(ws, limit)
}
