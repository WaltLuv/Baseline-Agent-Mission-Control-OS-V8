'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/library — workspace inventory across skills, employees,
// workflows. Read-only; "Browse marketplace" CTA goes to the public
// marketplace where install/hire actions live.
// ─────────────────────────────────────────────────────────────────────

interface SkillRow {
  id: number
  slug: string
  name: string
  category: string
  price_cents: number
  installed_at: number
}

interface WorkflowRow extends SkillRow {}

interface EmployeeRow {
  subscription_id: number
  employee_slug: string
  status: string
  started_at: number
  monthly_cents: number
  agent_id: number | null
  agent_name: string | null
  agent_role: string | null
  agent_status: string | null
}

interface LibraryPayload {
  skills: SkillRow[]
  workflows: WorkflowRow[]
  employees: EmployeeRow[]
  totals: { skills: number; workflows: number; employees: number }
}

function formatWhen(unix: number): string {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatPrice(cents: number, suffix?: string): string {
  if (!cents) return 'Free'
  return `$${(cents / 100).toFixed(0)}${suffix ?? ''}`
}

type Tab = 'all' | 'skills' | 'employees' | 'workflows'

export default function LibraryPage() {
  const [payload, setPayload] = useState<LibraryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const fetchPayload = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/library', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as LibraryPayload
      setPayload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load library')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPayload() }, [fetchPayload])

  const filtered = useMemo(() => {
    if (!payload) return { skills: [], workflows: [], employees: [] }
    const q = search.trim().toLowerCase()
    const match = (s: string) => !q || s.toLowerCase().includes(q)
    return {
      skills: payload.skills.filter((s) => match(s.name) || match(s.slug) || match(s.category)),
      workflows: payload.workflows.filter((w) => match(w.name) || match(w.slug) || match(w.category)),
      employees: payload.employees.filter(
        (e) => match(e.employee_slug) || match(e.agent_name ?? '') || match(e.agent_role ?? ''),
      ),
    }
  }, [payload, search])

  const showSkills = tab === 'all' || tab === 'skills'
  const showWorkflows = tab === 'all' || tab === 'workflows'
  const showEmployees = tab === 'all' || tab === 'employees'

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="library-page">
      <div className="mx-auto max-w-screen-lg px-6 py-10">
        <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-medium text-amber-300 uppercase tracking-wider mb-3">
              Mission Control · Library
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Your Library</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
              Every skill, employee, and workflow installed in this workspace. Read-only
              inventory — install or hire new items from the marketplace.
            </p>
          </div>
          <Button size="sm" onClick={() => (window.location.href = '/marketplace')} data-testid="library-browse-cta">
            Browse marketplace
          </Button>
        </header>

        {/* Totals */}
        <section className="mb-6 grid grid-cols-3 gap-3" data-testid="library-totals">
          {(['skills', 'workflows', 'employees'] as const).map((k) => (
            <div
              key={k}
              data-testid={`library-total-${k}`}
              className={`rounded-xl border p-4 transition-colors cursor-pointer ${
                tab === k || tab === 'all' ? 'border-white/15 bg-white/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'
              }`}
              onClick={() => setTab(tab === k ? 'all' : k)}
            >
              <div className="text-[11px] uppercase tracking-wider text-white/40">{k}</div>
              <div className="text-2xl font-bold font-mono mt-1">
                {payload ? payload.totals[k] : '—'}
              </div>
            </div>
          ))}
        </section>

        {/* Search */}
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, role, category…"
            className="flex-1 bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20 placeholder-white/35"
            data-testid="library-search"
          />
          {tab !== 'all' && (
            <button
              onClick={() => setTab('all')}
              className="text-[11px] text-white/45 hover:text-white/85"
            >
              Show all
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="library-error">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : !payload ? null : (
          <>
            {showSkills && (
              <section className="mb-8" data-testid="library-section-skills">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                  Skills · {filtered.skills.length}
                </h2>
                {filtered.skills.length === 0 ? (
                  <p className="text-xs text-white/40 italic">
                    {payload.totals.skills === 0 ? 'No skills installed yet. Install one from the marketplace.' : 'No matches.'}
                  </p>
                ) : (
                  <ul className="grid gap-2 md:grid-cols-2">
                    {filtered.skills.map((s) => (
                      <li
                        key={s.id}
                        data-testid={`library-skill-${s.slug}`}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white truncate flex-1">{s.name}</h3>
                          <span className="text-[10px] text-white/45 font-mono">{formatPrice(s.price_cents)}</span>
                        </div>
                        <p className="text-[11px] text-white/40">
                          {s.category} · installed {formatWhen(s.installed_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {showWorkflows && (
              <section className="mb-8" data-testid="library-section-workflows">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                  Workflows · {filtered.workflows.length}
                </h2>
                {filtered.workflows.length === 0 ? (
                  <p className="text-xs text-white/40 italic">
                    {payload.totals.workflows === 0
                      ? 'No paid workflows installed yet. Free workflows ship with workforce templates.'
                      : 'No matches.'}
                  </p>
                ) : (
                  <ul className="grid gap-2 md:grid-cols-2">
                    {filtered.workflows.map((w) => (
                      <li
                        key={w.id}
                        data-testid={`library-workflow-${w.slug}`}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white truncate flex-1">{w.name}</h3>
                          <span className="text-[10px] text-white/45 font-mono">{formatPrice(w.price_cents)}</span>
                        </div>
                        <p className="text-[11px] text-white/40">{w.category}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {showEmployees && (
              <section data-testid="library-section-employees">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                  Employees · {filtered.employees.length}
                </h2>
                {filtered.employees.length === 0 ? (
                  <p className="text-xs text-white/40 italic">
                    {payload.totals.employees === 0 ? 'No employees hired yet. Employees are free — pick one from the marketplace.' : 'No matches.'}
                  </p>
                ) : (
                  <ul className="grid gap-2 md:grid-cols-2">
                    {filtered.employees.map((e) => (
                      <li
                        key={e.subscription_id}
                        data-testid={`library-employee-${e.employee_slug}`}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white truncate flex-1">
                            {e.agent_name || e.employee_slug}
                          </h3>
                          <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Free</span>
                        </div>
                        <p className="text-[11px] text-white/40">
                          {e.agent_role || '—'} · hired {formatWhen(e.started_at)}
                          {e.agent_status ? ` · ${e.agent_status}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>
            Total: {payload?.totals.skills ?? 0} skills · {payload?.totals.workflows ?? 0} workflows · {payload?.totals.employees ?? 0} employees
          </span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
