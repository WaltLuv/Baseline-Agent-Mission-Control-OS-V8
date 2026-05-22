/**
 * Billing Service — Central credit mutation and usage metering for Mission Control V2.
 *
 * All credit deductions go through this service. Never let random panels deduct credits directly.
 * Workspace-first: workspace_id owns balances, subscriptions, credits, usage.
 * user_id only tracks the actor who triggered the event.
 *
 * Rules:
 * - Never update balance without credit_ledger row
 * - Never grant credits from success page/redirect
 * - Never process same Stripe event twice (idempotency_key uniqueness)
 * - All deductions are atomic
 * - Failed tasks don't charge (deductCredits called on success only)
 */

import { getDatabase } from '@/lib/db'
import { logStructured } from '@/lib/observability'

// ── Types ────────────────────────────────────────────────────────────

export type CreditType = 'grant' | 'usage' | 'refund' | 'adjustment' | 'purchase'

export type SourceType =
  | 'task' | 'workflow' | 'voice_call' | 'vision_analysis'
  | 'lead_research' | 'document_analysis' | 'manual' | 'stripe'
  | 'subscription' | 'adjustment' | 'api_usage'

export interface CreditMutation {
  workspaceId: number
  type: CreditType
  amount: number // positive for grants, negative for deductions
  sourceType: SourceType
  sourceId: string | number | null
  description: string
  idempotencyKey: string
  userId?: number // actor who triggered (optional)
}

export interface UsageEvent {
  workspaceId: number
  agentId: number | null
  taskId: number | null
  workflowRunId: string | null
  eventType: string
  provider: string | null
  model: string | null
  rawCostCents: number
  retailCostCents: number
  creditsCharged: number
  metadataJson: string | null
  idempotencyKey: string
}

export interface CreditBalance {
  workspaceId: number
  balance: number
  granted: number
  used: number
  refunded: number
}

export interface PricingConfig {
  eventType: string
  creditsRequired: number
  retailCostCents: number
}

export interface InsufficientCreditsError extends Error {
  type: 'INSUFFICIENT_CREDITS'
  required: number
  available: number
}

// ── Core: Atomic Credit Mutations ─────────────────────────────────────────────

/**
 * Apply a credit mutation atomically.
 * Creates both credit_ledger row AND updates balance.
 * Uses idempotency check: if key already exists, returns existing result.
 */
