'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

/**
 * Expired / invalid demo share landing.
 *
 * Reached automatically when /api/demo-share/verify returns a failure.
 * The page never reveals what kind of failure occurred to a prospect —
 * it simply offers a clear CTA to request a fresh link.
 */
export default function DemoExpiredPage() {
  const params = useSearchParams()
  const reason = params?.get('reason')
  return (
    <main
      data-testid="demo-expired-page"
      className="min-h-screen flex items-center justify-center px-6 py-12 bg-background text-foreground"
    >
      <div className="max-w-md w-full text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">
          Demo share
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">This demo link is no longer active.</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          The link has expired, been revoked, or wasn&apos;t a valid demo share.
          Ask whoever sent it for a fresh one — it takes a single click on their side.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/marketplace"
            data-testid="demo-expired-marketplace"
            className="rounded-md border border-border/60 bg-card/30 px-4 py-2 text-xs text-foreground hover:bg-card/60 transition-colors"
          >
            Browse the workforce
          </Link>
          <Link
            href="/login"
            data-testid="demo-expired-login"
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Request a fresh demo link
          </Link>
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground/70" data-testid="demo-expired-reason">
          {reason ? `Reason: ${reason}` : 'No live customer data is exposed by demo links.'}
        </p>
      </div>
    </main>
  )
}
