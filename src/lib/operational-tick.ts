'use client'

import { useEffect, useState } from 'react'

/**
 * Operational Tick — a single, app-wide calm clock.
 *
 * Components that need to "feel alive" without flashing subscribe here and
 * receive a slow, regular tick (default once per second). All visual
 * derivations should be additive and low-contrast — this hook is the
 * heartbeat of the executive surface, never a strobe.
 *
 * Honors `prefers-reduced-motion` by stopping the tick entirely.
 */
export interface OperationalTick {
  /** Wall-clock seconds since the hook mounted. */
  seconds: number
  /** Monotonic tick counter — useful as a key to retrigger entrance motion. */
  count: number
  /** True only while the document is visible. Reduces wakeups in background tabs. */
  visible: boolean
}

const DEFAULT_INTERVAL = 1000

export function useOperationalTick(intervalMs: number = DEFAULT_INTERVAL): OperationalTick {
  const [tick, setTick] = useState<OperationalTick>({ seconds: 0, count: 0, visible: true })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Respect reduced-motion: keep the value but never advance it.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    let mounted = true
    let visible = typeof document !== 'undefined' ? !document.hidden : true

    const onVis = () => {
      visible = !document.hidden
      setTick((t) => ({ ...t, visible }))
    }
    document.addEventListener('visibilitychange', onVis)

    const id = window.setInterval(() => {
      if (!mounted || !visible) return
      setTick((t) => ({ seconds: t.seconds + intervalMs / 1000, count: t.count + 1, visible: true }))
    }, intervalMs)

    return () => {
      mounted = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs])

  return tick
}

/**
 * Derives a calm "freshness" state from a last-event timestamp.
 * Used to drive the Operational Pulse colour and label.
 */
export type Freshness = 'live' | 'stale' | 'cold'

export function freshness(lastEventAtMs: number | null, now: number = Date.now()): Freshness {
  if (lastEventAtMs == null) return 'cold'
  const age = now - lastEventAtMs
  if (age < 15_000) return 'live'
  if (age < 60_000) return 'stale'
  return 'cold'
}

export function freshnessLabel(state: Freshness): string {
  switch (state) {
    case 'live':
      return 'On shift'
    case 'stale':
      return 'Catching breath'
    case 'cold':
      return 'Off shift'
  }
}

/**
 * Friendly age in plain English. Used in Operational Pulse tooltip.
 */
export function ageLabel(lastEventAtMs: number | null, now: number = Date.now()): string {
  if (lastEventAtMs == null) return 'never'
  const age = Math.max(0, now - lastEventAtMs)
  const sec = Math.floor(age / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}
