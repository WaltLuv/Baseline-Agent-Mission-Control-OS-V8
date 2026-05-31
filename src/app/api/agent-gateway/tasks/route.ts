import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { listGatewayTasks } from '@/lib/agent-gateway-client'

/**
 * GET /api/agent-gateway/tasks?limit=50&agent=claude|codex|opencode|hermes
 *
 * Returns the gateway's recent task list. Workspace boundary: the gateway is
 * single-workspace (GATEWAY_WORKSPACE_ID); MC enforces operator role here so
 * non-admins can't list arbitrary task prompts.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 500))
  const agent = searchParams.get('agent')
  const result = await listGatewayTasks({ limit, agent })

  if (!result.reachable) {
    return NextResponse.json(
      { error: 'Gateway unreachable', detail: result.error, gatewayUrl: result.gatewayUrl },
      { status: 503 },
    )
  }
  return NextResponse.json(
    typeof result.data === 'object' && result.data !== null ? result.data : { tasks: [] },
    { status: result.ok ? 200 : result.status || 502 },
  )
}

export const dynamic = 'force-dynamic'
