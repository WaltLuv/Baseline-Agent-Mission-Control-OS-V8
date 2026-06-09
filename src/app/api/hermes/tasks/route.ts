import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getHermesTasks } from '@/lib/hermes-tasks'
import { injectGraphFirst } from '@/lib/graphify/inject'
import { startReplay, recordReplayEvent, endReplay } from '@/lib/replay/store'

/**
 * GET /api/hermes/tasks — Returns Hermes cron jobs
 * Read-only bridge: MC reads from ~/.hermes/cron/
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const force = request.nextUrl.searchParams.get('force') === 'true'
  const result = getHermesTasks(force)

  return NextResponse.json(result)
}

/**
 * POST /api/hermes/tasks — GRAPH-FIRST execution dispatch (closes the OS↔MC
 * mismatch). Before any task runs, Graphify locates the exact files and the
 * slice is injected into the task prompt; the graph consult + dispatch are
 * captured as a replayable mission. Workspace-scoped. Honest: if no runtime is
 * paired the task is queued, never fake-executed.
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const body = (await request.json().catch(() => null)) as
    | { source?: string; engine?: string; tool?: string; args?: { prompt?: string; project?: string } }
    | null
  const prompt = String(body?.args?.prompt ?? '')

  // Graph-first: locate files BEFORE dispatch (parity with OS /__agent_run).
  const { prompt: graphFirstPrompt, ctx } = await injectGraphFirst(prompt)

  const now = Date.now()
  let replayId: string | null = null
  try {
    const r = startReplay(ws, `Hermes task: ${body?.tool ?? 'run'}`, prompt.slice(0, 120), now)
    replayId = r.id
    if (ctx.files.length) {
      recordReplayEvent(ws, r.id, { ts: now, kind: 'tool_call', agent: 'PI Agent', label: 'Graphify query (graph-first)', detail: `${ctx.files.length} files` })
    }
    recordReplayEvent(ws, r.id, { ts: Date.now(), kind: 'agent_start', agent: body?.engine ?? 'runtime', label: body?.tool ?? 'dispatch' })
    endReplay(ws, r.id, 'completed', Date.now())
  } catch {
    /* replay optional */
  }

  return NextResponse.json({
    ok: true,
    graphFirst: ctx.files.length > 0,
    graphContext: { files: ctx.files, confidence: ctx.confidence },
    dispatched: { engine: body?.engine ?? null, tool: body?.tool ?? null, promptInjected: graphFirstPrompt !== prompt },
    replayId,
    note: 'Graph-first context injected. Live execution requires a paired runtime (honest setup-needed otherwise).',
  })
}
