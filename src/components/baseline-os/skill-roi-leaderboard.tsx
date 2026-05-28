'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface SkillLeader {
  slug: string
  label: string
  valueUsdThisMonth: number
  uses: number
  employees: string[]
  primaryEmployeeSlug: string | null
  state: 'active' | 'warning' | 'inactive' | 'proven'
  trend: 'up' | 'flat' | 'down'
}

/**
 * Compact ROI leaderboard — top 3 value-creating skills this month.
 *
 * Calm, executive-grade, no gamification. Each row deep-links to the
 * trace of the primary employee using that skill so the operator can
 * inspect the actual work in one click.
 *
 * Empty-honest: renders nothing if no skill has produced measurable
 * value yet (never fabricates).
 */
export function SkillRoiLeaderboard() {
  const [leaders, setLeaders] = useState<SkillLeader[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/baseline-os/skill-leaderboard?limit=3', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { leaders: [] }))
      .then((d) => {
        if (!cancelled) setLeaders(d.leaders ?? [])
      })
      .catch(() => {
        if (!cancelled) setLeaders([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!leaders || leaders.length === 0) return null

  return (
    <section
      data-testid="skill-roi-leaderboard"
      className="rounded-2xl border border-border/40 bg-card/30 p-5"
    >
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Top Value Skills · This month
        </p>
        <h3 className="mt-1 text-sm font-semibold text-foreground">
          Where the workforce is creating the most value
        </h3>
      </header>
      <ol className="space-y-2">
        {leaders.map((s, i) => (
          <li
            key={s.slug}
            data-testid={`skill-roi-row-${s.slug}`}
            className="flex items-start gap-3 rounded-lg border border-border/30 bg-card/40 p-3"
          >
            <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/40 text-[11px] font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  <Link
                    href={`/app/skills/${encodeURIComponent(s.slug)}`}
                    className="hover:underline"
                    data-testid={`skill-roi-link-${s.slug}`}
                  >
                    {s.label}
                  </Link>
                  {s.state === 'proven' && (
                    <span
                      data-testid={`skill-proven-badge-${s.slug}`}
                      className="ml-2 inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary"
                    >
                      Proven capability
                    </span>
                  )}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    s.valueUsdThisMonth > 0 ? 'text-emerald-300' : 'text-muted-foreground'
                  }`}
                >
                  ${s.valueUsdThisMonth.toLocaleString()}
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {s.uses} activations
                {s.employees.length > 0 && (
                  <>
                    {' · used by '}
                    {s.employees.slice(0, 3).map((name, idx) => (
                      <span key={name}>
                        {idx > 0 && ', '}
                        <Link
                          href={`/app/agents/${encodeURIComponent(
                            name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                          )}/trace`}
                          className="text-foreground hover:underline"
                        >
                          {name}
                        </Link>
                      </span>
                    ))}
                  </>
                )}
                {s.trend !== 'flat' && (
                  <span
                    className={`ml-2 text-[10px] uppercase ${
                      s.trend === 'up' ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {s.trend === 'up' ? '↑ trending up' : '↓ slowing'}
                  </span>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
