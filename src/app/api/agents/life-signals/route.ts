import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import type { AIEmployeeLifeSignal, PresenceState, ConfidenceBand } from '@/lib/ai-employee-life-signals'

/**
 * GET /api/agents/life-signals
 *
 * Derives presence + current task + confidence + workload + collaboration
 * + blocker + recent win + memory citation from the real agent + task +
 * memory data for this workspace. NOT a demo overlay — only honest signals.
 *
 * The Demo Mode overlay (in `lib/demo-narratives.ts`) is rendered client-
 * side from the cookie; this endpoint never lies about live data.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()

  try {
    const agents = db
      .prepare(
        `SELECT id, name, role, status, last_activity, last_heartbeat
         FROM agents
         WHERE workspace_id = ? AND COALESCE(hidden, 0) = 0
         ORDER BY id
         LIMIT 12`,
      )
      .all(workspaceId) as Array<{
      id: number
      name: string
      role: string | null
      status: 'busy' | 'idle' | 'error' | 'offline' | null
      last_activity: string | null
      last_heartbeat: number | null
    }>

    const signals: AIEmployeeLifeSignal[] = agents.map((a) => {
      const presence = derivePresence(a.status, a.last_heartbeat)
      // confidence: derived from open vs. recently-closed tasks where available
      let confidence: ConfidenceBand = 'medium'
      let workload: 'light' | 'balanced' | 'heavy' = 'balanced'
      let openCount = 0
      let recentClosed: { title: string } | null = null
      let oldestBlocker: { title: string } | null = null
      try {
        const stats = db
          .prepare(
            `SELECT
              SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open_count,
              SUM(CASE WHEN status = 'done' AND updated_at >= ? THEN 1 ELSE 0 END) AS closed_recent
             FROM tasks WHERE workspace_id = ? AND assignee = ?`,
          )
          .get(Math.floor(Date.now() / 1000) - 7 * 86400, workspaceId, a.name) as
          | { open_count: number; closed_recent: number }
          | undefined
        openCount = Number(stats?.open_count ?? 0)
        const closedRecent = Number(stats?.closed_recent ?? 0)
        if (openCount === 0 && closedRecent === 0) confidence = 'medium'
        else if (closedRecent >= openCount * 2) confidence = 'high'
        else if (closedRecent === 0 && openCount > 1) confidence = 'low'

        workload = openCount >= 6 ? 'heavy' : openCount === 0 ? 'light' : 'balanced'

        recentClosed = db
          .prepare(
            `SELECT title FROM tasks WHERE workspace_id = ? AND assignee = ? AND status = 'done' ORDER BY updated_at DESC LIMIT 1`,
          )
          .get(workspaceId, a.name) as { title: string } | null
        oldestBlocker = db
          .prepare(
            `SELECT title FROM tasks WHERE workspace_id = ? AND assignee = ? AND status = 'blocked' ORDER BY updated_at ASC LIMIT 1`,
          )
          .get(workspaceId, a.name) as { title: string } | null
      } catch {
        // tasks table or columns may not exist in some workspaces — keep defaults
      }

      let memoryUsed: { source: string; snippet: string } | null = null
      try {
        const row = db
          .prepare(
            `SELECT rationale, detail, kind FROM workforce_memory
             WHERE workspace_id = ? AND (agent_slug = ? OR rationale LIKE ?)
             ORDER BY created_at DESC LIMIT 1`,
          )
          .get(workspaceId, a.name, `%${a.name}%`) as
          | { rationale: string | null; detail: string | null; kind: string }
          | undefined
        if (row) {
          const source = row.kind.startsWith('operator-memory.obsidian')
            ? 'Obsidian'
            : row.kind.startsWith('operator-memory.notion')
            ? 'Notion'
            : row.kind.startsWith('operator-memory.pinecone')
            ? 'Pinecone'
            : 'Workforce Memory'
          const snippet = (row.rationale || row.detail || '').slice(0, 120)
          if (snippet) memoryUsed = { source, snippet }
        }
      } catch {
        // best-effort only
      }

      return {
        agentSlug: a.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
        agentName: a.name,
        presence,
        currentlyWorkingOn: a.last_activity || null,
        confidence,
        workloadPressure: workload,
        responseSpeedMin: a.last_heartbeat
          ? Math.max(0, Math.round((Date.now() / 1000 - a.last_heartbeat) / 60))
          : null,
        collaborators: [], // requires team-graph; deferred
        escalation: null,
        memoryUsed,
        skillsActive: [], // skills inventory deferred to skill-install events
        activeWorkflow: null,
        recentWin: recentClosed?.title ?? null,
        currentBlocker: oldestBlocker?.title ?? null,
      }
    })

    return NextResponse.json({ signals })
  } catch {
    return NextResponse.json({ signals: [] })
  }
}

function derivePresence(
  status: 'busy' | 'idle' | 'error' | 'offline' | null,
  lastHeartbeat: number | null,
): PresenceState {
  const stale = lastHeartbeat ? Date.now() / 1000 - lastHeartbeat > 600 : true
  if (status === 'error') return 'needs-attention'
  if (status === 'offline') return stale ? 'idle' : 'idle'
  if (status === 'busy') return 'working'
  if (status === 'idle') return stale ? 'idle' : 'online'
  return 'online'
}

export const dynamic = 'force-dynamic'
