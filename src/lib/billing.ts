import { getDatabase } from '@/lib/db'
import { logStructured } from '@/lib/observability'
import { calculateTokenCosts, type TokenUsageInput, type CostResult } from './token-cost-calculator'

// -- Types --

export type CreditType = 'grant' | 'usage' | 'refund' | 'adjustment' | 'purchase'

export type SourceType =
  | 'task' | 'workflow' | 'voice_call' | 'vision_analysis'
  | 'lead_research' | 'document_analysis' | 'manual' | 'stripe'
  | 'subscription' | 'adjustment' | 'api_usage' | 'agent_session'

export interface CreditMutation {
  workspaceId: number
  type: CreditType
  amount: number
  sourceType: SourceType
  sourceId: string | number | null
  description: string
  idempotencyKey: string
  userId?: number
}

export interface UsageEvent {
  workspaceId: number
  agentId: number | null
  taskId: number | null
  workflowRunId: string | null
  eventType: string
  provider: string | null
  model: string | null
  inputTokens: number
  outputTokens: number
  rawCostCents: number
  retailCostCents: number
  creditsCharged: number
  markupMultiplier: number
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
  provider: string
  model: string
  wholesaleCostCents: number
  retailCostCents: number
  creditsRequired: number
  status: string
}

export interface InsufficientCreditsError extends Error {
  type: 'INSUFFICIENT_CREDITS'
  required: number
  available: number
}

// -- Core: Atomic Credit Mutations --

export function applyCreditMutation(mutation: CreditMutation): { balanceAfter: number; idempotent: boolean } {
  const db = getDatabase()
  const existing = db.prepare(
    'SELECT balance_after, id FROM credit_ledger WHERE idempotency_key = ? AND workspace_id = ?'
  ).get(mutation.idempotencyKey, mutation.workspaceId) as { balance_after: number; id: number } | undefined

  if (existing) {
    logStructured({
      level: 'info',
      message: 'Credit mutation skipped (idempotent)',
      idempotencyKey: mutation.idempotencyKey,
      balanceAfter: existing.balance_after,
      workspaceId: mutation.workspaceId,
    })
    return { balanceAfter: existing.balance_after, idempotent: true }
  }

  const currentBalanceRow = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE workspace_id = ?'
  ).get(mutation.workspaceId) as { balance: number }
  const balanceAfter = currentBalanceRow.balance + mutation.amount

  db.prepare(
    `INSERT INTO credit_ledger (workspace_id, subscription_id, type, amount, balance_after, source_type, source_id, description, idempotency_key, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
  ).run(
    mutation.workspaceId, mutation.type, mutation.amount, balanceAfter,
    mutation.sourceType,
    mutation.sourceId !== null ? String(mutation.sourceId) : null,
    mutation.description, mutation.idempotencyKey
  )

  logStructured({
    level: 'info',
    message: 'Credit ' + mutation.type + ' applied',
    type: mutation.type,
    amount: mutation.amount,
    balanceAfter,
    idempotencyKey: mutation.idempotencyKey,
  })
  return { balanceAfter, idempotent: false }
}

// -- Public API --

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

export function grantCredits(mutation: Omit<CreditMutation, 'type' | 'amount'> & { credits: number }): { balanceAfter: number; idempotent: boolean } {
  return applyCreditMutation({ ...mutation, type: 'grant', amount: mutation.credits })
}

export function deductCredits(
  workspaceId: number, creditsCharged: number, sourceType: SourceType,
  sourceId: string | number | null, description: string, idempotencyKey: string, userId?: number
): { balanceAfter: number; idempotent: boolean } {
  return applyCreditMutation({
    workspaceId, type: 'usage', amount: -creditsCharged, sourceType,
    sourceId, description, idempotencyKey, userId,
  })
}

export function refundCredits(
  workspaceId: number, credits: number, sourceType: SourceType,
  sourceId: string | number | null, description: string, idempotencyKey: string
): { balanceAfter: number; idempotent: boolean } {
  return applyCreditMutation({
    workspaceId, type: 'refund', amount: credits, sourceType, sourceId, description, idempotencyKey,
  })
}

export function recordUsageEvent(event: UsageEvent): void {
  const db = getDatabase()
  const existing = db.prepare(
    'SELECT id FROM usage_events WHERE idempotency_key = ? AND workspace_id = ?'
  ).get(event.idempotencyKey, event.workspaceId)
  if (existing) return

  db.prepare(
    `INSERT INTO usage_events (workspace_id, agent_id, task_id, workflow_run_id, event_type,
     provider, model, input_tokens, output_tokens, raw_cost_cents, retail_cost_cents,
     credits_charged, markup_multiplier, metadata_json, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
  ).run(
    event.workspaceId, event.agentId, event.taskId, event.workflowRunId, event.eventType,
    event.provider, event.model, event.inputTokens, event.outputTokens,
    event.rawCostCents, event.retailCostCents, event.creditsCharged,
    event.markupMultiplier, event.metadataJson || null, event.idempotencyKey,
  )
}

