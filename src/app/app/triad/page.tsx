'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/triad — Triad Council decisions + votes.
//
// Records-only surface: the cloud doesn't call models, agent runtimes do.
// This page renders real DB rows; the empty state is honest.
// ─────────────────────────────────────────────────────────────────────

type DecisionStatus = 'open' | 'voting' | 'resolved' | 'vetoed' | 'archived'
type VoteKind = 'approve' | 'reject' | 'abstain' | 'veto'

interface Vote {
  id: number
  decision_id: number
  model_id: string
  model_label: string | null
  vote: VoteKind
  rationale: string | null
  confidence: number | null
  created_at: number
}

interface Decision {
  id: number
  prompt: string
  summary: string | null
  status: DecisionStatus
  resolved_outcome: string | null
  resolved_at: number | null
  created_at: number
  updated_at: number
  votes: Vote[]
  tallies: { approve: number; reject: number; abstain: number; veto: number }
}

function formatWhen(unix: number): string {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function VoteBadge({ kind, label }: { kind: VoteKind; label?: string }) {
  const cls =
    kind === 'approve' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : kind === 'veto' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    : kind === 'reject' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    : 'bg-white/[0.06] text-white/55 border-white/[0.10]'
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 border ${cls}`}>
      {label || kind}
    </span>
  )
}

function StatusBadge({ status }: { status: DecisionStatus }) {
  const cls =
    status === 'resolved' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
    : status === 'vetoed' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
    : status === 'voting' ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
    : status === 'open' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    : 'bg-white/[0.04] text-white/55 border-white/[0.08]'
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 border ${cls}`}>
      {status}
    </span>
  )
}

export default function TriadPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [newPrompt, setNewPrompt] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchDecisions = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/triad', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { decisions: Decision[] }
      setDecisions(data.decisions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load decisions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDecisions() }, [fetchDecisions])

  const createDecision = useCallback(async () => {
    const prompt = newPrompt.trim()
    if (!prompt || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/triad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, summary: newSummary.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const { decision } = (await res.json()) as { decision: Decision }
      setDecisions((prev) => [decision, ...prev])
      setNewPrompt('')
      setNewSummary('')
      setComposing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to create decision')
    } finally {
      setSubmitting(false)
    }
  }, [newPrompt, newSummary, submitting])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="triad-page">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-[11px] font-medium text-violet-300 uppercase tracking-wider mb-3">
              Mission Control · Triad Council
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Triad Council</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
              Three-model voting on operator decisions. This page records and tallies votes —
              the actual model calls happen in your agent runtimes. Empty until a runtime
              records its first vote.
            </p>
          </div>
          <Button size="sm" onClick={() => setComposing((v) => !v)} data-testid="triad-compose-toggle">
            {composing ? 'Close' : 'New decision'}
          </Button>
        </header>

        {composing && (
          <section className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3" data-testid="triad-compose">
            <input
              type="text"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Decision prompt — what is being voted on?"
              maxLength={2000}
              className="w-full bg-transparent border-none outline-none text-base font-semibold text-white placeholder-white/40"
              data-testid="triad-compose-prompt"
            />
            <textarea
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="One-line summary (optional)"
              rows={2}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-xs text-white/85 outline-none focus:border-white/25 resize-y"
              data-testid="triad-compose-summary"
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={!newPrompt.trim() || submitting} onClick={createDecision} data-testid="triad-compose-save">
                {submitting ? 'Recording…' : 'Record decision'}
              </Button>
            </div>
          </section>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="triad-error">
            {error}
          </div>
        )}

        <section data-testid="triad-list">
          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : decisions.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center" data-testid="triad-empty">
              <p className="text-sm text-white/55 leading-relaxed">
                No decisions recorded yet. Record one above, or let an agent runtime POST to{' '}
                <code className="font-mono text-white/80 bg-white/[0.06] px-1 py-0.5 rounded text-xs">/api/triad</code>{' '}
                when a model casts its first vote.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {decisions.map((d) => {
                const expanded = expandedId === d.id
                return (
                  <li
                    key={d.id}
                    data-testid={`triad-decision-${d.id}`}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                  >
                    <button
                      onClick={() => setExpandedId(expanded ? null : d.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                        <StatusBadge status={d.status} />
                        <h3 className="text-sm font-semibold text-white flex-1 truncate">{d.prompt}</h3>
                        <span className="text-[11px] text-white/35">{formatWhen(d.updated_at)}</span>
                      </div>
                      {d.summary && (
                        <p className="text-xs text-white/55 mt-1">{d.summary}</p>
                      )}
                      <div className="mt-2 flex gap-1.5">
                        {d.tallies.approve > 0 && <VoteBadge kind="approve" label={`${d.tallies.approve} approve`} />}
                        {d.tallies.reject > 0 && <VoteBadge kind="reject" label={`${d.tallies.reject} reject`} />}
                        {d.tallies.abstain > 0 && <VoteBadge kind="abstain" label={`${d.tallies.abstain} abstain`} />}
                        {d.tallies.veto > 0 && <VoteBadge kind="veto" label={`${d.tallies.veto} veto`} />}
                        {d.votes.length === 0 && (
                          <span className="text-[10px] uppercase tracking-wider text-white/40 italic">
                            awaiting votes
                          </span>
                        )}
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
                        {d.votes.length === 0 ? (
                          <p className="text-[11px] text-white/40 italic">
                            No votes yet. Agent runtimes POST to /api/triad?id={d.id}&amp;action=vote to record one.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {d.votes.map((v) => (
                              <li key={v.id} className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <code className="text-[11px] font-mono text-white/85">{v.model_label || v.model_id}</code>
                                  <VoteBadge kind={v.vote} />
                                  {v.confidence !== null && (
                                    <span className="text-[10px] text-white/45">
                                      {v.confidence}% confidence
                                    </span>
                                  )}
                                  <span className="ml-auto text-[10px] text-white/35">{formatWhen(v.created_at)}</span>
                                </div>
                                {v.rationale && (
                                  <p className="mt-1 text-[11px] text-white/65 leading-relaxed">{v.rationale}</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {d.status === 'resolved' && d.resolved_outcome && (
                          <p className="text-[11px] text-emerald-300/85 leading-relaxed">
                            <strong>Outcome:</strong> {d.resolved_outcome}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>{decisions.length} decision{decisions.length === 1 ? '' : 's'}</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
