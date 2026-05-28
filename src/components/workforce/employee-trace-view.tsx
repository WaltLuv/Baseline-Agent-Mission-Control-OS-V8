'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { EmployeeTrace } from '@/lib/baseline-os/trace-derivation'
import { useDemoMode } from '@/components/demo/demo-mode-provider'

/**
 * EmployeeTraceView — one-click drill-down for any AI Employee.
 *
 * Answers in a single calm view:
 *   - What did this AI employee do today?
 *   - What is it doing right now?
 *   - What memory did it use?  (with citation source + excerpt)
 *   - What skills did it use?
 *   - Who did it collaborate with?
 *   - What did it cost / what value did it create?
 *   - What's blocked?  What needs approval (and WHY)?
 *   - What should I do next?
 *
 * Live mode → fetches `/api/agents/<slug>/trace` (honest data only).
 * Demo mode → renders demo narrative life signals (no live calls).
 */
export function EmployeeTraceView({ slug }: { slug: string }) {
  const demo = useDemoMode()
  const [trace, setTrace] = useState<EmployeeTrace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch(`/api/agents/${encodeURIComponent(slug)}/trace`, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) {
            setError('No trace data available for this AI Employee yet.')
            setLoading(false)
          }
          return
        }
        const j = await r.json()
        if (!cancelled) {
          setTrace(j.trace ?? null)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Could not load trace.')
          setLoading(false)
        }
      }
    }
    if (demo.active) {
      // Demo mode supplies overlay synchronously — no fetch.
      setLoading(false)
    } else {
      setLoading(true)
      load()
    }
    return () => {
      cancelled = true
    }
  }, [slug, demo.active])

  // Demo overlay — pick from narrative.lifeSignals if available
  const demoSignal = demo.active
    ? demo.narrative?.lifeSignals?.find(
        (s) => s.agentSlug === slug || s.agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug,
      )
    : null

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center text-sm text-muted-foreground">
        Loading trace…
      </div>
    )
  }

  if (!trace && !demoSignal) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center" data-testid="trace-empty-state">
        <p className="text-sm font-semibold text-foreground">No trace data yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {error ?? 'This AI Employee has not produced activity in this workspace.'}
        </p>
        <Link href="/app/overview" className="mt-3 inline-block text-xs text-primary hover:underline">
          ← Back to overview
        </Link>
      </div>
    )
  }

  // ------- DEMO MODE RENDERING -------
  if (demoSignal) {
    return (
      <section
        data-testid="employee-trace-view"
        data-mode="demo"
        className="rounded-2xl border border-primary/40 bg-card/30 p-6"
      >
        <Header
          name={demoSignal.agentName}
          presence={demoSignal.presence}
          currentlyWorkingOn={demoSignal.currentlyWorkingOn}
          demoBanner
        />

        {demoSignal.escalation && (
          <ApprovalCard
            title={demoSignal.escalation.title}
            severity={demoSignal.escalation.severity}
            memoryExcerpt={demoSignal.memoryUsed?.snippet ?? null}
            memorySource={demoSignal.memoryUsed?.source ?? null}
          />
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card title="Memory the workforce used">
            {demoSignal.memoryUsed ? (
              <p className="text-xs">
                <span className="font-semibold text-primary">{demoSignal.memoryUsed.source}</span>{' '}
                — &ldquo;{demoSignal.memoryUsed.snippet}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No memory cited.</p>
            )}
          </Card>
          <Card title="Skills active right now">
            {demoSignal.skillsActive.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {demoSignal.skillsActive.map((s) => (
                  <li key={s} className="rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] text-foreground/85">
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">No active skills.</p>
            )}
          </Card>
          <Card title="Currently collaborating with">
            {demoSignal.collaborators.length > 0 ? (
              <ul className="space-y-0.5 text-xs">
                {demoSignal.collaborators.map((c) => (
                  <li key={c}>
                    <Link
                      href={`/app/agents/${encodeURIComponent(c.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
                      className="text-foreground hover:underline"
                    >
                      → {c}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">Solo workload.</p>
            )}
          </Card>
          <Card title="Recent win">
            <p className="text-xs text-emerald-200">
              {demoSignal.recentWin ?? <span className="italic text-muted-foreground">Nothing closed yet.</span>}
            </p>
          </Card>
        </div>

        {demoSignal.currentBlocker && (
          <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
            ⚠ Blocker: {demoSignal.currentBlocker}
          </p>
        )}

        <BackLink />
      </section>
    )
  }

  // ------- LIVE MODE RENDERING -------
  if (!trace) return null

  return (
    <section data-testid="employee-trace-view" data-mode="live" className="rounded-2xl border border-border/40 bg-card/30 p-6">
      <Header
        name={trace.name}
        presence={trace.presence}
        currentlyWorkingOn={trace.currentlyWorkingOn}
      />

      {trace.needsApproval.length > 0 && (
        <ApprovalCard
          title={trace.needsApproval[0].title}
          severity="medium"
          memoryExcerpt={trace.needsApproval[0].reason}
          memorySource={trace.needsApproval[0].reason ? guessSourceFromRationale(trace.needsApproval[0].reason) : null}
        />
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="What it did today">
          {trace.todayActions.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {trace.todayActions.map((a, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate text-foreground/90">{a.title}</span>
                  {a.valueUsd > 0 && <span className="shrink-0 text-emerald-300">+${a.valueUsd.toLocaleString()}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No actions closed today.</Empty>
          )}
        </Card>

        <Card title="What it's working on right now">
          {trace.activeTasks.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {trace.activeTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link href={`/app/tasks/kanban#task-${t.id}`} className="text-foreground/90 hover:underline">
                    {t.title}
                  </Link>{' '}
                  <span className="text-[10px] text-muted-foreground">· {t.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing active. Standing by.</Empty>
          )}
        </Card>

        <Card title="Memory it used">
          {trace.memoryUsed.length > 0 ? (
            <ul className="space-y-2 text-xs">
              {trace.memoryUsed.slice(0, 4).map((m) => (
                <li key={m.id}>
                  <Link href={`/app/memory-feed?id=${m.id}`} className="font-semibold text-primary hover:underline">
                    {m.source} · {m.title}
                  </Link>
                  {m.excerpt && (
                    <p className="mt-0.5 text-muted-foreground italic">&ldquo;{m.excerpt.slice(0, 160)}&rdquo;</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No memory cited yet.</Empty>
          )}
        </Card>

        <Card title="Skills it used">
          {trace.skillsUsed.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {trace.skillsUsed.map((s) => (
                <li key={s.skill} className="rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] text-foreground/85">
                  {s.skill}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No skill usage yet. Run a task or install a skill to see this populate.</Empty>
          )}
        </Card>

        <Card title="Who it collaborates with">
          {trace.collaborators.length > 0 ? (
            <ul className="space-y-0.5 text-xs">
              {trace.collaborators.map((c) => (
                <li key={c.name}>
                  <Link
                    href={`/app/agents/${encodeURIComponent(c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
                    className="text-foreground/90 hover:underline"
                  >
                    → {c.name}
                  </Link>
                  <span className="ml-1 text-[10px] text-muted-foreground">· {c.sharedTasks} shared task{c.sharedTasks === 1 ? '' : 's'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No collaboration history yet.</Empty>
          )}
        </Card>

        <Card title="Cost & value this month">
          <p className="text-xs text-muted-foreground">
            Cost <span className="font-semibold text-foreground">${(trace.costThisMonthCents / 100).toLocaleString()}</span>
            <span className="mx-2 text-muted-foreground/40">·</span>
            Value <span className="font-semibold text-emerald-300">${(trace.valueThisMonthCents / 100).toLocaleString()}</span>
          </p>
        </Card>
      </div>

      <div className="mt-4">
        <TrustSparkline data={trace.trustTrajectory} />
      </div>

      {trace.blockedItems.length > 0 && (
        <Card title="Blocked items" className="mt-4 border-amber-500/30 bg-amber-500/5">
          <ul className="space-y-0.5 text-xs">
            {trace.blockedItems.map((b) => (
              <li key={b.id} className="text-amber-200">
                ⚠{' '}
                <Link href={`/app/tasks/kanban#task-${b.id}`} className="hover:underline">
                  {b.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-5 flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-4">
        <p className="text-xs text-foreground">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground mr-2">Next</span>
          {trace.nextAction.label}
        </p>
        <Link
          href={trace.nextAction.href}
          className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go →
        </Link>
      </div>

      <BackLink />
    </section>
  )
}

function Header({
  name,
  presence,
  currentlyWorkingOn,
  demoBanner,
}: {
  name: string
  presence: string
  currentlyWorkingOn: string | null
  demoBanner?: boolean
}) {
  return (
    <header>
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/80">
        AI Employee Trace · Baseline OS{demoBanner ? ' · Demo' : ''}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-foreground" data-testid="trace-employee-name">
        {name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Presence: <span className="text-foreground/90">{presence}</span>
        {currentlyWorkingOn && (
          <>
            <span className="mx-2 text-muted-foreground/40">·</span>
            Working on <span className="text-foreground/90">{currentlyWorkingOn}</span>
          </>
        )}
      </p>
    </header>
  )
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/40 bg-card/20 p-3 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-muted-foreground/80">{children}</p>
}

function BackLink() {
  return (
    <Link href="/app/overview" className="mt-3 inline-block text-xs text-muted-foreground hover:text-primary">
      ← Back to Mission Control
    </Link>
  )
}

function ApprovalCard({
  title,
  severity,
  memoryExcerpt,
  memorySource,
}: {
  title: string
  severity: 'low' | 'medium' | 'high'
  memoryExcerpt: string | null
  memorySource: string | null
}) {
  return (
    <div
      data-testid="approval-reasoning-card"
      className={`mt-4 rounded-xl border p-4 ${
        severity === 'high'
          ? 'border-red-500/40 bg-red-500/5'
          : severity === 'medium'
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-sky-500/40 bg-sky-500/5'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
        Held for approval
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
      {memoryExcerpt && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          <span className="not-italic font-semibold text-primary">
            {memorySource ?? 'Operator memory'}:
          </span>{' '}
          &ldquo;{memoryExcerpt}&rdquo;
        </p>
      )}
      <Link
        href="/app/approvals"
        className="mt-2 inline-block text-xs text-primary hover:underline"
      >
        Review and approve →
      </Link>
    </div>
  )
}

function TrustSparkline({ data }: { data: EmployeeTrace['trustTrajectory'] }) {
  // Hide if fewer than 5 data points OR all-zero trust (= no real history)
  const populated = data.filter((d) => d.closed + d.escalated > 0)
  if (populated.length < 5) {
    return (
      <div
        className="rounded-xl border border-border/30 bg-card/10 p-3 text-center"
        data-testid="trust-sparkline-empty"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Trust trend
        </p>
        <p className="mt-1 text-xs italic text-muted-foreground/80">
          Not enough history yet. Trust trend appears after this AI Employee closes a few workdays.
        </p>
      </div>
    )
  }

  const w = 280
  const h = 36
  const stepX = w / (data.length - 1)
  const pts = data.map((d, i) => {
    const x = i * stepX
    const y = h - d.trust * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polyline = pts.join(' ')
  const last = data[data.length - 1].trust
  const first = data[0].trust
  const delta = last - first
  return (
    <div className="rounded-xl border border-border/40 bg-card/20 p-3" data-testid="trust-sparkline">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Trust trend · 14 days
        </p>
        <span
          className={`text-[10px] font-semibold ${
            delta > 0.05 ? 'text-emerald-300' : delta < -0.05 ? 'text-amber-300' : 'text-muted-foreground'
          }`}
        >
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {(last * 100).toFixed(0)}%
        </span>
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-1 w-full">
        <polyline
          fill="none"
          stroke="currentColor"
          className="text-primary/80"
          strokeWidth="1.5"
          points={polyline}
        />
      </svg>
    </div>
  )
}

function guessSourceFromRationale(rationale: string): string {
  if (/obsidian/i.test(rationale)) return 'Obsidian'
  if (/notion/i.test(rationale)) return 'Notion'
  if (/pinecone/i.test(rationale)) return 'Pinecone'
  return 'Operator memory'
}
