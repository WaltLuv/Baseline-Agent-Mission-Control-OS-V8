'use client'

import { useEffect, useState } from 'react'
import { useNavigateToPanel } from '@/lib/navigation'
import type { ChecklistItemStatus } from '@/lib/help/checklist'

interface ApiResponse {
  items: ChecklistItemStatus[]
  total: number
  completed: number
  percent: number
}

/**
 * Setup Checklist — visible on the overview until 100% complete, or expanded
 * from the Help menu at any time. State is derived from the workspace.
 */
export function SetupChecklist({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const navigateToPanel = useNavigateToPanel()

  useEffect(() => {
    let cancelled = false
    fetch('/api/help/checklist')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j) setData(j) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(window.localStorage.getItem('mc:setup-checklist-dismissed') === '1')
  }, [])

  if (!data) return null
  if (!embedded && (dismissed || data.percent === 100)) return null

  return (
    <section
      data-testid="setup-checklist"
      aria-label="Setup checklist"
      className={`rounded-xl border border-border/50 bg-card/40 ${embedded ? '' : 'mb-4'} overflow-hidden`}
    >
      <header className="flex items-center justify-between px-5 py-4 border-b border-border/30">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">Setup</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Your workforce is {data.percent}% set up
          </h2>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {data.completed} of {data.total} steps complete. Each one is small.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing percent={data.percent} />
          {!embedded && (
            <button
              data-testid="setup-checklist-dismiss"
              onClick={() => { window.localStorage.setItem('mc:setup-checklist-dismissed', '1'); setDismissed(true) }}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Hide checklist"
            >
              Hide
            </button>
          )}
        </div>
      </header>
      <ul className="divide-y divide-border/30">
        {data.items.map((item) => (
          <li
            key={item.id}
            data-testid={`checklist-item-${item.id}`}
            data-done={item.done ? 'true' : 'false'}
            className="flex items-start justify-between gap-4 px-5 py-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <CheckMark done={item.done} />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {item.label}
                </p>
                {!item.done && (
                  <p className="mt-0.5 text-xs text-muted-foreground/80">{item.why}</p>
                )}
              </div>
            </div>
            {!item.done && (
              <button
                data-testid={`checklist-action-${item.id}`}
                onClick={() => navigateToPanel(item.panel)}
                className="shrink-0 text-xs text-primary hover:underline"
              >
                {item.actionLabel} →
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CheckMark({ done }: { done: boolean }) {
  if (done) {
    return (
      <span aria-hidden className="mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
          <polyline points="3,8 7,12 13,4" />
        </svg>
      </span>
    )
  }
  return <span aria-hidden className="mt-0.5 inline-block w-4 h-4 rounded-full border border-border/60" />
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 16
  const stroke = 3
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - percent / 100)
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-border" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        stroke="currentColor"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-700"
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="22" textAnchor="middle" className="text-[10px] fill-foreground font-medium">{percent}</text>
    </svg>
  )
}
