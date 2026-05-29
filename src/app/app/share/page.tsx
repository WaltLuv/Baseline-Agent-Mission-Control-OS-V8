'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import type { FocusEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DEMO_TEMPLATE_IDS } from '@/lib/demo-narratives'
import { sanitizeProspectName, clampHours, DEFAULT_TTL_DAYS, MAX_TTL_DAYS } from '@/lib/demo-share-shared'

/**
 * /app/share — salesperson preset.
 *
 * Reads:
 *   ?vertical=<id>    — required, must be a known demo storyline
 *   ?prospect=<name>  — optional, displayed inside the watermark
 *   ?hours=<n>        — optional, presentation context only
 *   ?ttl=<days>       — optional, 1..30, clamped (default 7)
 *
 * Calls `POST /api/demo-share` with the inputs, then surfaces:
 *   - the public redeem URL (one-tap copy)
 *   - the expiry timestamp
 *   - a quick "Open preview" button
 *
 * This page is operator-only. A demo guest with the read-only cookie
 * lands on the "salesperson access required" notice — they can never
 * mint new tokens.
 *
 * Security:
 *   - `POST /api/demo-share` requires the operator role server-side.
 *   - Prospect name is sanitized client-side AND server-side.
 *   - TTL is clamped 1..30 days both sides.
 *   - No state is persisted in the URL beyond the prospect display name.
 */

type MintResult = {
  ok: true
  url: string
  directUrl: string
  token: string
  expiresAt: number
  expiresInDays: number
  vertical: string
  tour: boolean
  watermark: boolean
  prospect?: string
  hours?: number
}

interface AuthUser {
  username: string
  role: string
}

