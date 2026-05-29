'use client'

import { useState, useRef, useEffect } from 'react'
import { useNavigateToPanel } from '@/lib/navigation'
import { CONTEXTUAL_HELP } from '@/lib/help/content'

/**
 * Inline "?" button that opens a small popover with three lines:
 *   What is this? Why does it matter? What should I do next?
 *
 * Use anywhere on important surfaces. Looks calm in both light and dark themes.
 */
export function HelpTooltip({
  topic,
  label = 'Why this matters',
  className = '',
}: {
  topic: keyof typeof CONTEXTUAL_HELP
  label?: string
  className?: string
}) {
  const help = CONTEXTUAL_HELP[topic]
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigateToPanel = useNavigateToPanel()

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!help) return null

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`Help: ${label}`}
        aria-expanded={open}
        data-testid={`help-tooltip-${topic}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-border/70 text-[10px] font-mono">?</span>
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div
          role="dialog"
          data-testid={`help-tooltip-${topic}-popover`}
          className="absolute z-50 top-full mt-2 right-0 w-72 rounded-lg border border-border/70 bg-popover shadow-xl p-4 text-xs leading-relaxed"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">What is this?</p>
          <p className="mt-1 text-foreground">{help.what}</p>
          <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Why does it matter?</p>
          <p className="mt-1 text-muted-foreground">{help.why}</p>
          <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">What should I do next?</p>
          <p className="mt-1 text-muted-foreground">{help.next}</p>
          {help.link && (
            <button
              data-testid={`help-tooltip-${topic}-link`}
              onClick={() => { setOpen(false); if (help.link?.panel) navigateToPanel(help.link.panel) }}
              className="mt-3 text-[11px] text-primary hover:underline"
            >
              {help.link.label} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
