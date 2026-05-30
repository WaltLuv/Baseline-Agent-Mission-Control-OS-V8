'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      setProvider(data.provider || null)
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12" data-testid="forgot-password-page">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Image src="/brand/mc-logo-128.png" alt="Mission Control" width={56} height={56} className="opacity-90 mb-3" />
        <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-void-cyan/80 mt-2">Powered by Baseline OS</p>

        {done ? (
          <div className="mt-6 w-full text-center space-y-3" data-testid="forgot-password-success">
            <p className="text-sm text-foreground">If an account exists for that email, we&apos;ve sent reset instructions.</p>
            {provider === 'setup_required' && (
              <p className="text-2xs text-amber-300/80 mt-2">
                Email delivery is not configured on this deployment. Your operator can surface the reset link from the audit log.
              </p>
            )}
            <Link href="/login" data-testid="forgot-back-to-login" className="block mt-4 text-void-cyan hover:underline text-sm">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full mt-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Enter the email on your Baseline OS account and we&apos;ll send a reset link.
            </p>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1">Email</label>
              <input
                id="email"
                data-testid="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan"
                placeholder="jane@acme.com"
              />
            </div>
            <button
              type="submit"
              data-testid="forgot-submit"
              disabled={submitting}
              className="w-full bg-void-cyan text-[#04111f] font-semibold rounded-md py-2.5 text-sm disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
            <div className="flex justify-between text-xs text-muted-foreground pt-2">
              <Link href="/login" className="hover:underline">Back to sign in</Link>
              <Link href="/signup" className="hover:underline">Create a workspace</Link>
            </div>
          </form>
        )}
        <p className="text-2xs text-muted-foreground/60 mt-8">Baseline OS · AI Workforce Operating System</p>
      </div>
    </main>
  )
}
