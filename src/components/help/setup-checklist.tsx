'use client'

import { useEffect, useState } from 'react'
import { panelHref, useNavigateToPanel } from '@/lib/navigation'
import type { ChecklistItemStatus } from '@/lib/help/checklist'

interface ApiResponse {
  items: ChecklistItemStatus[]
  total: number
  completed: number
  percent: number
  /** Server tells us which row to nudge the operator toward next. */
  next_step: ChecklistItemStatus | null
}

/**
 * Resolves an item's CTA target. `href` always wins (used for absolute
 * routes like /flight-deck and /marketplace that live outside the panel
 * catch-all). Otherwise falls back to /app/<panel>.
 */
function destinationFor(item: ChecklistItemStatus): { kind: 'href'; href: string } | { kind: 'panel'; panel: string } {
  if (item.href) return { kind: 'href', href: item.href }
  return { kind: 'panel', panel: item.panel }
}

/**
 * Setup Checklist — visible on the overview until 100% required complete,
 * or expanded from the Help menu at any time. Walt's P0 model: required
 * items drive the percent bar; optional items appear below and never
 * gate completion.
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

  const required = data.items.filter((i) => i.tier === 'required')
  const optional = data.items.filter((i) => i.tier === 'optional')
  const requiredDone = required.filter((i) => i.done).length
  const next = data.next_step

  function go(item: ChecklistItemStatus) {
    const dest = destinationFor(item)
    if (dest.kind === 'href') {
      window.location.href = dest.href
    } else {
      navigateToPanel(dest.panel)
    }
  }

  return (
    <section
      data-testid="setup-checklist"
      aria-label="Setup checklist"
      className={`rounded-xl border border-border/50 bg-card/40 ${embedded ? '' : 'mb-4'} overflow-hidden`}
    >
      <header className="flex items-center justify-between px-5 py-4 border-b border-border/30 gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">Setup · complete in under 10 minutes</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Your workforce is {data.percent}% set up
          </h2>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {requiredDone} of {required.length} required steps complete · {optional.filter((i) => i.done).length} of {optional.length} optional
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ProgressRing percent={data.percent} />
          {next && (
            <button
              type="button"
              data-testid="setup-checklist-continue"
              onClick={() => go(next)}
              className="hidden sm:inline-flex h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
            >
              Continue setup →
            </button>
          )}
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

      {/* Resume-where-you-left-off banner (only when at least one required is done) */}
      {next && requiredDone > 0 && (
        <div
          data-testid="setup-checklist-resume"
          className="px-5 py-2.5 bg-primary/5 border-b border-border/20 text-xs text-foreground/85 flex items-center justify-between gap-3"
        >
          <span>
            Resume where you left off — <strong className="text-foreground">{next.label}</strong>
          </span>
          <button
            type="button"
            data-testid="setup-checklist-resume-cta"
            onClick={() => go(next)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {next.actionLabel} →
          </button>
        </div>
      )}

      {/* Required rows */}
      <ul className="divide-y divide-border/30">
        {required.map((item) => (
          <ItemRow key={item.id} item={item} go={go} />
        ))}
      </ul>

      {/* Optional rows */}
      {optional.length > 0 && (
        <>
          <div className="px-5 py-3 border-t border-border/30 bg-card/60">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
              Optional — improves the experience, doesn&apos;t block 100%
            </p>
          </div>
          <ul className="divide-y divide-border/30">
            {optional.map((item) => (
              <ItemRow key={item.id} item={item} go={go} optional />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function ItemRow({
  item,
  go,
  optional,
}: {
  item: ChecklistItemStatus
  go: (item: ChecklistItemStatus) => void
  optional?: boolean
}) {
  const dest = destinationFor(item)
  const hrefAttr = dest.kind === 'href' ? dest.href : panelHref(dest.panel)
  return (
    <li
      data-testid={`checklist-item-${item.id}`}
      data-done={item.done ? 'true' : 'false'}
      data-tier={item.tier}
      className="flex items-start justify-between gap-4 px-5 py-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <CheckMark done={item.done} />
        <div className="min-w-0">
          <p className={`text-sm font-medium ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {item.label}
            {optional && !item.done && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">Optional</span>}
          </p>
          {!item.done && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">{item.why}</p>
          )}
        </div>
      </div>
      {!item.done && (
        <a
          data-testid={`checklist-action-${item.id}`}
          href={hrefAttr}
          onClick={(e) => {
            // Use the SPA navigator for /app routes; let absolute hrefs fall through.
            if (dest.kind === 'panel') {
              e.preventDefault()
              go(item)
            }
          }}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          {item.actionLabel} →
        </a>
      )}
    </li>
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
