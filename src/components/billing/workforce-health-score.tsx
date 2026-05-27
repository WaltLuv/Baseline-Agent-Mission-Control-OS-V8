'use client'

import { useEffect, useState } from 'react'

interface HealthInputs {
  balance: number
  daysRemaining: number
  marginPercent: number | null
  ledgerVerified: boolean
  recentEventCount: number
  attentionItemCount: number
}

interface HealthScore {
  score: number
  band: 'healthy' | 'attention' | 'critical'
  bullets: { ok: boolean; label: string }[]
}

export function computeWorkforceHealth(inputs: HealthInputs): HealthScore {
  const bullets: { ok: boolean; label: string }[] = []
  let score = 100

  // Fuel runway weighting
  if (inputs.balance <= 0) {
    score -= 40
    bullets.push({ ok: false, label: 'Workforce out of fuel' })
  } else if (inputs.daysRemaining < 5) {
    score -= 25
    bullets.push({ ok: false, label: `Only ~${inputs.daysRemaining} days of fuel left` })
  } else if (inputs.daysRemaining < 14) {
    score -= 10
    bullets.push({ ok: true, label: `~${inputs.daysRemaining} days of fuel` })
  } else {
    bullets.push({ ok: true, label: 'Plenty of fuel' })
  }

  // Ledger integrity
  if (!inputs.ledgerVerified) {
    score -= 30
    bullets.push({ ok: false, label: 'Credit ledger mismatch — investigate' })
  } else {
    bullets.push({ ok: true, label: 'Credit ledger verified' })
  }

  // Margin (only if admin can see it). Soft signal.
  if (inputs.marginPercent !== null) {
    if (inputs.marginPercent >= 55) bullets.push({ ok: true, label: `Healthy margin (${inputs.marginPercent.toFixed(0)}%)` })
    else { score -= 10; bullets.push({ ok: false, label: `Margin tight (${inputs.marginPercent.toFixed(0)}%)` }) }
  }

  // Activity / engagement
  if (inputs.recentEventCount === 0) {
    score -= 10
    bullets.push({ ok: false, label: 'No AI workforce activity in the last week' })
  } else {
    bullets.push({ ok: true, label: `${inputs.recentEventCount} actions completed recently` })
  }

  // Attention items
  if (inputs.attentionItemCount > 0) {
    score -= Math.min(15, inputs.attentionItemCount * 3)
    bullets.push({ ok: false, label: `${inputs.attentionItemCount} item${inputs.attentionItemCount === 1 ? '' : 's'} need human review` })
  }

  const clamped = Math.max(0, Math.min(100, score))
  const band: HealthScore['band'] = clamped >= 80 ? 'healthy' : clamped >= 55 ? 'attention' : 'critical'
  return { score: clamped, band, bullets }
}

interface WorkforceHealthScoreProps {
  inputs: HealthInputs
}

export function WorkforceHealthScore({ inputs }: WorkforceHealthScoreProps) {
  const health = computeWorkforceHealth(inputs)
  const tone =
    health.band === 'healthy'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : health.band === 'attention'
      ? 'border-amber-500/30 bg-amber-500/5'
      : 'border-red-500/40 bg-red-500/10'
  const scoreColor =
    health.band === 'healthy' ? 'text-emerald-400' : health.band === 'attention' ? 'text-amber-400' : 'text-red-400'

  return (
    <div
      data-testid="workforce-health-score"
      className={`rounded-lg border p-4 ${tone}`}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI Workforce Health
          </p>
          <p className={`text-3xl font-bold ${scoreColor}`} data-testid="health-score-value">
            {health.score}
            <span className="text-base font-medium text-muted-foreground"> / 100</span>
          </p>
        </div>
        <div className="text-right text-xs uppercase tracking-wider text-muted-foreground">
          {health.band}
        </div>
      </div>
      <ul className="mt-3 space-y-1" data-testid="health-score-bullets">
        {health.bullets.map((b, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className={b.ok ? 'text-emerald-400' : 'text-red-400'}>{b.ok ? '✓' : '!'}</span>
            <span className="text-foreground/90">{b.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface UseHealthInputsArgs {
  fuel: { balance: number; daysRemaining: number } | null
  marginPercent: number | null
  ledgerVerified: boolean
  recentEventCount: number
}

export function useDerivedHealthInputs({
  fuel,
  marginPercent,
  ledgerVerified,
  recentEventCount,
}: UseHealthInputsArgs): HealthInputs {
  const [attentionItemCount, setAttentionItemCount] = useState(0)
  useEffect(() => {
    // Count tasks in "review" status across the workspace. Cheap, polled.
    fetch('/api/tasks?status=review')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d)) setAttentionItemCount(d.length)
        else if (d?.tasks && Array.isArray(d.tasks)) setAttentionItemCount(d.tasks.length)
      })
      .catch(() => {})
  }, [])
  return {
    balance: fuel?.balance ?? 0,
    daysRemaining: fuel?.daysRemaining ?? 0,
    marginPercent,
    ledgerVerified,
    recentEventCount,
    attentionItemCount,
  }
}
