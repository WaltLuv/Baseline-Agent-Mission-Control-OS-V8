/**
 * POST /api/pi/run — run a request THROUGH PI Agent.
 *
 * PI assembles a context package (workspace knowledge + memory + Graphify),
 * runs the policy gate, routes to a specialized sub-agent, injects the context
 * and hands off to that sub-agent to execute, then indexes proof/replay and
 * writes a post-task memory update. operator+ (execution).
 *
 * Body: { request: string, agent?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { runThroughPiAgent, type Role } from '@/lib/pi/harness'
import { defaultSubAgentExecutor } from '@/lib/pi/sub-agents'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as { request?: string; agent?: string }
  const text = (body.request ?? '').trim()
  if (!text) return NextResponse.json({ error: 'request is required' }, { status: 400 })

  const result = await runThroughPiAgent(
    {
      workspaceId: auth.user.workspace_id ?? 1,
      request: text,
      role: auth.user.role as Role,
      actor: auth.user.username,
      requestedAgent: body.agent ?? null,
    },
    defaultSubAgentExecutor,
  )

  return NextResponse.json(result, { status: result.blocked ? 200 : 200 })
}
