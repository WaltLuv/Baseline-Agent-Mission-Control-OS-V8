'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * CountUp — calm, premium animated counter for executive metrics.
 *
 * - Respects `prefers-reduced-motion` (renders the final value immediately).
 * - Eases out (no spring, no bounce — this is a CFO/COO dashboard, not a game).
 * - Restarts when `to` changes (e.g. when the briefing reloads).
 */
interface Props {
  to: number
  durationMs?: number
  prefix?: string
  suffix?: string
  format?: (n: number) => string
  className?: string
  ['data-testid']?: string
}

export function CountUp({
  to,
  durationMs = 900,
  prefix = '',
  suffix = '',
  format,
  className,
  ...rest
}: Props) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startedAt = useRef<number | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      setValue(to)
      return
    }
    startedAt.current = null
    const from = 0
    const ease = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic
    const tick = (ts: number) => {
      if (startedAt.current === null) startedAt.current = ts
      const p = Math.min(1, (ts - startedAt.current) / durationMs)
      setValue(from + (to - from) * ease(p))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [to, durationMs, reduced])

  const display = format ? format(value) : Math.round(value).toLocaleString()
  return (
    <span className={className} data-testid={rest['data-testid']}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}

function useReducedMotion() {
  const [v, setV] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setV(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setV(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return v
}
