'use client'

import { useState } from 'react'
import { useDemoMode } from './demo-mode-provider'

interface ShareResponse {
  ok: boolean
  url?: string
  expiresAt?: number
  expiresInDays?: number
  vertical?: string
  error?: string
}

/**
 * Share This Demo — one-click signed demo link generator.
 *
 * Mints a signed, time-limited, watermarked link for the *current* demo
 * vertical and copies it to the operator's clipboard. The recipient opens
 * the link and lands directly inside the right storyline with the
 * Guided Demo auto-opened.
 *
 * Behavior:
 *   - Available only when a demo vertical is active.
 *   - Defaults to 7 days. Operator can pick 1 / 7 / 30 via a small popover.
 *   - Quiet failure: if no demo is active, the button is disabled.
 *   - This is not a public backdoor — see /api/demo-share for security.
 */
export function ShareDemoButton({
  variant = 'pill',
  testId = 'share-demo-button',
}: {
  variant?: 'pill' | 'menu'
  testId?: string
}) {
  const { active, templateId } = useDemoMode()
  const [open, setOpen] = useState(false)
  const [ttlDays, setTtlDays] = useState(7)
  const [status, setStatus] = useState<'idle' | 'minting' | 'copied' | 'error'>('idle')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function mintAndCopy() {
    if (!active || !templateId) return
    setStatus('minting')
    setError(null)
    try {
      const r = await fetch('/api/demo-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical: templateId, ttlDays, tour: true, watermark: true }),
      })
      const data = (await r.json()) as ShareResponse
      if (!r.ok || !data.ok || !data.url) {
        throw new Error(data.error || `Mint failed (${r.status})`)
      }
      setShareUrl(data.url)
      try {
        await navigator.clipboard.writeText(data.url)
        setStatus('copied')
      } catch {
        // Clipboard may be blocked in iframes; still expose the URL.
        setStatus('copied')
      }
    } catch (e) {
      setError(String(e).slice(0, 240))
      setStatus('error')
    }
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        data-testid={testId}
        disabled={!active}
        onClick={mintAndCopy}
        className="flex w-full items-center justify-between border-t border-border/40 bg-card/40 px-3 py-2.5 text-left text-xs text-foreground hover:bg-card/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span>
          <span className="block font-semibold text-foreground">Share this demo</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">
            {status === 'copied'
              ? `Demo link copied. Expires in ${ttlDays} day${ttlDays === 1 ? '' : 's'}.`
              : status === 'error'
              ? error
              : active
              ? 'Signed, watermarked, time-limited.'
              : 'Activate a demo vertical to share.'}
          </span>
        </span>
        <span className="text-primary text-sm">{status === 'minting' ? '…' : '↗'}</span>
      </button>
    )
  }

  return (
    <div className="relative inline-flex" data-testid={`${testId}-root`}>
      <button
        type="button"
        data-testid={testId}
        disabled={!active}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-card/60 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ShareIcon />
        Share this demo
      </button>
      {open && (
        <div
          role="dialog"
          data-testid={`${testId}-popover`}
          className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-border/60 bg-popover shadow-xl p-4 z-50"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
            Share a signed demo link
          </p>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            One link. Watermarked. Read-only. Lands directly inside the {' '}
            <span className="text-foreground font-medium">{templateId}</span> storyline with the Guided
            Demo open.
          </p>
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">Expires</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Expiry">
              {[1, 7, 30].map((d) => (
                <button
                  key={d}
                  role="radio"
                  aria-checked={ttlDays === d}
                  data-testid={`${testId}-ttl-${d}`}
                  onClick={() => setTtlDays(d)}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs ${
                    ttlDays === d
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border/60 text-muted-foreground hover:bg-secondary/60'
                  }`}
                >
                  {d === 1 ? '1 day' : d === 7 ? '7 days' : '30 days'}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            data-testid={`${testId}-mint`}
            disabled={status === 'minting'}
            onClick={mintAndCopy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {status === 'minting' ? 'Generating…' : status === 'copied' ? 'Link copied · regenerate' : 'Copy share link'}
          </button>
          {status === 'copied' && shareUrl && (
            <div
              data-testid={`${testId}-confirmation`}
              className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[11px] text-emerald-200 leading-relaxed"
            >
              Demo link copied. Expires in {ttlDays} day{ttlDays === 1 ? '' : 's'}.
              <span className="mt-1 block truncate text-emerald-300/80">{shareUrl}</span>
            </div>
          )}
          {status === 'error' && (
            <div
              data-testid={`${testId}-error`}
              className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-[11px] text-rose-200 leading-relaxed"
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
      <circle cx="4" cy="8" r="1.6" />
      <circle cx="12" cy="4" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M5.4 7.3l5.2-2.6M5.4 8.7l5.2 2.6" strokeLinecap="round" />
    </svg>
  )
}
