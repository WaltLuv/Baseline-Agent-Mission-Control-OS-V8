import { getDatabase } from '@/lib/db'

// ── Types ────────────────────────────────────────────────────────────────

export interface HealthFactor {
  name: string
  weight: number          // 0-1 (e.g. 0.20 = 20%)
  score: number           // 0-100
  detail?: string
}

export interface FleetHealthScore {
  score: number           // 0-100 overall
  label: string           // Excellent | Healthy | Needs Attention | At Risk | Critical
  factors: HealthFactor[]
}

// ── Weights (must sum to 1.0) ───────────────────────────────────────────

const WEIGHTS = {
  taskCompletionRate:    0.20,
  staleTaskCount:        0.15,
  failedWorkflowCount:   0.15,
  agentHeartbeatHealth:  0.15,
  qualityApprovalRate:   0.10,
  securityEventSeverity: 0.10,
  webhookHealth:         0.05,
  creditBalanceRisk:     0.05,
  costAnomalyRisk:       0.05,
} as const

// ── Factor Evaluators ────────────────────────────────────────────────────

interface FactorEvalCtx {
  db: ReturnType<typeof getDatabase>
  now: number             // unix epoch seconds
}

/**
 * Task completion rate (20%)
 * done / (done + assigned + in_progress + pending/queued)
 * Missing → skip
 */
function evalTaskCompletionRate({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN status IN ('done') THEN 1 ELSE 0 END) AS done_count,
        SUM(CASE WHEN status IN ('inbox','assigned','in_progress','pending','queued','review','quality_review') THEN 1 ELSE 0 END) AS active_count
      FROM tasks
    `).get() as { done_count: number | null; active_count: number | null } | undefined

    if (!row || row.done_count == null || row.active_count == null) {
      return { name: 'Task Completion Rate', weight: WEIGHTS.taskCompletionRate, score: 0, detail: 'No task data' }
    }

    const total = row.done_count + row.active_count
    if (total === 0) {
      return { name: 'Task Completion Rate', weight: WEIGHTS.taskCompletionRate, score: 0, detail: 'No tasks found' }
    }

    const ratio = row.done_count / total
    const score = Math.round(ratio * 100)
    return {
      name: 'Task Completion Rate',
      weight: WEIGHTS.taskCompletionRate,
      score,
      detail: `${row.done_count} done / ${total} total (${Math.round(ratio * 100)}%)`,
    }
  } catch {
    return { name: 'Task Completion Rate', weight: WEIGHTS.taskCompletionRate, score: 0, detail: 'Table unavailable' }
  }
}

/**
 * Stale task count (15%)
 * Measures tasks stuck in in_progress for >24h. More stale tasks → lower score.
 * Missing table → skip.
 */
function evalStaleTaskCount({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    const staleRow = db.prepare(`
      SELECT COUNT(*) AS stale
      FROM tasks
      WHERE status = 'in_progress' AND updated_at < ?
    `).get(now - 86_400) as { stale: number } | undefined

    if (!staleRow) {
      return { name: 'Stale Task Count', weight: WEIGHTS.staleTaskCount, score: 0, detail: 'Table unavailable' }
    }

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS total FROM tasks WHERE status = 'in_progress'
    `).get() as { total: number } | undefined

    const total = totalRow?.total ?? 0
    if (total === 0) {
      return { name: 'Stale Task Count', weight: WEIGHTS.staleTaskCount, score: 100, detail: 'No in-progress tasks' }
    }

    // % that are NOT stale
    const healthy = total - staleRow.stale
    const score = Math.round((healthy / total) * 100)
    return {
      name: 'Stale Task Count',
      weight: WEIGHTS.staleTaskCount,
      score,
      detail: `${staleRow.stale} stale / ${total} in-progress (>24h threshold)`,
    }
  } catch {
    return { name: 'Stale Task Count', weight: WEIGHTS.staleTaskCount, score: 0, detail: 'Table unavailable' }
  }
}

/**
 * Failed workflow count (15%)
 * Measures proportion of tasks ending in error/failed states.
 * Lower failure rate → higher score.
 * Missing table → skip.
 */
