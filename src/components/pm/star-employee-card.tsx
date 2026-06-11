'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * StarEmployeeCard — surfaces the workspace's top-performing AI employee on
 * the overview. Ranked server-side by completed work × accuracy
 * (/api/workforce/star-employee). Renders nothing until data arrives and
 * hides itself when there is no performance data yet (honest empty state).
 */
interface Star {
  name: string
  role: string
  status: string
  activity: string
  completed: number
  accuracy: number
  score: number
}

export function StarEmployeeCard() {
  const [star, setStar] = useState<Star | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/workforce/star-employee')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) { setStar(j?.star ?? null); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  if (!loaded || !star) return null

  const initials = star.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const accuracyPct = Math.round(star.accuracy * 100)

  return (
    <div
      data-testid="star-employee-card"
      className="rounded-lg border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-card px-4 py-3"
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-500">
        <span aria-hidden>★</span> Star Employee
        <span className="font-normal normal-case tracking-normal text-muted-foreground">
          · top performer this period
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-500/50 bg-amber-500/15 text-sm font-bold text-amber-600">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{star.name}</span>
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              title={star.status}
              style={{ background: star.status === 'busy' ? '#f59e0b' : '#34d399' }}
            />
          </div>
          <div className="truncate text-xs text-muted-foreground">{star.role}</div>
          {star.activity && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{star.activity}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold leading-none text-foreground">{star.completed}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">tasks done</div>
          <div className="mt-1 text-xs font-semibold text-emerald-600">{accuracyPct}% accurate</div>
        </div>
      </div>
      <div className="mt-2 text-right">
        <Link href="/app/agents" className="text-[11px] font-medium text-amber-600 hover:underline">
          View workforce →
        </Link>
      </div>
    </div>
  )
}
