'use client'

import { useEffect, useState } from 'react'
import { useRefreshConfig } from '@/lib/refresh-prefs'

/**
 * Workforce Memory Feed — operator-visible "what your AI workforce is
 * learning about your business" panel.
 *
 * Renders entries from `/api/workforce/memory`:
 *   - employee hires
 *   - skill installs
 *   - decisions ("Adjusted follow-up cadence after low response rate.")
 *   - learnings ("Owner prefers summary-first reports.")
 *   - rationales ("Why this recommendation was made")
 *
 * Used by:
 *   - `/app/memory-feed` standalone panel
 *   - the AI Employee detail drawer (passes `agentSlug` to scope to one employee)
 *
 * Background refresh respects the global RefreshConfigProvider — quiet
 * 2-minute cadence by default, paused while a modal/form is active.
 */
interface MemoryItem {
  id: number
  agentSlug: string | null
  agentId: number | null
  kind: string
  title: string
  detail: string | null
  rationale: string | null
  valueImpactCents: number
  createdAt: number
}

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  'employee-hired': { label: 'Hired', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/5' },
  'skill-installed': { label: 'Skill installed', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/5' },
  'decision': { label: 'Decision', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/5' },
  'learning': { label: 'Learned', tone: 'text-primary border-primary/30 bg-primary/5' },
  'recommendation': { label: 'Recommended', tone: 'text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/5' },
  'baseline-os.optimization': { label: 'Baseline OS · Optimization', tone: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/5' },
  'operator-memory.obsidian': { label: 'Operator Memory · Obsidian', tone: 'text-primary border-primary/40 bg-primary/10' },
}

function relativeTime(ts: number): string {
  const sec = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export function WorkforceMemoryFeed({ agentSlug, limit = 25 }: { agentSlug?: string; limit?: number }) {
  const refresh = useRefreshConfig()
  const [items, setItems] = useState<MemoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const url = agentSlug
          ? `/api/workforce/memory?agentSlug=${encodeURIComponent(agentSlug)}&limit=${limit}`
          : `/api/workforce/memory?limit=${limit}`
        const r = await fetch(url, { credentials: 'include' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const data = await r.json()
        if (!cancelled) setItems(data.items ?? [])
      } catch (e) {
        if (!cancelled) setError(String(e).slice(0, 150))
      }
    }
    load()
    const unsubManual = refresh.onManualRefresh(load)
    const interval = setInterval(() => {
      if (!refresh.enabled || refresh.interactionLocked) return
      if (typeof document !== 'undefined' && document.hidden) return
      load()
    }, Math.max(60_000, refresh.intervalMs))
    return () => {
      cancelled = true
      unsubManual()
      clearInterval(interval)
    }
  }, [agentSlug, limit, refresh])

  return (
    <section data-testid="workforce-memory-feed" className="rounded-2xl border border-border/40 bg-card/30 p-5">
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Workforce Memory
        </p>
        <h2 className="mt-1 text-base font-bold text-foreground">
          What your AI workforce is learning about your business
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Decisions, learnings, and the rationale behind every recommendation — so you can trust the work.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
          Couldn&apos;t load memory feed: {error}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/40 bg-card/20 p-6 text-center text-xs text-muted-foreground">
          <p>No memory entries yet.</p>
          <p className="mt-1">
            As you hire AI employees and they take action, their learnings, decisions, and
            rationales will appear here.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <ol className="space-y-2.5" data-testid="memory-feed-list">
          {items.map((it) => {
            const meta = KIND_LABEL[it.kind] ?? { label: it.kind, tone: 'text-muted-foreground border-border/40 bg-card/30' }
            return (
              <li
                key={it.id}
                data-testid={`memory-item-${it.id}`}
                className="rounded-lg border border-border/40 bg-card/20 p-3 transition-colors hover:border-border/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${meta.tone}`}>
                        {meta.label}
                      </span>
                      {it.agentSlug && (
                        <span className="text-[10px] text-muted-foreground">{it.agentSlug}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{it.title}</p>
                    {it.detail && <p className="mt-0.5 text-xs text-muted-foreground">{it.detail}</p>}
                    {it.rationale && (
                      <p className="mt-1 text-[11px] italic text-muted-foreground">
                        Why: {it.rationale}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(it.createdAt)}</span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
