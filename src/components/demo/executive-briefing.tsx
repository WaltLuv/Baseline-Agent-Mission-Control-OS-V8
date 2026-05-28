'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useDemoMode } from './demo-mode-provider'
import { ShareBriefingButton } from './share-briefing-button'
import { CountUp } from '@/components/motion/count-up'
import { MetricTooltip } from '@/components/ui/metric-tooltip'

interface LiveBriefing {
  briefingHeadline: string
  dailyWins: { title: string; impact: string; valueUsd: number }[]
  attentionItems: { title: string; severity: 'low' | 'medium' | 'high'; reason: string }[]
  valueCreatedMonthUsd: number
  hoursSavedMonth: number
  creditsUsedMonth: number
  topEmployee: { name: string; impact: string } | null
  highestRoiEmployee?: { name: string; impact: string } | null
  overloadedEmployee?: { name: string; impact: string } | null
  blockedAwaitingApprovalCount?: number
  memoryCitations?: { id: number; title: string; rationale: string | null; createdAt: number }[]
  nextAction: { label: string; href: string }
}

/**
 * Executive Morning Briefing — the first thing a business owner reads when
 * they open Mission Control. Answers in 60 seconds:
 *   - what happened today?
 *   - what needs attention?
 *   - what created value?
 *   - what should I do next?
 *
 * In demo mode (`?demo=cpa` etc.) this is populated from `demo-narratives.ts`
 * so prospects see an activated workforce instantly.
 *
 * In live mode (no demo overlay) we fetch real metrics from `/api/briefing`
 * — today's wins, attention items, workforce labor value created this month,
 * top AI employee, and the recommended next action.
 */
export function ExecutiveBriefing() {
  const { active, narrative } = useDemoMode()
  const [live, setLive] = useState<LiveBriefing | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (active) return // demo overlay handles its own data
    let cancelled = false
    fetch('/api/briefing')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setLive(data as LiveBriefing)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [active])

  // ---------- DEMO MODE ----------
  if (active && narrative) {
    return (
      <BriefingCard
        testId="executive-briefing"
        headlineEyebrow={`Your COO briefing — ${formatToday()} · Demo`}
        headline={narrative.briefingHeadline}
        subheadline={`Operating as ${narrative.template.icon} ${narrative.template.name}`}
        valueLabel="Value created · this month"
        valueUsd={narrative.valueCreatedMonthUsd}
        hoursSaved={narrative.hoursSavedMonth}
        dailyWins={narrative.dailyWins}
        attentionItems={narrative.attentionItems}
        topEmployee={narrative.topEmployee}
        nextAction={narrative.nextAction}
      />
    )
  }

  // ---------- LIVE MODE, REAL DATA ----------
  if (loaded && live && (live.dailyWins.length > 0 || live.attentionItems.length > 0 || live.creditsUsedMonth > 0)) {
    return (
      <BriefingCard
        testId="executive-briefing-live"
        headlineEyebrow={`Your COO briefing — ${formatToday()}`}
        headline={live.briefingHeadline}
        subheadline={`${live.creditsUsedMonth.toLocaleString()} workforce credits used this month`}
        valueLabel="Value created · this month"
        valueUsd={live.valueCreatedMonthUsd}
        hoursSaved={live.hoursSavedMonth}
        dailyWins={live.dailyWins}
        attentionItems={live.attentionItems}
        topEmployee={live.topEmployee}
        highestRoiEmployee={live.highestRoiEmployee ?? null}
        overloadedEmployee={live.overloadedEmployee ?? null}
        blockedAwaitingApprovalCount={live.blockedAwaitingApprovalCount ?? 0}
        memoryCitations={live.memoryCitations ?? []}
        nextAction={live.nextAction}
      />
    )
  }

  // ---------- EMPTY STATE ----------
  return (
    <div
      data-testid="executive-briefing-empty"
      className="rounded-2xl border border-dashed border-border/60 bg-card/20 p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Your daily briefing
      </p>
      <p className="mt-2 text-sm text-foreground">
        As your AI workforce starts working, this is where you&apos;ll see what happened, what needs
        your attention, and what value was created today.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Tip: try Demo mode (top-right) to see what a fully active workforce looks like.
      </p>
    </div>
  )
}

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

interface BriefingCardProps {
  testId: string
  headlineEyebrow: string
  headline: string
  subheadline: string
  valueLabel: string
  valueUsd: number
  hoursSaved: number
  dailyWins: { title: string; impact: string; valueUsd: number }[]
  attentionItems: { title: string; severity: 'low' | 'medium' | 'high'; reason: string }[]
  topEmployee: { name: string; impact: string } | null
  highestRoiEmployee?: { name: string; impact: string } | null
  overloadedEmployee?: { name: string; impact: string } | null
  blockedAwaitingApprovalCount?: number
  memoryCitations?: { id: number; title: string; rationale: string | null; createdAt: number }[]
  nextAction: { label: string; href: string }
}

