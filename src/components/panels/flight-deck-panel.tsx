'use client'

/**
 * Flight Deck V2 (Mission Control) — the executive control tower. Aggregates
 * ONLY real, workspace-scoped data from /api/flight-deck: runtimes, comms,
 * billing, approvals, replay, proof, maintenance, kanban, system health, demo
 * status. Every panel is live or an honest setup-needed. No filler widgets.
 */
import { useCallback, useEffect, useState } from 'react'
import { PairedDevices } from '@/components/flight-deck/paired-devices'
import { ApproveDevice } from '@/components/flight-deck/approve-device'

export function FlightDeckPanel() {
  const [d, setD] = useState<any>(null)
  const [dev, setDev] = useState<{ total: number; online: number; paired: number; revoked: number; latest_heartbeat: number | null } | null>(null)
  const load = useCallback(async () => {
    try { setD((await (await fetch('/api/flight-deck', { cache: 'no-store' })).json()).panels ?? null) } catch { setD(null) }
    try { setDev((await (await fetch('/api/devices', { cache: 'no-store' })).json()).summary ?? null) } catch { setDev(null) }
  }, [])
  useEffect(() => { void load() }, [load])

  const Tile = ({ title, status, children, testid }: { title: string; status?: string; children?: React.ReactNode; testid: string }) => {
    const setup = status?.startsWith('setup-needed')
    return (
      <div className="rounded-xl border border-border bg-card p-3" data-testid={testid}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</span>
          {status && <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${setup ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{setup ? 'setup-needed' : 'live'}</span>}
        </div>
        <div className="text-[12px] text-foreground/85">{children}</div>
        {setup && <div className="mt-1 text-[10px] text-amber-400/80">{status?.replace('setup-needed: ', '')}</div>}
      </div>
    )
  }

  return (
    <div className="m-4 space-y-3" data-testid="flight-deck-panel">
      <div>
        <h1 className="text-base font-semibold">Flight Deck · Control Tower</h1>
        <p className="text-xs text-muted-foreground">The supervisor layer over your AI workforce — runtimes, cost, approvals, comms, replay, proof, and health in one view. All live data or honest setup-needed.</p>
      </div>
      {!d ? <p className="text-[12px] text-muted-foreground/60">Loading control tower…</p> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Tile title="Runtime Registry" status={d.runtimes.status} testid="fd-runtimes">
            {d.runtimes.total === 0 ? 'No runtimes paired.' : <>{d.runtimes.healthy}/{d.runtimes.total} healthy · {d.runtimes.items.map((r: any) => r.name).slice(0, 3).join(', ')}</>}
          </Tile>
          <Tile title="Comms Status" status={d.comms.status} testid="fd-comms">
            Mode: <b>{d.comms.mode}</b> · {d.comms.items.filter((i: any) => i.present).length}/{d.comms.items.length} creds set
          </Tile>
          <Tile title="Billing" status={d.billing.status} testid="fd-billing">Credit ledger live · markup applied</Tile>
          <Tile title="Approval Queue" status={d.approvals.status} testid="fd-approvals">
            {d.approvals.pendingOwner} owner · {d.approvals.pendingKanban} workflow pending
          </Tile>
          <Tile title="Maintenance / Dispatch" status={d.maintenance.status} testid="fd-maintenance">
            {d.maintenance.workOrders} work orders · {d.maintenance.dispatched} dispatched
          </Tile>
          <Tile title="Replay Activity" status={d.replay.status} testid="fd-replay">{d.replay.total} missions recorded</Tile>
          <Tile title="Proof Activity" status={d.proof.status} testid="fd-proof">{d.proof.workOrders} proof packages · {d.proof.commLogEntries} comms-log entries</Tile>
          <Tile title="Kanban Pipeline" status={d.kanban.status} testid="fd-kanban">{d.kanban.shipped} shipped · {d.kanban.awaiting} awaiting approval</Tile>
          <Tile title="System Health" status={d.systemHealth.status} testid="fd-health">DB {d.systemHealth.db} · migrations {d.systemHealth.migrations}</Tile>
          <Tile title="Customer Demo Status" status={d.demo.status.includes('seed') ? 'setup-needed: ' + d.demo.status : 'live'} testid="fd-demo">{d.demo.seeded ? 'Demo data present' : 'No demo data'}</Tile>
          <Tile title="Paired Devices" status={dev && dev.total > 0 ? 'live' : 'setup-needed: no Flight Deck devices paired yet'} testid="fd-devices">
            {dev ? <>{dev.online} online · {dev.paired} paired · {dev.revoked} revoked</> : 'No devices'}
          </Tile>
        </div>
      )}
      <ApproveDevice />
      <PairedDevices />
    </div>
  )
}

export default FlightDeckPanel
