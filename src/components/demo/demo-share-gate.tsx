'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDemoMode } from './demo-mode-provider'

/**
 * DemoShareGate — applies an inbound signed demo share link.
 *
 * Reads `?share=<token>` from the URL on first paint. Validates the token
 * via /api/demo-share/verify. On success:
 *   - sets demo vertical
 *   - enables the watermark (sessionStorage flag)
 *   - opens the Guided Demo if `tour=1`
 *   - strips the share + tour params from the URL so the operator can
 *     navigate without the token re-firing
 *
 * On failure (invalid / expired / wrong perms) the gate redirects to
 * /demo/expired so the prospect sees a clean expired-link state.
 *
 * Read-only: the gate never writes to the DB and never reads private data.
 */
export function DemoShareGate() {
  const router = useRouter()
  const { setDemo } = useDemoMode()

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Read the share token directly from window.location so we don't depend
    // on Next.js's useSearchParams (which can return null inside catch-all
    // routes during initial hydration).
    let token: string | null = null
    try {
      const url = new URL(window.location.href)
      token = url.searchParams.get('share')
    } catch {
      token = null
    }
    if (!token) {
      const wasShareSession = window.sessionStorage.getItem('mc:demo-share-watermark') === '1'
      if (wasShareSession) {
        window.sessionStorage.removeItem('mc:demo-share-watermark')
        window.sessionStorage.removeItem('mc:demo-share-token')
        window.sessionStorage.removeItem('mc:demo-share-prospect')
        window.sessionStorage.removeItem('mc:demo-share-hours')
        window.dispatchEvent(new CustomEvent('mc:demo-share-applied'))
      }
      return
    }
    document.body.setAttribute('data-demo-share-gate', 'processing')
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/demo-share/verify?token=${encodeURIComponent(token)}`)
        const data = (await r.json()) as
          | { ok: true; payload: { vertical: string; tour: boolean; watermark: boolean; prospect?: string; hours?: number } }
          | { ok: false; reason: string }
        if (cancelled) return
        if (!data.ok) {
          router.replace(`/demo/expired?reason=${encodeURIComponent(data.reason)}`)
          return
        }
        // Apply the demo vertical (writes the canonical demo cookie).
        setDemo(data.payload.vertical)
        if (data.payload.watermark) {
          window.sessionStorage.setItem('mc:demo-share-watermark', '1')
          window.sessionStorage.setItem('mc:demo-share-token', token)
          if (data.payload.prospect) {
            window.sessionStorage.setItem('mc:demo-share-prospect', data.payload.prospect)
          } else {
            window.sessionStorage.removeItem('mc:demo-share-prospect')
          }
          if (typeof data.payload.hours === 'number') {
            window.sessionStorage.setItem('mc:demo-share-hours', String(data.payload.hours))
          } else {
            window.sessionStorage.removeItem('mc:demo-share-hours')
          }
          window.dispatchEvent(new CustomEvent('mc:demo-share-applied'))
        }
        // Suppress the first-run tour for the prospect — the Guided Demo is
        // a better introduction than the operator-focused first-run flow.
        window.localStorage.setItem('mc:first-run-tour:v1', '1')
        if (data.payload.tour) {
          // Wait a beat so the dashboard settles and the first-run tour (if it
          // raced) is dismissed by the localStorage flag above before opening.
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mc:guided-demo:open'))
          }, 1200)
        }
        // Strip the share + tour params from the URL while keeping demo=...
        const next = new URL(window.location.href)
        next.searchParams.delete('share')
        next.searchParams.delete('tour')
        router.replace(`${next.pathname}${next.search}`)
        document.body.setAttribute('data-demo-share-gate', 'applied')
      } catch {
        if (cancelled) return
        document.body.setAttribute('data-demo-share-gate', 'error')
        router.replace('/demo/expired?reason=network')
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
