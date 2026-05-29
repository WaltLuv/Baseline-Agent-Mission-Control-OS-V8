'use client'

import { useState, useRef, useEffect } from 'react'
import { useNavigateToPanel } from '@/lib/navigation'
import { replayFirstRunTour } from './first-run-tour'

/**
 * Header "?" button — opens a small menu of quick help entry points.
 */
export function HelpButton() {
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

  function go(panel: string) {
    setOpen(false)
    navigateToPanel(panel)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Help"
        data-testid="help-button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        title="Help"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M6 6a2 2 0 014 0c0 1.5-2 1.5-2 3" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          data-testid="help-button-menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-border/70 bg-popover shadow-xl z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Help</p>
            <p className="text-sm text-foreground mt-0.5">Where do you want to go?</p>
          </div>
          <div className="py-1">
            <MenuItem testId="help-menu-home" label="Help Home" sub="Browse all guides" onClick={() => go('help')} />
            <MenuItem testId="help-menu-getting-started" label="Getting Started" sub="10 steps to first workflow" onClick={() => go('help/getting-started')} />
            <MenuItem testId="help-menu-user-guide" label="User Guide" sub="Every screen explained" onClick={() => go('help/user-guide')} />
            <MenuItem testId="help-menu-runtime" label="Runtime Setup" sub="Hermes · OpenClaw · Claude Code" onClick={() => go('help/runtime-setup')} />
            <MenuItem testId="help-menu-memory" label="Memory Setup" sub="Obsidian · Notion · Knowledge" onClick={() => go('help/memory-setup')} />
            <MenuItem testId="help-menu-troubleshooting" label="Troubleshooting" sub="Fix common issues" onClick={() => go('help/troubleshooting')} />
            <MenuItem testId="help-menu-glossary" label="Glossary" sub="Plain-English definitions" onClick={() => go('help/glossary')} />
          </div>
          <div className="border-t border-border/40 py-1">
            <MenuItem
              testId="help-menu-replay-tour"
              label="Replay tour"
              sub="Walk through the dashboard again"
              onClick={() => { setOpen(false); replayFirstRunTour() }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, sub, onClick, testId }: { label: string; sub: string; onClick: () => void; testId: string }) {
  return (
    <button
      role="menuitem"
      data-testid={testId}
      onClick={onClick}
      className="w-full text-left px-4 py-2 hover:bg-secondary/40 transition-colors"
    >
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>
    </button>
  )
}
