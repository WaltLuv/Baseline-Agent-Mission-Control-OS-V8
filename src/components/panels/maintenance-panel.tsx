'use client'

/**
 * Live Maintenance Execution (F2). Submit a maintenance request → AI triage →
 * work order → vendor match → owner-approval gate (if spend ≥ threshold) →
 * dispatch (live or honest dry-run). Shows runtime/dispatch status, the work
 * order, proof (replay link), and embedded Agent Activity. Never fakes dispatch.
 */
import { useCallback, useEffect, useState } from 'react'
import { AgentActivity } from '@/components/agent-activity'

export function MaintenancePanel() {
  const [request, setRequest] = useState('Water leaking under the kitchen sink in unit 4B')
  const [property, setProperty] = useState('Maple Court')
  const [unit, setUnit] = useState('4B')
  const [tenant, setTenant] = useState('Jordan')
  const [threshold, setThreshold] = useState(500)
  const [result, setResult] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const j = await (await fetch('/api/maintenance', { cache: 'no-store' })).json(); setOrders(j.workOrders ?? []) } catch { /* empty */ }
  }, [])
  useEffect(() => { void load() }, [load])

  const run = async () => {
    if (!request.trim() || busy) return
    setBusy(true)
    try {
      const j = await (await fetch('/api/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request, property, unit, tenant, costThreshold: threshold }) })).json()
      setResult(j)
      await load()
    } catch (e) { setResult({ error: (e as Error).message }) }
    setBusy(false)
  }

  return (
    <div className="m-4 space-y-4" data-testid="maintenance-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">Maintenance Execution</h1>
          <p className="text-xs text-muted-foreground">Request → AI triage → work order → vendor match → owner approval (if over threshold) → dispatch. Live when comms are connected; otherwise an honest dry-run with full proof + replay.</p>
        </div>
        <button
          onClick={async () => { setSeeding(true); try { const j = await (await fetch('/api/demo/seed', { method: 'POST' })).json(); setSeedMsg(j.ok ? `Demo seeded · ${j.seeded.workOrders} work orders · ${j.seeded.pendingApprovals} pending approval(s) · ${j.seeded.replays} replays · comms ${j.credentials.mode}` : (j.error ?? 'error')); await load() } catch (e) { setSeedMsg((e as Error).message) } setSeeding(false) }}
          disabled={seeding}
          className="shrink-0 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
          data-testid="demo-seed"
        >
          {seeding ? 'Seeding…' : '✨ Demo Mode — seed data'}
        </button>
      </div>
      {seedMsg && <p className="text-[11px] text-primary" data-testid="demo-seed-msg">{seedMsg}</p>}

      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2" data-testid="maintenance-form">
        <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={2} placeholder="Describe the maintenance issue" className="rounded-md border border-border bg-background px-2 py-1 text-xs sm:col-span-2" data-testid="maintenance-request" />
        <input value={property} onChange={(e) => setProperty(e.target.value)} placeholder="Property" className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
        <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="Tenant" className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
        <div className="flex items-center gap-2"><label className="text-[11px] text-muted-foreground">Approval threshold $</label><input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs" /></div>
        <button onClick={() => void run()} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2" data-testid="maintenance-run">{busy ? 'Executing…' : 'Run maintenance workflow'}</button>
      </div>

      {result && !result.error && (
        <div className="rounded-xl border border-border bg-card p-3 text-[12px]" data-testid="maintenance-result">
          <div className={`mb-2 inline-block rounded px-2 py-0.5 text-[10px] uppercase ${result.liveComms ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`} data-testid="maintenance-dispatch-status">
            {result.liveComms ? 'comms live' : 'comms setup-needed — dry-run'}
          </div>
          <div>Work order <span className="font-mono">{result.workOrder?.id}</span> · {result.workOrder?.status}</div>
          <div className="text-muted-foreground">Triage: {result.workOrder?.triage} · Vendor: {result.workOrder?.vendor} · Est ${result.workOrder?.cost_estimate}</div>
          {result.approvalId && <div className="mt-1 text-amber-400">⏸ Owner approval required (${result.workOrder?.cost_estimate} ≥ ${threshold}) → see Approvals inbox.</div>}
          {result.dispatch && <div className="mt-1">Dispatch: {result.dispatch.status}{result.dispatch.reason ? ` — ${result.dispatch.reason}` : ''}</div>}
          <div className="mt-1 text-muted-foreground">Proof / replay: <span className="font-mono">{result.replayId}</span> (open Workforce Replay)</div>
        </div>
      )}
      {result?.error && <p className="text-[12px] text-red-400">{result.error}</p>}

      <div className="rounded-xl border border-border bg-card p-3" data-testid="maintenance-orders">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Work orders</div>
        {orders.length === 0 ? <p className="text-[11px] text-muted-foreground/60">None yet.</p> : (
          <ul className="space-y-0.5 text-[11px]">{orders.map((o) => <li key={o.id} className="flex gap-2"><span className="font-mono text-muted-foreground">{o.id}</span><span>{o.request}</span><span className="ml-auto rounded bg-muted px-1.5 text-[9px] uppercase">{o.status}</span></li>)}</ul>
        )}
      </div>

      <AgentActivity agentId="maintenance" runtime="Property Management" provider="Hermes" />
    </div>
  )
}

export default MaintenancePanel
