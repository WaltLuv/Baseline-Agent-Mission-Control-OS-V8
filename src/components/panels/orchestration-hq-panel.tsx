'use client'

/**
 * Maestro · Orchestration HQ (Mission Control) — the workforce traffic-control
 * tower. Routes a mission across Mission/Workforce/Provider/Approval/Cost,
 * graph-first, and records a replayable mission (Replay + Proof + Agent Activity
 * + Graphify + Knowledge OS). Workspace-scoped. Parity with Baseline OS /maestro.
 */
import { useCallback, useState } from 'react'
import { AgentActivity } from '@/components/agent-activity'
import { routeMission, maestroReplayEvents, MAESTRO_DIMENSIONS, type RoutingDecision } from '@/lib/maestro'

export function OrchestrationHQPanel() {
  const [mission, setMission] = useState('')
  const [decision, setDecision] = useState<RoutingDecision | null>(null)

  const routeNow = useCallback(async () => {
    if (!mission.trim()) return
    let files: string[] = []
    try {
      const r = await fetch(`/api/graphify?q=${encodeURIComponent(mission)}`)
      const j = await r.json()
      files = (j.results ?? []).map((n: { path: string }) => n.path).slice(0, 6)
    } catch { /* graph optional */ }
    const d = routeMission({ mission, graphFiles: files })
    setDecision(d)
    fetch('/api/replay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: `Maestro: ${mission}`.slice(0, 80), mission, events: maestroReplayEvents(d, Date.now()) }),
    }).catch(() => {})
  }, [mission])

  return (
    <div className="m-4" data-testid="orchestration-hq-panel">
      <div className="mb-3">
        <h1 className="text-base font-semibold">Maestro · Orchestration HQ</h1>
        <p className="text-xs text-muted-foreground">
          Air traffic control for your workforce — routes every mission across {MAESTRO_DIMENSIONS.join(' · ')}. Graph-first; each routed mission is replayable. Workspace-scoped.
        </p>
      </div>
      <div className="flex gap-2">
        <input value={mission} onChange={(e) => setMission(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void routeNow()} placeholder="e.g. Build and launch a sales follow-up campaign" className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="maestro-mission-input" />
        <button onClick={() => void routeNow()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Route</button>
      </div>
      {decision && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-5" data-testid="maestro-decision">
            {[
              { k: 'Mission → Lane', v: decision.lane },
              { k: 'Workforce', v: decision.workforce.join(', ') },
              { k: 'Provider', v: decision.provider.chosen },
              { k: 'Approval', v: decision.approval.required ? 'required' : 'auto' },
              { k: 'Cost', v: decision.cost.tier },
            ].map((c) => (
              <div key={c.k} className="rounded-lg border border-border bg-card p-2">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{c.k}</div>
                <div className="text-[11px] text-foreground/85">{c.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3"><AgentActivity agentId="maestro" runtime="Maestro" provider={decision.provider.chosen} /></div>
        </>
      )}
    </div>
  )
}

export default OrchestrationHQPanel
