/**
 * GET  /api/approvals/owner       → pending (or ?all=1) owner approvals.
 * POST /api/approvals/owner       → { id, decision, by, note } approve/deny/info.
 * Approving triggers the (live or dry-run) vendor dispatch. operator+ to decide.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { listPending, listAll, decide, type Decision } from '@/lib/pm/approvals'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const all = new URL(request.url).searchParams.get('all') === '1'
  return NextResponse.json({ approvals: all ? listAll(ws) : listPending(ws) })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const b = await request.json().catch(() => null) as any
  const valid: Decision[] = ['approved', 'denied', 'info_requested']
  if (!b?.id || !valid.includes(b.decision)) return NextResponse.json({ error: 'id + valid decision required' }, { status: 400 })
  const res = await decide(ws, String(b.id), b.decision, String(b.by ?? auth.user.email ?? 'owner'), String(b.note ?? ''), Date.now())
  return NextResponse.json(res, { status: res.ok ? 200 : 400 })
}