function BriefingCard({
  testId,
  headlineEyebrow,
  headline,
  subheadline,
  valueLabel,
  valueUsd,
  hoursSaved,
  dailyWins,
  attentionItems,
  topEmployee,
  highestRoiEmployee = null,
  overloadedEmployee = null,
  blockedAwaitingApprovalCount = 0,
  memoryCitations = [],
  nextAction,
}: BriefingCardProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 via-card/60 to-card/40 p-6 shadow-lg animate-in fade-in slide-in-from-top-2 duration-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {headlineEyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-foreground" data-testid="briefing-headline">
            {headline}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{subheadline}</p>
        </div>
        <div className="flex items-start gap-3">
          <ShareBriefingButton
            briefing={{
              headline,
              valueCreatedMonthUsd: valueUsd,
              hoursSavedMonth: hoursSaved,
              dailyWins,
              attentionItems,
              topEmployee,
              nextAction,
            }}
          />
          <div className="text-right" data-testid="briefing-value-counter">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MetricTooltip
                body="Estimated labor value created this month — workforce credits used × $4 (≈ 5 minutes of human work per credit at a $48/hr benchmark). This is what your AI workforce would cost in payroll."
              >
                {valueLabel}
              </MetricTooltip>
            </p>
            <p className="mt-0.5 text-3xl font-bold text-emerald-400">
              <CountUp to={valueUsd} prefix="$" data-testid="briefing-value-amount" />
            </p>
            <p className="text-xs text-muted-foreground">
              <MetricTooltip
                body="Operator hours your AI workforce gave back this month. We assume each workforce credit saves ~5 minutes of focused human work."
              >
                <CountUp to={hoursSaved} data-testid="briefing-hours-saved" /> hours saved
              </MetricTooltip>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/70" data-testid="briefing-last-updated">
              Updated {new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4" data-testid="briefing-wins">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <MetricTooltip body="Tasks your AI workforce closed in the last 24 hours. Each win is a unit of work that didn't need a human hand.">
              Today&apos;s wins ({dailyWins.length})
            </MetricTooltip>
          </p>
          {dailyWins.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No wins logged yet today. As your AI workforce closes work, it surfaces here.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {dailyWins.map((w, i) => (
                <li key={i} className="text-xs text-foreground/90">
                  <p className="font-medium">{w.title}</p>
                  <p className="text-muted-foreground">
                    {w.impact} · <span className="text-emerald-400">+${w.valueUsd.toLocaleString()}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 motion-safe:animate-[pulseSoft_3.6s_ease-in-out_infinite]"
          data-testid="briefing-attention"
          data-has-items={attentionItems.length > 0 ? 'true' : 'false'}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            <MetricTooltip body="Items the AI workforce paused on you — usually because a decision needs your authority, a compliance gate triggered, or a customer reply is needed. Clear these to keep work flowing.">
              Attention required ({attentionItems.length})
            </MetricTooltip>
          </p>
          {attentionItems.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nothing waiting on you right now. Your AI workforce is handling things.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {attentionItems.map((a, i) => (
                <li key={i} className="text-xs text-foreground/90">
                  <p className="font-medium flex items-center gap-1">
                    <span
                      className={
                        a.severity === 'high'
                          ? 'text-red-400'
                          : a.severity === 'medium'
                          ? 'text-amber-400'
                          : 'text-muted-foreground'
                      }
                    >
                      ●
                    </span>
                    {a.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5">{a.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 ring-1 ring-primary/10 transition-shadow hover:ring-primary/30" data-testid="briefing-top-employee">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            <MetricTooltip body="The AI employee with the most completed actions this week. Use this to spot who's carrying the load — and where you might want to hire a peer.">
              Star AI employee
            </MetricTooltip>
          </p>
          {topEmployee ? (
            <>
              <Link
                href={`/app/agents/${encodeURIComponent(topEmployee.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
                data-testid="briefing-top-employee-trace-link"
                className="mt-2 block text-sm font-semibold text-foreground hover:underline"
              >
                {topEmployee.name}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">{topEmployee.impact}</p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Your top performer of the week will show up here once activity rolls in.
            </p>
          )}
        </div>
      </div>

      {/* COO Daily Operating Report — v2 fields */}
      {(highestRoiEmployee || overloadedEmployee || blockedAwaitingApprovalCount > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="briefing-coo-report">
          {highestRoiEmployee && (
            <Link
              href={`/app/agents/${encodeURIComponent(highestRoiEmployee.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
              data-testid="briefing-highest-roi"
              className="block rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 transition-colors hover:border-emerald-500/50"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Highest ROI employee
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{highestRoiEmployee.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{highestRoiEmployee.impact}</p>
            </Link>
          )}
          {overloadedEmployee && (
            <Link
              href={`/app/agents/${encodeURIComponent(overloadedEmployee.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
              data-testid="briefing-overloaded"
              className="block rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 transition-colors hover:border-amber-500/50"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Most overloaded employee
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{overloadedEmployee.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{overloadedEmployee.impact}</p>
            </Link>
          )}
          {blockedAwaitingApprovalCount > 0 && (
            <Link
              href="/app/approvals"
              data-testid="briefing-blocked-approvals"
              className="block rounded-xl border border-red-500/30 bg-red-500/5 p-3 transition-colors hover:border-red-500/50"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                Blocked awaiting approval
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{blockedAwaitingApprovalCount}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Tasks paused until you approve. Review now to unblock.
              </p>
            </Link>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What you should do next
          </p>
          <p className="mt-1 text-sm text-foreground">{nextAction.label}</p>
        </div>
        <Link
          href={nextAction.href}
          data-testid="briefing-next-action"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go →
        </Link>
      </div>

      {memoryCitations.length > 0 && (
        <div
          data-testid="briefing-memory-citations"
          className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/90">
            From your Operator Memory · Baseline OS
          </p>
          <ul className="mt-1.5 space-y-1">
            {memoryCitations.map((c) => (
              <li key={c.id} className="text-[11px] text-foreground/90">
                <Link
                  href={`/app/memory-feed?id=${c.id}`}
                  data-testid={`briefing-memory-citation-${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.title}
                </Link>
                {c.rationale && (
                  <span className="ml-1 text-muted-foreground italic">{c.rationale}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Mission Control surfaced this briefing using context from your Obsidian vault. Open the
            Memory Feed to audit which notes were used.
          </p>
        </div>
      )}
    </div>
  )
}