function ShareInner() {
  const router = useRouter()
  const params = useSearchParams()

  const rawVertical = (params?.get('vertical') || '').trim()
  const rawProspect = params?.get('prospect') || ''
  const rawHours = params?.get('hours') || ''
  const rawTtl = params?.get('ttl') || ''

  const sanitizedProspect = useMemo(() => sanitizeProspectName(rawProspect), [rawProspect])
  const sanitizedHours = useMemo(() => clampHours(rawHours), [rawHours])
  const ttl = useMemo(() => {
    const n = Number(rawTtl)
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_TTL_DAYS
    return Math.max(1, Math.min(MAX_TTL_DAYS, Math.floor(n)))
  }, [rawTtl])

  const verticalValid = DEMO_TEMPLATE_IDS.includes(rawVertical)

  const [user, setUser] = useState<AuthUser | null>(null)
  const [authStatus, setAuthStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')
  const [minting, setMinting] = useState(false)
  const [result, setResult] = useState<MintResult | null>(null)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Check operator role.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const u = d?.user as AuthUser | undefined
        if (!u) {
          setAuthStatus('denied')
          return
        }
        setUser(u)
        // operator OR admin can mint. demo-guest, viewer cannot.
        setAuthStatus(u.role === 'admin' || u.role === 'operator' ? 'allowed' : 'denied')
      })
      .catch(() => setAuthStatus('denied'))
  }, [])

  // Auto-mint when the URL has a valid vertical and the user is allowed.
  useEffect(() => {
    if (authStatus !== 'allowed') return
    if (!verticalValid) return
    if (result || minting) return
    setMinting(true)
    setError('')
    fetch('/api/demo-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vertical: rawVertical,
        ttlDays: ttl,
        tour: true,
        watermark: true,
        prospect: sanitizedProspect || undefined,
        hours: sanitizedHours,
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok || !d?.ok) {
          setError(d?.error || 'Failed to mint demo link')
          return
        }
        // Normalize URLs to the browser-visible origin. The server may sit
        // behind a Cloudflare / K8s ingress that emits a different upstream
        // host in x-forwarded-host; the prospect must receive the public
        // host they actually opened.
        const fixed = { ...d } as MintResult
        try {
          const pubOrigin = window.location.origin
          const fixUrl = (raw: string) => {
            try {
              const u = new URL(raw)
              const p = new URL(pubOrigin)
              u.protocol = p.protocol
              u.host = p.host
              return u.toString()
            } catch {
              return raw
            }
          }
          if (fixed.url) fixed.url = fixUrl(fixed.url)
          if (fixed.directUrl) fixed.directUrl = fixUrl(fixed.directUrl)
        } catch { /* leave as-is */ }
        setResult(fixed)
      })
      .catch(() => setError('Network error — try again.'))
      .finally(() => setMinting(false))
  }, [authStatus, verticalValid, rawVertical, sanitizedProspect, sanitizedHours, ttl, result, minting])

  async function copyLink() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  // ---------- render guards ----------
  if (authStatus === 'loading') {
    return (
      <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground" data-testid="share-loading">
        Checking access…
      </div>
    )
  }

  if (authStatus === 'denied') {
    return (
      <div className="mx-auto max-w-2xl p-8 space-y-4" data-testid="share-denied">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Demo Share · Salesperson</div>
        <h1 className="text-2xl font-semibold">Salesperson access required</h1>
        <p className="text-sm text-muted-foreground">
          The share preset is for operators who supervise the AI workforce in their
          own workspace. Sign in with your operator account to mint a tailored demo
          link for a prospect.
        </p>
        <div className="flex gap-2 pt-2">
          <Button data-testid="share-denied-login" onClick={() => router.push('/login?next=/app/share' + (rawVertical ? `?vertical=${rawVertical}` : ''))}>
            Sign in
          </Button>
          <Button variant="outline" data-testid="share-denied-back" onClick={() => router.push('/marketplace')}>
            Back to marketplace
          </Button>
        </div>
      </div>
    )
  }

  if (!rawVertical) {
    return (
      <div className="mx-auto max-w-2xl p-8 space-y-4" data-testid="share-missing-vertical">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Demo Share</div>
        <h1 className="text-2xl font-semibold">Pick a vertical to share</h1>
        <p className="text-sm text-muted-foreground">
          Append <code className="rounded bg-muted px-1 py-0.5 text-xs">?vertical=&lt;id&gt;</code> to this URL
          to mint a demo link. Optional: <code className="rounded bg-muted px-1 py-0.5 text-xs">&amp;prospect=Acme</code>
          {' '}and <code className="rounded bg-muted px-1 py-0.5 text-xs">&amp;hours=8</code>.
        </p>
        <div className="flex flex-wrap gap-2 pt-2" data-testid="share-vertical-list">
          {DEMO_TEMPLATE_IDS.map((v) => (
            <Button
              key={v}
              size="sm"
              variant="outline"
              data-testid={`share-vertical-${v}`}
              onClick={() => router.replace(`/app/share?vertical=${v}`)}
            >
              {v}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  if (!verticalValid) {
    return (
      <div className="mx-auto max-w-2xl p-8 space-y-4" data-testid="share-invalid-vertical">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Demo Share</div>
        <h1 className="text-2xl font-semibold">That vertical isn&rsquo;t available yet</h1>
        <p className="text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{rawVertical}</code> isn&rsquo;t one of the
          curated demo storylines yet. Pick from:
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {DEMO_TEMPLATE_IDS.map((v) => (
            <Button key={v} size="sm" variant="outline" onClick={() => router.replace(`/app/share?vertical=${v}`)}>
              {v}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  // ---------- mint flow ----------
  return (
    <div className="mx-auto max-w-2xl p-8 space-y-6" data-testid="share-preset">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Demo Share · Salesperson</div>
        <h1 className="text-2xl font-semibold">Tailored demo link</h1>
        <p className="text-sm text-muted-foreground">
          Signed, time-limited, watermarked. Read-only — no live customer data, no
          mutation endpoints. The prospect lands directly in the guided demo.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Vertical</div>
            <div className="font-medium" data-testid="share-vertical-value">{rawVertical}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Expires in</div>
            <div className="font-medium" data-testid="share-ttl-value">
              {ttl} {ttl === 1 ? 'day' : 'days'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Prospect</div>
            <div className="font-medium" data-testid="share-prospect-value">
              {sanitizedProspect || <span className="text-muted-foreground">—</span>}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Hours saved/wk (context)</div>
            <div className="font-medium" data-testid="share-hours-value">
              {sanitizedHours !== undefined ? sanitizedHours : <span className="text-muted-foreground">—</span>}
            </div>
          </div>
        </div>
        {sanitizedProspect && (
          <div className="text-xs text-muted-foreground" data-testid="share-watermark-preview">
            Watermark on the prospect&rsquo;s screen will read:{' '}
            <span className="italic text-foreground/80">
              &ldquo;Demo workspace for {sanitizedProspect} · Baseline OS · No live customer data&rdquo;
            </span>
          </div>
        )}
      </section>

      {minting && (
        <div className="text-sm text-muted-foreground" data-testid="share-minting">
          Minting signed link…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" data-testid="share-error">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-3" data-testid="share-result">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Signed redeem URL</div>
          <div className="flex gap-2">
            <input
              readOnly
              value={result.url}
              onFocus={(e: FocusEvent<HTMLInputElement>) => e.currentTarget.select()}
              data-testid="share-url-input"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            />
            <Button onClick={copyLink} data-testid="share-copy-btn">
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span data-testid="share-expires-at">
              Expires {new Date(result.expiresAt * 1000).toLocaleString()}
            </span>
            <span aria-hidden>·</span>
            <span>Read-only</span>
            <span aria-hidden>·</span>
            <span>Guided Demo auto-opens</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Button asChild data-testid="share-open-preview">
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                Open preview in new tab
              </a>
            </Button>
            <Button
              variant="outline"
              data-testid="share-mint-another"
              onClick={() => {
                setResult(null)
                router.replace('/app/share')
              }}
            >
              Mint another
            </Button>
          </div>
          {user?.username && (
            <div className="pt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground" data-testid="share-issued-by">
              Issued by {user.username}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default function SharePresetPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">Loading…</div>}>
      <ShareInner />
    </Suspense>
  )
}
