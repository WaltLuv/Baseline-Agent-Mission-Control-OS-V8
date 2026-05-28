import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { tokenReportLimiter } from '@/lib/rate-limit'

/**
 * POST /api/agents/memory-use
 *
 * Runtime phone-home: an AI Employee actually used a piece of memory
 * (Obsidian doctrine, Notion SOP, Pinecone recall) while reasoning.
 * Surfaces on the trace "Memory used" card with the friendly source.
 */
interface Body {
  agentSlug?: string
  agentId?: number
  source: 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal'
  title: string
  excerpt?: string
  rationale?: string
  taskId?: number
}

export async function POST(request: NextRequest) {
  const rl = tokenReportLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  if (!body.source || !body.title) {
    return NextResponse.json({ error: 'source and title are required' }, { status: 400 })
  }
  const kind =
    body.source === 'Obsidian'
      ? 'operator-memory.obsidian'
      : body.source === 'Notion'
        ? 'operator-memory.notion'
        : body.source === 'Pinecone'
          ? 'operator-memory.pinecone'
          : 'operator-memory.internal'
  const db = getDatabase()
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
    kind,
    body.title.slice(0, 180),
    body.excerpt?.slice(0, 240) ?? null,
    body.rationale?.slice(0, 240) ?? null,
    Math.floor(Date.now() / 1000),
  )
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
