'use client'

/**
 * Pipeline — capture an idea, agents plan + route it, you approve, it ships.
 * Stages: Idea → Plan → Route → Approve → Build → Test → Ship → Proof.
 */
import { useCallback, useEffect, useState } from 'react'
import type { PipelineIdea } from '@/lib/pipeline/types'
import { PIPELINE_STAGES } from '@/lib/pipeline/types'

export function PipelinePanel() {
  const [ideas, setIdeas] = useState<PipelineIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/pipeline-ideas', { cache: 'no-store' }).then((x) => x.json()).catch(() => null)
    setIdeas(r?.ideas ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function capture() {
    if (!title.trim()) return
    await fetch('/api/pipeline-ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, detail }) })
    setTitle(''); setDetail(''); load()
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError('')
    const res = await fetch(`/api/pipeline-ideas?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'action failed') }
    load()
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this idea from the pipeline?')) return
    await fetch(`/api/pipeline-ideas?id=${id}`, { method: 'DELETE' }); load()
  }

  return (
    <div className="m-4 space-y-4" data-testid="pipeline-panel">
      <div className="rounded-lg border border-border/60 bg-card/20 p-3">
        <h1 className="text-base font-semibold">Pipeline</h1>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">Capture an idea, agents plan + route it, you approve, it ships. Every idea flows through the same gated stages.</p>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {PIPELINE_STAGES.map((s, i) => <span key={s} className="rounded-full border border-border px-2 py-0.5 uppercase tracking-wider text-muted-foreground">{i + 1}. {s}</span>)}
        </div>
      </div>

      {/* Idea inbox */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2" data-testid="idea-inbox">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Capture an idea…" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="idea-title" />
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Detail (optional)" rows={2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={capture} data-testid="idea-capture" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Capture idea</button>
      </div>

      {error && <p className="text-xs text-red-400" data-testid="pipeline-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : ideas.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="pipeline-empty">No ideas yet. Capture one above.</p>
      ) : (
        <div className="space-y-2" data-testid="pipeline-lanes">
          {ideas.map((idea) => (
            <div key={idea.id} className="rounded-lg border border-border bg-card p-3" data-testid={`idea-${idea.id}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{idea.title}</div>
                  {idea.detail && <div className="text-[11px] text-muted-foreground">{idea.detail}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    <span className="uppercase tracking-wider">{idea.stage}</span>
                    {idea.routedTo && <> · routed to {idea.routedTo}</>}
                    {idea.approved && <> · ✓ approved by {idea.approvedBy}</>}
                    {idea.artifact && <> · artifact: {idea.artifact}</>}
                  </div>
                </div>
                <button onClick={() => remove(idea.id)} className="rounded-md border border-red-500/40 text-red-400 px-2.5 py-1 text-xs hover:bg-red-500/10">Delete</button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                <button onClick={() => patch(idea.id, { action: 'route', routedTo: window.prompt('Route to which agent/team?') ?? '' })} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">Route</button>
                {!idea.approved && <button onClick={() => patch(idea.id, { action: 'approve', approvedBy: 'Walt' })} data-testid={`approve-${idea.id}`} className="rounded-md border border-emerald-500/40 text-emerald-400 px-2.5 py-1 text-xs hover:bg-emerald-500/10">Approve</button>}
                <button onClick={() => patch(idea.id, { action: 'advance' })} data-testid={`advance-${idea.id}`} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">Advance →</button>
                <button onClick={() => patch(idea.id, { action: 'ship', artifact: window.prompt('Artifact reference (path / URL)?') ?? '', proof: 'manual-ship' })} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">Ship + proof</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
