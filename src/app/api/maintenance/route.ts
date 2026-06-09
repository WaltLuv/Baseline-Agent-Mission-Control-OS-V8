/**
 * GET  /api/maintenance  → work orders (workspace-scoped).
 * POST /api/maintenance  → run a maintenance request end-to-end (live or dry-run).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { executeMaintenance, listWorkOrders } from '@/lib/pm/maintenance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ workOrders: listWorkOrders(auth.user.workspace_id ?? 1) })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const b = await request.json().catch(() => null) as any
  if (!b?.request) return NextResponse.json({ error: 'request required' }, { status: 400 })
  const result = await executeMaintenance(ws, {
    request: String(b.request), property: b.property, unit: b.unit, tenant: b.tenant,
    tenantContact: b.tenantContact, ownerContact: b.ownerContact, vendorContact: b.vendorContact,
    costThreshold: typeof b.costThreshold === 'number' ? b.costThreshold : undefined,
  }, Date.now())
  return NextResponse.json({ ok: true, ...result }, { status: 201 })
}
