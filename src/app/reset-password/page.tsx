'use client'

import { useState, type FormEvent, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params?.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!token) {
    return (
      <div className="text-center" data-testid="reset-missing-token">
        <p className="text-sm text-red-300">Reset link is missing a token.</p>
        <Link href="/forgot-password" className="inline-block mt-3 text-void-cyan text-sm hover:underline">Request a new reset link</Link>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 12) { setError('Password must be at least 12 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not reset password.')
        return
      }
      router.replace('/login?reset=ok')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full mt-6 space-y-4" data-testid="reset-form">
      <div>
        <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1">New password</label>
        <input
          id="password"
          data-testid="reset-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan"
          placeholder="Minimum 12 characters"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-xs font-medium text-foreground mb-1">Confirm new password</label>
        <input
          id="confirm"
          data-testid="reset-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan"
        />
      </div>
      {error && <div data-testid="reset-error" role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}
      <button
        type="submit"
        data-testid="reset-submit"
        disabled={submitting}
        className="w-full bg-void-cyan text-[#04111f] font-semibold rounded-md py-2.5 text-sm disabled:opacity-60"
      >
        {submitting ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12" data-testid="reset-password-page">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Image src="/brand/mc-logo-128.png" alt="Mission Control" width={56} height={56} className="opacity-90 mb-3" />
        <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-void-cyan/80 mt-2">Powered by Baseline OS</p>
        <Suspense fallback={<p className="mt-4 text-sm text-muted-foreground">Loading…</p>}>
          <ResetForm />
        </Suspense>
        <p className="text-2xs text-muted-foreground/60 mt-8">Baseline OS · AI Workforce Operating System</p>
      </div>
    </main>
  )
}
