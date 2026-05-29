'use client'

import { useEffect, useState } from 'react'
import { TOUR_STEPS } from '@/lib/help/content'
import { useNavigateToPanel } from '@/lib/navigation'

const STORAGE_KEY = 'mc:first-run-tour:v1'

/**
 * First-Run Tour
 *
 * Lightweight, modal-style guided tour. Steps are defined in help/content.ts.
 * It's:
 *   • Skippable (Esc, or Skip button)
 *   • Replayable (cleared from Help menu)
 *   • Non-annoying (auto-opens only once per workspace+user)
 */
export function FirstRunTour() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const navigateToPanel = useNavigateToPanel()

  // Auto-open once per browser
  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      // Small delay so the dashboard has time to settle.
      const t = setTimeout(() => setOpen(true), 1500)
      return () => clearTimeout(t)
    }
  }, [])

  // Listen for explicit replay
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onReplay() {
      setIndex(0)
      setOpen(true)
    }
    window.addEventListener('mc:first-run-tour:replay', onReplay)
    return () => window.removeEventListener('mc:first-run-tour:replay', onReplay)
  }, [])

  // Esc to dismiss
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Navigate to the panel for the current step if defined
  useEffect(() => {
    if (!open) return
    const step = TOUR_STEPS[index]
    if (step?.panel) navigateToPanel(step.panel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index])

  if (!open) return null
  const step = TOUR_STEPS[index]
  const isLast = index === TOUR_STEPS.length - 1

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1')
    }
    setOpen(false)
  }

  function next() {
    if (isLast) {
      dismiss()
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="First-run tour"
      data-testid="first-run-tour"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center pointer-events-none"
    >
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={dismiss}
        data-testid="first-run-tour-backdrop"
      />
      <div className="relative z-10 m-4 sm:m-0 w-full sm:max-w-md rounded-xl border border-border/70 bg-popover shadow-2xl p-6 pointer-events-auto">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
          Tour · {index + 1} of {TOUR_STEPS.length}
        </p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <button
            data-testid="first-run-tour-skip"
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                data-testid="first-run-tour-back"
                onClick={() => setIndex((i) => i - 1)}
                className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-secondary/50"
              >
                Back
              </button>
            )}
            <button
              data-testid="first-run-tour-next"
              onClick={next}
              className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Programmatic trigger — fire this from a "Replay tour" button.
 */
export function replayFirstRunTour() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('mc:first-run-tour:replay'))
}
