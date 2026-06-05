/**
 * Marketplace fulfillment — install / hire / deploy logic.
 *
 * Extracted from the marketplace purchase route so the Stripe webhook
 * can call the same code paths when a verified `checkout.session.completed`
 * lands. Two callers today:
 *
 *   1. `POST /api/marketplace/purchase` in test/mock mode → fulfills inline.
 *   2. `POST /api/stripe/webhook`        in live mode    → fulfills on the
 *      verified signed event after a real payment.
 *
 * Idempotency:
 *   Every helper takes an `idempotencyKey`. Repeated calls with the same
 *   key are no-ops (driven by UNIQUE indexes on `workforce_skills` and
 *   `workforce_subscriptions`).
 */
import { randomBytes } from 'node:crypto'
import { getDatabase } from '@/lib/db'
import { getSkillBySlug, getEmployeeBySlug, getBundleBySlug } from '@/lib/marketplace-catalog'
import { applyCreditMutation, getWorkspaceBalance, type SourceType } from '@/lib/billing'
import { itemPriceToCredits } from '@/lib/credits-config'

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

export function recordMarketplaceAudit(
  workspaceId: number,
  actorId: number,
  action: string,
  slug: string,
  type: string,
  valueCents: number,
) {
  try {
    const db = getDatabase()
    db.prepare(
      `INSERT INTO usage_events (workspace_id, agent_id, model, event_type, input_tokens, output_tokens, raw_cost_cents, retail_cost_cents, markup_multiplier, idempotency_key, created_at, metadata)
       VALUES (?, NULL, ?, ?, 0, 0, ?, ?, 1, ?, strftime('%s','now'), ?)`,
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
    /* best-effort */
  }
}

export function installSkill(
  workspaceId: number,
  slug: string,
  idempotencyKey: string,
  agentSlug?: string | null,
  agentId?: number | null,
) {
  const skill = getSkillBySlug(slug)
  if (!skill) throw new Error(`Unknown skill slug: ${slug}`)
  const db = getDatabase()
  ensureTables(db)
  db.prepare(
    `INSERT OR IGNORE INTO workforce_skills (workspace_id, slug, name, category, price_cents, attached_agent_id, installed_at, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'), ?)`,
  ).run(workspaceId, skill.slug, skill.name, skill.category, skill.priceUsd * 100, agentId ?? null, idempotencyKey)
  db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, created_at)
     VALUES (?, ?, ?, 'skill-installed', ?, ?, ?, strftime('%s','now'))`,
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

export function hireEmployee(workspaceId: number, slug: string, idempotencyKey: string) {
  const employee = getEmployeeBySlug(slug)
  if (!employee) throw new Error(`Unknown employee slug: ${slug}`)
  const db = getDatabase()
  ensureTables(db)
  db.prepare(
    `INSERT OR IGNORE INTO workforce_subscriptions (workspace_id, employee_slug, monthly_cents, started_at, idempotency_key)
     VALUES (?, ?, ?, strftime('%s','now'), ?)`,
  ).run(workspaceId, employee.slug, employee.monthlyUsd * 100, idempotencyKey)
  let agentId: number | undefined
  try {
    const existing = db.prepare(
      `SELECT id FROM agents WHERE workspace_id = ? AND name = ? LIMIT 1`,
    ).get(workspaceId, employee.name) as { id: number } | undefined
    if (existing) {
      agentId = existing.id
    } else {
      const result = db.prepare(
        `INSERT INTO agents (workspace_id, name, role, status, hidden, created_at)
         VALUES (?, ?, ?, 'idle', 0, strftime('%s','now'))`,
      ).run(workspaceId, employee.name, employee.role)
      agentId = Number(result.lastInsertRowid)
    }
  } catch {
    /* agents schema may vary across forks */
  }
  try {
    db.prepare(
      `INSERT INTO tasks (workspace_id, title, status, agent_id, created_at)
       VALUES (?, ?, 'todo', ?, strftime('%s','now'))`,
    ).run(workspaceId, `${employee.name}: introduction & first assignment`, agentId ?? null)
  } catch {
    /* tasks schema may vary across forks */
  }
  db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, created_at)
     VALUES (?, ?, ?, 'employee-hired', ?, ?, ?, strftime('%s','now'))`,
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

export function deployBundle(workspaceId: number, slug: string, idempotencyKey: string) {
  const bundle = getBundleBySlug(slug)
  if (!bundle) throw new Error(`Unknown bundle slug: ${slug}`)
  bundle.employeeSlugs.forEach((empSlug, i) => hireEmployee(workspaceId, empSlug, `${idempotencyKey}-emp-${i}`))
  bundle.skillSlugs.forEach((sklSlug, i) => installSkill(workspaceId, sklSlug, `${idempotencyKey}-skl-${i}`))
  return bundle
}

// ─────────────────────────────────────────────────────────────────────────
// Marketplace purchase ledger — pending row at checkout-creation time,
// flipped to fulfilled by the verified Stripe webhook.
// ─────────────────────────────────────────────────────────────────────────

export type MarketplaceItemType = 'skill' | 'workflow' | 'employee' | 'bundle' | 'credit_pack'

export interface RecordPurchaseArgs {
  workspaceId: number
  purchaserUserId: number | null
  itemType: MarketplaceItemType
  itemId: string
  itemName: string
  priceCents: number
  currency?: string
  stripeCheckoutSessionId: string
  idempotencyKey?: string | null
  metadata?: Record<string, unknown>
}

export function recordPendingMarketplacePurchase(args: RecordPurchaseArgs): number {
  const db = getDatabase()
  const result = db.prepare(
    `INSERT INTO marketplace_purchases
       (workspace_id, purchaser_user_id, item_type, item_id, item_name, price_cents, currency,
        stripe_checkout_session_id, status, idempotency_key, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, unixepoch())
     ON CONFLICT(stripe_checkout_session_id) DO UPDATE SET
       price_cents = excluded.price_cents,
       item_name   = excluded.item_name,
       metadata_json = excluded.metadata_json`,
  ).run(
    args.workspaceId,
    args.purchaserUserId,
    args.itemType,
    args.itemId,
    args.itemName,
    args.priceCents,
    args.currency ?? 'usd',
    args.stripeCheckoutSessionId,
    args.idempotencyKey ?? null,
    args.metadata ? JSON.stringify(args.metadata) : null,
  )
  return Number(result.lastInsertRowid)
}

export interface MarketplacePurchaseRow {
  id: number
  workspace_id: number
  purchaser_user_id: number | null
  item_type: MarketplaceItemType
  item_id: string
  item_name: string
  price_cents: number
  stripe_checkout_session_id: string
  status: 'pending' | 'fulfilled' | 'failed' | 'refunded'
  idempotency_key: string | null
}

export function findMarketplacePurchaseBySession(stripeSessionId: string): MarketplacePurchaseRow | null {
  const db = getDatabase()
  return (
    (db.prepare(
      `SELECT id, workspace_id, purchaser_user_id, item_type, item_id, item_name, price_cents,
              stripe_checkout_session_id, status, idempotency_key
         FROM marketplace_purchases
        WHERE stripe_checkout_session_id = ?`,
    ).get(stripeSessionId) as MarketplacePurchaseRow | undefined) ?? null
  )
}

/**
 * Fulfill a marketplace purchase after a verified webhook.
 * Idempotent on (purchase.id + stripe_event_id) — repeated calls return
 * `{ alreadyFulfilled: true }` without side effects.
 */
export function fulfillMarketplacePurchase(
  purchase: MarketplacePurchaseRow,
  stripeEventId: string,
): { alreadyFulfilled: boolean; itemType: MarketplaceItemType; itemId: string } {
  if (purchase.status === 'fulfilled') {
    return { alreadyFulfilled: true, itemType: purchase.item_type, itemId: purchase.item_id }
  }
  const idempotencyKey = purchase.idempotency_key ?? `mkt_${purchase.id}_${stripeEventId}`
  switch (purchase.item_type) {
    case 'skill':
      installSkill(purchase.workspace_id, purchase.item_id, idempotencyKey)
      break
    case 'employee':
      hireEmployee(purchase.workspace_id, purchase.item_id, idempotencyKey)
      break
    case 'bundle':
      deployBundle(purchase.workspace_id, purchase.item_id, idempotencyKey)
      break
    case 'workflow':
      // Workflows live in `workforce_skills` w/ category='workflow'; treat
      // identically. Future schema split lands here.
      installSkill(purchase.workspace_id, purchase.item_id, idempotencyKey)
      break
    case 'credit_pack':
      // Credit packs route through `fulfillPurchaseOrder` instead; the
      // webhook should never reach this branch for credit_pack rows.
      throw new Error('credit_pack purchases fulfill via fulfillPurchaseOrder, not this path')
  }
  const db = getDatabase()
  db.prepare(
    `UPDATE marketplace_purchases
        SET status = 'fulfilled', fulfilled_at = unixepoch(),
            stripe_payment_status = 'paid', stripe_event_id = ?
      WHERE id = ?`,
  ).run(stripeEventId, purchase.id)
  recordMarketplaceAudit(
    purchase.workspace_id,
    purchase.purchaser_user_id ?? 0,
    'webhook_fulfill',
    purchase.item_id,
    purchase.item_type,
    purchase.price_cents,
  )
  return { alreadyFulfilled: false, itemType: purchase.item_type, itemId: purchase.item_id }
}

// ─────────────────────────────────────────────────────────────────────────
// Credit-debit marketplace purchases (unified token-pack model, 2026-06-05+)
//
// Under the new monetization rule, Stripe only sells token packs;
// every marketplace purchase debits credits from the workspace ledger
// instead of going through individual Stripe checkout sessions.
//
// `purchaseWithCredits` is the canonical entry point for the marketplace
// purchase route under the credit-debit path. It:
//   1. Resolves the credit price from the catalogue (free / credits / included)
//   2. Returns 'insufficient_credits' if balance is too low
//   3. Debits the credits idempotently (UNIQUE on credit_ledger.idempotency_key)
//   4. Calls the underlying install/hire/deploy helper
//   5. Records a `marketplace_purchases` row with status='fulfilled'
//   6. Returns the install outcome + balance after
// ─────────────────────────────────────────────────────────────────────────

export type CreditPurchaseResult =
  | { ok: true; itemType: MarketplaceItemType; itemId: string; chargedCredits: number; balanceAfter: number; idempotent: boolean }
  | { ok: false; reason: 'free_item' | 'included_item'; itemType: MarketplaceItemType; itemId: string }
  | { ok: false; reason: 'insufficient_credits'; itemType: MarketplaceItemType; itemId: string; required: number; balance: number }
  | { ok: false; reason: 'unknown_item'; itemType: MarketplaceItemType; itemId: string }

function itemSourceType(t: MarketplaceItemType): SourceType {
  switch (t) {
    case 'employee': return 'marketplace_employee'
    case 'skill':    return 'marketplace_skill'
    case 'workflow': return 'marketplace_workflow'
    case 'bundle':   return 'marketplace_bundle'
    case 'credit_pack': return 'stripe' // never debited; reserved for Stripe path
  }
}

export interface CreditPurchaseArgs {
  workspaceId: number
  purchaserUserId: number | null
  itemType: MarketplaceItemType
  itemId: string
  /** Optional override of the catalogue price; null = use catalogue. */
  priceCreditsOverride?: number | null
  /** Optional explicit pricing_type override (catalogue is otherwise consulted). */
  pricingTypeOverride?: 'free' | 'credits' | 'included' | null
  idempotencyKey?: string | null
}

/**
 * Look up the catalogue credit price for an item. Returns the credit
 * cost or 0 for free/included items, and null when the slug is unknown.
 */
export function resolveItemCreditPrice(itemType: MarketplaceItemType, itemId: string): { credits: number; pricing_type: 'free' | 'credits' | 'included'; name: string } | null {
  if (itemType === 'credit_pack') return null
  if (itemType === 'skill' || itemType === 'workflow') {
    const skill = getSkillBySlug(itemId)
    if (!skill) return null
    return {
      credits: itemPriceToCredits({ list_price_usd: skill.priceUsd }),
      pricing_type: skill.priceUsd > 0 ? 'credits' : 'free',
      name: skill.name,
    }
  }
  if (itemType === 'employee') {
    const emp = getEmployeeBySlug(itemId)
    if (!emp) return null
    // Under the unified model, employee monthlyUsd becomes a one-time
    // unlock priced in credits. Walt's directive: free demo employees
    // can exist; marketplace employees are no longer always free.
    return {
      credits: itemPriceToCredits({ list_price_usd: emp.monthlyUsd }),
      pricing_type: emp.monthlyUsd > 0 ? 'credits' : 'free',
      name: emp.name,
    }
  }
  if (itemType === 'bundle') {
    const bundle = getBundleBySlug(itemId)
    if (!bundle) return null
    // Bundle price = sum of all child item credits.
    let total = 0
    for (const empSlug of bundle.employeeSlugs) {
      const emp = getEmployeeBySlug(empSlug)
      if (emp) total += itemPriceToCredits({ list_price_usd: emp.monthlyUsd })
    }
    for (const sklSlug of bundle.skillSlugs) {
      const skill = getSkillBySlug(sklSlug)
      if (skill) total += itemPriceToCredits({ list_price_usd: skill.priceUsd })
    }
    return { credits: total, pricing_type: total > 0 ? 'credits' : 'free', name: bundle.name }
  }
  return null
}

export function purchaseWithCredits(args: CreditPurchaseArgs): CreditPurchaseResult {
  const pricing = resolveItemCreditPrice(args.itemType, args.itemId)
  if (!pricing) return { ok: false, reason: 'unknown_item', itemType: args.itemType, itemId: args.itemId }

  const pricingType = args.pricingTypeOverride ?? pricing.pricing_type
  const priceCredits = typeof args.priceCreditsOverride === 'number'
    ? Math.max(0, Math.ceil(args.priceCreditsOverride))
    : pricing.credits

  // ── Free / included → fulfil inline, no debit ─────────────────────────
  if (pricingType === 'free' || priceCredits === 0) {
    const idem = args.idempotencyKey ?? `mkt_free_${args.itemType}_${args.itemId}_${randomBytes(4).toString('hex')}`
    fulfillByType(args.workspaceId, args.itemType, args.itemId, idem)
    recordCreditDebitPurchase(args, 0, 'fulfilled', idem, pricing.name)
    recordMarketplaceAudit(args.workspaceId, args.purchaserUserId ?? 0, 'free_install', args.itemId, args.itemType, 0)
    return { ok: false, reason: 'free_item', itemType: args.itemType, itemId: args.itemId }
  }
  if (pricingType === 'included') {
    return { ok: false, reason: 'included_item', itemType: args.itemType, itemId: args.itemId }
  }

  // ── Balance check before debit ────────────────────────────────────────
  const balance = getWorkspaceBalance(args.workspaceId).balance
  if (balance < priceCredits) {
    return {
      ok: false,
      reason: 'insufficient_credits',
      itemType: args.itemType,
      itemId: args.itemId,
      required: priceCredits,
      balance,
    }
  }

  // ── Debit + fulfill ───────────────────────────────────────────────────
  const idem = args.idempotencyKey ?? `mkt_credit_${args.itemType}_${args.itemId}_${args.workspaceId}_${randomBytes(4).toString('hex')}`
  const debit = applyCreditMutation({
    workspaceId: args.workspaceId,
    type: 'usage',
    amount: -priceCredits,
    sourceType: itemSourceType(args.itemType),
    sourceId: args.itemId,
    description: `${args.itemType} unlock: ${pricing.name}`,
    idempotencyKey: idem,
    userId: args.purchaserUserId ?? undefined,
  })

  if (!debit.idempotent) {
    fulfillByType(args.workspaceId, args.itemType, args.itemId, idem)
  }
  recordCreditDebitPurchase(args, priceCredits, 'fulfilled', idem, pricing.name)
  recordMarketplaceAudit(args.workspaceId, args.purchaserUserId ?? 0, 'credit_unlock', args.itemId, args.itemType, priceCredits)

  return {
    ok: true,
    itemType: args.itemType,
    itemId: args.itemId,
    chargedCredits: priceCredits,
    balanceAfter: debit.balanceAfter,
    idempotent: debit.idempotent,
  }
}

function fulfillByType(workspaceId: number, itemType: MarketplaceItemType, itemId: string, idem: string): void {
  switch (itemType) {
    case 'skill':    installSkill(workspaceId, itemId, idem); break
    case 'workflow': installSkill(workspaceId, itemId, idem); break
    case 'employee': hireEmployee(workspaceId, itemId, idem); break
    case 'bundle':   deployBundle(workspaceId, itemId, idem); break
    case 'credit_pack': throw new Error('credit_pack does not fulfill via marketplace path')
  }
}

function recordCreditDebitPurchase(
  args: CreditPurchaseArgs,
  priceCredits: number,
  status: 'fulfilled',
  idem: string,
  itemName: string,
): void {
  const db = getDatabase()
  const sessionLike = `credit_${idem}`
  db.prepare(
    `INSERT INTO marketplace_purchases
       (workspace_id, purchaser_user_id, item_type, item_id, item_name, price_cents, currency,
        stripe_checkout_session_id, stripe_payment_status, status, idempotency_key, metadata_json, created_at, fulfilled_at)
     VALUES (?, ?, ?, ?, ?, ?, 'credits', ?, 'credits', ?, ?, ?, unixepoch(), unixepoch())
     ON CONFLICT(stripe_checkout_session_id) DO NOTHING`,
  ).run(
    args.workspaceId,
    args.purchaserUserId,
    args.itemType,
    args.itemId,
    itemName,
    priceCredits,
    sessionLike,
    status,
    idem,
    JSON.stringify({ payment_method: 'credit_ledger', idempotency_key: idem }),
  )
}
