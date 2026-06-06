/**
 * GET /api/orchestration/mirror/status
 *
 * Lightweight monitoring endpoint for the mirror surface. Returns the
 * count of mirrored events per source + the timestamp of the most
 * recent one. Used by /app/orchestration and the local `mc mirror
 * status` command.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { getMirrorStatus } from '@/lib/orchestration/mirror'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json(getMirrorStatus(auth.user.workspace_id))
}
