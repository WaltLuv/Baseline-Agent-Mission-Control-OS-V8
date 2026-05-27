import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { getWorkspaceBalance, recalculateBalance } from '@/lib/billing'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1

  const db = getDatabase()
  const balance = getWorkspaceBalance(workspaceId)

  // Verify ledger consistency
  const ledgerBalance = recalculateBalance(workspaceId)

  // Get subscription info
  const subscription = db.prepare(
    `SELECT cs.*, bp.name as plan_name, bp.setup_fee_cents, bp.monthly_price_cents, bp.included_credits
     FROM customer_subscriptions cs
     LEFT JOIN billing_plans bp ON cs.plan_id = bp.id
     WHERE cs.workspace_id = ? AND cs.status = 'active'
     LIMIT 1`
  ).get(workspaceId) as any

  // Get credit packages (for purchase)
  const packages = db.prepare(
    'SELECT id, name, description, price_cents, credits, bonus_credits FROM credit_packages WHERE status = ? ORDER BY price_cents'
  ).all('active') as any[]

  // Get recent ledger entries
  const recentLedger = db.prepare(
    'SELECT id, type, amount, balance_after, source_type, source_id, description, created_at FROM credit_ledger WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(workspaceId) as any[]

  // Get recent usage events
  const recentUsage = db.prepare(
    'SELECT id, event_type, credits_charged, agent_id, task_id, created_at, provider, model FROM usage_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(workspaceId) as any[]

  // Top agents by spend
  const topAgents = db.prepare(
    `SELECT ue.agent_id, a.name as agent_name, COUNT(*) as task_count, SUM(ue.credits_charged) as total_credits
     FROM usage_events ue
     LEFT JOIN agents a ON ue.agent_id = a.id
     WHERE ue.workspace_id = ? AND ue.agent_id IS NOT NULL
     GROUP BY ue.agent_id ORDER BY total_credits DESC LIMIT 10`
  ).all(workspaceId) as any[]

  return NextResponse.json({
    balance: { ...balance, ledgerVerified: balance.balance === ledgerBalance },
    subscription: subscription || null,
    packages,
    recentLedger,
    recentUsage,
    topAgents,
  })
}
