/**
 * GET  /api/kanban  → Kanban 2.0 cards + PM templates.
 * POST /api/kanban  → /drive a new card (graph-first) → runs Floors 1-4 → Awaiting_Approval.
 * Workspace-scoped. operator+ to drive.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { drive, listCards, PM_TEMPLATES } from '@/lib/pm/kanban-store'
import { prepareGraphContext } from '@/lib/graphify/inject'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const stage = new URL(request.url).searchParams.get('stage') ?? undefined
  return NextResponse.json({ cards: listCards(ws, stage), templates: PM_TEMPLATES })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const b = await request.json().catch(() => null) as { idea?: string; templateSlug?: string } | null
  const tpl = b?.templateSlug ? PM_TEMPLATES.find((t) => t.slug === b.templateSlug) : undefined
  const idea = String(b?.idea ?? tpl?.idea ?? '').trim()
  if (!idea) return NextResponse.json({ error: 'idea or templateSlug required' }, { status: 400 })
  const ctx = await prepareGraphContext(idea) // graph-first
  const card = await drive(ws, idea, Date.now(), { templateSlug: tpl?.slug, graphFiles: ctx.files })
  return NextResponse.json({ ok: true, card }, { status: 201 })
}
