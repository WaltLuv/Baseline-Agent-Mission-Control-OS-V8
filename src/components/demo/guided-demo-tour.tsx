'use client'

import { useEffect, useState } from 'react'
import { useNavigateToPanel } from '@/lib/navigation'
import { useDemoMode } from '@/components/demo/demo-mode-provider'
import { GUIDED_DEMO_STEPS } from '@/lib/guided-demo'

/**
 * Guided Demo Tour — a 60–90 second prospect walkthrough.
 *
 * Opens via a header button (added separately) or via the URL hash
 * `#guided-demo`. Auto-pace is OPT-IN (off by default), because we want
 * prospects to read at their own speed.
 *
 * Calm rules:
 *   - Six steps. Skippable from any step.
 *   - No flashing, no sound, no flashy transitions.
 *   - Anchors to surfaces that already exist; we never invent UI to demo.
 */
export function GuidedDemoTour() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const navigateToPanel = useNavigateToPanel()
  const { templateId } = useDemoMode()

  // Open on demand via custom event or URL hash
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onReplay() { setIndex(0); setOpen(true) }
    window.addEventListener('mc:guided-demo:open', onReplay)
    if (window.location.hash === '#guided-demo') {
      setOpen(true)
    }
    return () => window.removeEventListener('mc:guided-demo:open', onReplay)
  }, [])

  // Navigate to each step's panel as the index changes
  useEffect(() => {
    if (!open) return
    const step = GUIDED_DEMO_STEPS[index]
    if (step?.panel) navigateToPanel(step.panel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index])

  // Auto-advance ~14 s per step when autoplay is on
  useEffect(() => {
    if (!open || !autoplay) return
    const total = GUIDED_DEMO_STEPS.length
    const id = window.setTimeout(() => {
      setIndex((i) => {
        if (i + 1 >= total) {
          setOpen(false)
          return 0
        }
        return i + 1
      })
    }, 14_000)
    return () => window.clearTimeout(id)
  }, [open, autoplay, index])

  // Esc dismisses
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setAutoplay(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  const step = GUIDED_DEMO_STEPS[index]
  const total = GUIDED_DEMO_STEPS.length
  const isLast = index === total - 1
  const verticalGloss = templateId && step.forTemplate?.[templateId]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guided demo"
      data-testid="guided-demo"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center pointer-events-none"
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setOpen(false)} />
      <div className="relative z-10 m-4 sm:m-0 w-full sm:max-w-lg rounded-xl border border-border/70 bg-popover shadow-2xl p-6 pointer-events-auto">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
            Guided demo · {index + 1} of {total}
          </p>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              data-testid="guided-demo-autoplay"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
              className="accent-primary"
            />
            Auto-pace
          </label>
        </div>
        <h3 className="mt-3 text-xl font-semibold text-foreground tracking-tight">{step.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
        {verticalGloss && (
          <p
            className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/90"
            data-testid="guided-demo-vertical-gloss"
          >
            {verticalGloss}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            data-testid="guided-demo-skip"
            onClick={() => { setOpen(false); setAutoplay(false) }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                data-testid="guided-demo-back"
                onClick={() => setIndex((i) => i - 1)}
                className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-secondary/50"
              >
                Back
              </button>
            )}
            <button
              data-testid="guided-demo-next"
              onClick={() => {
                if (isLast) { setOpen(false); setAutoplay(false) }
                else setIndex((i) => i + 1)
              }}
              className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
        {/* Progress strip — calm, low-contrast */}
        <div className="mt-4 flex gap-1" aria-hidden>
          {GUIDED_DEMO_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-0.5 flex-1 rounded-full transition-colors ${i <= index ? 'bg-primary/70' : 'bg-border/60'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function openGuidedDemo() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('mc:guided-demo:open'))
}
