'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ActiveSkill } from '@/lib/baseline-os/trace-derivation'
import { useDemoMode } from '@/components/demo/demo-mode-provider'
import { customerSkillLabel } from '@/lib/customer-skill-labels'

/**
 * Skills-Active Inventory — shows which skills are actually in use across
 * the AI Workforce right now. Customer-facing language only. Honest empty
 * state when there's no usage history.
 *
 * Live → `/api/baseline-os/skills-inventory`
 * Demo → derived client-side from `narrative.lifeSignals[].skillsActive`
 */
export function SkillsActiveInventory() {
  const demo = useDemoMode()
  const [skills, setSkills] = useState<ActiveSkill[] | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (demo.active) {
      setLoaded(true)
      return
    }
    fetch('/api/baseline-os/skills-inventory', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { skills: [] }))
      .then((j) => {
        if (!cancelled) {
          setSkills(j.skills ?? [])
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [demo.active])

  // Demo overlay — aggregate skills across narrative life signals
  const demoSkills: ActiveSkill[] = (() => {
    if (!demo.active || !demo.narrative?.lifeSignals) return []
    const acc: Record<string, ActiveSkill> = {}
    for (const sig of demo.narrative.lifeSignals) {
      for (const skill of sig.skillsActive) {
        if (!acc[skill]) {
          acc[skill] = {
            slug: skill,
            label: customerSkillLabel(skill),
            state: 'active',
            employees: [sig.agentName],
            workflows: sig.activeWorkflow ? [sig.activeWorkflow] : [],
            uses: 12 + Math.floor(Math.random() * 30),
            recentUsesPerDay: 2 + Math.floor(Math.random() * 6),
            estimatedMinutesSaved: 60 + Math.floor(Math.random() * 240),
            creditsUsedThisMonth: 200 + Math.floor(Math.random() * 800),
            valueUsdThisMonth: 100 + Math.floor(Math.random() * 600),
            relatedTasks: 5 + Math.floor(Math.random() * 20),
            recommendation: null,
          }
        } else {
          if (!acc[skill].employees.includes(sig.agentName)) acc[skill].employees.push(sig.agentName)
          if (sig.activeWorkflow && !acc[skill].workflows.includes(sig.activeWorkflow)) {
            acc[skill].workflows.push(sig.activeWorkflow)
          }
        }
      }
    }
    return Object.values(acc).slice(0, 9)
  })()

  const data = demo.active ? demoSkills : skills ?? []

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/30 p-6 text-sm text-muted-foreground">
        Loading skills…
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <section
        className="rounded-2xl border border-border/40 bg-card/30 p-6"
        data-testid="skills-inventory-empty"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Active Skills · Baseline OS
        </p>
        <h2 className="mt-1 text-base font-bold text-foreground">No active skill usage yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run a task or install a skill to see this populate. We only show skills your AI workforce
          actually used — never fake activity.
        </p>
      </section>
    )
  }

  return (
    <section
      data-testid="skills-inventory"
      className="rounded-2xl border border-border/40 bg-card/30 p-6"
    >
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Active Skills · Baseline OS
        </p>
        <h2 className="mt-1 text-base font-bold text-foreground">What the workforce is using</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Skills currently powering your AI workforce — who&apos;s using them, the workflows they
          power, and the value they create. Derived from real activity.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="skills-inventory-list">
        {data.map((s) => (
          <li
            key={s.slug}
            data-testid={`skill-card-${s.slug}`}
            className={`rounded-xl border p-3 transition-colors ${
              s.state === 'active'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : s.state === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-border/40 bg-card/20'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                  s.state === 'active'
                    ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                    : s.state === 'warning'
                      ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                      : 'border-border/40 text-muted-foreground bg-muted/40'
                }`}
              >
                {s.state}
              </span>
            </div>
            {s.employees.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Used by{' '}
                {s.employees.slice(0, 3).map((name, i) => (
                  <span key={name}>
                    {i > 0 && ', '}
                    <Link
                      href={`/app/agents/${encodeURIComponent(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
                      className="text-foreground hover:underline"
                    >
                      {name}
                    </Link>
                  </span>
                ))}
                {s.employees.length > 3 && <span> +{s.employees.length - 3}</span>}
              </p>
            )}
            {s.workflows.length > 0 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Powers <span className="text-foreground/90">{s.workflows.join(' · ')}</span>
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>{s.uses} uses</span>
              {s.estimatedMinutesSaved > 0 && (
                <span>
                  ~<span className="text-foreground">{Math.round(s.estimatedMinutesSaved / 60)}h</span> saved
                </span>
              )}
              {s.valueUsdThisMonth > 0 && (
                <span>
                  value{' '}
                  <span className="text-emerald-300">${s.valueUsdThisMonth.toLocaleString()}</span>
                </span>
              )}
            </div>
            {s.recommendation && (
              <p className="mt-2 text-[10px] italic text-amber-200">{s.recommendation}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
