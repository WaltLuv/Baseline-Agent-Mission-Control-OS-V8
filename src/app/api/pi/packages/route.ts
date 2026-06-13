/**
 * GET /api/pi/packages        — list PI context packages for the workspace.
 * GET /api/pi/packages?id=X   — full package (context + routing + memory events).
 *
 * viewer+ (read-only). The proof/replay index for PI Agent.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getContextPackage, listContextPackages } from '@/lib/pi/harness'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const ws = auth.user.workspace_id ?? 1
  const id = new URL(request.url).searchParams.get('id')
  if (id) {
    const pkg = getContextPackage(ws, id)
    if (!pkg) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ package: pkg })
  }
  return NextResponse.json({ packages: listContextPackages(ws) })
}