// -- PIVOT: chargeForAction with token-based costing --

/**
 * Get pricing config with HARD fallbacks. NEVER returns null.
 * Fallthrough: exact → by provider → by event_type → default from table → hardcoded 13 credits.
 */
export function getPricingConfig(eventType: string, provider?: string, model?: string): PricingConfig {
  const db = getDatabase()

  const exact = db.prepare(
    'SELECT * FROM pricing_configs WHERE event_type = ? AND provider = ? AND model = ? AND status = ? LIMIT 1'
  ).get(eventType, provider || '', model || '', 'active') as PricingConfig | undefined
  if (exact) return exact

  const byProv = db.prepare(
    'SELECT * FROM pricing_configs WHERE event_type = ? AND provider = ? AND status = ? LIMIT 1'
  ).get(eventType, provider || '', 'active') as PricingConfig | undefined
  if (byProv) return byProv

  const byType = db.prepare(
    'SELECT * FROM pricing_configs WHERE event_type = ? AND status = ? LIMIT 1'
  ).get(eventType, 'active') as PricingConfig | undefined
  if (byType) return byType

  // FALLBACK 1: default config from table
  const defaultConf = db.prepare(
    "SELECT * FROM pricing_configs WHERE event_type = 'default' AND status = 'active' LIMIT 1"
  ).get() as PricingConfig | undefined
  if (defaultConf) return defaultConf

  // FALLBACK 2: hardcoded safe values. 13 credits per action. NEVER zero.
  return {
    eventType: 'default', provider: 'default', model: 'default',
    wholesaleCostCents: 500, retailCostCents: 1250, creditsRequired: 13, status: 'active',
  }
}

export function checkCanRun(workspaceId: number, estimatedCredits: number): { canRun: boolean; available: number; required: number } {
  const balance = getWorkspaceBalance(workspaceId)
  return { canRun: balance.balance >= estimatedCredits, available: balance.balance, required: estimatedCredits }
}

/**
 * Atomic charge with 3 cost calculation modes:
 *   MODE 1: Token-based (real input/output tokens → wholesale → markup → credits)
 *   MODE 2: Custom credits (explicit override)
 *   MODE 3: Pricing config lookup (by event_type + provider + model)
 *
 * SAFETY: minimum 1 credit per action. Default fallback of 13 credits if no config.
 * NEVER charges zero. NEVER returns null config.
 */
export function chargeForAction(
  workspaceId: number, eventType: string, sourceType: SourceType,
  sourceId: string | number | null, idempotencyKey: string,
  agentId?: number | null, taskId?: number | null,
  options?: {
    customCredits?: number; metadataJson?: string;
    model?: string; provider?: string;
    inputTokens?: number; outputTokens?: number;
    cacheReadTokens?: number; cacheWriteTokens?: number;
    markupMultiplier?: number;
  }
): { creditsCharged: number; balanceAfter: number; wholesaleCostCents: number; retailCostCents: number } {
  let creditsRequired: number
  let retailCostCents = 0; let wholesaleCostCents = 0
  let inputTokens = 0; let outputTokens = 0; let usedMarkup = 2.5

  // MODE 1: Token-based cost calculation
  if (options?.model && (options.inputTokens || options.outputTokens)) {
    const cost = calculateTokenCosts({
      model: options.model, provider: options.provider || '',
      inputTokens: options.inputTokens || 0, outputTokens: options.outputTokens || 0,
      cacheReadTokens: options.cacheReadTokens, cacheWriteTokens: options.cacheWriteTokens,
      markupMultiplier: options.markupMultiplier,
    })
    creditsRequired = cost.creditsRequired
    retailCostCents = cost.retailCostCents
    wholesaleCostCents = cost.wholesaleCostCents
    usedMarkup = cost.markupMultiplier
    inputTokens = options.inputTokens || 0
    outputTokens = options.outputTokens || 0
  }
  // MODE 2: Explicit custom credits
  else if (options?.customCredits !== undefined) {
    creditsRequired = Math.max(1, options.customCredits)
  }
  // MODE 3: Pricing config lookup — NEVER returns null due to dual safety fallbacks
  else {
    const config = getPricingConfig(eventType, options?.provider || '', options?.model || '')
    creditsRequired = Math.max(1, config.creditsRequired)
    retailCostCents = config.retailCostCents
    wholesaleCostCents = config.wholesaleCostCents
    inputTokens = 1000; outputTokens = 500
    usedMarkup = retailCostCents > 0 && wholesaleCostCents > 0
      ? Math.round((retailCostCents / wholesaleCostCents) * 100) / 100 : 2.5
  }

  // BALANCE CHECK
  const { canRun, available } = checkCanRun(workspaceId, creditsRequired)
  if (!canRun) {
    const err = new Error(`Insufficient credits: ${available} available, ${creditsRequired} required`) as InsufficientCreditsError & Error
    err.type = 'INSUFFICIENT_CREDITS' as const
    throw err
  }

  // RECORD + CHARGE
  recordUsageEvent({
    workspaceId, agentId: agentId || null, taskId: taskId || null,
    workflowRunId: null, eventType,
    provider: options?.provider || null, model: options?.model || null,
    inputTokens, outputTokens,
    rawCostCents: wholesaleCostCents, retailCostCents,
    creditsCharged: creditsRequired, markupMultiplier: usedMarkup,
    metadataJson: options?.metadataJson || null, idempotencyKey,
  })

  const result = deductCredits(workspaceId, creditsRequired, sourceType, sourceId,
    eventType + ' (id: ' + sourceId + ')', idempotencyKey)

  return { creditsCharged: creditsRequired, balanceAfter: result.balanceAfter, wholesaleCostCents, retailCostCents }
}