function evalFailedWorkflowCount({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN status IN ('error','failed','timed_out','cancelled') THEN 1 ELSE 0 END) AS failed_count,
        COUNT(*) AS total
      FROM tasks
    `).get() as { failed_count: number | null; total: number } | undefined

    if (!row || row.total === 0) {
      return { name: 'Failed Workflow Count', weight: WEIGHTS.failedWorkflowCount, score: 0, detail: 'No workflow data' }
    }

    const failures = row.failed_count ?? 0
    const successRatio = (row.total - failures) / row.total
    const score = Math.round(successRatio * 100)
    return {
      name: 'Failed Workflow Count',
      weight: WEIGHTS.failedWorkflowCount,
      score,
      detail: `${failures} failed / ${row.total} total (${Math.round((1 - successRatio) * 100)}% failure rate)`,
    }
  } catch {
    return { name: 'Failed Workflow Count', weight: WEIGHTS.failedWorkflowCount, score: 0, detail: 'Table unavailable' }
  }
}

/**
 * Agent heartbeat health (15%)
 * Proportion of agents that have reported a heartbeat in the last 5 minutes.
 * Missing → skip.
 */
function evalAgentHeartbeatHealth({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    const totalRow = db.prepare(`
      SELECT COUNT(*) AS total FROM agents WHERE hidden = 0
    `).get() as { total: number } | undefined

    const total = totalRow?.total ?? 0
    if (total === 0) {
      // Try counting all agents (no hidden col)
      try {
        const allRow = db.prepare(`SELECT COUNT(*) AS total FROM agents`).get() as { total: number } | undefined
        if (!allRow || allRow.total === 0) {
          return { name: 'Agent Heartbeat Health', weight: WEIGHTS.agentHeartbeatHealth, score: 0, detail: 'No agents registered' }
        }
      } catch {
        return { name: 'Agent Heartbeat Health', weight: WEIGHTS.agentHeartbeatHealth, score: 0, detail: 'No agents registered' }
      }
    }

    const activeRow = db.prepare(`
      SELECT COUNT(*) AS active
      FROM agents
      WHERE last_seen > ?
    `).get(now - 300) as { active: number } | undefined

    const active = activeRow?.active ?? 0
    const ratio = total > 0 ? active / total : 0
    const score = Math.round(ratio * 100)
    return {
      name: 'Agent Heartbeat Health',
      weight: WEIGHTS.agentHeartbeatHealth,
      score,
      detail: `${active} seen in last 5 min / ${total} total agents`,
    }
  } catch {
    return { name: 'Agent Heartbeat Health', weight: WEIGHTS.agentHeartbeatHealth, score: 0, detail: 'Table unavailable' }
  }
}

/**
 * Quality approval rate (10%)
 * approved / (approved + rejected) from quality_reviews
 * Missing → skip.
 */
function evalQualityApprovalRate({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
      FROM quality_reviews
    `).get() as { approved: number | null; rejected: number | null } | undefined

    if (!row) {
      return { name: 'Quality Approval Rate', weight: WEIGHTS.qualityApprovalRate, score: 0, detail: 'Table unavailable' }
    }

    const approved = row.approved ?? 0
    const rejected = row.rejected ?? 0
    const total = approved + rejected
    if (total === 0) {
      return { name: 'Quality Approval Rate', weight: WEIGHTS.qualityApprovalRate, score: 100, detail: 'No quality reviews yet' }
    }

    const ratio = approved / total
    const score = Math.round(ratio * 100)
    return {
      name: 'Quality Approval Rate',
      weight: WEIGHTS.qualityApprovalRate,
      score,
      detail: `${approved} approved / ${total} reviewed (${Math.round(ratio * 100)}%)`,
    }
  } catch {
    return { name: 'Quality Approval Rate', weight: WEIGHTS.qualityApprovalRate, score: 0, detail: 'Table unavailable' }
  }
}

/**
 * Security event severity (10%)
 * Counts recent (24h) security events by severity, maps to a penalty score.
 * critical=-40, high=-25, medium=-10, low=-5 per event (clamped 0-100).
 * Missing → skip (score 100).
 */
