'use client'

import type { ReactNode } from 'react'

/**
 * MetricTooltip — minimal, CSS-only, executive-grade tooltip.
 *
 * Wraps any inline element with a "why this matters" hover/focus tooltip.
 * No portal, no JS state, no flicker — just a styled bubble that fades in
 * after a 150ms delay so it never feels nervous. Premium, Bloomberg-grade.
 *
 *   <MetricTooltip label="Why this matters" body="…">$2,432</MetricTooltip>
 *
 * Accessibility: the tooltip body is also exposed via `aria-label` on the
 * trigger so screen readers and keyboard users get the same context.
 */
interface Props {
  label?: string
  body: string
  children: ReactNode
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function MetricTooltip({ label = 'Why this matters', body, children, className = '', side = 'top' }: Props) {
  const sidePos =
    side === 'bottom'
      ? 'top-full mt-2'
      : side === 'left'
      ? 'right-full mr-2 top-1/2 -translate-y-1/2'
      : side === 'right'
      ? 'left-full ml-2 top-1/2 -translate-y-1/2'
      : 'bottom-full mb-2'

  return (
    <span
      className={`group/tip relative inline-flex cursor-help align-baseline ${className}`}
      tabIndex={0}
      aria-label={`${label}: ${body}`}
      data-testid="metric-tooltip-trigger"
    >
      {children}
      <span
        role="tooltip"
        data-testid="metric-tooltip-body"
        className={`pointer-events-none absolute left-1/2 z-50 w-64 -translate-x-1/2 ${sidePos} rounded-md border border-border/60 bg-popover/95 px-3 py-2 text-left text-[11px] leading-snug text-popover-foreground opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover/tip:opacity-100 group-focus/tip:opacity-100`}
      >
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-primary/90">
          {label}
        </span>
        <span className="mt-1 block text-muted-foreground">{body}</span>
      </span>
    </span>
  )
}
