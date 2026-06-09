/**
 * Owner Approval Inbox (F5). Pending spend approvals for maintenance work orders,
 * with approve / deny / request-more-info, a full audit trail, and links to the
 * work order, proof package (replay), and communication log. Approving triggers
 * the (live or dry-run) vendor dispatch. Workspace-scoped.
 */
import { getDatabase } from '@/lib/db'
import { recordReplayEvent } from '@/lib/replay/store'
import { dispatchWorkOrder, getWorkOrder } from '@/lib/pm/maintenance'

export type Decision = 'approved' | 'denied' | 'info_requested'

export interface OwnerApproval {
  id: string
  work_order_id: string
  cost: number
  threshold: number
  status: 'pending' | Decision
  context: Record<string, unknown>
  decided_by: string | null
  decided_at: number | null
  audit: { ts: number; action: string; by: string; note?: string }[]
  created_at: number
}

function hydrate(row: any): OwnerApproval {
  return { ...row, context: JSON.parse(row.context || '{}'), audit: JSON.parse(row.audit || '[]') }
}

export function listPending(ws: number): OwnerApproval[] {
  return (getDatabase().prepare("SELECT * FROM owner_approvals WHERE workspace_id = ? AND status = 'pending' ORDER BY created_at DESC").all(ws) as any[]).map(hydrate)
}
export function listAll(ws: number, limit = 50): OwnerApproval[] {
  return (getDatabase().prepare('SELECT * FROM owner_approvals WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?').all(ws, limit) as any[]).map(hydrate)
}
export function getApproval(ws: number, idv: string): OwnerApproval | null {
  const row = getDatabase().prepare('SELECT * FROM owner_approvals WHERE id = ? AND workspace_id = ?').get(idv, ws)
  return row ? hydrate(row) : null
}

/** Decide an approval. approved → dispatch; denied → block WO; info_requested → log. */
export async function decide(ws: number, idv: string, decision: Decision, by: string, note: string, now: number): Promise<{ ok: boolean; approval?: OwnerApproval; dispatch?: { status: string; reason?: string }; error?: string }> {
  const db = getDatabase()
  const cur = getApproval(ws, idv)
  if (!cur) return { ok: false, error: 'approval not found' }
  if (cur.status !== 'pending') return { ok: false, error: `already ${cur.status}` }

  const audit = [...cur.audit, { ts: now, action: decision, by, note: note || undefined }]
  // info_requested keeps it open (status stays pending in the queue but records the request).
  const newStatus = decision === 'info_requested' ? 'pending' : decision
  db.prepare('UPDATE owner_approvals SET status = ?, decided_by = ?, decided_at = ?, audit = ? WHERE id = ? AND workspace_id = ?')
    .run(newStatus, decision === 'info_requested' ? null : by, decision === 'info_requested' ? null : now, JSON.stringify(audit), idv, ws)

  const wo = getWorkOrder(ws, cur.work_order_id)
  if (wo?.replay_id) recordReplayEvent(ws, wo.replay_id, { ts: now, kind: 'approval', label: `Owner ${decision} by ${by}`, detail: note || undefined })

  let dispatch: { status: string; reason?: string } | undefined
  if (decision === 'approved') {
    dispatch = await dispatchWorkOrder(ws, cur.work_order_id, now)
  } else if (decision === 'denied') {
    db.prepare("UPDATE work_orders SET status = 'blocked' WHERE id = ? AND workspace_id = ?").run(cur.work_order_id, ws)
    if (wo?.replay_id) recordReplayEvent(ws, wo.replay_id, { ts: now, kind: 'output', label: 'Work order blocked — owner denied spend' })
  }
  return { ok: true, approval: getApproval(ws, idv) ?? undefined, dispatch }
}
