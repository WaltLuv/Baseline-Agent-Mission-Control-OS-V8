'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ValueReport } from '@/lib/value-report/aggregator'

/**
 * <ValueReportPanel /> — "Show your boss" page.
 *
 * One screen answering: "Is this workforce paying for itself?"
 * Lifetime numbers, clear hero, per-persona breakdown, weekly trend,
 * cost basis disclosure. Customer-facing copy, no jargon.
 *
 * Lane: consumer experience only. The aggregator backing /api/value-report
 * is a Mission Control fallback today; Baseline OS will replace the
 * payload via the BASELINE_OS_VALUE_REPORT_URL proxy hook.
 */

export function ValueReportPanel() {
  const [report, setReport] = useState<ValueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/value-report', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as ValueReport
        if (!cancelled) setReport(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load value report')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="p-8" data-testid="value-report" data-state="loading">
        <p className="text-sm text-white/55">Loading value report…</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="p-8" data-testid="value-report" data-state="error">
        <p className="text-sm text-rose-300">Could not load value report{error ? ': ' + error : ''}.</p>
      </div>
    )
  }

  if (report.empty_state) {
    return (
      <div className="max-w-4xl mx-auto p-8" data-testid="value-report" data-state="empty">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono">
            Value · Show your boss
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
            {report.empty_state.headline}
          </h1>
          <p className="mt-2 text-white/65 leading-relaxed">{report.empty_state.detail}</p>
        </header>
        <Link
          href={report.empty_state.cta_url}
          data-testid="value-empty-cta"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90"
        >
          {report.empty_state.cta_label}
        </Link>
      </div>
    )
  }

  const lt = report.lifetime
  const showCost = lt.workforce_cost_usd > 0

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6" data-testid="value-report" data-state="ready" data-source={report.source}>
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono">
            Value · Show your boss
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            Your {report.workforce_vertical} workforce has saved an estimated{' '}
            <span className="text-emerald-300" data-testid="value-hero-hours">
              {lt.estimated_hours_saved}h
            </span>
            .
          </h1>
          <p className="mt-2 text-white/65 leading-relaxed flex items-center gap-2 flex-wrap">
            <span>{report.date_range.label} · Source: {report.source === 'baseline-os' ? 'Baseline OS' : 'Mission Control'}</span>
            {report.source === 'baseline-os' && (
              <span
                data-testid="trust-pill"
                title="These numbers come from the same engine that ran the work — same formula across Daily Brief and this page."
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-200 text-[10px] uppercase tracking-wider font-mono"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Verified by Baseline OS
              </span>
            )}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="value-hero-tiles">
        <ValueHero
          label="Estimated labor value created"
          value={`$${lt.estimated_labor_value_usd.toLocaleString()}`}
          sublabel={`${lt.estimated_hours_saved}h × $${report.cost_basis.labor_rate_usd_per_hour}/h`}
          tone="positive"
          testid="hero-value"
        />
        <ValueHero
          label="Tasks completed"
          value={lt.tasks_completed.toLocaleString()}
          sublabel={`${lt.tasks_open} still open`}
          tone="neutral"
          testid="hero-tasks"
        />
        {showCost && lt.roi_multiple !== null ? (
          <ValueHero
            label="ROI multiple"
            value={`${lt.roi_multiple}×`}
            sublabel={`Cost $${lt.workforce_cost_usd.toLocaleString()} → value $${lt.estimated_labor_value_usd.toLocaleString()}`}
            tone={lt.roi_multiple >= 2 ? 'positive' : 'warn'}
            testid="hero-roi"
          />
        ) : (
          <ValueHero
            label="Proofs delivered"
            value={lt.proofs_delivered.toLocaleString()}
            sublabel="Auditable receipts for work done"
            tone="neutral"
            testid="hero-proofs"
          />
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6" data-testid="value-by-the-numbers">
        <p className="text-xs uppercase tracking-wider text-white/45 font-mono mb-3">By the numbers</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Tile label="Tasks completed" value={lt.tasks_completed} testid="num-tasks-completed" />
          <Tile label="Tasks still open" value={lt.tasks_open} testid="num-tasks-open" />
          <Tile label="Approvals handled" value={lt.approvals_handled} testid="num-approvals-handled" />
          <Tile label="Tool executions" value={lt.tool_executions} testid="num-tool-executions" />
          <Tile label="Proofs delivered" value={lt.proofs_delivered} testid="num-proofs-delivered" />
          <Tile
            label="Failed executions"
            value={lt.failed_executions}
            tone={lt.failed_executions > 0 ? 'warn' : 'neutral'}
            testid="num-failed-executions"
          />
        </div>
      </section>

      {report.by_persona.length > 0 && (
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6" data-testid="value-by-persona">
          <p className="text-xs uppercase tracking-wider text-white/45 font-mono mb-3">Per AI employee</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {report.by_persona.map((p) => (
              <Link
                key={p.agent_id}
                href={`/app/agents?focus=${encodeURIComponent(p.name)}`}
                data-testid={`value-persona-${p.agent_id}`}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.16]"
              >
                <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                <p className="text-[11px] text-violet-300/80 font-mono truncate">{p.role}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <SmallStat label="Done" value={p.completed} />
                  <SmallStat label="Hours" value={p.hours_saved} />
                  <SmallStat label="Value" value={`$${p.labor_value_usd.toLocaleString()}`} tone="positive" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6" data-testid="value-weekly-trend">
        <p className="text-xs uppercase tracking-wider text-white/45 font-mono mb-3">Weekly trend · last 8 weeks</p>
        <WeeklyBars data={report.weekly_trend} />
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5" data-testid="value-cost-basis">
        <p className="text-xs uppercase tracking-wider text-white/45 font-mono mb-2">How we calculated this</p>
        <p className="text-sm text-white/75 leading-relaxed">
          Hours saved = <code className="text-violet-200">{report.cost_basis.formula}</code>
        </p>
        <p className="text-xs text-white/45 mt-2 leading-relaxed">{report.cost_basis.notes}</p>
      </section>
    </div>
  )
}

function ValueHero({
  label,
  value,
  sublabel,
  tone,
  testid,
}: {
  label: string
  value: string
  sublabel: string
  tone: 'positive' | 'neutral' | 'warn'
  testid: string
}) {
  const valueTone =
    tone === 'positive' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-200' : 'text-white'
  return (
    <div
      data-testid={testid}
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-violet-500/[0.02] p-5"
    >
      <p className="text-xs uppercase tracking-wider text-white/45 font-mono">{label}</p>
      <p className={`mt-2 text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums ${valueTone}`}>{value}</p>
      <p className="mt-1 text-xs text-white/55 leading-snug">{sublabel}</p>
    </div>
  )
}

function Tile({
  label,
  value,
  tone = 'neutral',
  testid,
}: {
  label: string
  value: number
  tone?: 'neutral' | 'warn'
  testid: string
}) {
  const valueTone = tone === 'warn' ? 'text-rose-200' : 'text-white'
  return (
    <div
      data-testid={testid}
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
    >
      <p className={`text-xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
      <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{label}</p>
    </div>
  )
}

function SmallStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  tone?: 'neutral' | 'positive'
}) {
  const valueTone = tone === 'positive' ? 'text-emerald-300' : 'text-white'
  return (
    <div>
      <p className={`text-sm font-semibold ${valueTone}`}>{value}</p>
      <p className="text-[10px] text-white/45 mt-0.5">{label}</p>
    </div>
  )
}

function WeeklyBars({
  data,
}: {
  data: Array<{ week_start_iso: string; tasks_completed: number; hours_saved: number }>
}) {
  const max = Math.max(1, ...data.map((d) => d.hours_saved))
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((w) => {
        const h = Math.max(2, Math.round((w.hours_saved / max) * 100))
        const date = new Date(w.week_start_iso)
        const label = `${date.getMonth() + 1}/${date.getDate()}`
        return (
          <div key={w.week_start_iso} className="flex-1 flex flex-col items-center gap-1 group">
            <span className="text-[10px] text-white/55 font-mono tabular-nums">{w.hours_saved}h</span>
            <div className="w-full rounded-t bg-violet-500/30 group-hover:bg-violet-500/50 transition-colors" style={{ height: `${h}%` }} />
            <span className="text-[10px] text-white/35 font-mono">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
