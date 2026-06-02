import { NextResponse } from 'next/server'

/**
 * Public health probe for the deployment platform.
 *
 * Emergent's deployment template expects a root `/health` route that
 * returns 200 OK with no auth. Without this, the ingress health check
 * sees a 404/auth-failure HTML response and returns 520 ("origin
 * returned empty / unexpected response") at the edge.
 *
 * This route is also added to the public-routes list in `proxy.ts` so
 * it's never gated by auth middleware.
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
