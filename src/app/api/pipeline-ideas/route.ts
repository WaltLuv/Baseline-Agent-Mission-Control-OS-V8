import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  listIdeas, captureIdea, advanceIdea, approveIdea, routeIdea, shipIdea, deleteIdea,
} from '@/lib/pipeline/store'

/**
 * Pipeline API — Idea → Plan → Route → Approve → Build → Test → Ship → Proof.
 * Workspace-scoped: every call is bound to the authenticated workspace, so a
 * customer only ever reads/writes their own pipeline. No cross-tenant leakage.
 *
 *   GET    /api/pipeline-ideas                         → { ideas }
 *   POST   /api/pipeline-ideas   { title, detail? }    → { idea }
 *   PATCH  /api/pipeline-ideas?id=…
 *            { action: 'advance' | 'approve' | 'route' | 'ship', ... }
 *   DELETE /api/pipeline-ideas?id=…
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  return NextResponse.json({ ideas: listIdeas(ws) })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const body = await request.json().catch(() => null)
  if (!body?.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  return NextResponse.json({ idea: captureIdea(ws, body.title, body.detail ?? '', Date.now()) }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await request.json().catch(() => ({}))
  const now = Date.now()
  switch (body.action) {
    case 'advance': {
      const { idea, blocked } = advanceIdea(ws, id, now)
      if (!idea) return NextResponse.json({ error: 'not found' }, { status: 404 })
      if (blocked) return NextResponse.json({ error: blocked, idea }, { status: 409 })
      return NextResponse.json({ idea })
    }
    case 'approve':
      return NextResponse.json({ idea: approveIdea(ws, id, body.approvedBy ?? 'Walt', now) })
    case 'route':
      return NextResponse.json({ idea: routeIdea(ws, id, body.routedTo ?? '', now) })
    case 'ship':
      return NextResponse.json({ idea: shipIdea(ws, id, body.artifact ?? '', body.proof ?? '', now) })
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  return deleteIdea(ws, id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'not found' }, { status: 404 })
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
