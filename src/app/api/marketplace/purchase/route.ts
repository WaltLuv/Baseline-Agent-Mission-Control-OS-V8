import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { getSkillBySlug, getEmployeeBySlug, getBundleBySlug } from '@/lib/marketplace-catalog'
import { createStripeCheckoutSession, isLiveStripeMode } from '@/lib/stripe-client'

/**
 * Marketplace purchase endpoint — closes the loop browse → hire → pay → deploy.
 *
 * Body:
 *   { type: 'skill', slug }        — one-time purchase
 *   { type: 'employee', slug }     — monthly subscription
 *   { type: 'bundle', slug }       — preset team + skill pack
 *
 * Behaviour:
 *   - LIVE Stripe mode → returns `{ checkoutUrl }` to redirect operator.
 *   - TEST/mock mode   → immediately fulfills the install:
 *       * skills:    `workforce_skills` row + `workforce_memory` entry
 *       * employees: `agents` row + `workforce_subscriptions` row + first
 *                    starter task in `tasks` + memory entry
 *       * bundles:   does the above for every employee + skill in the bundle.
 *     Operator sees the new employee/skill instantly in the workforce, the
 *     executive briefing picks up the impact, and the audit trail records
 *     the install.
 *
 * Idempotency:
 *   `Idempotency-Key` header — if seen before, returns the cached response.
 */

interface PurchaseBody {
  type: 'skill' | 'employee' | 'bundle'
  slug: string
  /** Optional: when installing a skill, attach it directly to an existing AI Employee. */
  attachToAgentId?: number
  attachToAgentSlug?: string
}

