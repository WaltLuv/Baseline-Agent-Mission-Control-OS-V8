/**
 * GET /api/orchestration/export?format=maestro
 *
 * Maestro-compatible JSON snapshot of the workspace's missions + tasks +
 * dependencies + proofs. The local `maestro` CLI can consume this format
 * to seed a `.maestro/` project; Mission Control never reads back into
 * Maestro — export only.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { exportMaestro } from '@/lib/orchestration/store'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(request.url)
  const format = url.searchParams.get('format') ?? 'maestro'
  if (format !== 'maestro') {
    return NextResponse.json({ error: 'unsupported_format', supported: ['maestro'] }, { status: 400 })
  }
  const doc = exportMaestro(auth.user.workspace_id)
  return NextResponse.json(doc, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