export function applyCreditMutation(mutation: CreditMutation): { balanceAfter: number; idempotent: boolean } {
  const db = getDatabase()

  // Idempotency check
  const existing = db.prepare(
    'SELECT balance_after, id FROM credit_ledger WHERE idempotency_key = ? AND workspace_id = ?'
  ).get(mutation.idempotencyKey, mutation.workspaceId) as { balance_after: number; id: number } | undefined

  if (existing) {
    logStructured({
      level: 'info',
      message: 'Credit mutation skipped — idempotent',
      idempotencyKey: mutation.idempotencyKey,
      balanceAfter: existing.balance_after,
      workspaceId: mutation.workspaceId,
    })
    return { balanceAfter: existing.balance_after, idempotent: true }
  }

  // Get current balance from ledger recalculation (source of truth)
  const currentBalanceRow = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE workspace_id = ?'
  ).get(mutation.workspaceId) as { balance: number }
  const currentBalance = currentBalanceRow.balance

  // Calculate balance after
  const balanceAfter = currentBalance + mutation.amount

  // Insert ledger row
  const result = db.prepare(
    `INSERT INTO credit_ledger (workspace_id, subscription_id, type, amount, balance_after, source_type, source_id, description, idempotency_key, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
  ).run(
    mutation.workspaceId,
    mutation.type,
    mutation.amount,
    balanceAfter,
    mutation.sourceType,
    mutation.sourceId !== null ? String(mutation.sourceId) : null,
    mutation.description,
    mutation.idempotencyKey
  )

  logStructured({
    level: 'info',
    message: `Credit ${mutation.type}`,
    workspaceId: mutation.workspaceId,
    type: mutation.type,
    amount: mutation.amount,
    balanceAfter,
    sourceType: mutation.sourceType,
    idempotencyKey: mutation.idempotencyKey,
  })

  return { balanceAfter, idempotent: false }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get workspace credit balance from ledger (immutable, recalculated).
 */
export function getWorkspaceBalance(workspaceId: number): CreditBalance {
  const db = getDatabase()
  const row = db.prepare(
    `SELECT
       COALESCE(SUM(amount), 0) as balance,
       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as granted,
       COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as used,
       COALESCE(SUM(CASE WHEN type = 'refund' THEN ABS(amount) ELSE 0 END), 0) as refunded
     FROM credit_ledger WHERE workspace_id = ?`
  ).get(workspaceId) as CreditBalance

  row.workspaceId = workspaceId
  return row
}

/**
 * Grant credits (e.g. from subscription, purchase, manual adjustment).
 * Amount is positive.
 */
export function grantCredits(mutation: Omit<CreditMutation, 'type' | 'amount'> & { credits: number }): { balanceAfter: number; idempotent: boolean } {
  return applyCreditMutation({
    ...mutation,
    type: 'grant',
    amount: mutation.credits,
  })
}

/**
 * Deduct credits for usage.
 * Amount is negative internally (creditsCharged is positive).
 */
export function deductCredits(
  workspaceId: number,
  creditsCharged: number,
  sourceType: SourceType,
  sourceId: string | number | null,
  description: string,
  idempotencyKey: string,
  userId?: number
): { balanceAfter: number; idempotent: boolean } {
  return applyCreditMutation({
    workspaceId,
    type: 'usage',
    amount: -creditsCharged, // negative for deductions
    sourceType,
    sourceId,
    description,
    idempotencyKey,
    userId,
  })
}

/**
 * Refund credits (e.g. failed task, cancelled workflow).
 * Amount is positive (adds back credits).
 */
export function refundCredits(
  workspaceId: number,
  credits: number,
  sourceType: SourceType,
  sourceId: string | number | null,
  description: string,
  idempotencyKey: string
): { balanceAfter: number; idempotent: boolean } {
  return applyCreditMutation({
    workspaceId,
    type: 'refund',
    amount: credits,
    sourceType,
    sourceId,
    description,
    idempotencyKey,
  })
}

/**
 * Record a usage event (separate from credit deduction).
 * Usage events are for analytics and audit trail.
 * DeductCredits should also be called for the actual charge.
 */
export function recordUsageEvent(event: UsageEvent): void {
  const db = getDatabase()

  // Idempotency check
  const existing = db.prepare(
    'SELECT id FROM usage_events WHERE idempotency_key = ? AND workspace_id = ?'
  ).get(event.idempotencyKey, event.workspaceId)

  if (existing) {
    return // already recorded
  }

  db.prepare(
    `INSERT INTO usage_events (workspace_id, agent_id, task_id, workflow_run_id, event_type, provider, model, raw_cost_cents, retail_cost_cents, credits_charged, metadata_json, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
  ).run(
    event.workspaceId,
    event.agentId,
    event.taskId,
    event.workflowRunId,
    event.eventType,
    event.provider,
    event.model,
    event.rawCostCents,
    event.retailCostCents,
    event.creditsCharged,
    event.metadataJson || null,
    event.idempotencyKey,
  )
}

/**
 * Get pricing config for an event type.
 */
export function getPricingConfig(eventType: string, provider?: string, model?: string): PricingConfig | null {
  const db = getDatabase()

  // Try exact match first
  let config = db.prepare(
    'SELECT * FROM pricing_configs WHERE event_type = ? AND provider = ? AND model = ? AND status = ? LIMIT 1'
  ).get(eventType, provider || '', model || '', 'active') as PricingConfig | undefined

  // Fallback: event_type only
  if (!config) {
    config = db.prepare(
      'SELECT * FROM pricing_configs WHERE event_type = ? AND (provider = ? OR provider IS NULL) AND status = ? LIMIT 1'
    ).get(eventType, '', 'active') as PricingConfig | undefined
  }

  return config || null
}

/**
 * Check if workspace has enough credits for estimated cost.
 * Returns { canRun, available, required }
 */
export function checkCanRun(workspaceId: number, estimatedCredits: number): { canRun: boolean; available: number; required: number } {
  const balance = getWorkspaceBalance(workspaceId)
  return {
    canRun: balance.balance >= estimatedCredits,
    available: balance.balance,
    required: estimatedCredits,
  }
}

