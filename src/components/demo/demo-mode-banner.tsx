'use client'

import { useDemoMode } from './demo-mode-provider'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Top-bar Demo Mode indicator.
 *
 * Renders only when demo mode is active. Shows the active vertical and a
 * one-click "Exit Demo Mode" button. Exit:
 *   1. Clears the mc_demo_template cookie (via setDemo(null)).
 *   2. Strips ?demo, ?tour, ?share params from the URL.
 *   3. Clears any guided-tour state (dispatched event so the tour overlay
 *      removes itself; tour listens for `mc:guided-demo:close`).
 *   4. Does NOT call router.refresh — the demo provider's React state
 *      change re-renders every consumer without resetting scroll, modals,
 *      or input state.
 */
export function DemoModeBanner() {
  const { active, narrative, setDemo } = useDemoMode()
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()

  const exitDemoMode = useCallback(() => {
    // 1 & 3: Clear cookie + state. Close any guided tour.
    setDemo(null)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mc:guided-demo:close'))
    }

    // 2: Strip demo-related query params from the URL.
    const next = new URLSearchParams(params?.toString() ?? '')
    next.delete('demo')
    next.delete('tour')
    next.delete('share')
    next.delete('prospect')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname || '/', { scroll: false })
  }, [params, pathname, router, setDemo])

  if (!active) return null

  const verticalLabel = narrative?.template?.name || 'Demo workspace'

  return (
    <div
      data-testid="demo-mode-banner"
      role="status"
      className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-100 backdrop-blur"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-50">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
          Demo Mode
        </span>
        <span className="text-xs text-amber-100/90 truncate">
          You are viewing <span className="font-semibold text-amber-50">{verticalLabel}</span>. This is a curated storyline — no live customer data.
        </span>
      </div>
      <button
        type="button"
        onClick={exitDemoMode}
        data-testid="exit-demo-mode-btn"
        className="shrink-0 rounded-md border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-200/20 hover:border-amber-200/50 transition-colors"
      >
        Exit Demo Mode
      </button>
    </div>
  )
}
