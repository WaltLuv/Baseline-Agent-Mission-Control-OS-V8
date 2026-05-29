'use client'

import { useState, useMemo, type FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { BUSINESS_TEMPLATES } from '@/lib/business-templates'

/**
 * Customer self-signup page.
 *
 * Sits on top of `POST /api/auth/signup` which uses the existing
 * `workspaces` table + `users.workspace_id` foreign key. No new
 * tables are introduced.
 */
export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const verticals = useMemo(() => BUSINESS_TEMPLATES.map((t) => ({ id: t.id, name: t.name, icon: t.icon })), [])

  const pwTooShort = password.length > 0 && password.length < 12

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setFieldError(null)

    if (!email || !password || !fullName || !companyName || !businessType) {
      setError('All fields are required.')
      return
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.')
      setFieldError('password')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          company_name: companyName.trim(),
          business_type: businessType,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not create account.')
        if (data.field) setFieldError(data.field)
        return
      }
      router.replace(data.next || '/onboarding')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12" data-testid="signup-page">
      <div className="w-full max-w-md flex flex-col items-center">
        <Image src="/brand/mc-logo-128.png" alt="Mission Control" width={56} height={56} className="opacity-90 mb-3" />
        <h1 className="text-xl font-semibold text-foreground">Create your workspace</h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-void-cyan/80 mt-2">Powered by Baseline OS</p>
        <p className="text-sm text-muted-foreground mt-3 text-center max-w-xs leading-relaxed">
          Set up your AI workforce in minutes. Choose your business type, pick starter AI employees, and start operating.
        </p>

        <form onSubmit={handleSubmit} className="w-full mt-6 space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-xs font-medium text-foreground mb-1">Your name</label>
            <input
              id="full_name"
              data-testid="signup-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1">Work email</label>
            <input
              id="email"
              data-testid="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className={`w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan ${fieldError === 'email' ? 'border-red-500' : 'border-border'}`}
              placeholder="jane@acme.com"
            />
          </div>
          <div>
            <label htmlFor="company_name" className="block text-xs font-medium text-foreground mb-1">Company name</label>
            <input
              id="company_name"
              data-testid="signup-company"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
              required
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan"
              placeholder="Acme Property Management"
            />
          </div>
          <div>
            <label htmlFor="business_type" className="block text-xs font-medium text-foreground mb-1">Business type</label>
            <select
              id="business_type"
              data-testid="signup-business-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan"
            >
              <option value="">Select your business…</option>
              {verticals.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.icon} {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1">Password</label>
            <input
              id="password"
              data-testid="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
              className={`w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-void-cyan ${pwTooShort || fieldError === 'password' ? 'border-red-500' : 'border-border'}`}
              placeholder="Minimum 12 characters"
            />
            {pwTooShort && (
              <p className="mt-1 text-2xs text-red-400">Use at least 12 characters.</p>
            )}
          </div>

          {error && (
            <div data-testid="signup-error" role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            data-testid="signup-submit"
            disabled={submitting}
            className="w-full bg-void-cyan text-[#04111f] font-semibold rounded-md py-2.5 text-sm transition hover:bg-void-cyan/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating workspace…' : 'Create workspace'}
          </button>

          <p className="text-2xs text-center text-muted-foreground/70 mt-1">
            By creating an account you agree to keep your workspace data separate from other tenants. SOC 2 path in progress.
          </p>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <span>Already have an account?{' '}
            <Link href="/login" className="text-void-cyan hover:underline" data-testid="signup-to-login">Sign in</Link>
          </span>
        </div>

        <p className="text-2xs text-muted-foreground/60 mt-8">Baseline OS · AI Workforce Operating System</p>
      </div>
    </main>
  )
}
