import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { logBillingEvent } from '@/lib/billing-log'

interface AutoreloadRow {
  workspace_id: number
  enabled: number
  threshold_credits: number
  package_id: number
  max_per_month_cents: number
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  last_triggered_at: number | null
}

function read(workspaceId: number): AutoreloadRow | null {
  const db = getDatabase()
  return db
    .prepare(
      'SELECT workspace_id, enabled, threshold_credits, package_id, max_per_month_cents, stripe_customer_id, stripe_payment_method_id, last_triggered_at FROM workspace_autoreload WHERE workspace_id = ?'
    )
    .get(workspaceId) as AutoreloadRow | null
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const wsId = auth.user.workspace_id ?? 1
  const row = read(wsId)
  if (!row) {
    return NextResponse.json({
      enabled: false,
      thresholdCredits: 100,
      packageId: 1,
      maxPerMonthCents: 5000,
      lastTriggeredAt: null,
      paymentMethodAttached: false,
    })
  }
  return NextResponse.json({
    enabled: row.enabled === 1,
    thresholdCredits: row.threshold_credits,
    packageId: row.package_id,
    maxPerMonthCents: row.max_per_month_cents,
    lastTriggeredAt: row.last_triggered_at,
    paymentMethodAttached: !!row.stripe_payment_method_id,
  })
}

export async function PUT(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const wsId = auth.user.workspace_id ?? 1
  const body = await request.json().catch(() => ({}))
  const enabled = !!body.enabled
  const thresholdCredits = Math.max(10, Math.min(10_000, Number(body.thresholdCredits) || 100))
  const packageId = Math.max(1, Math.min(4, Number(body.packageId) || 1))
  const maxPerMonthCents = Math.max(1000, Math.min(100_000, Number(body.maxPerMonthCents) || 5000))

  const db = getDatabase()
  db.prepare(
    `INSERT INTO workspace_autoreload (workspace_id, enabled, threshold_credits, package_id, max_per_month_cents, updated_at)
     VALUES (?, ?, ?, ?, ?, unixepoch())
     ON CONFLICT(workspace_id) DO UPDATE SET
       enabled = excluded.enabled,
       threshold_credits = excluded.threshold_credits,
       package_id = excluded.package_id,
       max_per_month_cents = excluded.max_per_month_cents,
       updated_at = unixepoch()`
  ).run(wsId, enabled ? 1 : 0, thresholdCredits, packageId, maxPerMonthCents)

  logBillingEvent('info', 'autoreload.triggered', enabled ? 'Auto-reload enabled' : 'Auto-reload disabled', {
    workspaceId: wsId,
    metadata: { enabled, thresholdCredits, packageId, maxPerMonthCents },
  })

  return NextResponse.json({
    enabled,
    thresholdCredits,
    packageId,
    maxPerMonthCents,
  })
}
