/**
 * POST /api/org-chart/generate { slug } — auto-generate the org chart for an
 * installed workforce template/directive (Phase 1). Idempotent + workspace-scoped.
 * operator+ only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { generateOrgFromTemplate } from '@/lib/org-chart/store'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
  const result = generateOrgFromTemplate(ws, slug, Date.now())
  if (result.created === 0 && result.skipped === 0) {
    return NextResponse.json({ error: `no workforce known for slug "${slug}"` }, { status: 404 })
  }
  return NextResponse.json({ ok: true, slug, ...result })
}
