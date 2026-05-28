import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import type { AIEmployeeLifeSignal, PresenceState, ConfidenceBand } from '@/lib/ai-employee-life-signals'

/**
 * GET /api/agents/life-signals
 *
 * Derives presence + current task + confidence + workload + collaboration
 * + blocker + recent win + memory citation + skills + escalation from
 * real workspace data. NOT a demo overlay — only honest signals.
 *
 * Schema-aligned (production SQLite):
 *   - agents.last_seen (unix), tasks.assigned_to, workforce_memory.agent_slug
 *   - Skills derived from `workforce_memory.kind IN ('skill-used','skill-installed')`
 *   - Collaborators derived from `tasks.project_id` shared-work analysis
 *   - Escalation chains derived from `tasks.status IN ('needs-review','review')`
 *     plus matched `workforce_memory.rationale`.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()

  try {
    const agents = db
      .prepare(
        `SELECT id, name, role, status, last_activity, last_seen
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
      last_seen: number | null
    }>

    const now = Math.floor(Date.now() / 1000)
    const weekAgo = now - 7 * 86_400
    const dayAgo = now - 86_400

    const signals: AIEmployeeLifeSignal[] = agents.map((a) => {
      const slug = a.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
      let confidence: ConfidenceBand = 'medium'
      let workload: 'light' | 'balanced' | 'heavy' = 'balanced'
      let openCount = 0
      let recentClosed: { title: string } | null = null
      let oldestBlocker: { title: string } | null = null
      let escalationItem: { title: string; severity: 'low' | 'medium' | 'high' } | null = null
      let activeWorkflow: string | null = null

      try {
        const stats = db
          .prepare(
            `SELECT
              SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open_count,
              SUM(CASE WHEN status = 'done' AND COALESCE(updated_at, created_at) >= ? THEN 1 ELSE 0 END) AS closed_recent,
              SUM(CASE WHEN status IN ('needs-review','review','waiting-approval') THEN 1 ELSE 0 END) AS escalated
             FROM tasks WHERE workspace_id = ? AND assigned_to = ?`,
          )
          .get(weekAgo, workspaceId, a.name) as
          | { open_count: number; closed_recent: number; escalated: number }
          | undefined
        openCount = Number(stats?.open_count ?? 0)
        const closedRecent = Number(stats?.closed_recent ?? 0)
        const escalated = Number(stats?.escalated ?? 0)
        // Confidence derives from closed/escalated reliability ratio
        const reliability = closedRecent + escalated > 0 ? closedRecent / (closedRecent + escalated) : 0.5
        if (openCount === 0 && closedRecent === 0) confidence = 'medium'
        else if (reliability >= 0.75 && closedRecent >= 2) confidence = 'high'
        else if (reliability < 0.4 || (closedRecent === 0 && openCount > 1)) confidence = 'low'

        workload = openCount >= 6 ? 'heavy' : openCount === 0 ? 'light' : 'balanced'

        recentClosed = db
          .prepare(
            `SELECT title FROM tasks WHERE workspace_id = ? AND assigned_to = ? AND status = 'done'
             ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1`,
          )
          .get(workspaceId, a.name) as { title: string } | null
        oldestBlocker = db
          .prepare(
            `SELECT title FROM tasks WHERE workspace_id = ? AND assigned_to = ? AND status = 'blocked'
             ORDER BY COALESCE(updated_at, created_at) ASC LIMIT 1`,
          )
          .get(workspaceId, a.name) as { title: string } | null
        // Oldest open escalation surfaces as the chain head
        const esc = db
          .prepare(
            `SELECT title, COALESCE(updated_at, created_at) AS since_at FROM tasks
             WHERE workspace_id = ? AND assigned_to = ?
               AND status IN ('needs-review','review','waiting-approval')
             ORDER BY since_at ASC LIMIT 1`,
          )
          .get(workspaceId, a.name) as { title: string; since_at: number } | null
        if (esc) {
          const ageHours = Math.max(0, (now - esc.since_at) / 3600)
          const severity: 'low' | 'medium' | 'high' = ageHours > 48 ? 'high' : ageHours > 12 ? 'medium' : 'low'
          escalationItem = { title: esc.title, severity }
        }
        // Active workflow heuristic: most recent in_progress task title
        const ip = db
          .prepare(
            `SELECT title FROM tasks WHERE workspace_id = ? AND assigned_to = ? AND status = 'in_progress'
             ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1`,
          )
          .get(workspaceId, a.name) as { title: string } | null
        activeWorkflow = ip?.title ?? null
      } catch {
        // tasks table missing — keep defaults
      }

      // Memory citation
      let memoryUsed: { source: string; snippet: string } | null = null
      try {
        const row = db
          .prepare(
            `SELECT rationale, detail, kind FROM workforce_memory
             WHERE workspace_id = ?
               AND (agent_id = ? OR agent_slug = ? OR agent_slug = ? OR rationale LIKE ?)
             ORDER BY created_at DESC LIMIT 1`,
          )
          .get(workspaceId, a.id, slug, a.name.toLowerCase(), `%${a.name}%`) as
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

      // Skills active in last 24h, derived from workforce_memory skill-used/installed
      let skillsActive: string[] = []
      try {
        const rows = db
          .prepare(
            `SELECT DISTINCT title FROM workforce_memory
             WHERE workspace_id = ?
               AND (agent_id = ? OR agent_slug = ? OR agent_slug = ?)
               AND kind IN ('skill-used','skill-installed')
               AND created_at >= ?
             ORDER BY created_at DESC LIMIT 4`,
          )
          .all(workspaceId, a.id, slug, a.name.toLowerCase(), dayAgo) as Array<{ title: string }>
        skillsActive = rows.map((r) => r.title)
      } catch {
        // ignore
      }

      // Collaborators: other agents sharing same project_id this week
      let collaborators: string[] = []
      try {
        const rows = db
          .prepare(
            `SELECT DISTINCT other.assigned_to AS name
             FROM tasks t
             JOIN tasks other
               ON other.project_id = t.project_id
              AND other.workspace_id = t.workspace_id
              AND other.assigned_to IS NOT NULL
              AND other.assigned_to != ?
             WHERE t.workspace_id = ? AND t.assigned_to = ?
               AND COALESCE(t.updated_at, t.created_at) >= ?
             ORDER BY name LIMIT 4`,
          )
          .all(a.name, workspaceId, a.name, weekAgo) as Array<{ name: string }>
        collaborators = rows.map((r) => r.name)
      } catch {
        // ignore (tasks missing project_id, etc.)
      }

      const presence = derivePresence(
        a.status,
        a.last_seen,
        Boolean(oldestBlocker),
        Boolean(escalationItem),
      )

      return {
        agentSlug: slug,
        agentName: a.name,
        presence,
        currentlyWorkingOn: a.last_activity || activeWorkflow,
        confidence,
        workloadPressure: workload,
        responseSpeedMin: a.last_seen
          ? Math.max(0, Math.round((now - a.last_seen) / 60))
          : null,
        collaborators,
        escalation: escalationItem,
        memoryUsed,
        skillsActive,
        activeWorkflow,
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
  lastSeen: number | null,
  hasBlocker: boolean,
  hasEscalation: boolean,
): PresenceState {
  if (hasEscalation) return 'waiting-for-approval'
  if (status === 'error') return 'needs-attention'
  if (hasBlocker) return 'blocked'
  const stale = lastSeen ? Date.now() / 1000 - lastSeen > 600 : true
  if (status === 'busy') return 'working'
  if (status === 'offline') return 'idle'
  if (status === 'idle') return stale ? 'idle' : 'online'
  return 'online'
}

export const dynamic = 'force-dynamic'
