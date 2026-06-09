/**
 * POST /api/kanban/[id]/approve → { decision: approve|reject|request_changes, by }.
 * Approve unlocks Implementation → Self-Check → Shipped (safe draft unless coding
 * runtime connected). Workspace-scoped. operator+. Never auto-approves.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { approve } from '@/lib/pm/kanban-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const { id } = await ctx.params
  const b = await request.json().catch(() => null) as { decision?: string; by?: string } | null
  const valid = ['approve', 'reject', 'request_changes']
  if (!b?.decision || !valid.includes(b.decision)) return NextResponse.json({ error: 'valid decision required' }, { status: 400 })
  const res = await approve(ws, id, b.decision as any, String(b.by ?? auth.user.email ?? 'operator'), Date.now())
  return NextResponse.json(res.error ? res : { ok: true, card: res }, { status: res.error ? 400 : 200 })
}
