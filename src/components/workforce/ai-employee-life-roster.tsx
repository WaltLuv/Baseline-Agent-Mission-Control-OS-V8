'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useDemoMode } from '@/components/demo/demo-mode-provider'
import { setLastTouchedEmployee } from '@/lib/panel-continuity'
import {
  presenceLabel,
  presenceTone,
  confidenceTone,
  type AIEmployeeLifeSignal,
  type PresenceState,
} from '@/lib/ai-employee-life-signals'

/** Workforce life signal: a calm dot whose colour reflects presence and whose
 * subtle breath says "on shift". No strobe, no scale, opacity only — so layout
 * never reflows. Static under prefers-reduced-motion (handled in globals.css). */
function PresenceDot({ presence }: { presence: PresenceState }) {
  const tone =
    presence === 'working' || presence === 'online'
      ? 'bg-emerald-400'
      : presence === 'waiting-for-approval'
      ? 'bg-amber-300'
      : presence === 'blocked' || presence === 'needs-attention'
      ? 'bg-rose-300'
      : 'bg-sky-300'
  const breathing = presence === 'working' || presence === 'online'
  return (
    <span
      aria-hidden
      data-testid="life-roster-breath"
      data-presence={presence}
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${tone} ${breathing ? 'animate-[mcLifeBreathe_6s_ease-in-out_infinite]' : ''}`}
    />
  )
}

/**
 * AI Employee Life Roster — surfaces the workforce-in-motion on the
 * overview. Each card shows presence, current task, confidence, blocker,
 * recent win, and collaborators so the operator immediately sees the
 * workforce is doing something accountable right now.
 *
 * Driven by:
 *   - demo mode → narrative.lifeSignals (storyline-grade content)
 *   - live mode → `/api/agents/life-signals` (derived from real data)
 *
 * Calm, single-row, no animation churn. Cards are tappable to the
 * agent's profile for deep-link continuity.
 */
export function AIEmployeeLifeRoster() {
  const demo = useDemoMode()
  const [liveSignals, setLiveSignals] = useState<AIEmployeeLifeSignal[] | null>(null)

  useEffect(() => {
    if (demo.active) return // demo narrative supplies the signals
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/agents/life-signals', { credentials: 'include' })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setLiveSignals(j.signals ?? [])
      } catch {
        // calm fallback — no signals shown, no error toast
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [demo.active])

  const signals: AIEmployeeLifeSignal[] | null = demo.active
    ? demo.narrative?.lifeSignals ?? null
    : liveSignals

  if (!signals || signals.length === 0) return null

  return (
    <section
      data-testid="ai-employee-life-roster"
      className="rounded-2xl border border-border/40 bg-card/30 p-5"
    >
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          AI Workforce · live
        </p>
        <h2 className="mt-1 text-base font-bold text-foreground">
          Who is working on what right now
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Presence, current task, confidence, and blockers — derived from real
          activity, never faked.
        </p>
      </header>

      <ol
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="life-roster-list"
      >
        {signals.map((s) => (
          <li
            key={s.agentSlug}
            data-testid={`life-roster-item-${s.agentSlug}`}
            className="rounded-xl border border-border/40 bg-card/20 p-3 transition-colors hover:border-border/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <PresenceDot presence={s.presence} />
                <Link
                  href={`/app/agents/${encodeURIComponent(s.agentSlug)}/trace`}
                  onClick={() => setLastTouchedEmployee(s.agentSlug)}
                  data-testid={`life-roster-trace-link-${s.agentSlug}`}
                  className="block truncate text-sm font-semibold text-foreground hover:underline"
                >
                  {s.agentName}
                </Link>
              </div>
              <span
                data-testid={`life-roster-presence-${s.agentSlug}`}
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${presenceTone(s.presence)}`}
              >
                {presenceLabel(s.presence)}
              </span>
            </div>

            <p className="mt-1.5 text-[12px] text-foreground/85">
              {s.currentlyWorkingOn ? (
                <>
                  <span className="text-muted-foreground">Working on </span>
                  {s.currentlyWorkingOn}
                </>
              ) : (
                <span className="italic text-muted-foreground/80">
                  Standing by — no open work
                </span>
              )}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span>
                <span className={`font-semibold ${confidenceTone(s.confidence)}`}>
                  {s.confidence}
                </span>{' '}
                confidence
              </span>
              <span>
                workload{' '}
                <span
                  className={
                    s.workloadPressure === 'heavy'
                      ? 'font-semibold text-amber-300'
                      : s.workloadPressure === 'light'
                      ? 'font-semibold text-sky-300'
                      : 'font-semibold text-foreground'
                  }
                >
                  {s.workloadPressure}
                </span>
              </span>
              {s.responseSpeedMin !== null && (
                <span>
                  responds in <span className="font-semibold text-foreground">~{s.responseSpeedMin}m</span>
                </span>
              )}
            </div>

            {s.collaborators.length > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Collaborating with{' '}
                <span className="text-foreground/80">{s.collaborators.join(' · ')}</span>
              </p>
            )}

            {s.escalation && (
              <p
                className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-2 py-1 text-[11px] text-red-200"
                data-testid={`life-roster-escalation-${s.agentSlug}`}
              >
                ⚠ {s.escalation.title}
              </p>
            )}

            {s.currentBlocker && (
              <p className="mt-1 text-[10px] text-amber-300">
                Blocker: {s.currentBlocker}
              </p>
            )}

            {s.memoryUsed && (
              <p
                className="mt-2 truncate text-[10px] text-primary/80"
                title={s.memoryUsed.snippet}
                data-testid={`life-roster-memory-${s.agentSlug}`}
              >
                Used <span className="font-semibold">{s.memoryUsed.source}</span> · &ldquo;{s.memoryUsed.snippet}&rdquo;
              </p>
            )}

            {s.skillsActive.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {s.skillsActive.slice(0, 4).map((skill) => (
                  <span
                    key={skill}
                    className="rounded border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {s.activeWorkflow && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Workflow: <span className="text-foreground/80">{s.activeWorkflow}</span>
              </p>
            )}
            {s.recentWin && (
              <p className="mt-1 text-[10px] text-emerald-300">
                Recent win: {s.recentWin}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
