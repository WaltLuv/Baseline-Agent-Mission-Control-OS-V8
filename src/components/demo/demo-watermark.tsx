'use client'

import { useEffect, useState } from 'react'

/**
 * DemoWatermark — a subtle, persistent reminder that the user is looking
 * at a curated demo workspace. Shown only when the current session was
 * launched via a signed demo share link (i.e. a token was applied).
 *
 * If the share link carried a prospect display name, the watermark reads:
 *   "Demo workspace for <Prospect> · Baseline OS · No live customer data"
 * Otherwise it falls back to:
 *   "Demo workspace · Baseline OS · No live customer data"
 *
 * Calm, low-contrast, fixed bottom-right. Never covers content. Never
 * blocks interaction.
 */
export function DemoWatermark() {
  const [show, setShow] = useState(false)
  const [prospect, setProspect] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    function refresh() {
      setShow(window.sessionStorage.getItem('mc:demo-share-watermark') === '1')
      setProspect(window.sessionStorage.getItem('mc:demo-share-prospect') || '')
    }
    refresh()
    function onStorage(e: StorageEvent) {
      if (e.key === 'mc:demo-share-watermark' || e.key === 'mc:demo-share-prospect') refresh()
    }
    window.addEventListener('mc:demo-share-applied', refresh as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('mc:demo-share-applied', refresh as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (!show) return null
  const label = prospect
    ? `Demo workspace for ${prospect} · Baseline OS · No live customer data`
    : 'Demo workspace · Baseline OS · No live customer data'
  return (
    <div
      aria-hidden
      data-testid="demo-watermark"
      data-prospect={prospect || undefined}
      className="pointer-events-none fixed bottom-3 right-3 z-[60] select-none"
    >
      <div className="rounded-full border border-primary/30 bg-card/70 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary/80 shadow-lg">
        {label}
      </div>
    </div>
  )
}
