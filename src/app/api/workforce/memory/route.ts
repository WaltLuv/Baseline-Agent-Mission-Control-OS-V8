import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

/**
 * Workforce Memory Feed.
 *
 * Returns the operator-visible memory trail for the workforce:
 *   - hires
 *   - skill installs
 *   - decisions ("Adjusted follow-up cadence after low response rate.")
 *   - learnings ("Owner prefers summary-first reports.")
 *   - rationales ("Why this recommendation was made")
 *
 * Query:
 *   ?agentSlug=...   filter to one employee's timeline
 *   ?limit=50        page size (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const url = new URL(request.url)
  const agentSlug = url.searchParams.get('agentSlug')
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))

  let rows: Array<{
    id: number
    agent_slug: string | null
    agent_id: number | null
    kind: string
    title: string
    detail: string | null
    rationale: string | null
    value_impact_cents: number
    created_at: number
  }> = []
  try {
    const db = getDatabase()
    // Ensure tables exist even if no install has happened yet so the
    // operator gets an empty feed instead of a 500.
    db.exec(`
      CREATE TABLE IF NOT EXISTS workforce_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        agent_id INTEGER,
        agent_slug TEXT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        rationale TEXT,
        value_impact_cents INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `)
    if (agentSlug) {
      rows = db
        .prepare(
          `SELECT id, agent_slug, agent_id, kind, title, detail, rationale, value_impact_cents, created_at
           FROM workforce_memory
           WHERE workspace_id = ? AND agent_slug = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(workspaceId, agentSlug, limit) as typeof rows
    } else {
      rows = db
        .prepare(
          `SELECT id, agent_slug, agent_id, kind, title, detail, rationale, value_impact_cents, created_at
           FROM workforce_memory
           WHERE workspace_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(workspaceId, limit) as typeof rows
    }
  } catch {
    rows = []
  }

  // Seed-friendly empty-state copy: if no memory yet, return a synthetic
  // "what would show up here" hint so the UI never looks dead.
  const items = rows.map((r) => ({
    id: r.id,
    agentSlug: r.agent_slug,
    agentId: r.agent_id,
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    rationale: r.rationale,
    valueImpactCents: r.value_impact_cents,
    createdAt: r.created_at,
  }))

  return NextResponse.json({ items })
}
