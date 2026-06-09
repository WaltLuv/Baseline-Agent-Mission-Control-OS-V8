'use client'

/**
 * Owner Approval Inbox (F5) — the heart of the PM demo. Pending spend approvals
 * with full work-order / vendor / tenant / property context, cost vs threshold,
 * approve / deny / request-more-info, an audit trail, and links to the proof
 * package (replay) and communication log. Approving triggers the dispatch.
 */
import { useCallback, useEffect, useState } from 'react'

interface Approval {
  id: string; work_order_id: string; cost: number; threshold: number
  status: string; context: Record<string, any>; decided_by: string | null
  audit: { ts: number; action: string; by: string; note?: string }[]; created_at: number
}

export function OwnerApprovalsPanel() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const j = await (await fetch('/api/approvals/owner?all=1', { cache: 'no-store' })).json(); setApprovals(j.approvals ?? []) } catch { /* empty */ }
  }, [])
  useEffect(() => { void load() }, [load])

  const decide = async (id: string, decision: string) => {
    const j = await (await fetch('/api/approvals/owner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decision, note }) })).json()
    setMsg(j.ok ? `${decision}${j.dispatch ? ` · dispatch ${j.dispatch.status}` : ''}` : (j.error ?? 'error'))
    setNote('')
    await load()
  }

  const pending = approvals.filter((a) => a.status === 'pending')

  return (
    <div className="m-4 space-y-4" data-testid="owner-approvals-panel">
      <div>
        <h1 className="text-base font-semibold">Owner Approval Inbox</h1>
        <p className="text-xs text-muted-foreground">Spend approvals for maintenance work orders. Approve to dispatch, deny to block, or request more info. Every decision is audited.</p>
      </div>
      {msg && <p className="text-[11px] text-primary" data-testid="approvals-msg">{msg}</p>}

      <div data-testid="approvals-pending">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Pending · {pending.length}</div>
        {pending.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No pending approvals. Run a maintenance workflow over the threshold to create one.</p> : pending.map((a) => (
          <div key={a.id} className="mb-2 rounded-xl border border-amber-500/30 bg-card p-3" data-testid={`approval-${a.id}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{a.context.request}</span>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">${a.cost} (≥ ${a.threshold})</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {a.context.property} {a.context.unit} · tenant {a.context.tenant} · vendor {a.context.vendor} · urgency {a.context.urgency}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground/70">Work order <span className="font-mono">{a.work_order_id}</span> · proof in Workforce Replay</div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note / question" className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-[11px]" />
            <div className="mt-2 flex gap-2">
              <button onClick={() => void decide(a.id, 'approved')} className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white" data-testid={`approve-${a.id}`}>Approve</button>
              <button onClick={() => void decide(a.id, 'denied')} className="rounded-md bg-red-600 px-3 py-1 text-[11px] font-semibold text-white" data-testid={`deny-${a.id}`}>Deny</button>
              <button onClick={() => void decide(a.id, 'info_requested')} className="rounded-md border border-border px-3 py-1 text-[11px]" data-testid={`info-${a.id}`}>Request info</button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-3" data-testid="approvals-history">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Decision history</div>
        {approvals.filter((a) => a.status !== 'pending').length === 0 ? <p className="text-[11px] text-muted-foreground/60">No decisions yet.</p> : (
          <ul className="space-y-0.5 text-[11px]">
            {approvals.filter((a) => a.status !== 'pending').map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className={`rounded px-1.5 text-[9px] uppercase ${a.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{a.status}</span>
                <span className="truncate text-foreground/75">{a.context.request}</span>
                <span className="ml-auto text-muted-foreground/60">by {a.decided_by ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default OwnerApprovalsPanel
