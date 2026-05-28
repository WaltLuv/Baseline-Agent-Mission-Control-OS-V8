'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Recommendation {
  id: string
  title: string
  why: string
  expectedImpact: string
  confidence: 'low' | 'medium' | 'high'
  relatedEmployee: string | null
  relatedSkill: string | null
  actionLabel: string
  actionHref: string | null
}

interface ForecastRisk {
  id: string
  kind: string
  title: string
  watchFor: string
  recommendedPrevention: string
  confidence: 'low' | 'medium' | 'high'
  href: string | null
}

/**
 * Baseline OS recommendations + 7-day forecast surface.
 * Honest-empty: renders nothing when there's not enough signal.
 */
export function WorkforceOptimizationCard() {
  const [data, setData] = useState<{ recommendations: Recommendation[]; forecast: ForecastRisk[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/baseline-os/recommendations', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { recommendations: [], forecast: [] }))
      .then((d) => {
        if (!cancelled) setData({ recommendations: d.recommendations ?? [], forecast: d.forecast ?? [] })
      })
      .catch(() => {
        if (!cancelled) setData({ recommendations: [], forecast: [] })
      })
    return () => { cancelled = true }
  }, [])

  if (!data || (data.recommendations.length === 0 && data.forecast.length === 0)) return null

  return (
    <div className="space-y-3">
      {data.recommendations.length > 0 && (
        <section
          data-testid="workforce-recommendations"
          className="rounded-2xl border border-border/40 bg-card/30 p-5"
        >
          <header className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
              Baseline OS recommends
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">
              {data.recommendations.length} ways to improve your workforce
            </h3>
          </header>
          <ul className="space-y-2">
            {data.recommendations.map((r) => (
              <li
                key={r.id}
                data-testid={`workforce-recommendation-${r.id}`}
                className="rounded-lg border border-border/30 bg-card/40 p-3 text-[12px]"
              >
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                <p className="mt-0.5 text-muted-foreground">{r.why}</p>
                <p className="mt-1 text-foreground/80">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Expected impact ·
                  </span>{' '}
                  {r.expectedImpact}
                </p>
                {r.actionHref && (
                  <Link
                    href={r.actionHref}
                    className="mt-2 inline-block text-[11px] text-primary hover:underline"
                  >
                    {r.actionLabel} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.forecast.length > 0 && (
        <section
          data-testid="workforce-forecast"
          className="rounded-2xl border border-border/40 bg-card/30 p-5"
        >
          <header className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300">
              Likely risk next 7 days
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">Watch this week</h3>
          </header>
          <ul className="space-y-2">
            {data.forecast.map((r) => (
              <li
                key={r.id}
                data-testid={`workforce-forecast-${r.id}`}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[12px]"
              >
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                <p className="mt-0.5 text-muted-foreground">{r.watchFor}</p>
                <p className="mt-1 text-foreground/80">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Recommended prevention ·
                  </span>{' '}
                  {r.recommendedPrevention}
                </p>
                {r.href && (
                  <Link href={r.href} className="mt-2 inline-block text-[11px] text-primary hover:underline">
                    Open →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
