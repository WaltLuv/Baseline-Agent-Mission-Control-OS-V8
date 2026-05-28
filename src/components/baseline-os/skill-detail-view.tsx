'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface SkillDetailData {
  slug: string
  label: string
  description: string | null
  installed: boolean
  installedAt: number | null
  state: 'active' | 'warning' | 'inactive' | 'proven'
  stateReason: string
  uses: number
  successCount: number
  escalationCount: number
  lastUsedAt: number | null
  valueUsdThisMonth: number
  estimatedHoursSaved: number
  employees: string[]
  timeline: Array<{ id: number; when: number; kind: 'used' | 'escalated' | 'installed'; agentSlug: string | null; detail: string | null; valueCents: number }>
  recommendations: string[]
}

/**
 * Full per-skill detail surface — drives `/app/skills/[slug]`.
 * Calm enterprise layout: header → state → metrics → employees →
 * timeline → recommendations. No noisy charts.
 */
export function SkillDetailView({ slug }: { slug: string }) {
  const [detail, setDetail] = useState<SkillDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/baseline-os/skills/${encodeURIComponent(slug)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!cancelled) setDetail(d.detail)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e).slice(0, 160))
      })
    return () => { cancelled = true }
  }, [slug])

  if (error) {
    return (
      <p
        data-testid="skill-detail-empty"
        className="rounded-2xl border border-border/40 bg-card/30 p-6 text-sm text-muted-foreground"
      >
        This skill isn&apos;t installed in your workspace, and has no event history yet.
      </p>
    )
  }
  if (!detail) return <p className="text-sm text-muted-foreground">Loading…</p>

  const stateLabel: Record<SkillDetailData['state'], string> = {
    active: 'Active',
    warning: 'Needs attention',
    inactive: 'Inactive',
    proven: 'Proven capability',
  }

  return (
    <article data-testid="skill-detail" data-state={detail.state} className="space-y-4">
      <header className="rounded-2xl border border-border/40 bg-card/30 p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Workforce capability · Baseline OS
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground" data-testid="skill-detail-label">
          {detail.label}
        </h1>
        {detail.description && (
          <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>
        )}
        <p
          className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-wider ${
            detail.state === 'active'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : detail.state === 'proven'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : detail.state === 'warning'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-border/40 bg-muted/30 text-muted-foreground'
          }`}
          data-testid="skill-detail-state"
        >
          {stateLabel[detail.state]}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{detail.stateReason}</p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Activations" value={detail.uses.toLocaleString()} />
        <Metric label="Successful" value={detail.successCount.toLocaleString()} />
        <Metric label="Escalated" value={detail.escalationCount.toLocaleString()} />
        <Metric label="Value · this month" value={`$${detail.valueUsdThisMonth.toLocaleString()}`} accent="emerald" />
      </section>

      <section className="rounded-2xl border border-border/40 bg-card/30 p-5">
        <h2 className="text-sm font-semibold text-foreground">AI Employees using this skill</h2>
        {detail.employees.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No AI Employee has activated this skill yet.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="skill-employees">
            {detail.employees.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/app/agents/${encodeURIComponent(slug)}/trace`}
                  className="rounded-full border border-border/40 px-3 py-1 text-[11px] text-foreground hover:bg-primary/10"
                >
                  {slug}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border/40 bg-card/30 p-5">
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        {detail.timeline.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="mt-2 space-y-2" data-testid="skill-timeline">
            {detail.timeline.slice(0, 10).map((evt) => (
              <li
                key={evt.id}
                className="flex items-start gap-3 rounded-lg border border-border/30 bg-card/40 p-3 text-[12px]"
              >
                <span
                  className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                    evt.kind === 'used'
                      ? 'bg-emerald-400'
                      : evt.kind === 'escalated'
                        ? 'bg-amber-400'
                        : 'bg-muted-foreground'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-foreground">
                    {evt.kind === 'used' ? 'Activated' : evt.kind === 'escalated' ? 'Escalated' : 'Installed'}
                    {evt.agentSlug && (
                      <>
                        {' · '}
                        <Link
                          href={`/app/agents/${encodeURIComponent(evt.agentSlug)}/trace`}
                          className="hover:underline"
                        >
                          {evt.agentSlug}
                        </Link>
                      </>
                    )}
                  </p>
                  {evt.detail && <p className="text-muted-foreground">{evt.detail}</p>}
                </div>
                {evt.valueCents > 0 && (
                  <p className="text-[11px] text-emerald-300">+${(evt.valueCents / 100).toLocaleString()}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {detail.recommendations.length > 0 && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="text-sm font-semibold text-foreground">Baseline OS recommends</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-foreground/90" data-testid="skill-recommendations">
            {detail.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: 'emerald' }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-3">
      <p className={`text-base font-bold ${accent === 'emerald' ? 'text-emerald-300' : 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
