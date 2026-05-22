import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────────────

interface Prescription {
  id: string
  type: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  dollarImpact: number // estimated $ impact
  entityType?: string
  entityIds?: Array<number | string>
  icon: string
}

interface Summary24h {
  tasksCompleted: number
  tasksFailed: number
  tasksInProgress: number
  agentsActive: number
  agentsOffline: number
  qualityReviewsApproved: number
  qualityReviewsRejected: number
  webhooksSucceeded: number
  webhooksFailed: number
  creditsUsed: number
  alertsTriggered: number
  securityEvents: number
}

interface DailyOptimizationData {
  fleetHealthScore: number
  prescriptions: Prescription[]
  summary24h: Summary24h
}

// ─── Helpers ────────────────────────────────────────────────────────────

function now(): number {
  return Math.floor(Date.now() / 1000)
}

// ─── Prescription generators ────────────────────────────────────────────

function findStaleTasks(db: any, workspaceId: number): Prescription[] {
  const rows = db.prepare(`
    SELECT id, title, assigned_to, updated_at
    FROM tasks
    WHERE workspace_id = ?
      AND status = 'in_progress'
      AND updated_at < ?
    ORDER BY updated_at ASC
    LIMIT 10
  `).all(workspaceId, now() - 86400) as any[]

  if (rows.length === 0) return []

  const totalStale = (db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE workspace_id = ? AND status = 'in_progress' AND updated_at < ?
  `).get(workspaceId, now() - 86400) as any).cnt as number

  return [{
    id: 'stale-tasks',
    type: 'stale-tasks',
    severity: 'critical',
    title: `${totalStale} stale task${totalStale > 1 ? 's' : ''} in progress > 24h`,
    description: 'Tasks stuck in_progress for over 24 hours may indicate abandoned workflows or agent failures.',
    dollarImpact: totalStale * 5, // ~$5/hr waste estimate
    entityType: 'task',
    entityIds: rows.map((r: any) => r.id),
    icon: '⏳',
  }]
}

function findFailedWebhooks(db: any, workspaceId: number): Prescription[] {
  const rows = db.prepare(`
    SELECT wd.*, w.name as webhook_name, COUNT(*) as fail_count
    FROM webhook_deliveries wd
    JOIN webhooks w ON wd.webhook_id = w.id
    WHERE wd.status_code >= 400 AND wd.webhook_id IN (
      SELECT id FROM webhooks WHERE workspace_id = ?
    )
    GROUP BY wd.webhook_id
    HAVING fail_count > 3
    ORDER BY fail_count DESC
    LIMIT 5
  `).all(workspaceId) as any[]

  if (rows.length === 0) return []

  return [{
    id: 'failed-webhooks',
    type: 'failed-webhooks',
    severity: 'warning',
    title: `${rows.length} webhook(s) with >3 retries failing`,
    description: 'Webhook endpoints returning errors repeatedly. Check target service health.',
    dollarImpact: rows.length * 2, // ~$2/integration risk
    entityType: 'webhook',
    entityIds: rows.map((r: any) => r.webhook_id),
    icon: '🔗',
  }]
}

function findLowCreditBalance(db: any, _workspaceId: number): Prescription[] {
  try {
    const row = db.prepare(`
      SELECT balance FROM credit_ledger
      WHERE workspace_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(_workspaceId) as any

    if (!row) return []

    // Get actual balance from credit_balances if it exists
    const balanceRow = db.prepare(`
      SELECT balance FROM ws_credit_balances
      WHERE workspace_id = ?
      LIMIT 1
    `).get(_workspaceId) as any

    const balance = balanceRow?.balance ?? row.balance ?? 0

    if (balance >= 200) return []

    return [{
      id: 'low-credits',
      type: 'low-credits',
      severity: 'warning',
      title: `Low credit balance: ${balance.toFixed(0)} credits remaining`,
      description: 'Balance below 200 credits. Tasks may fail to start when depleted.',
      dollarImpact: Math.max(0, (200 - balance) * 10) as unknown as number,
      icon: '💳',
    }]
  } catch {
    return []
  }
}

