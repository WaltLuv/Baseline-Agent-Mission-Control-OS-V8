import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { installWorkforceTemplate } from '@/lib/baseline-os/workforce-templates/install'

/**
 * POST /api/workforce/install
 *
 * One-click install of a workforce template (vertical bundle). Idempotent:
 * re-calling for the same workspace + template returns
 * { status: 'already_installed' } with the same persona + workflow IDs.
 *
 * Customer-facing: this is the surface the "Install Property Management
 * Workforce" button on the Activation Hub hits. Latency budget: 60s as
 * advertised. Real-world: < 200ms because everything is local SQLite.
 */
export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: { template?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const slug = body.template?.toString().toLowerCase().trim()
  if (!slug) {
    return NextResponse.json({ error: 'template is required' }, { status: 400 })
  }

  const result = installWorkforceTemplate(
    workspaceId,
    slug,
    auth.user.username || `user:${auth.user.id}`,
  )
  if (result.status === 'unavailable') {
    return NextResponse.json(
      { error: `template "${slug}" is not available for install yet`, ...result },
      { status: 400 },
    )
  }
  return NextResponse.json(result, { status: result.status === 'installed' ? 201 : 200 })
}

export const dynamic = 'force-dynamic'
