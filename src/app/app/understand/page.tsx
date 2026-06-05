'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/understand — durable decision-context entries.
//
// "Why we chose X" persistence: question + conclusion + evidence +
// confidence. Survives across operator handoffs so the reasoning isn't
// re-derived every time. Real DB rows; no synthetic data.
// ─────────────────────────────────────────────────────────────────────

type Status = 'live' | 'superseded' | 'archived'

interface Entry {
  id: number
  topic: string
  question: string
  conclusion: string
  evidence_md: string | null
  confidence: number
  tags: string[]
  status: Status
  superseded_by: number | null
  created_at: number
  updated_at: number
}

interface Payload {
  entries: Entry[]
  topics: Array<{ topic: string; count: number }>
}

function formatWhen(unix: number): string {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  })
}

function ConfidenceBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-1 bg-white/[0.08] rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className="text-[10px] text-white/55 font-mono w-8 text-right">{pct}%</span>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === 'live' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
    : status === 'superseded' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    : 'bg-white/[0.04] text-white/45 border-white/[0.08]'
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 border ${cls}`}>
      {status}
    </span>
  )
}

export default function UnderstandPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState({ topic: '', question: '', conclusion: '', evidence_md: '', confidence: 70, tagsRaw: '' })
  const [submitting, setSubmitting] = useState(false)
  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchPayload = useCallback(async () => {
    try {
      setError(null)
      const url = topicFilter ? `/api/understand?topic=${encodeURIComponent(topicFilter)}` : '/api/understand'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPayload((await res.json()) as Payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [topicFilter])

  useEffect(() => { fetchPayload() }, [fetchPayload])

  const createEntry = useCallback(async () => {
    if (submitting) return
    const t = form.topic.trim(), q = form.question.trim(), c = form.conclusion.trim()
    if (!t || !q || !c) return
    setSubmitting(true)
    try {
      const tags = form.tagsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      const res = await fetch('/api/understand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: t,
          question: q,
          conclusion: c,
          evidence_md: form.evidence_md.trim() || undefined,
          confidence: form.confidence,
          tags,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      await fetchPayload()
      setForm({ topic: '', question: '', conclusion: '', evidence_md: '', confidence: 70, tagsRaw: '' })
      setComposing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to record entry')
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, fetchPayload])

  const archiveEntry = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/understand?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchPayload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to archive')
    }
  }, [fetchPayload])

  const visibleTopics = useMemo(() => payload?.topics ?? [], [payload])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="understand-page">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-[11px] font-medium text-cyan-300 uppercase tracking-wider mb-3">
              Mission Control · Understand
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Understand</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
              The reasoning ledger. Capture <em>why</em> a choice was made — the question,
              the conclusion, the evidence, the confidence — so future operators don&apos;t
              re-derive what was already decided.
            </p>
          </div>
          <Button size="sm" onClick={() => setComposing((v) => !v)} data-testid="understand-compose-toggle">
            {composing ? 'Close' : 'Record decision'}
          </Button>
        </header>

        {composing && (
          <section className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3" data-testid="understand-compose">
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="Topic (e.g. billing-model, agent-routing)"
              maxLength={160}
              className="w-full bg-transparent border-none outline-none text-base font-semibold text-white placeholder-white/40"
              data-testid="understand-compose-topic"
            />
            <input
              type="text"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="The question being answered"
              maxLength={1000}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white/85 outline-none focus:border-white/25"
              data-testid="understand-compose-question"
            />
            <textarea
              value={form.conclusion}
              onChange={(e) => setForm((f) => ({ ...f, conclusion: e.target.value }))}
              placeholder="The conclusion (what was decided)"
              rows={3}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm text-white/85 outline-none focus:border-white/25 resize-y"
              data-testid="understand-compose-conclusion"
            />
            <textarea
              value={form.evidence_md}
              onChange={(e) => setForm((f) => ({ ...f, evidence_md: e.target.value }))}
              placeholder="Evidence / reasoning (markdown, optional)"
              rows={4}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-xs text-white/85 outline-none focus:border-white/25 resize-y font-mono leading-relaxed"
              data-testid="understand-compose-evidence"
            />
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-white/55">Confidence</label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.confidence}
                onChange={(e) => setForm((f) => ({ ...f, confidence: Number(e.target.value) }))}
                className="flex-1"
                data-testid="understand-compose-confidence"
              />
              <span className="text-[11px] text-white/85 font-mono w-10 text-right">{form.confidence}%</span>
            </div>
            <input
              type="text"
              value={form.tagsRaw}
              onChange={(e) => setForm((f) => ({ ...f, tagsRaw: e.target.value }))}
              placeholder="tags, comma, separated"
              className="w-full bg-transparent border-b border-white/10 outline-none text-xs text-white/65 placeholder-white/30 pb-1.5"
              data-testid="understand-compose-tags"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!form.topic.trim() || !form.question.trim() || !form.conclusion.trim() || submitting}
                onClick={createEntry}
                data-testid="understand-compose-save"
              >
                {submitting ? 'Recording…' : 'Record'}
              </Button>
            </div>
          </section>
        )}

        {/* Topic chips */}
        {visibleTopics.length > 0 && (
          <div className="mb-4 flex items-center gap-1.5 flex-wrap" data-testid="understand-topics">
            <button
              onClick={() => setTopicFilter(null)}
              className={`text-xs rounded-full px-3 py-1 border ${topicFilter === null ? 'border-white/30 bg-white/[0.08] text-white' : 'border-white/[0.08] text-white/55 hover:text-white/85'}`}
            >
              All topics
            </button>
            {visibleTopics.map((t) => (
              <button
                key={t.topic}
                onClick={() => setTopicFilter(t.topic === topicFilter ? null : t.topic)}
                className={`text-xs rounded-full px-3 py-1 border ${topicFilter === t.topic ? 'border-white/30 bg-white/[0.08] text-white' : 'border-white/[0.08] text-white/55 hover:text-white/85'}`}
                data-testid={`understand-topic-${t.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              >
                {t.topic} · {t.count}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="understand-error">
            {error}
          </div>
        )}

        <section data-testid="understand-list">
          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : !payload || payload.entries.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center" data-testid="understand-empty">
              <p className="text-sm text-white/55 leading-relaxed">
                {topicFilter
                  ? `No entries under topic "${topicFilter}".`
                  : 'No decision records yet. Capture your first reasoning above.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {payload.entries.map((e) => {
                const expanded = expandedId === e.id
                return (
                  <li
                    key={e.id}
                    data-testid={`understand-entry-${e.id}`}
                    className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                  >
                    <button
                      onClick={() => setExpandedId(expanded ? null : e.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider text-white/55 font-mono bg-white/[0.04] border border-white/[0.08] rounded-full px-2 py-0.5">
                          {e.topic}
                        </span>
                        <StatusBadge status={e.status} />
                        <h3 className="text-sm font-semibold text-white flex-1 truncate">{e.question}</h3>
                        <span className="text-[11px] text-white/35">{formatWhen(e.updated_at)}</span>
                      </div>
                      <p className="text-xs text-white/65 leading-relaxed line-clamp-2">{e.conclusion}</p>
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <ConfidenceBar pct={e.confidence} />
                        {e.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] text-white/55 bg-white/[0.05] border border-white/10 rounded-full px-2 py-0.5"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06]">
                        <p className="text-[11px] text-white/45 uppercase tracking-wider mb-1">Conclusion</p>
                        <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{e.conclusion}</p>
                        {e.evidence_md && (
                          <>
                            <p className="text-[11px] text-white/45 uppercase tracking-wider mt-3 mb-1">Evidence</p>
                            <pre className="text-xs text-white/75 whitespace-pre-wrap leading-relaxed font-sans bg-black/20 border border-white/[0.04] rounded-lg p-3">
                              {e.evidence_md}
                            </pre>
                          </>
                        )}
                        {e.superseded_by && (
                          <p className="mt-3 text-[11px] text-amber-300/80 italic">
                            Superseded by entry #{e.superseded_by}
                          </p>
                        )}
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => archiveEntry(e.id)}
                            className="text-[11px] text-white/40 hover:text-rose-300"
                            data-testid={`understand-entry-${e.id}-archive`}
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>{payload?.entries.length ?? 0} entr{(payload?.entries.length ?? 0) === 1 ? 'y' : 'ies'}</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
