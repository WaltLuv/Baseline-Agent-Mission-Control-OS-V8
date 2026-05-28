/**
 * Baseline OS — Workforce Intelligence Derivation
 *
 * Pure read-only derivations from the SQLite store. Powers the
 * "From observation to explanation" pass:
 *
 *   • employeeTrace(slug)       — one-click drill-down for an AI Employee
 *   • skillsInventory()         — what skills are actually being used
 *   • collaborationGraph()      — who hands off to whom, who's a bottleneck
 *   • trustTrajectory(slug)     — 14-day trust evolution sparkline
 *
 * HARD RULES
 *   1. Never fabricate. If there's no data, the function returns the
 *      honest empty shape so the UI can render "no activity yet".
 *   2. Customer-facing strings come from this module — no slugs in titles,
 *      no embedding/vector/index jargon.
 *   3. Workspace-scoped — every query carries workspace_id.
 *   4. Tolerant of missing columns/tables (PRAGMA-checked).
 */
import { getDatabase } from '@/lib/db'
import type { Database } from 'better-sqlite3'

// ---------- shared types ----------

export interface MemoryCitation {
  id: number
  source: 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal'
  title: string
  excerpt: string
  rationale: string | null
  createdAt: number
}

export interface EmployeeTrace {
  slug: string
  name: string
  presence: 'online' | 'working' | 'waiting-for-approval' | 'blocked' | 'idle' | 'needs-attention'
  currentlyWorkingOn: string | null
  /** Tasks closed in the last 24h. */
  todayActions: Array<{ title: string; closedAt: number; valueUsd: number }>
  activeTasks: Array<{ id: number; title: string; status: string; updatedAt: number }>
  activeWorkflow: string | null
  memoryUsed: MemoryCitation[]
  skillsUsed: Array<{ skill: string; lastUsedAt: number; uses: number }>
  collaborators: Array<{ name: string; sharedTasks: number; lastSharedAt: number }>
  costThisMonthCents: number
  valueThisMonthCents: number
  blockedItems: Array<{ id: number; title: string; sinceAt: number }>
  needsApproval: Array<{ id: number; title: string; reason: string | null; sinceAt: number }>
  /** Daily reliability ratio 0..1 — used by the trust sparkline. */
  trustTrajectory: Array<{ day: string; trust: number; closed: number; escalated: number }>
  nextAction: { label: string; href: string }
}

export interface ActiveSkill {
  /** Stable slug used internally — never the primary label. */
  slug: string
  /** Customer-facing label derived from the slug. */
  label: string
  state: 'active' | 'inactive' | 'warning'
  employees: string[]
  workflows: string[]
  uses: number
  recentUsesPerDay: number
  estimatedMinutesSaved: number
  creditsUsedThisMonth: number
  valueUsdThisMonth: number
  relatedTasks: number
  recommendation: string | null
}

export interface CollaborationEdge {
  from: string
  to: string
  /** Customer-facing relationship verb: "Works with", "Hands off to", etc. */
  kind: 'works-with' | 'hands-off-to' | 'escalates-to' | 'depends-on'
  /** 0..1 — strength of the relationship based on shared events. */
  strength: number
  sharedTasks: number
  lastSharedAt: number
}

export interface CollaborationGraph {
  nodes: Array<{
    name: string
    role: 'central' | 'normal' | 'overloaded' | 'bottleneck' | 'underused'
  }>
  edges: CollaborationEdge[]
  topPair: { left: string; right: string; reason: string } | null
}

// ---------- helpers ----------

function tableExists(db: Database, name: string): boolean {
  const r = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name)
  return !!r
}

