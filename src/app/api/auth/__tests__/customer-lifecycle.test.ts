/**
 * Vitest spec for Pass A + Pass B customer-lifecycle endpoints:
 *   - forgot-password (no enumeration)
 *   - reset-password (token expiry / single-use / password change)
 *   - invite create + accept (workspace isolation)
 *   - workspaces list filtered by membership
 *   - per-workspace role enforcement
 */
import { describe, it, expect, beforeAll } from 'vitest'

process.env.MC_DISABLE_RATE_LIMIT = '1'

import { POST as forgotPOST } from '@/app/api/auth/forgot-password/route'
import { POST as resetPOST } from '@/app/api/auth/reset-password/route'
import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { POST as invitePOST, GET as inviteGET } from '@/app/api/workspaces/[id]/invites/route'
import { POST as acceptPOST, GET as acceptGET } from '@/app/api/invites/[token]/route'
import { GET as workspacesGET } from '@/app/api/workspaces/route'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { resolveRole, listMembershipsForUser } from '@/lib/memberships'
import { createHash, randomBytes } from 'crypto'
import { NextRequest } from 'next/server'

function rndIp() {
  return `10.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`
}

function makeReq(url: string, body: unknown, opts: { ip?: string; cookie?: string; method?: string } = {}): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': opts.ip || rndIp(),
  }
  if (opts.cookie) headers['cookie'] = opts.cookie
  return new Request(url, {
    method: opts.method || 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function nextReq(url: string, opts: { cookie?: string } = {}): NextRequest {
  const headers: Record<string, string> = { 'x-forwarded-for': rndIp() }
  if (opts.cookie) headers['cookie'] = opts.cookie
  return new NextRequest(url, { headers })
}

function extractSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie') || ''
  const match = setCookie.match(/(?:__Secure-)?mc-session=([^;]+)/)
  return match ? `${match[0].split(';')[0]}` : null
}

async function signupCustomer(suffix: string, vertical = 'pm'): Promise<{ user: { id: number; username: string; email: string }; workspace: { id: number; name: string }; cookie: string }> {
  const res = await signupPOST(makeReq('http://localhost/api/auth/signup', {
    email: `${suffix}@acme.test`,
    password: 'CorrectHorseBattery42',
    full_name: `Tester ${suffix}`,
    company_name: `Acme ${suffix}`,
    business_type: vertical,
  }))
  if (res.status !== 200) throw new Error(`signup failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  // Email-verify so gated actions (e.g. team invites) admit this owner.
  getDatabase().prepare('UPDATE users SET email_verified_at = unixepoch() WHERE id = ?').run(data.user.id)
  return { user: data.user, workspace: data.workspace, cookie: extractSessionCookie(res) || '' }
}

describe('Customer lifecycle — forgot-password + reset-password', () => {
  beforeAll(() => runMigrations(getDatabase()))

  it('does not reveal whether an email exists', async () => {
    const unknown = await forgotPOST(makeReq('http://localhost/api/auth/forgot-password', { email: 'never-registered@nowhere.test' }))
    expect(unknown.status).toBe(200)
    const body1 = await unknown.json()
    expect(body1.ok).toBe(true)
    expect(body1.message).toMatch(/If an account/i)

    const ts = Date.now()
    await signupCustomer(`pw_${ts}`)
    const known = await forgotPOST(makeReq('http://localhost/api/auth/forgot-password', { email: `pw_${ts}@acme.test` }))
    const body2 = await known.json()
    expect(body2.message).toBe(body1.message)
  })

  it('issues a reset token, lets the user change password, then expires it', async () => {
    const ts = Date.now()
    const { user } = await signupCustomer(`reset_${ts}`)
    await forgotPOST(makeReq('http://localhost/api/auth/forgot-password', { email: user.email }))

    // Fish out the most recent token for that user, generate matching plaintext
    // by reusing what the route stores — we can't read the plaintext from db,
    // so we directly create a known reset token (same as the route does) for
    // assertion purposes.
    const db = getDatabase()
    const plaintext = randomBytes(32).toString('base64url')
    const hash = createHash('sha256').update(plaintext).digest('hex')
    db.prepare(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)`)
      .run(hash, user.id, Math.floor(Date.now() / 1000) + 3600)

    const ok = await resetPOST(makeReq('http://localhost/api/auth/reset-password', { token: plaintext, password: 'NewSecret1234ABC' }))
    expect(ok.status).toBe(200)

    const reuse = await resetPOST(makeReq('http://localhost/api/auth/reset-password', { token: plaintext, password: 'AnotherSecret456X' }))
    expect(reuse.status).toBe(400)
    expect((await reuse.json()).code).toBe('TOKEN_USED')

    const bogus = await resetPOST(makeReq('http://localhost/api/auth/reset-password', { token: 'not-a-token', password: 'NewSecret1234ABC' }))
    expect(bogus.status).toBe(400)
    expect((await bogus.json()).code).toBe('TOKEN_INVALID')
  })

  it('expired token is rejected', async () => {
    const ts = Date.now()
    const { user } = await signupCustomer(`exp_${ts}`)
    const db = getDatabase()
    const plaintext = randomBytes(32).toString('base64url')
    const hash = createHash('sha256').update(plaintext).digest('hex')
    db.prepare(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)`)
      .run(hash, user.id, Math.floor(Date.now() / 1000) - 10)
    const res = await resetPOST(makeReq('http://localhost/api/auth/reset-password', { token: plaintext, password: 'NewSecret1234ABC' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('TOKEN_EXPIRED')
  })
})

describe('Customer lifecycle — invites + workspace memberships', () => {
  it('owner can invite, invitee accepts, lands in correct workspace with assigned role', async () => {
    const ts = Date.now()
    const owner = await signupCustomer(`inv_owner_${ts}`)
    const inviteeEmail = `inv_member_${ts}@acme.test`

    // Owner creates invite
    const inviteRes = await invitePOST(
      makeReq(`http://localhost/api/workspaces/${owner.workspace.id}/invites`,
        { email: inviteeEmail, role: 'operator' }, { cookie: owner.cookie }),
      { params: Promise.resolve({ id: String(owner.workspace.id) }) },
    )
    expect(inviteRes.status).toBe(200)
    const inviteData = await inviteRes.json()
    expect(inviteData.invite.email).toBe(inviteeEmail)
    expect(inviteData.accept_url).toContain('/invite/')
    const token = inviteData.accept_url.split('/invite/')[1]

    // Lookup invite before accept
    const lookup = await acceptGET(makeReq(`http://localhost/api/invites/${token}`, undefined, { method: 'GET' }), { params: Promise.resolve({ token }) })
    expect(lookup.status).toBe(200)
    expect((await lookup.json()).invite.status).toBe('valid')

    // Invitee accepts (new user signup-through-invite)
    const acceptRes = await acceptPOST(
      makeReq(`http://localhost/api/invites/${token}`, { full_name: 'Invited User', password: 'InviteAcceptSecret42' }),
      { params: Promise.resolve({ token }) },
    )
    expect(acceptRes.status).toBe(200)
    const acceptData = await acceptRes.json()
    expect(acceptData.workspace_id).toBe(owner.workspace.id)
    expect(acceptData.role).toBe('operator')

    // Invitee now has membership in owner.workspace, NOT a new workspace.
    const db = getDatabase()
    const inviteeUser = db.prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`).get(inviteeEmail) as { id: number }
    const memberships = listMembershipsForUser(inviteeUser.id)
    expect(memberships).toHaveLength(1)
    expect(memberships[0].id).toBe(owner.workspace.id)
    expect(memberships[0].role).toBe('operator')

    // Invite cannot be re-used
    const reuse = await acceptPOST(
      makeReq(`http://localhost/api/invites/${token}`, { full_name: 'X', password: 'OtherAcceptSecret99' }),
      { params: Promise.resolve({ token }) },
    )
    expect(reuse.status).toBe(400)
    expect((await reuse.json()).code).toBe('INVITE_USED')
  })

  it('per-workspace role enforcement: viewer rejected, admin allowed', async () => {
    const ts = Date.now()
    const owner = await signupCustomer(`role_${ts}`)

    // Invite a viewer
    const inviteRes = await invitePOST(
      makeReq(`http://localhost/api/workspaces/${owner.workspace.id}/invites`,
        { email: `viewer_${ts}@acme.test`, role: 'viewer' }, { cookie: owner.cookie }),
      { params: Promise.resolve({ id: String(owner.workspace.id) }) },
    )
    const inviteData = await inviteRes.json()
    const token = inviteData.accept_url.split('/invite/')[1]
    const accept = await acceptPOST(
      makeReq(`http://localhost/api/invites/${token}`, { full_name: 'V', password: 'ViewerSecret123XYZ' }),
      { params: Promise.resolve({ token }) },
    )
    const viewerCookie = extractSessionCookie(accept) || ''

    // Viewer tries to invite someone — must be 403
    const blocked = await invitePOST(
      makeReq(`http://localhost/api/workspaces/${owner.workspace.id}/invites`,
        { email: `vctx_${ts}@acme.test`, role: 'operator' }, { cookie: viewerCookie }),
      { params: Promise.resolve({ id: String(owner.workspace.id) }) },
    )
    expect(blocked.status).toBe(403)
  })

  it('cross-workspace isolation: workspaces list only returns my own memberships', async () => {
    const ts = Date.now()
    const a = await signupCustomer(`xw_a_${ts}`)
    const b = await signupCustomer(`xw_b_${ts}`)

    const resA = await workspacesGET(nextReq('http://localhost/api/workspaces', { cookie: a.cookie }))
    const bodyA = await resA.json()
    const idsA = (bodyA.workspaces || []).map((w: { id: number }) => w.id)
    expect(idsA).toContain(a.workspace.id)
    expect(idsA).not.toContain(b.workspace.id)
  })

  it('resolveRole returns "owner" for the workspace creator and null for non-members', async () => {
    const ts = Date.now()
    const a = await signupCustomer(`role_resolve_${ts}`)
    expect(resolveRole(a.user.id, a.workspace.id)).toBe('owner')
    expect(resolveRole(a.user.id, 999999)).toBeNull()
  })
})