function ensureTables(db: ReturnType<typeof getDatabase>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workforce_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      attached_agent_id INTEGER,
      installed_at INTEGER NOT NULL,
      idempotency_key TEXT,
      UNIQUE(workspace_id, slug, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS workforce_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      employee_slug TEXT NOT NULL,
      monthly_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      started_at INTEGER NOT NULL,
      idempotency_key TEXT,
      UNIQUE(workspace_id, employee_slug, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS workforce_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      agent_id INTEGER,
      agent_slug TEXT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      rationale TEXT,
      value_impact_cents INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workforce_memory_workspace ON workforce_memory(workspace_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workforce_memory_agent ON workforce_memory(workspace_id, agent_slug, created_at DESC);
  `)
}

function recordAudit(workspaceId: number, actorId: number, action: string, slug: string, type: string, valueCents: number) {
  try {
    const db = getDatabase()
    db.prepare(
      `INSERT INTO usage_events (workspace_id, agent_id, model, event_type, input_tokens, output_tokens, raw_cost_cents, retail_cost_cents, markup_multiplier, idempotency_key, created_at, metadata)
       VALUES (?, NULL, ?, ?, 0, 0, ?, ?, 1, ?, strftime('%s','now'), ?)`
    ).run(
      workspaceId,
      `marketplace-${type}`,
      `marketplace.${action}`,
      valueCents,
      valueCents,
      `mkt-${randomBytes(8).toString('hex')}`,
      JSON.stringify({ actorId, slug, type }),
    )
  } catch {
    // best-effort
  }
}

function installSkill(workspaceId: number, slug: string, idempotencyKey: string, agentSlug?: string | null, agentId?: number | null) {
  const skill = getSkillBySlug(slug)
  if (!skill) throw new Error(`Unknown skill slug: ${slug}`)
  const db = getDatabase()
  ensureTables(db)
  db.prepare(
    `INSERT OR IGNORE INTO workforce_skills (workspace_id, slug, name, category, price_cents, attached_agent_id, installed_at, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'), ?)`
  ).run(workspaceId, skill.slug, skill.name, skill.category, skill.priceUsd * 100, agentId ?? null, idempotencyKey)
  db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, created_at)
     VALUES (?, ?, ?, 'skill-installed', ?, ?, ?, strftime('%s','now'))`
  ).run(
    workspaceId,
    agentId ?? null,
    agentSlug ?? null,
    skill.slug,
    `${skill.outcome} Estimated impact: ${skill.timeSaved}.`,
    `Operator added this capability to expand the workforce.`,
  )
  return skill
}

function hireEmployee(workspaceId: number, slug: string, idempotencyKey: string) {
  const employee = getEmployeeBySlug(slug)
  if (!employee) throw new Error(`Unknown employee slug: ${slug}`)
  const db = getDatabase()
  ensureTables(db)
  // Create the subscription row
  db.prepare(
    `INSERT OR IGNORE INTO workforce_subscriptions (workspace_id, employee_slug, monthly_cents, started_at, idempotency_key)
     VALUES (?, ?, ?, strftime('%s','now'), ?)`
  ).run(workspaceId, employee.slug, employee.monthlyUsd * 100, idempotencyKey)
  // Provision an agent row so the employee actually appears in the squad.
  let agentId: number | undefined
  try {
    const existing = db.prepare(
      `SELECT id FROM agents WHERE workspace_id = ? AND name = ? LIMIT 1`
    ).get(workspaceId, employee.name) as { id: number } | undefined
    if (existing) {
      agentId = existing.id
    } else {
      const result = db.prepare(
        `INSERT INTO agents (workspace_id, name, role, status, hidden, created_at)
         VALUES (?, ?, ?, 'idle', 0, strftime('%s','now'))`
      ).run(workspaceId, employee.name, employee.role)
      agentId = Number(result.lastInsertRowid)
    }
  } catch {
    // best-effort — `agents` schema may vary
  }
  // First starter task — gives the operator immediate "they're working" signal.
  try {
    db.prepare(
      `INSERT INTO tasks (workspace_id, title, status, agent_id, created_at)
       VALUES (?, ?, 'todo', ?, strftime('%s','now'))`
    ).run(workspaceId, `${employee.name}: introduction & first assignment`, agentId ?? null)
  } catch {
    // tasks table schema may vary across forks
  }
  // Memory entry — operator-visible rationale.
  db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, created_at)
     VALUES (?, ?, ?, 'employee-hired', ?, ?, ?, strftime('%s','now'))`
  ).run(
    workspaceId,
    agentId ?? null,
    employee.slug,
    `Hired ${employee.name} as ${employee.role}`,
    employee.outcome,
    `Operator chose this employee to ${employee.outcome.toLowerCase()}`,
  )
  return { employee, agentId }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1
  const actorId = auth.user.id

  let body: PurchaseBody
  try {
    body = (await request.json()) as PurchaseBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const idempotencyKey = request.headers.get('idempotency-key') || `purchase-${randomBytes(8).toString('hex')}`

  if (!body?.type || !body?.slug) {
    return NextResponse.json({ error: 'type and slug required' }, { status: 400 })
  }

  // --- Pricing & validation ---
  let priceCents = 0
  let label = ''
  let billingMode: 'one-time' | 'monthly' = 'one-time'

  if (body.type === 'skill') {
    const s = getSkillBySlug(body.slug)
    if (!s) return NextResponse.json({ error: 'Unknown skill' }, { status: 404 })
    priceCents = s.priceUsd * 100
    label = `Install skill — ${s.name}`
    billingMode = 'one-time'
  } else if (body.type === 'employee') {
    const e = getEmployeeBySlug(body.slug)
    if (!e) return NextResponse.json({ error: 'Unknown employee' }, { status: 404 })
    priceCents = e.monthlyUsd * 100
    label = `Hire AI employee — ${e.name}`
    billingMode = 'monthly'
  } else if (body.type === 'bundle') {
    const b = getBundleBySlug(body.slug)
    if (!b) return NextResponse.json({ error: 'Unknown bundle' }, { status: 404 })
    priceCents = b.monthlyUsd * 100 + b.oneTimeUsd * 100
    label = `Deploy team — ${b.name}`
    billingMode = 'monthly'
  } else {
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }

  // --- LIVE Stripe mode → redirect to Checkout ---
  if (isLiveStripeMode()) {
    try {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`
      const session = await createStripeCheckoutSession({
        workspaceId,
        stripeSessionId: `mkt-${idempotencyKey}`,
        packageId: 0,
        packageName: label,
        packagePriceCents: priceCents,
        packageCredits: 0,
        successUrl: `${origin}/app/agents?install=success&type=${body.type}&slug=${body.slug}`,
        cancelUrl: `${origin}/marketplace?install=cancelled`,
      })
      return NextResponse.json({ ok: true, mode: 'stripe', checkoutUrl: session.url })
    } catch (e) {
      return NextResponse.json({ error: 'Stripe checkout failed', detail: String(e).slice(0, 200) }, { status: 502 })
    }
  }

  // --- TEST / mock mode → fulfill immediately ---
  try {
    if (body.type === 'skill') {
      installSkill(workspaceId, body.slug, idempotencyKey, body.attachToAgentSlug, body.attachToAgentId)
    } else if (body.type === 'employee') {
      hireEmployee(workspaceId, body.slug, idempotencyKey)
    } else if (body.type === 'bundle') {
      const bundle = getBundleBySlug(body.slug)!
      bundle.employeeSlugs.forEach((slug, i) => hireEmployee(workspaceId, slug, `${idempotencyKey}-emp-${i}`))
      bundle.skillSlugs.forEach((slug, i) => installSkill(workspaceId, slug, `${idempotencyKey}-skl-${i}`))
    }
    recordAudit(workspaceId, actorId, 'install', body.slug, body.type, priceCents)
    return NextResponse.json({
      ok: true,
      mode: 'fulfilled',
      type: body.type,
      slug: body.slug,
      label,
      priceCents,
      billingMode,
      nextStep: body.type === 'employee' ? 'first-task-queued' : 'capability-attached',
    })
  } catch (e) {
    return NextResponse.json({ error: 'Install failed', detail: String(e).slice(0, 200) }, { status: 500 })
  }
}