function columnExists(db: Database, table: string, col: string): boolean {
  if (!tableExists(db, table)) return false
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((r) => r.name === col)
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const SOURCE_LABELS: Record<string, MemoryCitation['source']> = {
  'operator-memory.obsidian': 'Obsidian',
  'operator-memory.notion': 'Notion',
  'operator-memory.pinecone': 'Pinecone',
}

function sourceLabelFromKind(kind: string): MemoryCitation['source'] {
  return SOURCE_LABELS[kind] ?? 'Internal'
}

/** Convert "tax-doc-organizer" → "Tax Doc Organizer". */
export function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------- employee trace ----------

export function employeeTrace(workspaceId: number, slugOrName: string): EmployeeTrace | null {
  const db = getDatabase()
  const lookupName = slugOrName.replace(/-/g, ' ')
  // Try to find agent by name (case-insensitive) or by slug-style match.
  const agent = db
    .prepare(
      `SELECT id, name, role, status, last_activity, last_heartbeat
       FROM agents
       WHERE workspace_id = ?
         AND (LOWER(name) = LOWER(?) OR LOWER(REPLACE(name, ' ', '-')) = LOWER(?))
       LIMIT 1`,
    )
    .get(workspaceId, lookupName, slugOrName) as
    | {
        id: number
        name: string
        role: string | null
        status: 'busy' | 'idle' | 'error' | 'offline' | null
        last_activity: string | null
        last_heartbeat: number | null
      }
    | undefined

  if (!agent) return null

  const slug = slugify(agent.name)
  const now = Math.floor(Date.now() / 1000)
  const dayAgo = now - 86_400
  const monthAgo = now - 30 * 86_400
  const fourteenDaysAgo = now - 14 * 86_400

  // --- today's actions: closed tasks in last 24h
  let todayActions: EmployeeTrace['todayActions'] = []
  if (tableExists(db, 'tasks')) {
    try {
      todayActions = db
        .prepare(
          `SELECT title, COALESCE(updated_at, created_at) AS closed_at,
                  COALESCE(value_usd, 0) AS value_usd
           FROM tasks
           WHERE workspace_id = ? AND assignee = ? AND status = 'done'
             AND COALESCE(updated_at, created_at) >= ?
           ORDER BY closed_at DESC LIMIT 5`,
        )
        .all(workspaceId, agent.name, dayAgo)
        .map((r) => {
          const row = r as { title: string; closed_at: number; value_usd: number }
          return { title: row.title, closedAt: row.closed_at, valueUsd: row.value_usd }
        })
    } catch {
      // value_usd may not exist; fall through
      todayActions = (db
        .prepare(
          `SELECT title, COALESCE(updated_at, created_at) AS closed_at
           FROM tasks WHERE workspace_id = ? AND assignee = ? AND status = 'done'
             AND COALESCE(updated_at, created_at) >= ? ORDER BY closed_at DESC LIMIT 5`,
        )
        .all(workspaceId, agent.name, dayAgo) as Array<{ title: string; closed_at: number }>)
        .map((r) => ({ title: r.title, closedAt: r.closed_at, valueUsd: 0 }))
    }
  }

  // --- active tasks
  let activeTasks: EmployeeTrace['activeTasks'] = []
  if (tableExists(db, 'tasks')) {
    activeTasks = (db
      .prepare(
        `SELECT id, title, status, COALESCE(updated_at, created_at) AS updated_at
         FROM tasks WHERE workspace_id = ? AND assignee = ? AND status IN ('open','in_progress','blocked','needs-review','review')
         ORDER BY updated_at DESC LIMIT 10`,
      )
      .all(workspaceId, agent.name) as Array<{ id: number; title: string; status: string; updated_at: number }>)
      .map((r) => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updated_at }))
  }

  // --- memory used: most recent rows where this agent is referenced
  let memoryUsed: MemoryCitation[] = []
  if (tableExists(db, 'workforce_memory')) {
    memoryUsed = (db
      .prepare(
        `SELECT id, kind, title, detail, rationale, created_at
         FROM workforce_memory
         WHERE workspace_id = ?
           AND (agent_slug = ? OR rationale LIKE ? OR detail LIKE ?)
         ORDER BY created_at DESC LIMIT 5`,
      )
      .all(workspaceId, agent.name, `%${agent.name}%`, `%${agent.name}%`) as Array<{
      id: number
      kind: string
      title: string
      detail: string | null
      rationale: string | null
      created_at: number
    }>)
      .map((r) => ({
        id: r.id,
        source: sourceLabelFromKind(r.kind),
        title: r.title,
        excerpt: (r.detail || '').slice(0, 280),
        rationale: r.rationale,
        createdAt: r.created_at,
      }))
  }

  // --- skills used: from usage_events (if column exists) joined by skill_name
  let skillsUsed: EmployeeTrace['skillsUsed'] = []
  if (tableExists(db, 'usage_events') && columnExists(db, 'usage_events', 'skill_name') && columnExists(db, 'usage_events', 'agent_name')) {
    skillsUsed = (db
      .prepare(
        `SELECT skill_name AS skill, MAX(created_at) AS last_used, COUNT(*) AS uses
         FROM usage_events
         WHERE workspace_id = ? AND agent_name = ? AND created_at >= ?
         GROUP BY skill_name ORDER BY uses DESC LIMIT 6`,
      )
      .all(workspaceId, agent.name, monthAgo) as Array<{ skill: string; last_used: number; uses: number }>)
      .filter((r) => !!r.skill)
      .map((r) => ({ skill: r.skill, lastUsedAt: r.last_used, uses: r.uses }))
  }

  // --- collaborators: agents that worked the same tasks
  let collaborators: EmployeeTrace['collaborators'] = []
  if (tableExists(db, 'tasks') && columnExists(db, 'tasks', 'assignee')) {
    // Heuristic: tasks that have been re-assigned (assignee != original_assignee
    // OR comments by other agents). Without rich audit, we approximate via
    // tasks that share the same `project_id` worked by multiple agents in the
    // last 30 days.
    if (columnExists(db, 'tasks', 'project_id')) {
      collaborators = (db
        .prepare(
          `SELECT other.assignee AS name,
                  COUNT(DISTINCT t.id) AS shared_tasks,
                  MAX(COALESCE(t.updated_at, t.created_at)) AS last_at
           FROM tasks t
           JOIN tasks other
             ON other.project_id = t.project_id
            AND other.workspace_id = t.workspace_id
            AND other.assignee IS NOT NULL
            AND other.assignee != ?
           WHERE t.workspace_id = ? AND t.assignee = ?
             AND COALESCE(t.updated_at, t.created_at) >= ?
           GROUP BY other.assignee
           ORDER BY shared_tasks DESC LIMIT 6`,
        )
        .all(agent.name, workspaceId, agent.name, monthAgo) as Array<{
        name: string
        shared_tasks: number
        last_at: number
      }>)
        .map((r) => ({ name: r.name, sharedTasks: r.shared_tasks, lastSharedAt: r.last_at }))
    }
  }

  // --- cost + value this month
  let costThisMonthCents = 0
  let valueThisMonthCents = 0
  if (tableExists(db, 'usage_events') && columnExists(db, 'usage_events', 'agent_name') && columnExists(db, 'usage_events', 'retail_cost_cents')) {
    try {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(retail_cost_cents),0) AS cost
           FROM usage_events
           WHERE workspace_id = ? AND agent_name = ? AND created_at >= ?`,
        )
        .get(workspaceId, agent.name, monthAgo) as { cost: number } | undefined
      costThisMonthCents = row?.cost ?? 0
    } catch {
      costThisMonthCents = 0
    }
  }
  if (tableExists(db, 'tasks') && columnExists(db, 'tasks', 'value_usd')) {
    try {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(value_usd),0) AS v
           FROM tasks
           WHERE workspace_id = ? AND assignee = ? AND status = 'done' AND COALESCE(updated_at, created_at) >= ?`,
        )
        .get(workspaceId, agent.name, monthAgo) as { v: number } | undefined
      valueThisMonthCents = Math.round((row?.v ?? 0) * 100)
    } catch {
      valueThisMonthCents = 0
    }
  }

  // --- blocked items
  let blockedItems: EmployeeTrace['blockedItems'] = []
  if (tableExists(db, 'tasks')) {
    blockedItems = (db
      .prepare(
        `SELECT id, title, COALESCE(updated_at, created_at) AS since_at
         FROM tasks WHERE workspace_id = ? AND assignee = ? AND status = 'blocked'
         ORDER BY since_at ASC LIMIT 5`,
      )
      .all(workspaceId, agent.name) as Array<{ id: number; title: string; since_at: number }>)
      .map((r) => ({ id: r.id, title: r.title, sinceAt: r.since_at }))
  }

  // --- needs approval: tasks in needs-review/review status + memory rationale
  let needsApproval: EmployeeTrace['needsApproval'] = []
  if (tableExists(db, 'tasks')) {
    needsApproval = (db
      .prepare(
        `SELECT id, title, COALESCE(updated_at, created_at) AS since_at
         FROM tasks WHERE workspace_id = ? AND assignee = ? AND status IN ('needs-review','review','waiting-approval')
         ORDER BY since_at ASC LIMIT 5`,
      )
      .all(workspaceId, agent.name) as Array<{ id: number; title: string; since_at: number }>)
      .map((r) => {
        // Try to find a matching memory rationale that explains why approval is held.
        let reason: string | null = null
        if (tableExists(db, 'workforce_memory')) {
          const row = db
            .prepare(
              `SELECT rationale FROM workforce_memory
               WHERE workspace_id = ? AND rationale LIKE ?
               ORDER BY created_at DESC LIMIT 1`,
            )
            .get(workspaceId, `%${r.title.slice(0, 40)}%`) as { rationale: string | null } | undefined
          reason = row?.rationale ?? null
        }
        return { id: r.id, title: r.title, reason, sinceAt: r.since_at }
      })
  }

  // --- trust trajectory: per-day closed/escalated counts over 14 days
  const trustTrajectory = computeTrustTrajectory(db, workspaceId, agent.name, fourteenDaysAgo, now)

  // --- presence
  const presence: EmployeeTrace['presence'] = derivePresence(
    agent.status,
    agent.last_heartbeat,
    activeTasks.find((t) => t.status === 'blocked') ? 'blocked' : null,
    needsApproval.length > 0 ? 'waiting-for-approval' : null,
  )

  // --- next action: prefer needs-approval, then blockers, then nothing
  const nextAction =
    needsApproval[0]
      ? { label: `Approve "${needsApproval[0].title.slice(0, 60)}"`, href: '/app/approvals' }
      : blockedItems[0]
        ? { label: `Unblock "${blockedItems[0].title.slice(0, 60)}"`, href: `/app/tasks/kanban#task-${blockedItems[0].id}` }
        : { label: 'Review the workforce briefing', href: '/app/overview' }

  return {
    slug,
    name: agent.name,
    presence,
    currentlyWorkingOn: agent.last_activity,
    todayActions,
    activeTasks,
    activeWorkflow: null,
    memoryUsed,
    skillsUsed,
    collaborators,
    costThisMonthCents,
    valueThisMonthCents,
    blockedItems,
    needsApproval,
    trustTrajectory,
    nextAction,
  }
}

