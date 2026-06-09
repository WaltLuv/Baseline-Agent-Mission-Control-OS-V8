'use client'

/**
 * Gemini Flow (Mission Control) — Google-Flow-style workflow workspace, parity
 * with Baseline OS. Graph-first: planning queries /api/graphify before laying
 * out the task graph. Workspace-scoped + customer-safe. Not a chatbot.
 */
import { useState } from 'react'
import { AgentActivity } from '@/components/agent-activity'
import { planFromGoal, flowStats, flowReplayEvents, ARTIFACT_KINDS, type FlowWorkflow } from '@/lib/gemini-flow'

export function GeminiFlowPanel() {
  const [goal, setGoal] = useState('')
  const [wf, setWf] = useState<FlowWorkflow | null>(null)
  const [busy, setBusy] = useState(false)

  const plan = async () => {
    if (!goal.trim() || busy) return
    setBusy(true)
    let files: string[] = []
    try {
      const r = await fetch(`/api/graphify?q=${encodeURIComponent(goal)}`)
      const j = await r.json()
      files = (j.results ?? []).map((n: { path: string }) => n.path)
    } catch { /* graph optional */ }
    const planned = planFromGoal(goal, files, { now: Date.now(), provider: 'gemini' })
    setWf(planned)
    // Replay: persist this workflow as a replayable mission (workspace-scoped).
    fetch('/api/replay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: `Gemini Flow: ${goal}`.slice(0, 80), mission: goal, events: flowReplayEvents(planned, Date.now()) }),
    }).catch(() => {})
    setBusy(false)
  }

  const stats = wf ? flowStats(wf) : null
  const byKind = (k: string) => (wf?.nodes ?? []).filter((n) => n.kind === k)

  return (
    <div className="m-4" data-testid="gemini-flow-panel">
      <div className="mb-3">
        <h1 className="text-base font-semibold">Gemini Flow · workflow workspace</h1>
        <p className="text-xs text-muted-foreground">Goal → graph-first task plan, artifacts, agents + providers. Not a chatbot. Queries Graphify first; emits replay events. Workspace-scoped.</p>
      </div>
      <div className="flex gap-2">
        <input value={goal} onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && plan()} placeholder="Plan a product launch campaign…" className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="flow-goal" />
        <button onClick={plan} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Planning…' : 'Build flow'}</button>
      </div>

      {wf && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3" data-testid="flow-canvas">
          <div className="rounded-xl border border-border bg-card p-3 lg:col-span-2">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Task graph · {stats?.tasks} tasks · {stats?.contextFiles} graph-context files {stats?.graphFirst ? '· graph-first ✓' : ''}
            </div>
            <div className="space-y-1.5">
              {wf.nodes.map((n) => (
                <div key={n.id} className="flex items-center gap-2 text-[11px]" data-testid={`flow-node-${n.kind}`}>
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] uppercase text-primary">{n.kind}</span>
                  <span className="text-foreground/80">{n.label}</span>
                  {n.deps.length > 0 && <span className="text-muted-foreground/40">← {n.deps.length} dep{n.deps.length > 1 ? 's' : ''}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3" data-testid="flow-artifacts">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Artifacts</div>
              <div className="flex flex-wrap gap-1">{ARTIFACT_KINDS.map((a) => <span key={a} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{a}</span>)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3" data-testid="flow-agents">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Agents · Providers</div>
              {byKind('agent').map((n) => <div key={n.id} className="text-[11px] text-foreground/75">🤖 {n.label}</div>)}
              {byKind('provider').map((n) => <div key={n.id} className="text-[11px] text-foreground/75">⚙ {n.label}</div>)}
            </div>
            <AgentActivity agentId="gemini-flow" runtime="Gemini" provider="Google" />
          </div>
        </div>
      )}
    </div>
  )
}

export default GeminiFlowPanel
