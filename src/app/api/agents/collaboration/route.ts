import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { tokenReportLimiter } from '@/lib/rate-limit'

/**
 * POST /api/agents/collaboration
 *
 * Runtime phone-home: AI Employee A handed work to AI Employee B.
 * Stored as a `collaboration` row in `workforce_memory` for both
 * employees so the collaborator graph + trace "Collaborated with"
 * surface render correctly.
 */
interface Body {
  fromAgentSlug?: string
  toAgentSlug?: string
  taskId?: number
  reason?: string
}

export async function POST(request: NextRequest) {
  const rl = tokenReportLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  if (!body.fromAgentSlug || !body.toAgentSlug) {
    return NextResponse.json({ error: 'fromAgentSlug and toAgentSlug are required' }, { status: 400 })
  }
  const db = getDatabase()
  db.exec(`CREATE TABLE IF NOT EXISTS workforce_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL, agent_id INTEGER, agent_slug TEXT,
    kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, rationale TEXT,
    value_impact_cents INTEGER DEFAULT 0, created_at INTEGER NOT NULL
  )`)
  const now = Math.floor(Date.now() / 1000)
  const ins = db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, detail, rationale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const title = `Handoff to ${body.toAgentSlug}`
  const detail = body.reason?.slice(0, 220) ?? null
  const taskRef = body.taskId ? `task #${body.taskId}` : null
  ins.run(workspaceId, body.fromAgentSlug, 'collaboration', title, detail, taskRef, now)
  ins.run(workspaceId, body.toAgentSlug, 'collaboration', `Received from ${body.fromAgentSlug}`, detail, taskRef, now)
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