function derivePresence(
  status: 'busy' | 'idle' | 'error' | 'offline' | null,
  heartbeat: number | null,
  hasBlocker: 'blocked' | null,
  hasApproval: 'waiting-for-approval' | null,
): EmployeeTrace['presence'] {
  if (hasApproval) return 'waiting-for-approval'
  if (status === 'error') return 'needs-attention'
  if (hasBlocker) return 'blocked'
  const stale = heartbeat ? Date.now() / 1000 - heartbeat > 600 : true
  if (status === 'busy') return 'working'
  if (status === 'offline') return 'idle'
  return stale ? 'idle' : 'online'
}

function computeTrustTrajectory(
  db: Database,
  workspaceId: number,
  agentName: string,
  fromTs: number,
  toTs: number,
): EmployeeTrace['trustTrajectory'] {
  if (!tableExists(db, 'tasks')) return []
  const out: EmployeeTrace['trustTrajectory'] = []
  const days = Math.ceil((toTs - fromTs) / 86_400)
  for (let i = 0; i < days; i++) {
    const dayStart = fromTs + i * 86_400
    const dayEnd = dayStart + 86_400
    const row = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS closed,
           SUM(CASE WHEN status IN ('blocked','needs-review') THEN 1 ELSE 0 END) AS escalated
         FROM tasks
         WHERE workspace_id = ? AND assignee = ?
           AND COALESCE(updated_at, created_at) >= ? AND COALESCE(updated_at, created_at) < ?`,
      )
      .get(workspaceId, agentName, dayStart, dayEnd) as
      | { closed: number; escalated: number }
      | undefined
    const closed = Number(row?.closed ?? 0)
    const escalated = Number(row?.escalated ?? 0)
    const total = closed + escalated
    const trust = total === 0 ? 0 : closed / total
    out.push({
      day: new Date(dayStart * 1000).toISOString().slice(5, 10),
      trust,
      closed,
      escalated,
    })
  }
  return out
}

// ---------- skills inventory ----------

const SKILL_LABEL_OVERRIDE: Record<string, string> = {
  'document-chase': 'Missing Document Outreach',
  'sms-outbound': 'SMS Reminders',
  'email-followup': 'Email Follow-ups',
  'reconciliation': 'Bookkeeping Reconciliation',
  'partner-escalation': 'Partner Escalation',
  'bank-feed-sync': 'Bank Feed Sync',
  'category-mapping': 'Transaction Categorisation',
  'client-survey': 'Client NPS Survey',
  'intake-form': 'Client Intake',
  'conflict-search': 'Conflict-of-Interest Check',
  'document-summary': 'Document Summarisation',
  'matter-tagging': 'Matter Tagging',
  'matter-update-email': 'Client Status Updates',
  'scheduling': 'Scheduling',
  'advertising-rules': 'Compliance Watch',
  'fee-agreement-review': 'Fee-Agreement Review',
  'priority-triage': 'Maintenance Triage',
  'photo-evidence': 'Photo Evidence Capture',
  'tenant-comms': 'Tenant Communications',
  'vendor-routing': 'Vendor Routing',
  'cost-validation': 'Cost Validation',
  'statement-generation': 'Owner Statement Generation',
  'photo-attach': 'Photo Attachment',
  'tour-scheduling': 'Tour Scheduling',
  'application-review': 'Application Review',
}

export function customerSkillLabel(slug: string): string {
  return SKILL_LABEL_OVERRIDE[slug] || humanizeSlug(slug)
}

export function skillsInventory(workspaceId: number): ActiveSkill[] {
  const db = getDatabase()
  if (!tableExists(db, 'usage_events')) return []
  if (!columnExists(db, 'usage_events', 'skill_name')) return []
  const monthAgo = Math.floor(Date.now() / 1000) - 30 * 86_400
  const dayAgo = Math.floor(Date.now() / 1000) - 86_400

  const rows = db
    .prepare(
      `SELECT skill_name AS slug,
              COUNT(*) AS uses,
              SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS recent_uses,
              SUM(COALESCE(retail_cost_cents, 0)) AS credits_cost,
              MAX(created_at) AS last_used,
              GROUP_CONCAT(DISTINCT agent_name) AS agents
       FROM usage_events
       WHERE workspace_id = ? AND skill_name IS NOT NULL AND created_at >= ?
       GROUP BY skill_name
       ORDER BY uses DESC
       LIMIT 24`,
    )
    .all(dayAgo, workspaceId, monthAgo) as Array<{
    slug: string
    uses: number
    recent_uses: number
    credits_cost: number
    last_used: number
    agents: string | null
  }>

  return rows.map((r) => {
    const employees = (r.agents || '').split(',').filter(Boolean)
    const recentUsesPerDay = Number(r.recent_uses) / 1 // last 24h window
    const stale = r.last_used < Math.floor(Date.now() / 1000) - 7 * 86_400
    const state: ActiveSkill['state'] = stale ? 'inactive' : recentUsesPerDay > 0 ? 'active' : 'warning'
    return {
      slug: r.slug,
      label: customerSkillLabel(r.slug),
      state,
      employees,
      workflows: [],
      uses: r.uses,
      recentUsesPerDay,
      estimatedMinutesSaved: r.uses * 15,
      creditsUsedThisMonth: Math.round((r.credits_cost ?? 0) / 100),
      valueUsdThisMonth: Math.round(((r.uses * 15) / 60) * 60), // 15 min @ $60/hr
      relatedTasks: 0,
      recommendation:
        state === 'inactive'
          ? `No use in 7 days — consider archiving or attaching to a different team`
          : state === 'warning'
            ? `Usage dropped in last 24h — check if a workflow stalled`
            : null,
    }
  })
}

// ---------- collaboration graph ----------

export function collaborationGraph(workspaceId: number): CollaborationGraph {
  const db = getDatabase()
  if (!tableExists(db, 'tasks') || !columnExists(db, 'tasks', 'project_id') || !columnExists(db, 'tasks', 'assignee')) {
    return { nodes: [], edges: [], topPair: null }
  }
  const monthAgo = Math.floor(Date.now() / 1000) - 30 * 86_400
  const rows = db
    .prepare(
      `SELECT a.assignee AS from_name,
              b.assignee AS to_name,
              COUNT(DISTINCT a.id) AS shared,
              MAX(COALESCE(a.updated_at, a.created_at)) AS last_at
       FROM tasks a
       JOIN tasks b
         ON a.project_id = b.project_id
        AND a.workspace_id = b.workspace_id
        AND a.assignee IS NOT NULL
        AND b.assignee IS NOT NULL
        AND a.assignee != b.assignee
       WHERE a.workspace_id = ?
         AND COALESCE(a.updated_at, a.created_at) >= ?
       GROUP BY from_name, to_name
       HAVING shared > 0
       ORDER BY shared DESC
       LIMIT 40`,
    )
    .all(workspaceId, monthAgo) as Array<{ from_name: string; to_name: string; shared: number; last_at: number }>

  if (rows.length === 0) return { nodes: [], edges: [], topPair: null }

  const maxShared = rows.reduce((m, r) => Math.max(m, r.shared), 1)
  const edges: CollaborationEdge[] = rows.map((r) => ({
    from: r.from_name,
    to: r.to_name,
    kind: r.shared >= 5 ? 'works-with' : 'hands-off-to',
    strength: r.shared / maxShared,
    sharedTasks: r.shared,
    lastSharedAt: r.last_at,
  }))

  // Node roles
  const incoming: Record<string, number> = {}
  const outgoing: Record<string, number> = {}
  for (const e of edges) {
    incoming[e.to] = (incoming[e.to] ?? 0) + e.sharedTasks
    outgoing[e.from] = (outgoing[e.from] ?? 0) + e.sharedTasks
  }
  const names = Array.from(new Set([...Object.keys(incoming), ...Object.keys(outgoing)]))
  const nodes = names.map((name) => {
    const inE = incoming[name] ?? 0
    const outE = outgoing[name] ?? 0
    const total = inE + outE
    const ratio = total === 0 ? 0 : inE / total
    let role: CollaborationGraph['nodes'][number]['role'] = 'normal'
    if (inE >= maxShared * 1.5) role = 'overloaded'
    else if (ratio > 0.7 && inE > 2) role = 'bottleneck'
    else if (total === 0) role = 'underused'
    else if (total >= maxShared * 1.5) role = 'central'
    return { name, role }
  })

  const top = rows[0]
  const topPair = top
    ? {
        left: top.from_name,
        right: top.to_name,
        reason: `${top.shared} shared tasks in the last 30 days — highest collaboration pair.`,
      }
    : null

  return { nodes, edges, topPair }
}