function findRejectedReviews(db: any, workspaceId: number): Prescription[] {
  const rows = db.prepare(`
    SELECT qr.id, qr.task_id, qr.notes, t.title
    FROM quality_reviews qr
    LEFT JOIN tasks t ON qr.task_id = t.id
    WHERE qr.status = 'rejected'
      AND qr.created_at > ?
      AND (t.workspace_id = ? OR t.workspace_id IS NULL)
    ORDER BY qr.created_at DESC
    LIMIT 5
  `).all(now() - 86400, workspaceId) as any[]

  if (rows.length === 0) return []

  return [{
    id: 'rejected-qa',
    type: 'rejected-qa',
    severity: 'critical',
    title: `${rows.length} quality review rejection(s) in 24h`,
    description: 'Work failing quality gates. Review agent output and task definitions.',
    dollarImpact: rows.length * 15, // ~$15 rework cost
    entityType: 'quality_review',
    entityIds: rows.map((r: any) => r.id),
    icon: '❌',
  }]
}

function findOfflineAgents(db: any, workspaceId: number): Prescription[] {
  const threshold = now() - 1800 // 30 min
  const rows = db.prepare(`
    SELECT id, name, status, last_seen
    FROM agents
    WHERE workspace_id = ?
      AND last_seen IS NOT NULL
      AND last_seen < ?
    ORDER BY last_seen ASC
    LIMIT 10
  `).all(workspaceId, threshold) as any[]

  if (rows.length === 0) return []

  return [{
    id: 'offline-agents',
    type: 'offline-agents',
    severity: 'warning',
    title: `${rows.length} agent(s) offline >30 min`,
    description: 'Agents unreachable for extended period. Check runtime connectivity.',
    dollarImpact: rows.length * 8, // ~$8/hr per idle agent
    entityType: 'agent',
    entityIds: rows.map((r: any) => r.id),
    icon: '🤖',
  }]
}

