'use client'

import { useDemoMode } from './demo-mode-provider'

/**
 * Executive Morning Briefing — the first thing a business owner reads when
 * they open Mission Control. Answers in 60 seconds:
 *   - what happened today?
 *   - what needs attention?
 *   - what created value?
 *   - what should I do next?
 *
 * In demo mode this is fully populated from `demo-narratives.ts`. In live
 * mode (no demo overlay), we surface a friendly empty state until the
 * workforce produces real activity.
 */
export function ExecutiveBriefing() {
  const { active, narrative } = useDemoMode()
  if (!active || !narrative) {
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

  return (
    <div
      data-testid="executive-briefing"
      className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 via-card/60 to-card/40 p-6 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Your COO briefing — {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-foreground" data-testid="briefing-headline">
            {narrative.briefingHeadline}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Operating as <span className="font-semibold text-foreground">{narrative.template.icon} {narrative.template.name}</span>
          </p>
        </div>
        <div className="text-right" data-testid="briefing-value-counter">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value created · this month</p>
          <p className="mt-0.5 text-3xl font-bold text-emerald-400">
            ${narrative.valueCreatedMonthUsd.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">{narrative.hoursSavedMonth} hours saved</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {/* Daily Wins */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4" data-testid="briefing-wins">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Today&apos;s wins</p>
          <ul className="mt-2 space-y-2">
            {narrative.dailyWins.map((w, i) => (
              <li key={i} className="text-xs text-foreground/90">
                <p className="font-medium">{w.title}</p>
                <p className="text-muted-foreground">{w.impact} · <span className="text-emerald-400">+${w.valueUsd.toLocaleString()}</span></p>
              </li>
            ))}
          </ul>
        </div>

        {/* Attention Required */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="briefing-attention">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Attention required ({narrative.attentionItems.length})
          </p>
          <ul className="mt-2 space-y-2">
            {narrative.attentionItems.map((a, i) => (
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
        </div>

        {/* MVP Employee */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4" data-testid="briefing-top-employee">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Star AI employee</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{narrative.topEmployee.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{narrative.topEmployee.impact}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What you should do next
          </p>
          <p className="mt-1 text-sm text-foreground">{narrative.nextAction.label}</p>
        </div>
        <a
          href={narrative.nextAction.href}
          data-testid="briefing-next-action"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go →
        </a>
      </div>
    </div>
  )
}