/**
 * Gateway/agent phone-home: report token usage and auto-charge credits.
 * This is the critical connection between agent token consumption and billing.
 */
export function chargeForAgentSession(
  workspaceId: number, agentId: number, taskId: number | null,
  model: string, provider: string, inputTokens: number, outputTokens: number, idempotencyKey: string
): { creditsCharged: number; balanceAfter: number; wholesaleCostCents: number; retailCostCents: number } {
  return chargeForAction(workspaceId, 'agent_session', 'agent_session', 'agent_' + agentId,
    idempotencyKey, agentId, taskId,
    { model, provider, inputTokens, outputTokens, metadataJson: JSON.stringify({ model, provider }) })
}

export function recalculateBalance(workspaceId: number): number {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE workspace_id = ?'
  ).get(workspaceId) as { balance: number }
  return row.balance
}

export function createPurchaseOrder(workspaceId: number, packageId: number, stripeSessionId: string, creditsToGrant: number, amountCents: number): number {
  const db = getDatabase()
  const result = db.prepare(
    `INSERT INTO credit_purchase_orders (workspace_id, package_id, stripe_session_id, credits_to_grant, amount_cents, status, fulfilled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, unixepoch(), unixepoch())`
  ).run(workspaceId, packageId, stripeSessionId, creditsToGrant, amountCents)
  return result.lastInsertRowid as number
}

export function fulfillPurchaseOrder(workspaceId: number, stripeSessionId: string, stripeEventId: string, idempotencyKey: string): { creditsGranted: number; balanceAfter: number } | null {
  const db = getDatabase()
  const order = db.prepare(
    `SELECT * FROM credit_purchase_orders WHERE stripe_session_id = ? AND workspace_id = ? AND status = 'pending'`
  ).get(stripeSessionId, workspaceId) as any
  if (!order) return null

  const result = applyCreditMutation({
    workspaceId, type: 'purchase', amount: order.credits_to_grant,
    sourceType: 'stripe', sourceId: stripeSessionId,
    description: 'Credit package purchase (order #' + order.id + ')', idempotencyKey,
  })
  db.prepare(
    `UPDATE credit_purchase_orders SET status = 'paid', fulfilled = 1, stripe_event_id = ?, updated_at = unixepoch() WHERE id = ?`
  ).run(stripeEventId, order.id)
  return { creditsGranted: order.credits_to_grant, balanceAfter: result.balanceAfter }
}

export function getMarginReport(workspaceId: number, timeframe: 'day' | 'week' | 'month' | 'all' = 'week') {
  const db = getDatabase()
  let periodFilter = ''
  const now = Math.floor(Date.now() / 1000)
  if (timeframe === 'day') periodFilter = 'AND created_at > ' + (now - 86400)
  else if (timeframe === 'week') periodFilter = 'AND created_at > ' + (now - 604800)
  else if (timeframe === 'month') periodFilter = 'AND created_at > ' + (now - 2592000)

  const row = db.prepare(
    'SELECT COALESCE(SUM(raw_cost_cents), 0) as wholesale_cents, COALESCE(SUM(retail_cost_cents), 0) as retail_cents, COALESCE(SUM(credits_charged), 0) as total_credits, COUNT(*) as event_count FROM usage_events WHERE workspace_id = ? ' + periodFilter
  ).get(workspaceId) as { wholesale_cents: number; retail_cents: number; total_credits: number; event_count: number }

  const marginCents = row.retail_cents - row.wholesale_cents
  const marginPct = row.retail_cents > 0 ? Math.round((marginCents / row.retail_cents) * 10000) / 100 : 0

  return {
    wholesaleCents: row.wholesale_cents, retailCents: row.retail_cents,
    marginCents, marginPercent: marginPct,
    totalCredits: row.total_credits, eventCount: row.event_count, period: timeframe,
  }
}
