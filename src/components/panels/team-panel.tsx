'use client'

/**
 * TeamPanel — customer-facing team / invites UI.
 *
 * The previous Customer Zero Browser Pass flagged this as a launch blocker:
 * the backend POST /api/workspaces/{id}/invites existed but there was no UI
 * for a workspace owner to invite a teammate. This panel closes that gap.
 *
 * Renders:
 *   - current workspace members (GET /api/workspaces/[id]/members)
 *   - pending invites (GET /api/workspaces/[id]/invites)
 *   - invite form (POST /api/workspaces/[id]/invites)
 *   - revoke pending invite (DELETE /api/workspaces/[id]/invites?invite_id=…)
 *   - copy accept_url when email delivery is not configured
 *
 * Admin-only — server-side checks already enforce this; we hide the form for
 * operators/viewers and show a read-only members list instead.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Member = {
  user_id: number
  username: string
  display_name: string
  email: string | null
  role: 'admin' | 'operator' | 'viewer'
  joined_at: number
}

type Invite = {
  id: number
  email: string
  role: 'admin' | 'operator' | 'viewer'
  expires_at: number
  used_at: number | null
  revoked_at: number | null
  created_at: number
  accept_url?: string
}

type Me = { user: { workspace_id: number; role: string; display_name?: string; email?: string } }

const roleColors: Record<string, string> = {
  admin: 'bg-red-500/15 text-red-300 border-red-500/30',
  operator: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  viewer: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
}

export function TeamPanel() {
  const [me, setMe] = useState<Me['user'] | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ email: '', role: 'operator' as Invite['role'] })
  const [submitting, setSubmitting] = useState(false)
  const [lastInvite, setLastInvite] = useState<Invite | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = useCallback(async () => {
    if (!me) return
    try {
      const [mRes, iRes] = await Promise.all([
        fetch(`/api/workspaces/${me.workspace_id}/members`, { cache: 'no-store' }),
        fetch(`/api/workspaces/${me.workspace_id}/invites`, { cache: 'no-store' }),
      ])
      if (mRes.ok) {
        const data = await mRes.json()
        setMembers(data.members || [])
      }
      if (iRes.ok) {
        const data = await iRes.json()
        setInvites(data.invites || [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [me])

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setMe(d.user || null))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (me) refresh()
  }, [me, refresh])

  const isAdmin = me?.role === 'admin'

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!me || !form.email.trim() || submitting) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/workspaces/${me.workspace_id}/invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), role: form.role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFeedback({ ok: false, text: data.error || `Failed (${res.status})` })
      } else {
        const inv: Invite = {
          id: data.invite?.id,
          email: data.invite?.email,
          role: data.invite?.role,
          expires_at: data.invite?.expires_at,
          used_at: null,
          revoked_at: null,
          created_at: Math.floor(Date.now() / 1000),
          accept_url: data.accept_url,
        }
        setLastInvite(inv)
        // Optimistically prepend to the visible list so the UI doesn't appear
        // to "swallow" the action while the GET round-trip lands.
        setInvites((prev) => [inv, ...prev])
        setForm({ email: '', role: 'operator' })
        setFeedback({ ok: true, text: data.email_status === 'sent' ? `Invite emailed to ${inv.email}` : 'Invite created — copy the link below' })
        refresh()
      }
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setSubmitting(false)
    }
  }

  const revokeInvite = async (inviteId: number) => {
    if (!me) return
    if (!confirm('Revoke this invite? Anyone who already has the link will be blocked.')) return
    const res = await fetch(`/api/workspaces/${me.workspace_id}/invites?invite_id=${inviteId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setFeedback({ ok: true, text: 'Invite revoked' })
      refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setFeedback({ ok: false, text: data.error || `Revoke failed (${res.status})` })
    }
  }

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setFeedback({ ok: true, text: 'Invite link copied to clipboard' })
    } catch {
      setFeedback({ ok: false, text: 'Could not copy — long-press / right-click the link above' })
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground" data-testid="team-panel-loading">
        Loading team…
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-8 text-sm text-red-400" data-testid="team-panel-error">
        {error}
      </div>
    )
  }

  const pending = invites.filter((i) => {
    if (i.used_at || i.revoked_at) return false
    if (i.expires_at && i.expires_at * 1000 < Date.now()) return false
    return true
  })

  return (
    <div className="p-4 space-y-6" data-testid="team-panel">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground" data-testid="team-panel-title">
            Team
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {members.length} member{members.length === 1 ? '' : 's'} · {pending.length} pending invite{pending.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      {feedback && (
        <div
          data-testid="team-feedback"
          className={`rounded-md px-3 py-2 text-sm border ${
            feedback.ok ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {isAdmin && (
        <section className="rounded-lg border border-border bg-card p-4" data-testid="team-invite-section">
          <h2 className="text-sm font-medium mb-3">Invite a teammate</h2>
          <form onSubmit={submitInvite} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1" htmlFor="invite-email">Email</label>
              <input
                id="invite-email"
                data-testid="invite-email-input"
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="teammate@company.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1" htmlFor="invite-role">Role</label>
              <select
                id="invite-role"
                data-testid="invite-role-select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Invite['role'] })}
                className="w-full sm:w-40 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="viewer">Viewer (read-only)</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button
              type="submit"
              data-testid="invite-submit-button"
              disabled={!form.email || submitting}
            >
              {submitting ? 'Sending…' : 'Send invite'}
            </Button>
          </form>

          {lastInvite?.accept_url && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs" data-testid="invite-accept-url-box">
              <div className="text-amber-200 font-medium mb-1">Invite link (valid 7 days)</div>
              <div className="font-mono break-all text-amber-100 mb-2">{lastInvite.accept_url}</div>
              <Button
                type="button"
                variant="outline"
                onClick={() => copyLink(lastInvite.accept_url!)}
                data-testid="invite-copy-button"
              >
                Copy link
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-border bg-card" data-testid="team-members-list">
        <header className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          Members
        </header>
        {members.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Just you — invite a teammate above.</div>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between px-4 py-2 text-sm" data-testid={`member-row-${m.user_id}`}>
                <div>
                  <div className="font-medium">{m.display_name || m.username}</div>
                  <div className="text-xs text-muted-foreground">{m.email || m.username}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border ${roleColors[m.role] || ''}`}>{m.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending.length > 0 && (
        <section className="rounded-lg border border-border bg-card" data-testid="team-pending-list">
          <header className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            Pending invites
          </header>
          <ul className="divide-y divide-border">
            {pending.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-2 text-sm" data-testid={`pending-invite-row-${inv.id}`}>
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">role: {inv.role} · expires {new Date(inv.expires_at * 1000).toLocaleDateString()}</div>
                </div>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => revokeInvite(inv.id)}
                    data-testid={`revoke-invite-${inv.id}`}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