function findFailedTasks(db: any, workspaceId: number): Prescription[] {
  const count = (db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE workspace_id = ?
      AND outcome = 'failed'
      AND updated_at > ?
  `).get(workspaceId, now() - 86400) as any).cnt as number

  if (count === 0) return []

  return [{
    id: 'failed-tasks',
    type: 'failed-tasks',
    severity: 'critical',
    title: `${count} failed task(s) in 24h`,
    description: 'Tasks completing with failure status. Review error logs and retry policies.',
    dollarImpact: count * 10,
    icon: '💥',
  }]
}

function findUnusedSkills(db: any, workspaceId: number): Prescription[] {
  // Skills table check — fallback gracefully
  try {
    const unusedCount = (db.prepare(`
      SELECT COUNT(*) as cnt FROM skills
      WHERE workspace_id = ? AND (last_used_at IS NULL OR last_used_at < ?)
    `).get(workspaceId, now() - 86400 * 7) as any).cnt as number

    if (unusedCount === 0) return []

    return [{
      id: 'unused-skills',
      type: 'unused-skills',
      severity: 'info',
      title: `${unusedCount} skill(s) unused in 7 days`,
      description: 'Inactive skills consuming catalog space. Consider pruning.',
      dollarImpact: 0,
      icon: '📦',
    }]
  } catch {
    return []
  }
}

// ─── Summary builder ───────────────────────────────────────────────────

function buildSummary24h(db: any, workspaceId: number): Summary24h {
  const since = now() - 86400

  const tasksCompleted = (db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE workspace_id = ? AND status = 'done' AND updated_at > ?
  `).get(workspaceId, since) as any).cnt as number

  const tasksFailed = (db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE workspace_id = ? AND (status = 'failed' OR outcome = 'failed') AND updated_at > ?
  `).get(workspaceId, since) as any).cnt as number

  const tasksInProgress = (db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE workspace_id = ? AND status = 'in_progress'
  `).get(workspaceId) as any).cnt as number

  const agentsTotal = (db.prepare(`
    SELECT COUNT(*) as cnt FROM agents WHERE workspace_id = ?
  `).get(workspaceId) as any).cnt as number

  const agentsOffline = (db.prepare(`
    SELECT COUNT(*) as cnt FROM agents
    WHERE workspace_id = ? AND status = 'offline'
  `).get(workspaceId) as any).cnt as number

  const agentsActive = agentsTotal - agentsOffline

  const qaApproved = (db.prepare(`
    SELECT COUNT(*) as cnt FROM quality_reviews qr
    JOIN tasks t ON qr.task_id = t.id
    WHERE qr.status = 'approved' AND qr.created_at > ?
      AND t.workspace_id = ?
  `).get(since, workspaceId) as any).cnt as number

  const qaRejected = (db.prepare(`
    SELECT COUNT(*) as cnt FROM quality_reviews qr
    JOIN tasks t ON qr.task_id = t.id
    WHERE qr.status = 'rejected' AND qr.created_at > ?
      AND t.workspace_id = ?
  `).get(since, workspaceId) as any).cnt as number

  const webhookSuccess = (db.prepare(`
    SELECT COUNT(*) as cnt FROM webhook_deliveries wd
    JOIN webhooks w ON wd.webhook_id = w.id
    WHERE wd.status_code >= 200 AND wd.status_code < 300 AND wd.created_at > ?
      AND w.workspace_id = ?
  `).get(since, workspaceId) as any).cnt as number

  const webhookFailed = (db.prepare(`
    SELECT COUNT(*) as cnt FROM webhook_deliveries wd
    JOIN webhooks w ON wd.webhook_id = w.id
    WHERE wd.status_code >= 400 AND wd.created_at > ?
      AND w.workspace_id = ?
  `).get(since, workspaceId) as any).cnt as number

  const creditsUsed = (db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'usage' THEN ABS(amount) ELSE 0 END), 0) as total
    FROM credit_ledger
    WHERE workspace_id = ? AND created_at > ?
  `).get(workspaceId, since) as any).total as number

  const alertsTriggered = (db.prepare(`
    SELECT COALESCE(SUM(trigger_count), 0) as cnt FROM alert_rules
    WHERE workspace_id = ? AND last_triggered_at > ?
  `).get(workspaceId, since) as any).cnt as number

  const securityEvents = (db.prepare(`
    SELECT COUNT(*) as cnt FROM security_events
    WHERE workspace_id = ? AND created_at > ?
  `).get(workspaceId, since) as any).cnt as number

  return {
    tasksCompleted,
    tasksFailed,
    tasksInProgress,
    agentsActive,
    agentsOffline,
    alertsTriggered,
    securityEvents,
    creditsUsed,
    qualityReviewsApproved: qaApproved,
    qualityReviewsRejected: qaRejected,
    webhooksSucceeded: webhookSuccess,
    webhooksFailed: webhookFailed,
  }
}

// ─── Fleet health calculator ───────────────────────────────────────────

function calculateFleetHealth(prescriptions: Prescription[], summary: Summary24h): number {
  let score = 100

  for (const p of prescriptions) {
    if (p.severity === 'critical') score -= 20
    else if (p.severity === 'warning') score -= 10
    else if (p.severity === 'info') score -= 3
  }

  if (summary.agentsOffline > 0) score -= 5 * Math.min(summary.agentsOffline, 5)
  if (summary.tasksFailed > 0) score -= 8 * Math.min(summary.tasksFailed, 5)

  return Math.max(0, Math.min(100, score))
}

// ─── API Route ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()

  const allPrescriptions: Prescription[] = [
    ...findStaleTasks(db, workspaceId),
    ...findFailedWebhooks(db, workspaceId),
    ...findLowCreditBalance(db, workspaceId),
    ...findRejectedReviews(db, workspaceId),
    ...findOfflineAgents(db, workspaceId),
    ...findFailedTasks(db, workspaceId),
    ...findUnusedSkills(db, workspaceId),
  ]

  // Sort by severity (critical first), then dollar impact
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  allPrescriptions.sort((a, b) => {
    const sDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (sDiff !== 0) return sDiff
    return b.dollarImpact - a.dollarImpact
  })

  const prescriptions = allPrescriptions.slice(0, 4)
  const summary24h = buildSummary24h(db, workspaceId)
  const fleetHealthScore = calculateFleetHealth(allPrescriptions, summary24h)

  const data: DailyOptimizationData = {
    fleetHealthScore,
    prescriptions,
    summary24h,
  }

  return NextResponse.json(data)
}
