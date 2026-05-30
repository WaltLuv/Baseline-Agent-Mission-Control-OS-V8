import { NextResponse } from 'next/server'
import { createUser, createSession, getDefaultWorkspaceContext } from '@/lib/auth'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { getMcSessionCookieName, getMcSessionCookieOptions, isRequestSecure } from '@/lib/session-cookie'
import { selfRegisterLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getBusinessTemplate, BUSINESS_TEMPLATES } from '@/lib/business-templates'
import { upsertMembership } from '@/lib/memberships'

/**
 * Customer self-signup.
 *
 * Creates:
 *   1. A new workspace (slug derived from company name, unique).
 *   2. A new local user with role='owner', email, password, attached to that workspace.
 *   3. A session cookie so the new user is logged in.
 *   4. Stamps onboarding settings so the user lands in the wizard.
 *
 * Sits on top of the existing multi-tenant tables (workspaces + users.workspace_id).
 * Does NOT create a second workspace system.
 */
export async function POST(request: Request) {
  try {
    const rateCheck = selfRegisterLimiter(request)
    if (rateCheck) return rateCheck

    const body = await request.json().catch(() => ({})) as Partial<{
      email: string
      password: string
      full_name: string
      company_name: string
      business_type: string
    }>

    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    const fullName = (body.full_name || '').trim()
    const companyName = (body.company_name || '').trim()
    const businessType = (body.business_type || '').trim()

    // Validation
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required', field: 'email' }, { status: 400 })
    }
    if (!password || password.length < 12) {
      return NextResponse.json({ error: 'Password must be at least 12 characters', field: 'password' }, { status: 400 })
    }
    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required', field: 'full_name' }, { status: 400 })
    }
    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required', field: 'company_name' }, { status: 400 })
    }
    const template = getBusinessTemplate(businessType)
    if (!template) {
      return NextResponse.json({
        error: 'Choose a business type',
        field: 'business_type',
        options: BUSINESS_TEMPLATES.map((t) => ({ id: t.id, name: t.name })),
      }, { status: 400 })
    }

    const db = getDatabase()

    // Uniqueness checks
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1').get(email)
    if (existingEmail) {
      return NextResponse.json({ error: 'An account with this email already exists', field: 'email' }, { status: 409 })
    }

    // Generate a unique workspace slug from company name.
    const baseSlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'workspace'
    let slug = baseSlug
    let suffix = 1
    while (db.prepare('SELECT id FROM workspaces WHERE slug = ?').get(slug)) {
      suffix += 1
      slug = `${baseSlug}-${suffix}`
      if (suffix > 50) {
        return NextResponse.json({ error: 'Could not generate a unique workspace slug' }, { status: 500 })
      }
    }

    // Username is derived from email local-part; collisions get a numeric suffix.
    const baseUsername = email.split('@')[0].replace(/[^a-z0-9_-]/g, '').slice(0, 30) || `user${Date.now()}`
    let username = baseUsername
    suffix = 1
    while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      suffix += 1
      username = `${baseUsername}${suffix}`
    }

    const defaultTenantId = getDefaultWorkspaceContext().tenantId
    const now = Math.floor(Date.now() / 1000)

    // Transactional: create workspace + user + onboarding seed in one shot.
    const txn = db.transaction(() => {
      const wsResult = db.prepare(
        'INSERT INTO workspaces (slug, name, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(slug, companyName, defaultTenantId, now, now)
      const workspaceId = Number(wsResult.lastInsertRowid)

      const user = createUser(username, password, fullName, 'admin', {
        provider: 'local',
        email,
        is_approved: 1,
        workspace_id: workspaceId,
      })

      // Multi-workspace membership: owner of their own workspace.
      upsertMembership(user.id, workspaceId, 'owner', {}, db)

      // Stamp the chosen vertical into per-user settings so the onboarding wizard
      // (which reads `settings` scoped by `user.<username>.onboarding.*`) picks it up.
      db.prepare(`
        INSERT INTO settings (key, value, description, category, updated_by, updated_at)
        VALUES (?, ?, ?, 'onboarding', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(
        `user.${username}.onboarding.business_type`,
        template.id,
        'Vertical chosen at signup',
        username,
        now,
      )
      db.prepare(`
        INSERT INTO settings (key, value, description, category, updated_by, updated_at)
        VALUES (?, ?, ?, 'onboarding', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(
        `user.${username}.onboarding.workspace_id`,
        String(workspaceId),
        'Workspace created at signup',
        username,
        now,
      )

      return { user, workspaceId }
    })

    const { user, workspaceId } = txn()

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    const { token, expiresAt } = createSession(user.id, ipAddress, userAgent, workspaceId)

    logAuditEvent({
      action: 'signup',
      actor: user.username,
      actor_id: user.id,
      target_type: 'workspace',
      target_id: workspaceId,
      detail: JSON.stringify({ email, company: companyName, business_type: template.id }),
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        role: user.role,
        workspace_id: workspaceId,
        tenant_id: defaultTenantId,
      },
      workspace: { id: workspaceId, slug, name: companyName },
      next: '/onboarding',
    })

    const isSecureRequest = isRequestSecure(request)
    const cookieName = getMcSessionCookieName(isSecureRequest)
    response.cookies.set(cookieName, token, {
      ...getMcSessionCookieOptions({ maxAgeSeconds: expiresAt - Math.floor(Date.now() / 1000), isSecureRequest }),
    })

    return response
  } catch (error) {
    logger.error({ err: error }, 'Signup error')
    return NextResponse.json({ error: 'Could not create account. Please try again.' }, { status: 500 })
  }
}
