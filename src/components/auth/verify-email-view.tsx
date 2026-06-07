'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The "Verify your email to continue" screen. Used by /verify-email,
 * /verify-email/sent, and /verify-email/expired (via `mode`). Lets the user
 * resend the link (with a live cooldown), log out, and explains exactly what
 * is locked until they verify.
 */
type Mode = 'pending' | 'sent' | 'expired'

interface Me {
  email: string | null
  email_verified: boolean
}

export function VerifyEmailView({ mode = 'pending' }: { mode?: Mode }) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(
    mode === 'sent' ? 'Verification email sent. Check your inbox.' :
    mode === 'expired' ? 'That verification link was invalid or expired. Request a new one below.' :
    null,
  )
  const [emailConfigured, setEmailConfigured] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setMe({ email: d.user.email ?? null, email_verified: !!d.user.email_verified })
          // Already verified → bounce into onboarding.
          if (d.user.email_verified) router.replace('/onboarding')
        }
      })
      .catch(() => {})
  }, [router])

  // Live cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const resend = useCallback(async () => {
    setBusy(true); setNotice(null)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429 && data.cooldownRemaining) {
        setCooldown(data.cooldownRemaining)
        setNotice(`You can resend in ${data.cooldownRemaining}s.`)
      } else if (data.ok) {
        setCooldown(60)
        if (data.emailConfigured === false || data.sent === false) {
          setEmailConfigured(false)
          setNotice('Email delivery is not configured on this server yet. Ask an admin to set MC_RESEND_API_KEY.')
        } else {
          setNotice('Verification email sent. Check your inbox.')
        }
      } else {
        setNotice(data.error || 'Could not resend right now.')
      }
    } catch {
      setNotice('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* noop */ }
    router.replace('/login')
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#09090b] text-[#fafafa] px-4 py-12" data-testid="verify-email-page" data-mode={mode}>
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7">
        <div className="text-4xl mb-3">✉️</div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="verify-email-title">Verify your email to continue</h1>
        <p className="mt-3 text-sm text-white/60 leading-relaxed">
          We sent a verification link to{' '}
          <strong className="text-white" data-testid="verify-email-address">{me?.email || 'your email'}</strong>.
          Verify your email before connecting runtimes, storing API keys, buying credits, or activating your workforce.
        </p>

        <ul className="mt-4 text-[12px] text-white/45 space-y-1 list-disc list-inside">
          <li>Billing &amp; credits</li>
          <li>Credentials / API keys</li>
          <li>Runtime keys &amp; connecting runtimes</li>
          <li>Marketplace purchases &amp; team invites</li>
        </ul>

        {notice && (
          <div className="mt-4 rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2 text-xs text-violet-100" data-testid="verify-email-notice">
            {notice}
          </div>
        )}
        {!emailConfigured && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100" data-testid="verify-email-setup-needed">
            Email provider not configured (setup needed).
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            data-testid="verify-email-resend"
            disabled={busy || cooldown > 0}
            onClick={resend}
            className="h-10 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : busy ? 'Sending…' : 'Resend verification email'}
          </button>
          <button
            type="button"
            data-testid="verify-email-change"
            onClick={logout}
            className="h-9 rounded-lg bg-white/[0.05] text-white/75 text-sm border border-white/[0.08] hover:bg-white/[0.08]"
          >
            Change email (sign out &amp; sign up again)
          </button>
          <button
            type="button"
            data-testid="verify-email-logout"
            onClick={logout}
            className="h-9 text-sm text-white/45 hover:text-white/80"
          >
            Log out
          </button>
        </div>
      </div>
    </main>
  )
}