function evalSecurityEventSeverity({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical_count,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high_count,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) AS medium_count,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) AS low_count,
        COUNT(*) AS total_count
      FROM security_events
      WHERE created_at > ?
    `).get(now - 86_400) as { critical_count: number | null; high_count: number | null; medium_count: number | null; low_count: number | null; total_count: number } | undefined

    if (!row || row.total_count === 0) {
      return { name: 'Security Event Severity', weight: WEIGHTS.securityEventSeverity, score: 100, detail: 'No recent security events' }
    }

    const penalty =
      (row.critical_count ?? 0) * 40 +
      (row.high_count ?? 0) * 25 +
      (row.medium_count ?? 0) * 10 +
      (row.low_count ?? 0) * 5

    const score = Math.max(0, Math.min(100, 100 - penalty))
    return {
      name: 'Security Event Severity',
      weight: WEIGHTS.securityEventSeverity,
      score,
      detail: `C:${row.critical_count ?? 0} H:${row.high_count ?? 0} M:${row.medium_count ?? 0} L:${row.low_count ?? 0} (last 24h)`,
    }
  } catch {
    return { name: 'Security Event Severity', weight: WEIGHTS.securityEventSeverity, score: 100, detail: 'Table unavailable' }
  }
}

/**
 * Webhook health (5%)
 * Delivery success rate from webhook_deliveries (status_code 2xx = success).
 * Missing → skip (score 100).
 */
function evalWebhookHealth({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    const row = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) AS success
      FROM webhook_deliveries
      WHERE created_at > ?
    `).get(now - 86_400) as { total: number; success: number | null } | undefined

    if (!row || row.total === 0) {
      return { name: 'Webhook Health', weight: WEIGHTS.webhookHealth, score: 100, detail: 'No recent webhook deliveries' }
    }

    const success = row.success ?? 0
    const ratio = success / row.total
    const score = Math.round(ratio * 100)
    return {
      name: 'Webhook Health',
      weight: WEIGHTS.webhookHealth,
      score,
      detail: `${success} successful / ${row.total} deliveries (last 24h, ${Math.round(ratio * 100)}%)`,
    }
  } catch {
    return { name: 'Webhook Health', weight: WEIGHTS.webhookHealth, score: 100, detail: 'Table unavailable' }
  }
}

/**
 * Credit balance risk (5%)
 * Checks credit_ledger balance. Low balance (< 100 credits) → lower score.
 * Missing tables → skip (score 100).
 */
