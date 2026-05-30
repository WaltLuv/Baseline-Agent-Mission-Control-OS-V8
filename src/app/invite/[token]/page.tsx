'use client'

import { useState, useEffect, type FormEvent, use as usePromise } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type InviteInfo = {
  email: string
  role: string
  workspace: { id: number; slug: string; name: string } | null
  status: 'valid' | 'used' | 'revoked' | 'expired'
}

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params)
  const router = useRouter()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let live = true
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((data) => { if (live) { setInfo(data.invite || null); setLoading(false) } })
      .catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [token])

  async function handleAccept(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (password.length < 12) { setError('Password must be at least 12 characters'); return }
    if (!fullName.trim()) { setError('Name is required'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/invites/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'LOGIN_REQUIRED') {
          router.push(`/login?next=/invite/${token}`)
          return
        }
        setError(data.error || 'Could not accept invite.')
        return
      }
      router.replace(data.next || '/onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12" data-testid="invite-accept-page">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Image src="/brand/mc-logo-128.png" alt="Mission Control" width={56} height={56} className="opacity-90 mb-3" />
        <h1 className="text-xl font-semibold text-foreground">Accept your invite</h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-void-cyan/80 mt-2">Powered by Baseline OS</p>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading invite…</p>
        ) : !info ? (
          <p className="mt-6 text-sm text-red-300" data-testid="invite-not-found">This invite link is invalid.</p>
        ) : info.status !== 'valid' ? (
          <p className="mt-6 text-sm text-red-300" data-testid={`invite-${info.status}`}>
            This invite is {info.status}. Ask the workspace owner to send a new one.
          </p>
        ) : (
          <form onSubmit={handleAccept} className="w-full mt-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Join <span className="font-semibold text-foreground">{info.workspace?.name || 'this workspace'}</span> as <span className="font-mono text-void-cyan">{info.role}</span>.
              <br />
              <span className="text-xs">Invited email: <span className="font-mono">{info.email}</span></span>
            </p>
            <div>
              <label htmlFor="full_name" className="block text-xs font-medium text-foreground mb-1">Your name</label>
              <input
                id="full_name"
                data-testid="invite-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1">Password</label>
              <input
                id="password"
                data-testid="invite-password"
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
            {error && <div data-testid="invite-error" role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}
            <button type="submit" data-testid="invite-submit" disabled={submitting} className="w-full bg-void-cyan text-[#04111f] font-semibold rounded-md py-2.5 text-sm disabled:opacity-60">
              {submitting ? 'Joining…' : 'Accept and join workspace'}
            </button>
            <p className="text-xs text-center text-muted-foreground">
              Already have an account? <Link href={`/login?next=/invite/${token}`} className="text-void-cyan hover:underline">Sign in to accept</Link>
            </p>
          </form>
        )}
        <p className="text-2xs text-muted-foreground/60 mt-8">Baseline OS · AI Workforce Operating System</p>
      </div>
    </main>
  )
}
