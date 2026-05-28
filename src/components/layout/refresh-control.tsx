'use client'

import { useState, useRef, useEffect } from 'react'
import { useRefreshConfig, REFRESH_INTERVAL_PRESETS } from '@/lib/refresh-prefs'

/**
 * Header-bar control giving operators visible authority over background
 * refresh behaviour:
 *   - one-click "Refresh now" to update every panel on demand
 *   - toggle auto-refresh on/off
 *   - cadence selector (60s · 2m · 5m · 10m)
 *
 * Visible across every authenticated route via HeaderBar.
 */
export function RefreshControl() {
  const cfg = useRefreshConfig()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const intervalLabel = (() => {
    const sec = Math.round(cfg.intervalMs / 1000)
    if (sec < 60) return `${sec}s`
    const min = Math.round(sec / 60)
    return `${min}m`
  })()

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1 rounded-md border border-border/60 bg-card/40 px-1 py-0.5">
        <button
          type="button"
          onClick={cfg.triggerRefresh}
          data-testid="refresh-now-button"
          title="Refresh all panels now"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground hover:bg-muted/40 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          <span className="hidden md:inline">Refresh</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          data-testid="refresh-prefs-toggle"
          title="Auto-refresh settings"
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            cfg.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="hidden md:inline">{cfg.enabled ? `Auto · ${intervalLabel}` : 'Paused'}</span>
        </button>
      </div>

      {open && (
        <div
          data-testid="refresh-prefs-popover"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-xl"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Background refresh
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mission Control updates panels in the background. Turn it down or off if it gets in your way.
          </p>

          <label className="mt-3 flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-2 py-1.5 text-xs">
            <span className="text-foreground">Auto-refresh</span>
            <button
              type="button"
              role="switch"
              aria-checked={cfg.enabled}
              onClick={() => cfg.setEnabled(!cfg.enabled)}
              data-testid="refresh-enabled-switch"
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                cfg.enabled ? 'bg-emerald-500/60' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                  cfg.enabled ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          <fieldset className={`mt-2 space-y-1 ${cfg.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <legend className="text-xs text-muted-foreground mb-1">Cadence</legend>
            {REFRESH_INTERVAL_PRESETS.map((ms) => {
              const sec = ms / 1000
              const label = sec < 60 ? `${sec}s` : sec === 60 ? '1 min' : `${sec / 60} min`
              const checked = cfg.intervalMs === ms
              return (
                <label
                  key={ms}
                  data-testid={`refresh-interval-${ms}`}
                  className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted/40 ${
                    checked ? 'bg-primary/10 text-primary' : 'text-foreground'
                  }`}
                >
                  <span>Every {label}</span>
                  <input
                    type="radio"
                    name="refresh-interval"
                    value={ms}
                    checked={checked}
                    onChange={() => cfg.setIntervalMs(ms)}
                    className="accent-primary"
                  />
                </label>
              )
            })}
          </fieldset>

          <p className="mt-2 text-[10px] text-muted-foreground">
            Refresh always pauses while the tab is hidden or you&apos;re using a modal or form.
          </p>
        </div>
      )}
    </div>
  )
}
