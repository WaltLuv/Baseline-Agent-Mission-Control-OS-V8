import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getGatewayTask } from '@/lib/agent-gateway-client'

/**
 * GET /api/agent-gateway/tasks/[id]
 * Returns full task row from the gateway, including status / exit_code /
 * timing / cost.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!id || !/^[a-zA-Z0-9._-]{1,128}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid task id' }, { status: 400 })
  }

  const result = await getGatewayTask(id)
  if (!result.reachable) {
    return NextResponse.json(
      { error: 'Gateway unreachable', detail: result.error, gatewayUrl: result.gatewayUrl },
      { status: 503 },
    )
  }
  return NextResponse.json(
    typeof result.data === 'object' && result.data !== null ? result.data : { task: null },
    { status: result.ok ? 200 : result.status || 502 },
  )
}

export const dynamic = 'force-dynamic'
