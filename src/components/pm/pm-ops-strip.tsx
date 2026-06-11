'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * PmOpsStrip — "this business is already running" at a glance.
 *
 * A single compact row on /app/overview surfacing the live operational
 * counts a new operator must see in their first 30 seconds: work orders,
 * vendor dispatches, owner approvals, replay history, proof entries, and
 * Flight Deck runtime status. Pure aggregation of the existing
 * /api/flight-deck endpoint — no new data model, honest counts only.
 * Renders nothing until data arrives; hides itself entirely when the
 * workspace has no operational data yet.
 */

interface FlightDeckPanels {
  maintenance?: { workOrders?: number; dispatched?: number }
  approvals?: { pendingOwner?: number }
  replay?: { total?: number }
  proof?: { commLogEntries?: number }
  runtimes?: { healthy?: number; total?: number }
}

interface OpsCard {
  key: string
  label: string
  value: string
  sub: string
  href: string
  alert?: boolean
}

export function PmOpsStrip() {
  const [panels, setPanels] = useState<FlightDeckPanels | null>(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/flight-deck')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.panels) setPanels(j.panels as FlightDeckPanels) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function resetDemo() {
    if (resetting) return
    if (!window.confirm(
      'Reset the demo workspace?\n\nThis wipes your changes to the seeded data (work orders, approvals, replays) and restores a fresh, already-running Property Management demo. Your account and settings are not affected.',
    )) return
    setResetting(true)
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      if (res.ok) window.location.reload()
      else { setResetting(false); window.alert('Reset failed. Please try again.') }
    } catch {
      setResetting(false)
      window.alert('Reset failed. Please try again.')
    }
  }

  if (!panels) return null

  const workOrders = panels.maintenance?.workOrders ?? 0
  const dispatched = panels.maintenance?.dispatched ?? 0
  const pendingOwner = panels.approvals?.pendingOwner ?? 0
  const replays = panels.replay?.total ?? 0
  const proofs = panels.proof?.commLogEntries ?? 0
  const runtimesHealthy = panels.runtimes?.healthy ?? 0
  const runtimesTotal = panels.runtimes?.total ?? 0

  // Honest empty state: no operational data → render nothing.
  if (workOrders + pendingOwner + replays + proofs === 0) return null

  const cards: OpsCard[] = [
    { key: 'work-orders', label: 'Work orders', value: String(workOrders), sub: `${dispatched} dispatched to vendors`, href: '/app/maintenance' },
    { key: 'approvals', label: 'Owner approvals', value: String(pendingOwner), sub: pendingOwner > 0 ? 'awaiting your decision' : 'queue clear', href: '/app/approvals', alert: pendingOwner > 0 },
    { key: 'replays', label: 'Replay history', value: String(replays), sub: 'missions recorded', href: '/app/replay' },
    { key: 'proof', label: 'Proof packages', value: String(proofs), sub: 'comm-log entries', href: '/app/proofs' },
    { key: 'flight-deck', label: 'Flight Deck', value: runtimesHealthy > 0 ? `${runtimesHealthy}/${runtimesTotal}` : '—', sub: runtimesHealthy > 0 ? 'runtimes healthy' : 'connect a runtime', href: '/app/flight-deck' },
  ]

  return (
    <div data-testid="pm-ops-strip" className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Live operations
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/70">real-time · workspace-scoped</span>
          <button
            type="button"
            onClick={resetDemo}
            disabled={resetting}
            data-testid="reset-demo-button"
            title="Wipe your changes and restore a fresh, already-running demo workspace"
            className="rounded border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : '↻ Reset demo'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            data-testid={`pm-ops-${c.key}`}
            className={`group rounded-md border px-3 py-2 transition-colors ${
              c.alert
                ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10'
                : 'border-border/60 bg-background/40 hover:bg-accent/40'
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-semibold tabular-nums ${c.alert ? 'text-amber-300' : 'text-foreground'}`}>
                {c.value}
              </span>
              <span className="text-xs font-medium text-foreground/90">{c.label}</span>
            </div>
            <div className={`mt-0.5 text-[11px] ${c.alert ? 'text-amber-200/80' : 'text-muted-foreground'}`}>
              {c.sub} <span className="opacity-0 transition-opacity group-hover:opacity-100">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
