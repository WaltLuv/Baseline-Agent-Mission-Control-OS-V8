import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getGatewayHealth, getGatewayUrl } from '@/lib/agent-gateway-client'

/**
 * GET /api/agent-gateway/health
 *
 * Reports liveness of the FastMCP Agent Gateway from Mission Control's
 * perspective. Used by:
 *   - the runtime registry UI
 *   - Flight Deck
 *   - external monitors
 *
 * Auth: viewer. Mission Control already authenticates the caller; the
 * gateway's own API key (AGENT_GATEWAY_API_KEY / API_KEY) is held server-side
 * and never returned.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const result = await getGatewayHealth()
  if (!result.reachable) {
    return NextResponse.json(
      {
        ok: false,
        reachable: false,
        error: result.error,
        gatewayUrl: result.gatewayUrl,
        hint: 'Set AGENT_GATEWAY_URL and start the gateway with `agent-gateway --host 127.0.0.1 --port 8765`.',
      },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      ok: result.ok,
      reachable: true,
      gatewayUrl: result.gatewayUrl,
      status: result.status,
      ...(typeof result.data === 'object' && result.data !== null ? result.data : {}),
    },
    { status: result.ok ? 200 : 502 },
  )
}

export const dynamic = 'force-dynamic'
