'use client'

import { useState } from 'react'

/**
 * Send Briefing — secure-share control mounted in the Executive Briefing.
 *
 * What it does:
 *   - Operator clicks "Send Briefing" → modal opens
 *   - Three actions: Copy link · Send to Slack · Send to email
 *   - Each routes through POST /api/briefing/share which signs the link
 *     (HMAC) and stores a snapshot. Links expire in 7 days by default.
 *   - If the workspace has no email provider / Slack webhook configured,
 *     the server returns `{ requiresSetup: 'email'|'slack' }` and we show
 *     the operator a friendly setup prompt + a fallback copy summary.
 *   - No public workforce profiles. Read-only snapshot view only.
 */
interface BriefingPayload {
  headline: string
  valueCreatedMonthUsd: number
  hoursSavedMonth: number
  dailyWins: { title: string; impact: string; valueUsd: number }[]
  attentionItems: { title: string; severity: 'low' | 'medium' | 'high'; reason: string }[]
  topEmployee: { name: string; impact: string } | null
  nextAction: { label: string; href: string }
}

interface ShareResp {
  ok?: boolean
  shareUrl?: string
  summary?: string
  expiresAt?: number
  requiresSetup?: 'email' | 'slack'
  message?: string
  error?: string
  note?: string
}

export function ShareBriefingButton({ briefing }: { briefing: BriefingPayload }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ShareResp | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [copied, setCopied] = useState(false)

  const send = async (channel: 'copy' | 'link' | 'slack' | 'email', to?: string) => {
    setBusy(true)
    setResult(null)
    try {
      const r = await fetch('/api/briefing/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel, to, briefing, expiresInDays: 7 }),
      })
      const data = (await r.json()) as ShareResp
      setResult(data)
      // For copy/link actions, copy the URL automatically
      if ((channel === 'copy' || channel === 'link') && data.shareUrl) {
        try {
          await navigator.clipboard.writeText(data.summary || data.shareUrl)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // ignore — user can still see the link in the modal
        }
      }
    } catch (e) {
      setResult({ error: String(e).slice(0, 200) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="share-briefing-button"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Send Briefing
      </button>

      {open && (
        <div
          data-testid="share-briefing-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Send executive briefing</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share a read-only snapshot to your COO, CFO, or investor. Link expires in 7 days.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                data-testid="share-modal-close"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => send('copy')}
                data-testid="share-action-copy"
                className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                <span>Copy briefing &amp; signed link</span>
                <span className="text-xs text-muted-foreground">{copied ? 'Copied ✓' : 'Recommended'}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => send('slack')}
                data-testid="share-action-slack"
                className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                <span>Send to Slack</span>
                <span className="text-xs text-muted-foreground">via configured webhook</span>
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="coo@yourbusiness.com"
                  data-testid="share-email-input"
                  className="flex-1 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  disabled={busy || !emailTo}
                  onClick={() => send('email', emailTo)}
                  data-testid="share-action-email"
                  className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>

            {result && (
              <div
                data-testid="share-result"
                className={`mt-4 rounded-lg border p-3 text-xs ${
                  result.error
                    ? 'border-red-500/30 bg-red-500/5 text-red-300'
                    : result.requiresSetup
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
                    : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
                }`}
              >
                {result.error && <p>{result.error}</p>}
                {result.requiresSetup && (
                  <p>
                    {result.message} The briefing summary was prepared anyway — copy it below or
                    set up the integration in Settings → Integrations.
                  </p>
                )}
                {result.ok && !result.requiresSetup && (
                  <p>Sent. {result.note ? result.note : ''} Link expires in 7 days.</p>
                )}
                {result.shareUrl && (
                  <p className="mt-2 break-all text-muted-foreground">
                    Signed link: <span className="text-foreground">{result.shareUrl}</span>
                  </p>
                )}
                {result.summary && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[10px] text-muted-foreground">
                    {result.summary}
                  </pre>
                )}
              </div>
            )}

            <p className="mt-4 text-[10px] text-muted-foreground">
              The shared snapshot includes wins, attention items, value created, and the next
              recommended action. It does <strong>not</strong> share secrets, customer PII, or
              workspace credentials. Every share is recorded in the audit trail.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
