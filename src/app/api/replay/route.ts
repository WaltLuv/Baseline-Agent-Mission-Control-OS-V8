/**
 * Workforce Replay API (workspace-scoped).
 * GET  → list this workspace's missions (newest first).
 * POST → record a mission { trigger, mission, events[] } (start→events→complete).
 * Customer-safe: every read/write bound to auth.user.workspace_id.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { listReplays, startReplay, recordReplayEvent, endReplay, type ReplayEvent } from '@/lib/replay/store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  return NextResponse.json({ replays: listReplays(ws, 100) })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const body = await request.json().catch(() => null) as { trigger?: string; mission?: string; events?: ReplayEvent[] } | null
  if (!body?.trigger) return NextResponse.json({ error: 'trigger required' }, { status: 400 })
  const now = Date.now()
  const r = startReplay(ws, body.trigger, body.mission ?? body.trigger, now)
  for (const e of body.events ?? []) recordReplayEvent(ws, r.id, e)
  const done = endReplay(ws, r.id, 'completed', Date.now())
  return NextResponse.json({ ok: true, replay: done }, { status: 201 })
}
