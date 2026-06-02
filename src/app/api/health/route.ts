import { NextResponse } from 'next/server'

/**
 * Mirror of `/health` under the `/api` prefix.
 *
 * Some deployment templates poll `/api/health` (FastAPI convention) while
 * Emergent's main template polls `/health`. Both must be public and both
 * must return 200 quickly so the ingress doesn't flag the origin as 520.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'mission-control',
      runtime: 'nextjs',
      ts: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
