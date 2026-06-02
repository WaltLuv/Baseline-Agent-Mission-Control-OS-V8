/**
 * /api/tool-executions
 *
 * GET   — list executions for this workspace; query: status, task_id,
 *         runtime_id, limit, offset.
 * POST  — runtime/router records intent to execute a CLI command. We
 *         classify risk, gate HIGH-risk behind explicit approval, and
 *         persist a tamper-evident audit row. We DO NOT execute anything.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import {
  listToolExecutions,
  startToolExecution,
  type ToolExecutionStatus,
} from '@/lib/baseline-os/tool-executions'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const sp = new URL(request.url).searchParams
  const status = sp.get('status') ?? undefined
  const taskId = sp.get('task_id') ? Number(sp.get('task_id')) : undefined
  const runtimeId = sp.get('runtime_id') ? Number(sp.get('runtime_id')) : undefined
  const limit = sp.get('limit') ? Math.max(1, Math.min(Number(sp.get('limit')), 200)) : 50
  const offset = sp.get('offset') ? Math.max(0, Number(sp.get('offset'))) : 0
  const result = listToolExecutions({
    workspace_id: workspaceId,
    status: status as ToolExecutionStatus | 'all' | 'pending_approval' | undefined,
    task_id: taskId,
    runtime_id: runtimeId,
    limit,
    offset,
  })
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: {
    cli_tool_id?: string
    command_name?: string
    command_args_redacted?: string
    task_id?: number
    agent_id?: number
    runtime_id?: number
    cost_estimate?: number
    billable_action_type?: string
    policy_override?: 'low' | 'medium' | 'high' | 'blocked'
    approval_requested_by?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.cli_tool_id || !body.command_name) {
    return NextResponse.json({ error: 'cli_tool_id and command_name are required' }, { status: 400 })
  }
  const result = startToolExecution({
    workspace_id: workspaceId,
    requested_by: auth.user.username || `user:${auth.user.id}`,
    cli_tool_id: body.cli_tool_id,
    command_name: body.command_name,
    command_args_redacted: body.command_args_redacted,
    task_id: body.task_id ?? null,
    agent_id: body.agent_id ?? null,
    runtime_id: body.runtime_id ?? null,
    cost_estimate: body.cost_estimate ?? null,
    billable_action_type: body.billable_action_type ?? null,
    policy_override: body.policy_override,
    approval_requested_by: body.approval_requested_by,
  })
  return NextResponse.json(result, { status: 201 })
}

export const dynamic = 'force-dynamic'
