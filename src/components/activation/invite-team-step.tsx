'use client'

import { useState } from 'react'

// Invite Team — Step 3 of the activation hub. Invites one teammate at a time
// via /api/workspaces/:id/invites; the parent decides when the user can
// continue (we mark complete after the first successful invite OR an
// explicit "I'll invite later" skip).

const ROLES = [
  { id: 'operator', label: 'Operator', description: 'Day-to-day operator. Can create tasks, run agents, view billing.' },
  { id: 'admin', label: 'Admin', description: 'Full workspace control. Can invite, change billing, mint API keys.' },
  { id: 'viewer', label: 'Viewer', description: 'Read-only. Sees dashboards and reports, cannot mutate state.' },
] as const

type Role = (typeof ROLES)[number]['id']

export function InviteTeamStep({
  workspaceId,
  onComplete,
  onSkip,
}: {
  workspaceId: number
  onComplete: () => void
  onSkip: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<Array<{ email: string; role: Role }>>([])

  async function sendInvite() {
    setError(null)
    if (!email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setSent((prev) => [...prev, { email: email.trim().toLowerCase(), role }])
      setEmail('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'invite failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5" data-testid="invite-team-step">
      <header>
        <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono mb-1.5">Step 3 of 3</p>
        <h2 className="text-2xl font-semibold tracking-tight">Invite your team</h2>
        <p className="mt-2 text-sm text-white/55 leading-relaxed">
          Mission Control becomes much more valuable when your operators and admins each have their own login. They&apos;ll get an email with a one-click join link.
        </p>
      </header>

      <div className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-white/45 font-mono">Email</span>
          <input
            type="email"
            data-testid="invite-team-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@yourcompany.com"
            className="mt-1.5 w-full h-10 px-3 rounded-md bg-black/40 border border-white/[0.08] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-400/50"
          />
        </label>

        <fieldset>
          <legend className="text-xs uppercase tracking-wider text-white/45 font-mono mb-1.5">Role</legend>
          <div className="space-y-1.5">
            {ROLES.map((r) => (
              <label
                key={r.id}
                className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${
                  role === r.id ? 'border-violet-400/40 bg-violet-500/[0.05]' : 'border-white/[0.06] hover:border-white/[0.12]'
                }`}
                data-testid={`invite-team-role-${r.id}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={role === r.id}
                  onChange={() => setRole(r.id)}
                  className="mt-0.5 accent-violet-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{r.label}</div>
                  <p className="text-xs text-white/50 mt-0.5">{r.description}</p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/[0.04] p-2.5 text-xs text-red-200" data-testid="invite-team-error">
            {error}
          </div>
        )}

        <button
          type="button"
          data-testid="invite-team-submit"
          disabled={submitting || !email}
          onClick={sendInvite}
          className={`w-full h-10 rounded-md text-sm font-semibold ${
            submitting || !email ? 'bg-white/[0.06] text-white/40 cursor-not-allowed' : 'bg-violet-500 hover:bg-violet-400 text-white'
          }`}
        >
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </div>

      {sent.length > 0 && (
        <div data-testid="invite-team-sent">
          <p className="text-xs uppercase tracking-wider text-white/45 font-mono mb-2">
            Invites sent ({sent.length})
          </p>
          <ul className="space-y-1.5">
            {sent.map((s, i) => (
              <li
                key={`${s.email}-${i}`}
                className="text-xs text-white/65 font-mono flex items-center gap-2"
              >
                <span className="text-emerald-400">✓</span>
                <span>{s.email}</span>
                <span className="text-white/35">· {s.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          data-testid="invite-team-skip"
          onClick={onSkip}
          className="text-sm text-white/50 hover:text-white/80"
        >
          I&apos;ll invite later
        </button>
        <button
          type="button"
          data-testid="invite-team-finish"
          onClick={onComplete}
          className="h-10 px-5 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90"
        >
          {sent.length > 0 ? 'Finish activation →' : 'Skip and finish →'}
        </button>
      </div>
    </div>
  )
}
