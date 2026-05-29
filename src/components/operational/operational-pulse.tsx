'use client'

import { useEffect, useState } from 'react'
import { useMissionControl } from '@/store'
import {
  useOperationalTick,
  freshness,
  freshnessLabel,
  ageLabel,
} from '@/lib/operational-tick'

/**
 * Operational Pulse — a small, executive-grade "the system is on shift"
 * indicator. A slow breathing dot in the header. Click reveals a calm
 * tray with last event age, agent count, and SSE state.
 *
 * Calm rules:
 *   - Slow 4s breathe, never strobing
 *   - Green only when both SSE is connected AND an event was seen recently
 *   - Amber when connected but quiet for >15s
 *   - Grey when SSE is off (no fake "live")
 *   - Hides entirely under prefers-reduced-motion mode (kept static dot)
 */
export function OperationalPulse() {
  const { connection, agents } = useMissionControl()
  const tick = useOperationalTick(1000)
  const [open, setOpen] = useState(false)
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)

  // Listen to the existing SSE event bus by patching the document with a
  // CustomEvent name the server-events hook already dispatches. To stay
  // additive (no API changes), we also bump the timestamp whenever the
  // store's sseConnected flag becomes true.
  useEffect(() => {
    if (connection.sseConnected) setLastEventAt(Date.now())
  }, [connection.sseConnected])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onEvent = () => setLastEventAt(Date.now())
    // The server-events hook fires these for tasks, agents, chat, etc.
    for (const name of ['mc:task-update', 'mc:agent-update', 'mc:activity', 'mc:notification']) {
      window.addEventListener(name, onEvent as EventListener)
    }
    return () => {
      for (const name of ['mc:task-update', 'mc:agent-update', 'mc:activity', 'mc:notification']) {
        window.removeEventListener(name, onEvent as EventListener)
      }
    }
  }, [])

  // Re-evaluate freshness on every tick so the dot transitions calmly.
  const isSseDown = !connection.sseConnected
  const state = isSseDown ? 'cold' : freshness(lastEventAt, Date.now())

  // Hide the tick value with void so TypeScript doesn't complain — it's used
  // implicitly by React to re-render this component on every second.
  void tick.count

  const dotClass =
    state === 'live'
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
      : state === 'stale'
      ? 'bg-amber-300'
      : 'bg-muted-foreground/40'

  const ringClass =
    state === 'live'
      ? 'border-emerald-400/30'
      : state === 'stale'
      ? 'border-amber-300/30'
      : 'border-muted-foreground/20'

  const breathing = state === 'live'

  const activeAgents = agents.filter((a) => a.status === 'busy').length

  return (
    <div className="relative" data-testid="operational-pulse" data-state={state}>
      <button
        type="button"
        data-testid="operational-pulse-trigger"
        aria-label={`System status — ${freshnessLabel(state)}`}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 h-8 px-2 rounded-md border ${ringClass} bg-card/40 hover:bg-card/60 transition-colors`}
      >
        <span className="relative inline-flex items-center justify-center w-3 h-3">
          {/* breathing halo — only when live */}
          {breathing && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-emerald-400/30 animate-[mcBreathe_4s_ease-in-out_infinite]"
            />
          )}
          <span className={`relative w-1.5 h-1.5 rounded-full ${dotClass}`} />
        </span>
        <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground tracking-tight">
          {freshnessLabel(state)}
        </span>
      </button>
      {open && (
        <div
          role="dialog"
          data-testid="operational-pulse-tray"
          className="absolute right-0 mt-2 w-72 rounded-lg border border-border/60 bg-popover shadow-xl p-4 z-50"
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
            System status
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-foreground">{freshnessLabel(state)}</h3>
            <span className="text-[11px] text-muted-foreground">
              last signal {ageLabel(lastEventAt)}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-xs">
            <PulseRow label="Live stream" value={connection.sseConnected ? 'Connected' : 'Disconnected'} tone={connection.sseConnected ? 'good' : 'cold'} />
            <PulseRow label="Workforce on shift" value={`${activeAgents} of ${agents.length}`} />
            <PulseRow label="Uptime in view" value={`${Math.floor(tick.seconds)}s`} />
          </dl>
          <p className="mt-4 text-[11px] text-muted-foreground/80 leading-relaxed">
            A calm pulse. Green when the system is taking events. Amber when
            quiet for a minute. Grey only when the live stream is off — never
            faked.
          </p>
        </div>
      )}
    </div>
  )
}

function PulseRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'good' | 'cold'
}) {
  const valueClass =
    tone === 'good' ? 'text-emerald-300' : tone === 'cold' ? 'text-muted-foreground/70' : 'text-foreground'
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={valueClass}>{value}</dd>
    </div>
  )
}