/**
 * Atomic charge: record usage event + deduct credits + record ledger.
 * All-or-nothing: if credits are insufficient, throws error and charges nothing.
 */
export function chargeForAction(
  workspaceId: number,
  eventType: string,
  sourceType: SourceType,
  sourceId: string | number | null,
  idempotencyKey: string,
  agentId?: number | null,
  taskId?: number | null,
  options?: { customCredits?: number; metadataJson?: string }
): { creditsCharged: number; balanceAfter: number } {
  const db = getDatabase()

  // Determine cost from pricing config
  let creditsRequired: number
  let retailCostCents = 0
  let rawCostCents = 0

  if (options?.customCredits !== undefined) {
    creditsRequired = options.customCredits
  } else {
    const config = getPricingConfig(eventType)
    if (!config) {
      creditsRequired = 0 // free action if no pricing config
    } else {
      creditsRequired = config.creditsRequired
      retailCostCents = config.retailCostCents
    }
  }

  // Check balance first
  const { canRun, available } = checkCanRun(workspaceId, creditsRequired)
  if (!canRun) {
    const err: InsufficientCreditsError = new Error(
      `Insufficient credits: ${available} available, ${creditsRequired} required`
    ) as InsufficientCreditsError
    err.type = 'INSUFFICIENT_CREDITS'
    throw err
  }

  // Record usage event
  recordUsageEvent({
    workspaceId,
    agentId: agentId || null,
    taskId: taskId || null,
    workflowRunId: null,
    eventType,
    provider: null,
    model: null,
    rawCostCents,
    retailCostCents,
    creditsCharged: creditsRequired,
    metadataJson: options?.metadataJson || null,
    idempotencyKey,
  })

  // Deduct credits
  const result = deductCredits(
    workspaceId,
    creditsRequired,
    sourceType,
    sourceId,
    `${eventType} (id: ${sourceId})`,
    idempotencyKey,
  )

  return {
    creditsCharged: creditsRequired,
    balanceAfter: result.balanceAfter,
  }
}

/**
 * Recalculate workspace balance from ledger (audit/verification).
 */
export function recalculateBalance(workspaceId: number): number {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE workspace_id = ?'
  ).get(workspaceId) as { balance: number }
  return row.balance
}

/**
 * Credit purchase order workflow:
 * 1. Create order record before Stripe Checkout
 * 2. Webhook marks order PAID
 * 3. Credits granted through applyCreditMutation only
 */
export function createPurchaseOrder(
  workspaceId: number,
  packageId: number,
  stripeSessionId: string,
  creditsToGrant: number,
  amountCents: number
): number {
  const db = getDatabase()
  const result = db.prepare(
    `INSERT INTO credit_purchase_orders (workspace_id, package_id, stripe_session_id, credits_to_grant, amount_cents, status, fulfilled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, unixepoch(), unixepoch())`
  ).run(workspaceId, packageId, stripeSessionId, creditsToGrant, amountCents)

  return result.lastInsertRowid as number
}

/**
 * Fulfill purchase order (called from Stripe webhook ONLY).
 * Grants credits atomically via applyCreditMutation.
 */
export function fulfillPurchaseOrder(
  workspaceId: number,
  stripeSessionId: string,
  stripeEventId: string,
  idempotencyKey: string
): { creditsGranted: number; balanceAfter: number } | null {
  const db = getDatabase()

  // Find pending order
  const order = db.prepare(
    `SELECT * FROM credit_purchase_orders WHERE stripe_session_id = ? AND workspace_id = ? AND status = 'pending'`
  ).get(stripeSessionId, workspaceId) as any

  if (!order) {
    return null // no pending order found
  }

  // Grant credits through the central mutation service
  const result = applyCreditMutation({
    workspaceId,
    type: 'purchase',
    amount: order.credits_to_grant,
    sourceType: 'stripe',
    sourceId: stripeSessionId,
    description: `Credit package purchase (order #${order.id})`,
    idempotencyKey,
  })

  // Mark order fulfilled and store Stripe event reference
  db.prepare(
    `UPDATE credit_purchase_orders SET status = 'paid', fulfilled = 1, stripe_event_id = ?, updated_at = unixepoch()
     WHERE id = ?`
  ).run(stripeEventId, order.id)

  return { creditsGranted: order.credits_to_grant, balanceAfter: result.balanceAfter }
}
