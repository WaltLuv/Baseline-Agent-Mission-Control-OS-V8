'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/personas — full persona roster for the workspace.
//
// Differs from `/app/agents` (runtime view): this page shows the
// persona-level metadata (division, role, who-they-report-to, bio) and
// whether each one has been hired. Runtime agents page shows live status,
// heartbeat, runtime type.
// ─────────────────────────────────────────────────────────────────────

interface Persona {
  slug: string
  name: string
  division: string
  role: string
  outcome: string
  for_whom: string
  reports_to: string | null
  manages: string[]
  hired: boolean
  hired_at: number | null
  agent_id: number | null
  agent_status: string | null
}

interface Payload {
  personas: Persona[]
  totals: { catalogue: number; hired: number }
  divisions: string[]
}

function formatWhen(unix: number | null): string {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

type Filter = 'all' | 'hired' | 'available'

export default function PersonasPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const fetchPayload = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/personas', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPayload((await res.json()) as Payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load personas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPayload() }, [fetchPayload])

  const byDivision = useMemo(() => {
    if (!payload) return new Map<string, Persona[]>()
    const q = search.trim().toLowerCase()
    const groups = new Map<string, Persona[]>()
    for (const d of payload.divisions) groups.set(d, [])
    for (const p of payload.personas) {
      if (filter === 'hired' && !p.hired) continue
      if (filter === 'available' && p.hired) continue
      if (q && !(
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.outcome.toLowerCase().includes(q) ||
        p.division.toLowerCase().includes(q)
      )) continue
      const list = groups.get(p.division) ?? []
      list.push(p)
      groups.set(p.division, list)
    }
    return groups
  }, [payload, filter, search])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="personas-page">
      <div className="mx-auto max-w-screen-lg px-6 py-10">
        <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-[11px] font-medium text-violet-300 uppercase tracking-wider mb-3">
              Mission Control · Personas
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Personas</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
              The full persona roster — every AI employee available to your workspace, with bio,
              division, and reporting relationships. Hire from the marketplace; persons are free.
            </p>
          </div>
          <Button size="sm" onClick={() => (window.location.href = '/marketplace')} data-testid="personas-marketplace-cta">
            Browse roster
          </Button>
        </header>

        {/* Totals + filter */}
        <section className="mb-5 grid grid-cols-2 gap-3" data-testid="personas-totals">
          <button
            onClick={() => setFilter(filter === 'hired' ? 'all' : 'hired')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              filter === 'hired' || filter === 'all' ? 'border-white/15 bg-white/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'
            }`}
            data-testid="personas-total-hired"
          >
            <div className="text-[11px] uppercase tracking-wider text-white/40">Hired</div>
            <div className="text-2xl font-bold font-mono mt-1">{payload?.totals.hired ?? '—'}</div>
          </button>
          <button
            onClick={() => setFilter(filter === 'available' ? 'all' : 'available')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              filter === 'available' || filter === 'all' ? 'border-white/15 bg-white/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'
            }`}
            data-testid="personas-total-catalogue"
          >
            <div className="text-[11px] uppercase tracking-wider text-white/40">In catalogue</div>
            <div className="text-2xl font-bold font-mono mt-1">{payload?.totals.catalogue ?? '—'}</div>
          </button>
        </section>

        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, division, outcome…"
            className="flex-1 bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20 placeholder-white/35"
            data-testid="personas-search"
          />
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-[11px] text-white/45 hover:text-white/85">
              Show all
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="personas-error">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : !payload ? null : (
          payload.divisions.map((division) => {
            const list = byDivision.get(division) ?? []
            if (list.length === 0) return null
            return (
              <section
                key={division}
                data-testid={`personas-division-${division.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                className="mb-8"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                  {division} · {list.length}
                </h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {list.map((p) => (
                    <li
                      key={p.slug}
                      data-testid={`persona-${p.slug}`}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <h3 className="text-base font-semibold text-white">{p.name}</h3>
                        {p.hired ? (
                          <span className="text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            Hired
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 bg-white/[0.04] text-white/55 border border-white/[0.08]">
                            Available
                          </span>
                        )}
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Free</span>
                      </div>
                      <p className="text-xs text-white/55">{p.role}</p>
                      <p className="mt-2 text-xs text-white/65 leading-relaxed">{p.outcome}</p>
                      <p className="mt-2 text-[11px] text-white/40">For: {p.for_whom}</p>
                      {(p.reports_to || (p.manages && p.manages.length > 0)) && (
                        <p className="mt-1 text-[11px] text-white/40">
                          {p.reports_to ? <>Reports to <span className="font-mono">{p.reports_to}</span></> : null}
                          {p.reports_to && p.manages.length > 0 ? ' · ' : null}
                          {p.manages.length > 0 ? <>Manages {p.manages.length}</> : null}
                        </p>
                      )}
                      {p.hired && p.hired_at && (
                        <p className="mt-2 text-[10px] text-white/35">
                          Hired {formatWhen(p.hired_at)}
                          {p.agent_status ? ` · ${p.agent_status}` : ''}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>{payload ? `${payload.totals.hired} of ${payload.totals.catalogue} personas hired` : ''}</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
