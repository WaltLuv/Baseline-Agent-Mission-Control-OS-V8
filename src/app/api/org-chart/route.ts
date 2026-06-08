import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  listOrgAgents, createOrgAgent, updateOrgAgent, archiveOrgAgent, deleteOrgAgent,
  reorderOrgAgents, buildHierarchy,
} from '@/lib/org-chart/store'

/**
 * AI Org Chart CRUD API.
 *
 *   GET    /api/org-chart[?include_archived=1]   → { agents, hierarchy }
 *   POST   /api/org-chart   { name, role?, department?, ... }   → { agent }
 *   PATCH  /api/org-chart?id=…   { ...patch | reorder: string[] }
 *   DELETE /api/org-chart?id=…[&hard=1]   → archive (or hard delete when confirmed)
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const includeArchived = new URL(request.url).searchParams.get('include_archived') === '1'
  const agents = listOrgAgents(includeArchived)
  return NextResponse.json({ agents, hierarchy: buildHierarchy(agents.filter((a) => !a.archived)) })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => null)
  if (!body?.name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const agent = createOrgAgent(body, Date.now())
  return NextResponse.json({ agent }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => null)
  if (body?.reorder && Array.isArray(body.reorder)) {
    reorderOrgAgents(body.reorder, Date.now())
    return NextResponse.json({ ok: true })
  }
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const agent = updateOrgAgent(id, body ?? {}, Date.now())
  if (!agent) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ agent })
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // Default is a soft archive. Hard delete (destructive) must be explicitly
  // confirmed by the caller with hard=1 — the UI gates this behind a confirm.
  const ok = url.searchParams.get('hard') === '1' ? deleteOrgAgent(id) : archiveOrgAgent(id, Date.now())
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'not found' }, { status: 404 })
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
