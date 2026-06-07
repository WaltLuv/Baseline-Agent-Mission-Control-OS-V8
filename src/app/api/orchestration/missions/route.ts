/**
 * GET  /api/orchestration/missions       — list workspace missions
 * POST /api/orchestration/missions       — create mission (admin/operator)
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole, requireVerifiedEmail } from '@/lib/auth'
import { createMission, listMissions } from '@/lib/orchestration/store'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ missions: listMissions(auth.user.workspace_id) })
}

export async function POST(request: NextRequest) {
  const auth = requireVerifiedEmail(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as {
    slug?: string
    title?: string
    description?: string
    tags?: string[]
    metadata?: Record<string, unknown>
    source?: 'cloud' | 'baseline-local' | 'maestro-import'
  }
  if (!body.slug || !body.title) {
    return NextResponse.json({ error: 'slug_and_title_required' }, { status: 400 })
  }
  try {
    const mission = createMission({
      workspaceId: auth.user.workspace_id,
      slug: String(body.slug).slice(0, 80),
      title: String(body.title).slice(0, 240),
      description: body.description ? String(body.description).slice(0, 4000) : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).slice(0, 32)).slice(0, 16) : undefined,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
      source: body.source,
      userId: auth.user.id > 0 ? auth.user.id : undefined,
    })
    return NextResponse.json({ mission }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'create_failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
