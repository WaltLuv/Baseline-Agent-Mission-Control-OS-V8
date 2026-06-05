'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/seo — Workspace SEO targets (cloud parity of Baseline OS /seo).
//
// Operator records the keywords + URLs they're trying to rank for.
// Ranks are recorded values — the cloud never auto-fetches; a rank-
// tracker agent (or the operator) writes current_rank into the row.
// ─────────────────────────────────────────────────────────────────────

type Status = 'planned' | 'drafting' | 'published' | 'ranking' | 'archived'

interface Target {
  id: number
  target_keyword: string
  target_url: string | null
  page_title: string | null
  status: Status
  current_rank: number | null
  target_rank: number | null
  notes: string | null
  last_checked_at: number | null
  created_at: number
  updated_at: number
}

const STATUS_OPTIONS: Status[] = ['planned', 'drafting', 'published', 'ranking']

function formatWhen(unix: number | null): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  })
}

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === 'ranking' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
    : status === 'published' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
    : status === 'drafting' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    : status === 'planned' ? 'bg-white/[0.05] text-white/70 border-white/[0.10]'
    : 'bg-white/[0.04] text-white/45 border-white/[0.08]'
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 border ${cls}`}>
      {status}
    </span>
  )
}

export default function SeoPage() {
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newTargetRank, setNewTargetRank] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')

  const fetchTargets = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/seo', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { targets: Target[] }
      setTargets(data.targets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load SEO targets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTargets() }, [fetchTargets])

  const createTarget = useCallback(async () => {
    const keyword = newKeyword.trim()
    if (!keyword || submitting) return
    setSubmitting(true)
    try {
      const targetRank = newTargetRank.trim() ? Number(newTargetRank) : undefined
      const res = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_keyword: keyword,
          target_url: newUrl.trim() || undefined,
          target_rank: targetRank,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const { target } = (await res.json()) as { target: Target }
      setTargets((prev) => [target, ...prev])
      setNewKeyword('')
      setNewUrl('')
      setNewTargetRank('')
      setComposing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to add target')
    } finally {
      setSubmitting(false)
    }
  }, [newKeyword, newUrl, newTargetRank, submitting])

  const setStatus = useCallback(async (id: number, status: Status) => {
    try {
      const res = await fetch(`/api/seo?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { target } = (await res.json()) as { target: Target }
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to update target')
    }
  }, [])

  const archiveTarget = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/seo?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTargets((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to archive')
    }
  }, [])

  const visible = useMemo(() => {
    if (statusFilter === 'all') return targets
    return targets.filter((t) => t.status === statusFilter)
  }, [targets, statusFilter])

  const tallies = useMemo(() => {
    const out: Record<Status, number> = {
      planned: 0, drafting: 0, published: 0, ranking: 0, archived: 0,
    }
    for (const t of targets) out[t.status] = (out[t.status] ?? 0) + 1
    return out
  }, [targets])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="seo-page">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-medium text-amber-300 uppercase tracking-wider mb-3">
              Mission Control · SEO
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">SEO Targets</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
              Track the keywords and URLs your workspace is trying to rank for. Ranks are
              recorded values — Mission Control never silently scrapes the SERP.
            </p>
          </div>
          <Button size="sm" onClick={() => setComposing((v) => !v)} data-testid="seo-compose-toggle">
            {composing ? 'Close' : 'New target'}
          </Button>
        </header>

        {composing && (
          <section className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3" data-testid="seo-compose">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Target keyword"
              maxLength={280}
              className="w-full bg-transparent border-none outline-none text-base font-semibold text-white placeholder-white/40"
              data-testid="seo-compose-keyword"
            />
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Target URL (optional)"
              maxLength={2048}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/85 outline-none focus:border-white/25"
              data-testid="seo-compose-url"
            />
            <input
              type="number"
              value={newTargetRank}
              onChange={(e) => setNewTargetRank(e.target.value)}
              placeholder="Target rank (1-1000, optional)"
              min={1}
              max={1000}
              className="w-32 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/85 outline-none focus:border-white/25"
              data-testid="seo-compose-rank"
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={!newKeyword.trim() || submitting} onClick={createTarget} data-testid="seo-compose-save">
                {submitting ? 'Saving…' : 'Save target'}
              </Button>
            </div>
          </section>
        )}

        {/* Status filter */}
        <div className="mb-4 flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-full px-3 py-1 border ${statusFilter === 'all' ? 'border-white/30 bg-white/[0.08] text-white' : 'border-white/[0.08] text-white/55 hover:text-white/85'}`}
            data-testid="seo-filter-all"
          >
            All · {targets.length}
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 border ${statusFilter === s ? 'border-white/30 bg-white/[0.08] text-white' : 'border-white/[0.08] text-white/55 hover:text-white/85'}`}
              data-testid={`seo-filter-${s}`}
            >
              {s} · {tallies[s]}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="seo-error">
            {error}
          </div>
        )}

        <section data-testid="seo-list">
          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-white/40 italic">
              {targets.length === 0
                ? 'No SEO targets yet. Add one above to start tracking.'
                : 'No targets match that filter.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((t) => (
                <li
                  key={t.id}
                  data-testid={`seo-target-${t.id}`}
                  className="group rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    <StatusBadge status={t.status} />
                    <h3 className="text-sm font-semibold text-white flex-1 truncate">{t.target_keyword}</h3>
                    <span className="text-[11px] text-white/35">checked {formatWhen(t.last_checked_at)}</span>
                  </div>
                  {t.target_url && (
                    <p className="text-[11px] text-white/55 font-mono truncate" title={t.target_url}>
                      {t.target_url}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-white/55">
                    <span>
                      Rank: <strong className="text-white/85">{t.current_rank ?? '—'}</strong>
                      {t.target_rank ? ` / target ${t.target_rank}` : ''}
                    </span>
                    {t.notes && <span className="text-white/40">· {t.notes}</span>}
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                      <select
                        value={t.status}
                        onChange={(e) => setStatus(t.id, e.target.value as Status)}
                        className="bg-white/[0.04] border border-white/[0.1] rounded px-1.5 py-0.5 text-[11px] text-white/85 outline-none"
                        data-testid={`seo-target-${t.id}-status`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => archiveTarget(t.id)}
                        className="text-[11px] text-white/40 hover:text-rose-300"
                        data-testid={`seo-target-${t.id}-archive`}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>{visible.length} of {targets.length} target{targets.length === 1 ? '' : 's'}</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
