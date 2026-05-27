'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface PanelStoryHeaderProps {
  /** Plain-English title — what this panel _means_, not what it _shows_. */
  title: string
  /** Short subtitle answering "why should the customer care?". */
  story: string
  /** One-line summary of current state. Optional. */
  currentState?: ReactNode
  /** Recommended next action. Surfaces as a button if `onAction` is provided. */
  nextAction?: string
  onAction?: () => void
  /** Extra controls/CTAs (e.g. tab switcher). */
  rightSlot?: ReactNode
  /** Test id slug. */
  panelId: string
}

/**
 * Standard story header used by every customer-facing panel.
 *
 * Every panel in Mission Control should answer three questions for a
 * non-technical business owner:
 *
 *   1. What am I looking at?            → title
 *   2. Why does it matter to me?        → story
 *   3. What should I do next?           → nextAction
 */
export function PanelStoryHeader({
  title,
  story,
  currentState,
  nextAction,
  onAction,
  rightSlot,
  panelId,
}: PanelStoryHeaderProps) {
  return (
    <div
      data-testid={`panel-story-${panelId}`}
      className="flex flex-col gap-2 border-b border-border/60 bg-card/30 p-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{story}</p>
        {currentState && (
          <p className={cn('mt-1 text-xs text-muted-foreground')} data-testid={`panel-story-state-${panelId}`}>
            {currentState}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {nextAction && onAction && (
          <Button
            size="xs"
            data-testid={`panel-story-next-action-${panelId}`}
            onClick={onAction}
          >
            {nextAction}
          </Button>
        )}
        {rightSlot}
      </div>
    </div>
  )
}

interface PanelEmptyStateProps {
  panelId: string
  title: string
  description: string
  cta?: { label: string; onClick: () => void }
}

/**
 * Customer-friendly empty state. Every panel that can be empty must use this
 * so the customer never sees a blank screen with no explanation.
 */
export function PanelEmptyState({ panelId, title, description, cta }: PanelEmptyStateProps) {
  return (
    <div
      data-testid={`panel-empty-${panelId}`}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/20 p-10 text-center"
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 max-w-md text-xs text-muted-foreground">{description}</p>
      {cta && (
        <Button size="sm" className="mt-4" onClick={cta.onClick} data-testid={`panel-empty-cta-${panelId}`}>
          {cta.label}
        </Button>
      )}
    </div>
  )
}
