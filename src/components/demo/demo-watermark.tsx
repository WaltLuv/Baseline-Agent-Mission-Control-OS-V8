'use client'

import { useEffect, useState } from 'react'

/**
 * DemoWatermark — a subtle, persistent reminder that the user is looking
 * at a curated demo workspace. Shown only when the current session was
 * launched via a signed demo share link (i.e. a token was applied).
 *
 * Calm, low-contrast, fixed bottom-right. Never covers content. Never
 * blocks interaction. Disappears under prefers-reduced-motion only if
 * the user has explicitly opted out (we keep the static label).
 */
export function DemoWatermark() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    function refresh() {
      setShow(window.sessionStorage.getItem('mc:demo-share-watermark') === '1')
    }
    refresh()
    function onStorage(e: StorageEvent) {
      if (e.key === 'mc:demo-share-watermark') refresh()
    }
    window.addEventListener('mc:demo-share-applied', refresh as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('mc:demo-share-applied', refresh as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (!show) return null
  return (
    <div
      aria-hidden
      data-testid="demo-watermark"
      className="pointer-events-none fixed bottom-3 right-3 z-[60] select-none"
    >
      <div className="rounded-full border border-primary/30 bg-card/70 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary/80 shadow-lg">
        Demo workspace · Baseline OS · No live customer data
      </div>
    </div>
  )
}