function evalCreditBalanceRisk({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    const row = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'grant' OR type = 'purchase' OR type = 'refund' THEN amount
                               WHEN type = 'usage' THEN -amount
                               WHEN type = 'adjustment' THEN amount
                               ELSE 0 END), 0) AS balance
      FROM credit_ledger
    `).get() as { balance: number } | undefined

    if (!row) {
      return { name: 'Credit Balance Risk', weight: WEIGHTS.creditBalanceRisk, score: 100, detail: 'No credit data' }
    }

    const balance = row.balance
    // 1000+ credits = full score, 100 = 50%, 0 = 0%, scale linearly
    const score = Math.min(100, Math.max(0, (balance / 1000) * 100))
    const label = score < 20 ? '⚠️ Very low' : score < 50 ? 'Low' : 'Healthy'
    return {
      name: 'Credit Balance Risk',
      weight: WEIGHTS.creditBalanceRisk,
      score: Math.round(score),
      detail: `${label} credit balance: ${balance} (threshold: 1000 = full score)`,
    }
  } catch {
    return { name: 'Credit Balance Risk', weight: WEIGHTS.creditBalanceRisk, score: 100, detail: 'Table unavailable' }
  }
}

/**
 * Cost anomaly risk (5%)
 * Compares recent 24h spend vs the trailing 7-day average.
 * If current > 2× average → penalty.
 * Missing data → skip (score 100).
 */
function evalCostAnomalyRisk({ db, now }: FactorEvalCtx): HealthFactor {
  try {
    // Last 24h cost
    const recent = db.prepare(`
      SELECT COALESCE(SUM(COALESCE(cost_usd, 0)), 0) AS recent_cost
      FROM token_usage
      WHERE created_at > ?
    `).get(now - 86_400) as { recent_cost: number } | undefined

    // Previous 24h (24-48h ago) for baseline
    const baseline = db.prepare(`
      SELECT COALESCE(SUM(COALESCE(cost_usd, 0)), 0) AS baseline_cost
      FROM token_usage
      WHERE created_at > ? AND created_at <= ?
    `).get(now - 172_800, now - 86_400) as { baseline_cost: number } | undefined

    if (!recent || !baseline) {
      return { name: 'Cost Anomaly Risk', weight: WEIGHTS.costAnomalyRisk, score: 100, detail: 'No cost data' }
    }

    const recentCost = recent.recent_cost
    const baseCost = baseline.baseline_cost

    if (baseCost === 0 && recentCost === 0) {
      return { name: 'Cost Anomaly Risk', weight: WEIGHTS.costAnomalyRisk, score: 100, detail: 'No token usage recorded' }
    }

    if (baseCost === 0) {
      // Baseline zero but current non-zero = anomaly
      return {
        name: 'Cost Anomaly Risk',
        weight: WEIGHTS.costAnomalyRisk,
        score: 0,
        detail: `Anomaly: $${recentCost.toFixed(2)} today (baseline was $0)`,
      }
    }

    const ratio = recentCost / baseCost
    // ratio ≤ 1 = normal (100), ratio 1-1.5 = slight (75), ratio 1.5-2 = warning (50), ratio > 2 = critical (0)
    let score: number
    if (ratio <= 1) score = 100
    else if (ratio <= 1.5) score = 100 - ((ratio - 1) / 0.5) * 25
    else if (ratio <= 2) score = 75 - ((ratio - 1.5) / 0.5) * 75
    else score = 0

    return {
      name: 'Cost Anomaly Risk',
      weight: WEIGHTS.costAnomalyRisk,
      score: Math.round(Math.max(0, Math.min(100, score))),
      detail: `$${recentCost.toFixed(2)} vs $${baseCost.toFixed(2)} baseline (ratio: ${ratio.toFixed(2)}×)`,
    }
  } catch {
    return { name: 'Cost Anomaly Risk', weight: WEIGHTS.costAnomalyRisk, score: 100, detail: 'Table unavailable' }
  }
}

// ── Main Export ──────────────────────────────────────────────────────────

/**
 * Calculate the fleet health score (0-100) from 9 weighted factors.
 *
 * Missing tables are gracefully skipped — the factor contributes 0 to the
 * weighted sum, but its weight still counts toward the denominator, so the
 * score reflects "unknown capability" rather than "healthy default."
 *
 * If you want missing factors to be neutral (score 100) instead, set
 * `options.neutralOnMissing = true`.
 */
export function calculateFleetHealth(
  options?: { workspaceId?: number; neutralOnMissing?: boolean },
): FleetHealthScore {
  const now = Math.floor(Date.now() / 1000)
  let db: ReturnType<typeof getDatabase>
  try {
    db = getDatabase()
  } catch (err) {
    // Database itself is unavailable — return all zeros
    return buildResult([], options?.neutralOnMissing ?? false)
  }

  const ctx: FactorEvalCtx = { db, now }

  const evaluators = [
    evalTaskCompletionRate,
    evalStaleTaskCount,
    evalFailedWorkflowCount,
    evalAgentHeartbeatHealth,
    evalQualityApprovalRate,
    evalSecurityEventSeverity,
    evalWebhookHealth,
    evalCreditBalanceRisk,
    evalCostAnomalyRisk,
  ]

  const factors: HealthFactor[] = evaluators.map((fn) => fn(ctx))
  return buildResult(factors, options?.neutralOnMissing ?? false)
}

function buildResult(factors: HealthFactor[], neutralOnMissing: boolean): FleetHealthScore {
  let weightedSum = 0
  let effectiveWeightTotal = 0

  for (const f of factors) {
    // If the factor scored 0 and is marked "table unavailable", treat as neutral if requested
    const useScore = neutralOnMissing && f.detail?.includes('Table unavailable') ? 100 : f.score

    weightedSum += useScore * f.weight
    effectiveWeightTotal += f.weight
  }

  // Normalize to 100 even if some factors were completely skipped
  const overallScore = effectiveWeightTotal > 0 ? Math.round(weightedSum / effectiveWeightTotal) : 0
  const label = getLabel(overallScore)

  return { score: overallScore, label, factors }
}

function getLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Healthy'
  if (score >= 60) return 'Needs Attention'
  if (score >= 40) return 'At Risk'
  return 'Critical'
}
