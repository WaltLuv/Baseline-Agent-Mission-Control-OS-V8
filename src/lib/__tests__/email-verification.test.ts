/**
 * Email verification — P0 account trust. Covers the 14 required cases:
 * token lifecycle (hashed, single-use, expiry, cooldown) and route-level
 * enforcement (unverified users blocked from monetized features; verified
 * users allowed; provider-missing surfaces as setup-required).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'

process.env.MC_DISABLE_RATE_LIMIT = '1'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import {
  createVerificationToken,
  verifyEmailToken,
  secondsUntilResend,
  sendVerificationEmail,
  RESEND_COOLDOWN_SECONDS,
} from '@/lib/email-verification'
import { getEmailProvider } from '@/lib/email'
import { createUser, getUserById, isEmailVerified } from '@/lib/auth'

import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { POST as runtimeKeyPOST } from '@/app/api/onboarding/runtime-key/route'
import { PUT as credentialsPUT } from '@/app/api/credentials/[provider_id]/route'
import { POST as purchasePOST } from '@/app/api/marketplace/purchase/route'
import { POST as purchaseOrderPOST } from '@/app/api/billing/purchase-order/route'
import { NextRequest } from 'next/server'

let uniq = 0
function freshUser(verified = false) {
  uniq += 1
  const email = `verif_${Date.now()}_${uniq}@acme.test`
  const u = createUser(`verif_user_${Date.now()}_${uniq}`, 'CorrectHorseBattery42', 'Verif User', 'admin', {
    email,
    email_verified_at: verified ? Math.floor(Date.now() / 1000) : null,
  })
  return { ...u, email }
}

async function signupSession(): Promise<{ cookie: string; userId: number; email: string }> {
  uniq += 1
  const email = `signup_${Date.now()}_${uniq}@acme.test`
  const res = await signupPOST(
    new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.5.0.${uniq % 250}` },
      body: JSON.stringify({
        email, password: 'CorrectHorseBattery42', full_name: 'Signy', company_name: `SignCo ${uniq}`, business_type: 'pm',
      }),
    }),
  )
  expect(res.status).toBe(200)
  const data = (await res.json()) as { user: { id: number }; next: string }
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/(?:mc-session|__Secure-mc-session)=([^;]+)/i)!
  return { cookie: `mc-session=${m[1]}`, userId: data.user.id, email }
}

beforeAll(() => { runMigrations(getDatabase()) })

describe('email verification — token lifecycle', () => {
  it('1. signup creates an UNVERIFIED user and routes to the demo workspace (verification in background)', async () => {
    uniq += 1
    const email = `s_${Date.now()}_${uniq}@acme.test`
    const res = await signupPOST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.6.0.${uniq % 250}` },
        body: JSON.stringify({ email, password: 'CorrectHorseBattery42', full_name: 'X', company_name: `C ${uniq}`, business_type: 'pm' }),
      }),
    )
    const data = (await res.json()) as { user: { id: number }; next: string }
    expect(data.next).toBe('/app/overview?activated=1&source=signup')
    const u = getUserById(data.user.id)!
    expect(u.email_verified_at == null).toBe(true)
    expect(isEmailVerified(u)).toBe(false)
  })

  it('2. the verification token is stored HASHED (raw token never in DB)', () => {
    const u = freshUser()
    const mint = createVerificationToken(u.id, u.email)
    expect(mint.ok).toBe(true)
    const raw = mint.rawToken!
    const db = getDatabase()
    const rows = db.prepare('SELECT token_hash FROM email_verification_tokens WHERE user_id = ?').all(u.id) as Array<{ token_hash: string }>
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.token_hash).not.toBe(raw) // never the raw value
      expect(r.token_hash).toMatch(/^[a-f0-9]{64}$/) // sha-256 hex
    }
  })

  it('3. sending reports the provider honestly (setup_required when unconfigured)', async () => {
    const prevMc = process.env.MC_RESEND_API_KEY; const prevR = process.env.RESEND_API_KEY
    delete process.env.MC_RESEND_API_KEY; delete process.env.RESEND_API_KEY
    const u = freshUser()
    const out = await sendVerificationEmail({ id: u.id, email: u.email }, 'http://localhost', null, { ignoreCooldown: true })
    expect(out.provider).toBe('setup_required')
    expect(out.sent).toBe(false)
    if (prevMc) process.env.MC_RESEND_API_KEY = prevMc
    if (prevR) process.env.RESEND_API_KEY = prevR
  })

  it('4. an invalid token is rejected', () => {
    expect(verifyEmailToken('not-a-real-token').ok).toBe(false)
    expect(verifyEmailToken('').ok).toBe(false)
  })

  it('5. an expired token is rejected', () => {
    const u = freshUser()
    const mint = createVerificationToken(u.id, u.email)
    // Force expiry into the past.
    getDatabase().prepare('UPDATE email_verification_tokens SET expires_at = ? WHERE user_id = ?').run(1, u.id)
    const r = verifyEmailToken(mint.rawToken!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('expired')
    expect(getUserById(u.id)!.email_verified_at == null).toBe(true)
  })

  it('6. a valid token sets email_verified_at', () => {
    const u = freshUser()
    const mint = createVerificationToken(u.id, u.email)
    const r = verifyEmailToken(mint.rawToken!)
    expect(r.ok).toBe(true)
    expect(getUserById(u.id)!.email_verified_at).toBeTruthy()
  })

  it('7. a token is single-use', () => {
    const u = freshUser()
    const mint = createVerificationToken(u.id, u.email)
    expect(verifyEmailToken(mint.rawToken!).ok).toBe(true)
    const second = verifyEmailToken(mint.rawToken!)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toBe('used')
  })

  it('8. resend cooldown is enforced', () => {
    const u = freshUser()
    const first = createVerificationToken(u.id, u.email)
    expect(first.ok).toBe(true)
    expect(secondsUntilResend(u.id)).toBeGreaterThan(0)
    expect(secondsUntilResend(u.id)).toBeLessThanOrEqual(RESEND_COOLDOWN_SECONDS)
    const second = createVerificationToken(u.id, u.email) // within cooldown
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('cooldown')
  })

  it('14. missing email provider config is detectable (blocks production readiness)', () => {
    const prevMc = process.env.MC_RESEND_API_KEY; const prevR = process.env.RESEND_API_KEY
    const prevH = process.env.MC_SMTP_HOST
    delete process.env.MC_RESEND_API_KEY; delete process.env.RESEND_API_KEY; delete process.env.MC_SMTP_HOST
    expect(getEmailProvider()).toBe('setup_required')
    if (prevMc) process.env.MC_RESEND_API_KEY = prevMc
    if (prevR) process.env.RESEND_API_KEY = prevR
    if (prevH) process.env.MC_SMTP_HOST = prevH
  })
})

describe('email verification — route enforcement', () => {
  // Ensure the dev bypass is OFF for these tests (gate active).
  beforeEach(() => { delete process.env.ALLOW_UNVERIFIED_DEV_LOGIN })
  afterEach(() => { delete process.env.ALLOW_UNVERIFIED_DEV_LOGIN })

  it('9. unverified user CANNOT purchase credits (billing)', async () => {
    const { cookie } = await signupSession()
    const res = await purchaseOrderPOST(
      new NextRequest('http://localhost/api/billing/purchase-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ pack: 'starter' }),
      }),
    )
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('email_verification_required')
  })

  it('10. unverified user CANNOT store credentials', async () => {
    const { cookie } = await signupSession()
    const res = await credentialsPUT(
      new NextRequest('http://localhost/api/credentials/openrouter', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ secrets: { api_key: 'sk-x' } }),
      }),
      { params: Promise.resolve({ provider_id: 'openrouter' }) },
    )
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('email_verification_required')
  })

  it('11. unverified user CANNOT create a runtime key', async () => {
    const { cookie } = await signupSession()
    const res = await runtimeKeyPOST(
      new Request('http://localhost/api/onboarding/runtime-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ runtime: 'claude' }),
      }),
    )
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('email_verification_required')
  })

  it('12. unverified user CANNOT purchase a marketplace item', async () => {
    const { cookie } = await signupSession()
    const res = await purchasePOST(
      new NextRequest('http://localhost/api/marketplace/purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ slug: 'x', type: 'skill' }),
      }),
    )
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('email_verification_required')
  })

  it('13. a VERIFIED user can create a runtime key', async () => {
    const { cookie, userId } = await signupSession()
    // Verify via the token path (end-to-end).
    const u = getUserById(userId)!
    const mint = createVerificationToken(u.id, u.email!, null, { ignoreCooldown: true })
    expect(verifyEmailToken(mint.rawToken!).ok).toBe(true)

    const res = await runtimeKeyPOST(
      new Request('http://localhost/api/onboarding/runtime-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ runtime: 'claude' }),
      }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).api_key).toMatch(/^mca_/)
  })

  it('dev bypass: ALLOW_UNVERIFIED_DEV_LOGIN lets an unverified user through (non-prod only)', async () => {
    const { cookie } = await signupSession()
    process.env.ALLOW_UNVERIFIED_DEV_LOGIN = 'true' // NODE_ENV is 'test' here
    const res = await runtimeKeyPOST(
      new Request('http://localhost/api/onboarding/runtime-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ runtime: 'claude' }),
      }),
    )
    expect(res.status).toBe(200)
  })
})
