'use client'

import { useEffect, useState } from 'react'
import { useRefreshConfig } from '@/lib/refresh-prefs'
import { MetricTooltip } from '@/components/ui/metric-tooltip'

const DIM_RATIONALE: Record<string, string> = {
  'execution-health': 'Are tasks actually closing? Drops when work piles up in draft / blocked.',
  'responsiveness': 'Are AI employees acting on heartbeats? A low score means workers are idle when work is queued.',
  'workload-balance': 'Is work spread sensibly? A 100% score with one busy employee means you need a peer.',
  'cost-efficiency': 'Credits per closed action. Low score = the workforce is spinning expensive cycles for thin output.',
  'quality': 'Approvals + needs-review backlog. High = consistent output you can trust; low = humans gatekeeping too often.',
  'memory-continuity': 'Is the workforce learning? Drops when no decisions / rationales are being captured.',
  'automation-reliability': 'Error / failure rate across recent events. Low = the workforce is humming, not erroring.',
  'customer-experience': 'How many customer-facing items are blocked or SLA-at-risk. Low = customers are waiting.',
}

/**
 * Workforce Health Score v2 — 8-dimension breakdown.
 *
 * Pulls from `/api/baseline-os/workforce-health` (computed by Baseline OS,
 * displayed by Mission Control). Each dimension shows score, trend, the
 * cause ("Why changed"), and a recommended fix when the score is low.
 *
 * Designed for the dashboard left rail or a standalone /app/health page.
 */
interface Dimension {
  key: string
  label: string
  score: number
  trend: 'up' | 'flat' | 'down'
  whyChanged: string
  fix?: string
}
interface HealthResp {
  overall: number
  overallTrend: 'up' | 'flat' | 'down'
  headline: string
  dimensions: Dimension[]
  computedAt: number
  computedBy: string
}

const TREND: Record<Dimension['trend'], { icon: string; tone: string }> = {
  up:   { icon: '↑', tone: 'text-emerald-400' },
  flat: { icon: '→', tone: 'text-amber-400' },
  down: { icon: '↓', tone: 'text-red-400' },
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
  if (score >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/5'
  return 'text-red-400 border-red-500/30 bg-red-500/5'
}

export function WorkforceHealthV2() {
  const refresh = useRefreshConfig()
  const [data, setData] = useState<HealthResp | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/baseline-os/workforce-health', { credentials: 'include' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        if (!cancelled) setData(j as HealthResp)
      } catch (e) {
        if (!cancelled) setError(String(e).slice(0, 150))
      }
    }
    load()
    const unsub = refresh.onManualRefresh(load)
    const id = setInterval(() => {
      if (!refresh.enabled || refresh.interactionLocked) return
      if (typeof document !== 'undefined' && document.hidden) return
      load()
    }, Math.max(120_000, refresh.intervalMs))
    return () => { cancelled = true; unsub(); clearInterval(id) }
  }, [refresh])

  if (error) {
    return (
      <section data-testid="workforce-health-v2-error" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">
        Couldn&apos;t load workforce health: {error}
      </section>
    )
  }
  if (!data) {
    return (
      <section data-testid="workforce-health-v2-loading" className="rounded-2xl border border-border/40 bg-card/30 p-5 text-sm text-muted-foreground">
        Loading workforce health…
      </section>
    )
  }

  return (
    <section data-testid="workforce-health-v2" className="rounded-2xl border border-border/40 bg-card/30 p-5">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
            Baseline OS · Workforce Health
          </p>
          <h2 className="mt-1 text-base font-bold text-foreground">{data.headline}</h2>
        </div>
        <div data-testid="workforce-health-overall" className={`shrink-0 rounded-xl border px-3 py-2 text-center ${scoreTone(data.overall)}`}>
          <MetricTooltip body="Composite of all 8 sub-dimensions, weighted by what matters for an operator running an AI workforce. A score below 60 means it's time to act today.">
            <div className="text-2xl font-bold">{data.overall}</div>
          </MetricTooltip>
          <div className="text-[10px] uppercase tracking-wider opacity-80">Overall {TREND[data.overallTrend].icon}</div>
        </div>
      </header>

      <ul className="grid gap-2 sm:grid-cols-2" data-testid="workforce-health-dimensions">
        {data.dimensions.map((d) => (
          <li
            key={d.key}
            data-testid={`workforce-health-dim-${d.key}`}
            className="rounded-lg border border-border/40 bg-card/20 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                <MetricTooltip body={DIM_RATIONALE[d.key] ?? 'Baseline OS sub-dimension contributing to the overall workforce health score.'}>
                  {d.label}
                </MetricTooltip>
              </p>
              <span className={`inline-flex items-center gap-1 text-sm font-bold ${TREND[d.trend].tone}`}>
                {d.score} <span>{TREND[d.trend].icon}</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{d.whyChanged}</p>
            {d.fix && (
              <p className="mt-1 text-[11px] text-primary">
                Recommended: {d.fix}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Computed by Baseline OS · displayed by Mission Control · last updated{' '}
        {new Date(data.computedAt * 1000).toLocaleTimeString()}.
      </p>
    </section>
  )
}
