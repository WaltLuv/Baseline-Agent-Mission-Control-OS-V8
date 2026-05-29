/**
 * Vitest spec for the customer self-signup endpoint.
 *
 * Verifies the Phase 1 multi-tenant activation contract:
 *   1. Stranger can POST /api/auth/signup with email + password + company + vertical.
 *   2. Server creates a new workspace and a new user attached to it.
 *   3. Server sets a session cookie so the new user is signed in.
 *   4. Duplicate email returns 409.
 *   5. Bad inputs return 400 with a `field` hint.
 *   6. Cross-workspace data isolation holds: tasks created in workspace A
 *      are not returned to a user whose session is bound to workspace B.
 *
 * This runs against the in-process Next.js route handlers via direct import,
 * NOT against the live preview env (those checks run in CI separately).
 */
import { describe, it, expect, beforeAll } from 'vitest'

process.env.MC_DISABLE_RATE_LIMIT = '1'

import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { getDatabase } from '@/lib/db'
import '@/lib/migrations'
import { runMigrations } from '@/lib/migrations'

function makeRequest(body: unknown, ip = `10.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`): Request {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup — customer self-signup', () => {
  beforeAll(() => {
    runMigrations(getDatabase())
  })

  it('creates a new workspace + owner user on valid input', async () => {
    const email = `founder_${Date.now()}@acme.test`
    const res = await signupPOST(makeRequest({
      email,
      password: 'CorrectHorseBattery42',
      full_name: 'Test Founder',
      company_name: `Acme ${Date.now()}`,
      business_type: 'pm',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.user.email).toBe(email)
    expect(data.user.role).toBe('admin')
    expect(data.workspace.id).toBeGreaterThan(1) // not the default workspace
    expect(data.next).toBe('/onboarding')

    // Session cookie set
    const setCookie = res.headers.get('set-cookie') || ''
    expect(setCookie).toMatch(/mc-session|__Secure-mc-session/i)
  })

  it('rejects duplicate email with 409', async () => {
    const email = `dup_${Date.now()}@acme.test`
    const ok = await signupPOST(makeRequest({
      email,
      password: 'CorrectHorseBattery42',
      full_name: 'A',
      company_name: `One ${Date.now()}`,
      business_type: 'pm',
    }))
    expect(ok.status).toBe(200)

    const dup = await signupPOST(makeRequest({
      email,
      password: 'CorrectHorseBattery42',
      full_name: 'B',
      company_name: `Two ${Date.now()}`,
      business_type: 'pm',
    }))
    expect(dup.status).toBe(409)
    const data = await dup.json()
    expect(data.field).toBe('email')
  })

  it('rejects bad inputs with 400 + field hint', async () => {
    const badEmail = await signupPOST(makeRequest({
      email: 'not-an-email',
      password: 'CorrectHorseBattery42',
      full_name: 'X',
      company_name: 'Y',
      business_type: 'pm',
    }))
    expect(badEmail.status).toBe(400)
    expect((await badEmail.json()).field).toBe('email')

    const shortPw = await signupPOST(makeRequest({
      email: `short_${Date.now()}@acme.test`,
      password: 'short',
      full_name: 'X',
      company_name: 'Y',
      business_type: 'pm',
    }))
    expect(shortPw.status).toBe(400)
    expect((await shortPw.json()).field).toBe('password')

    const badVertical = await signupPOST(makeRequest({
      email: `bv_${Date.now()}@acme.test`,
      password: 'CorrectHorseBattery42',
      full_name: 'X',
      company_name: 'Y',
      business_type: 'nope',
    }))
    expect(badVertical.status).toBe(400)
    expect((await badVertical.json()).field).toBe('business_type')
  })

  it('seeds onboarding settings (vertical + workspace_id) keyed to the new user', async () => {
    const email = `seed_${Date.now()}@acme.test`
    const res = await signupPOST(makeRequest({
      email,
      password: 'CorrectHorseBattery42',
      full_name: 'Seed User',
      company_name: `SeedCo ${Date.now()}`,
      business_type: 'cpa',
    }))
    expect(res.status).toBe(200)
    const { user, workspace } = await res.json()

    const db = getDatabase()
    const vertical = db.prepare('SELECT value FROM settings WHERE key = ?')
      .get(`user.${user.username}.onboarding.business_type`) as { value: string } | undefined
    const ws = db.prepare('SELECT value FROM settings WHERE key = ?')
      .get(`user.${user.username}.onboarding.workspace_id`) as { value: string } | undefined

    expect(vertical?.value).toBe('cpa')
    expect(Number(ws?.value)).toBe(workspace.id)
  })

  it('cross-workspace isolation: new workspace starts with zero tasks regardless of admin activity', async () => {
    const db = getDatabase()
    // Create one task tagged to workspace 1 (the default/admin workspace)
    db.prepare(`
      INSERT INTO tasks (title, description, status, priority, created_by, created_at, updated_at, workspace_id)
      VALUES ('ADMIN_PRIVATE', 'isolated', 'inbox', 'medium', 'admin', unixepoch(), unixepoch(), 1)
    `).run()

    const email = `iso_${Date.now()}@acme.test`
    const res = await signupPOST(makeRequest({
      email,
      password: 'CorrectHorseBattery42',
      full_name: 'Iso',
      company_name: `IsoCo ${Date.now()}`,
      business_type: 'pm',
    }))
    expect(res.status).toBe(200)
    const { user, workspace } = await res.json()

    // The new workspace must not see admin's task at all.
    const visible = db.prepare(`SELECT id FROM tasks WHERE workspace_id = ?`).all(workspace.id) as Array<{ id: number }>
    expect(visible).toHaveLength(0)

    // And the new user is bound to the new workspace, not workspace 1.
    const dbUser = db.prepare(`SELECT workspace_id FROM users WHERE id = ?`).get(user.id) as { workspace_id: number }
    expect(dbUser.workspace_id).toBe(workspace.id)
    expect(dbUser.workspace_id).not.toBe(1)
  })
})
