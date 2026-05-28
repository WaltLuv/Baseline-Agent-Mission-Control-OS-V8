import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { tokenReportLimiter } from '@/lib/rate-limit'

/**
 * POST /api/agents/escalation
 *
 * Runtime phone-home: an AI Employee has decided a task needs human
 * approval. Writes a `workforce_memory` row tagged `escalation` (used
 * by the Approval Queue rationale lookup) and — if `taskId` provided —
 * sets the task status to `needs-review`.
 */
interface Body {
  agentSlug?: string
  agentId?: number
  taskId?: number
  reason?: string
  source?: 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal'
  severity?: 'low' | 'medium' | 'high'
}

export async function POST(request: NextRequest) {
  const rl = tokenReportLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  if (!body.reason || typeof body.reason !== 'string') {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }
  const db = getDatabase()
  const kindSource = body.source === 'Obsidian'
    ? 'operator-memory.obsidian'
    : body.source === 'Notion'
      ? 'operator-memory.notion'
      : body.source === 'Pinecone'
        ? 'operator-memory.pinecone'
        : 'escalation'
  const now = Math.floor(Date.now() / 1000)

  db.exec(`CREATE TABLE IF NOT EXISTS workforce_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL, agent_id INTEGER, agent_slug TEXT,
    kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, rationale TEXT,
    value_impact_cents INTEGER DEFAULT 0, created_at INTEGER NOT NULL
  )`)
  db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workspaceId,
    body.agentId ?? null,
    body.agentSlug ?? null,
    kindSource,
    `Escalation${body.severity ? ` · ${body.severity}` : ''}`,
    body.reason.slice(0, 240),
    body.reason.slice(0, 240),
    now,
  )

  if (body.taskId) {
    try {
      db.prepare(
        `UPDATE tasks SET status = 'needs-review', updated_at = ? WHERE id = ? AND workspace_id = ?`,
      ).run(now, body.taskId, workspaceId)
    } catch {
      // tasks table may not exist in this workspace yet — ignore.
    }
  }
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
