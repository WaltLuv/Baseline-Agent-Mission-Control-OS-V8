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
      `SELECT id, name, role, status, last_activity, last_seen
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
        last_seen: number | null
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
           WHERE workspace_id = ? AND assigned_to = ? AND status = 'done'
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
           FROM tasks WHERE workspace_id = ? AND assigned_to = ? AND status = 'done'
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
         FROM tasks WHERE workspace_id = ? AND assigned_to = ? AND status IN ('open','in_progress','blocked','needs-review','review')
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
           AND (agent_id = ? OR agent_slug = ? OR agent_slug = ? OR rationale LIKE ? OR detail LIKE ?)
         ORDER BY created_at DESC LIMIT 5`,
      )
      .all(workspaceId, agent.id, slug, agent.name.toLowerCase(), `%${agent.name}%`, `%${agent.name}%`) as Array<{
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

  // --- skills used: derived from workforce_memory `skill-used` entries when present
  let skillsUsed: EmployeeTrace['skillsUsed'] = []
  if (tableExists(db, 'workforce_memory')) {
    try {
      skillsUsed = (db
        .prepare(
          `SELECT title AS skill, MAX(created_at) AS last_used, COUNT(*) AS uses
           FROM workforce_memory
           WHERE workspace_id = ?
             AND (agent_id = ? OR agent_slug = ? OR agent_slug = ?)
             AND kind IN ('skill-used','skill-installed')
             AND created_at >= ?
           GROUP BY title ORDER BY uses DESC LIMIT 6`,
        )
        .all(workspaceId, agent.id, slug, agent.name.toLowerCase(), monthAgo) as Array<{ skill: string; last_used: number; uses: number }>)
        .filter((r) => !!r.skill)
        .map((r) => ({ skill: r.skill, lastUsedAt: r.last_used, uses: r.uses }))
    } catch {
      skillsUsed = []
    }
  }

  // --- collaborators: agents that worked the same tasks (same project_id)
  let collaborators: EmployeeTrace['collaborators'] = []
  if (tableExists(db, 'tasks') && columnExists(db, 'tasks', 'assigned_to') && columnExists(db, 'tasks', 'project_id')) {
    collaborators = (db
      .prepare(
        `SELECT other.assigned_to AS name,
                COUNT(DISTINCT t.id) AS shared_tasks,
                MAX(COALESCE(t.updated_at, t.created_at)) AS last_at
         FROM tasks t
         JOIN tasks other
           ON other.project_id = t.project_id
          AND other.workspace_id = t.workspace_id
          AND other.assigned_to IS NOT NULL
          AND other.assigned_to != ?
         WHERE t.workspace_id = ? AND t.assigned_to = ?
           AND COALESCE(t.updated_at, t.created_at) >= ?
         GROUP BY other.assigned_to
         ORDER BY shared_tasks DESC LIMIT 6`,
      )
      .all(agent.name, workspaceId, agent.name, monthAgo) as Array<{
      name: string
      shared_tasks: number
      last_at: number
    }>)
      .map((r) => ({ name: r.name, sharedTasks: r.shared_tasks, lastSharedAt: r.last_at }))
  }

  // --- cost + value this month
  let costThisMonthCents = 0
  let valueThisMonthCents = 0
  if (tableExists(db, 'usage_events') && columnExists(db, 'usage_events', 'agent_id') && columnExists(db, 'usage_events', 'retail_cost_cents')) {
    try {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(retail_cost_cents),0) AS cost
           FROM usage_events
           WHERE workspace_id = ? AND agent_id = ? AND created_at >= ?`,
        )
        .get(workspaceId, agent.id, monthAgo) as { cost: number } | undefined
      costThisMonthCents = row?.cost ?? 0
    } catch {
      costThisMonthCents = 0
    }
  }
  if (tableExists(db, 'workforce_memory') && columnExists(db, 'workforce_memory', 'value_impact_cents')) {
    try {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(value_impact_cents),0) AS v
           FROM workforce_memory
           WHERE workspace_id = ? AND (agent_id = ? OR agent_slug = ? OR agent_slug = ?)
             AND created_at >= ?`,
        )
        .get(workspaceId, agent.id, slug, agent.name.toLowerCase(), monthAgo) as { v: number } | undefined
      valueThisMonthCents = row?.v ?? 0
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
         FROM tasks WHERE workspace_id = ? AND assigned_to = ? AND status = 'blocked'
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
         FROM tasks WHERE workspace_id = ? AND assigned_to = ? AND status IN ('needs-review','review','waiting-approval')
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
    agent.last_seen,
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
         WHERE workspace_id = ? AND assigned_to = ?
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
  'pdf-generation': 'PDF Document Generation',
}

export function customerSkillLabel(slug: string): string {
  return SKILL_LABEL_OVERRIDE[slug] || humanizeSlug(slug)
}

export function skillsInventory(workspaceId: number): ActiveSkill[] {
  const db = getDatabase()
  if (!tableExists(db, 'workforce_memory') && !tableExists(db, 'workforce_skills')) return []
  const monthAgo = Math.floor(Date.now() / 1000) - 30 * 86_400
  const dayAgo = Math.floor(Date.now() / 1000) - 86_400

  // Merge two sources:
  //   1. `workforce_skills` rows — every installed capability (live ROI counters)
  //   2. `workforce_memory` rows where kind IN ('skill-used','skill-installed')
  //      — used to backfill employees / workflows when the counter row is empty.
  type Row = {
    slug: string
    label: string
    uses: number
    recent_uses: number
    last_used: number
    employees: string
    value_cents: number
    success_count: number
    escalation_count: number
    installed_at: number | null
  }
  const rows = new Map<string, Row>()

  if (tableExists(db, 'workforce_skills')) {
    try {
      const installed = db
        .prepare(
          `SELECT slug, name AS label,
                  COALESCE(use_count, 0) AS uses,
                  COALESCE(last_used_at, 0) AS last_used,
                  COALESCE(value_impact_cents, 0) AS value_cents,
                  COALESCE(success_count, 0) AS success_count,
                  COALESCE(escalation_count, 0) AS escalation_count,
                  installed_at
           FROM workforce_skills
           WHERE workspace_id = ?
           ORDER BY uses DESC, installed_at DESC
           LIMIT 24`,
        )
        .all(workspaceId) as Array<{
        slug: string
        label: string
        uses: number
        last_used: number
        value_cents: number
        success_count: number
        escalation_count: number
        installed_at: number
      }>
      for (const r of installed) {
        rows.set(r.slug, {
          slug: r.slug,
          label: r.label,
          uses: r.uses,
          recent_uses: 0,
          last_used: r.last_used,
          employees: '',
          value_cents: r.value_cents,
          success_count: r.success_count,
          escalation_count: r.escalation_count,
          installed_at: r.installed_at,
        })
      }
    } catch {
      // workforce_skills columns may be older; skip the counter merge.
    }
  }

  if (tableExists(db, 'workforce_memory')) {
    try {
      const events = db
        .prepare(
          `SELECT title AS slug_candidate,
                  COUNT(*) AS uses,
                  SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS recent_uses,
                  MAX(created_at) AS last_used,
                  GROUP_CONCAT(DISTINCT agent_slug) AS agents,
                  COALESCE(SUM(value_impact_cents), 0) AS value_cents,
                  SUM(CASE WHEN kind = 'skill-used' THEN 1 ELSE 0 END) AS success_count,
                  SUM(CASE WHEN kind = 'skill-escalated' THEN 1 ELSE 0 END) AS escalation_count
           FROM workforce_memory
           WHERE workspace_id = ?
             AND kind IN ('skill-installed','skill-used','skill-escalated')
             AND created_at >= ?
           GROUP BY title
           ORDER BY uses DESC
           LIMIT 24`,
        )
        .all(dayAgo, workspaceId, monthAgo) as Array<{
        slug_candidate: string
        uses: number
        recent_uses: number
        last_used: number
        agents: string | null
        value_cents: number
        success_count: number
        escalation_count: number
      }>
      for (const e of events) {
        // Memory rows store either the slug or the human label as `title`.
        // Normalize to slug form so we merge with the workforce_skills row.
        const slug = e.slug_candidate.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const existing = rows.get(slug)
        if (existing) {
          // Keep counter-source counters (more authoritative). Add recency + employees from memory.
          existing.recent_uses = Math.max(existing.recent_uses, Number(e.recent_uses))
          existing.last_used = Math.max(existing.last_used, Number(e.last_used))
          existing.employees = e.agents || ''
        } else {
          rows.set(slug, {
            slug,
            label: e.slug_candidate,
            uses: Number(e.uses),
            recent_uses: Number(e.recent_uses),
            last_used: Number(e.last_used),
            employees: e.agents || '',
            value_cents: Number(e.value_cents),
            success_count: Number(e.success_count),
            escalation_count: Number(e.escalation_count),
            installed_at: null,
          })
        }
      }
    } catch {
      // ignore
    }
  }

  const now = Math.floor(Date.now() / 1000)
  return Array.from(rows.values())
    .sort((a, b) => b.uses - a.uses || (b.last_used ?? 0) - (a.last_used ?? 0))
    .slice(0, 24)
    .map((r) => {
      const employees = (r.employees || '').split(',').filter(Boolean)
      const recentUsesPerDay = r.recent_uses
      // State derivation:
      //   active   — recent uses with no escalations OR success-dominant
      //   warning  — escalations ≥ 50% of uses OR recent activity dropping
      //   inactive — installed but no use in 7d, OR no use ever
      const stale = !r.last_used || r.last_used < now - 7 * 86_400
      const escalationRate = r.uses > 0 ? r.escalation_count / r.uses : 0
      let state: ActiveSkill['state']
      if (r.uses === 0 || stale) state = 'inactive'
      else if (escalationRate >= 0.5) state = 'warning'
      else if (recentUsesPerDay > 0) state = 'active'
      else state = 'warning'

      let recommendation: string | null = null
      if (state === 'inactive' && r.installed_at && r.uses === 0) {
        recommendation = 'Installed but never used — attach it to an AI Employee or workflow.'
      } else if (state === 'inactive') {
        recommendation = 'No use in 7 days — consider archiving or attaching elsewhere.'
      } else if (state === 'warning' && escalationRate >= 0.5) {
        recommendation = `${Math.round(escalationRate * 100)}% of activations escalated — check the upstream workflow.`
      } else if (state === 'warning') {
        recommendation = 'Usage dropped in last 24h — check if a workflow stalled.'
      }

      return {
        slug: r.slug,
        label: customerSkillLabel(r.slug),
        state,
        employees,
        workflows: [],
        uses: r.uses,
        recentUsesPerDay,
        estimatedMinutesSaved: r.uses * 15,
        creditsUsedThisMonth: 0,
        valueUsdThisMonth: Math.round((r.value_cents ?? 0) / 100),
        relatedTasks: 0,
        recommendation,
      }
    })
}

// ---------- collaboration graph ----------

export function collaborationGraph(workspaceId: number): CollaborationGraph {
  const db = getDatabase()
  if (!tableExists(db, 'tasks') || !columnExists(db, 'tasks', 'project_id') || !columnExists(db, 'tasks', 'assigned_to')) {
    return { nodes: [], edges: [], topPair: null }
  }
  const monthAgo = Math.floor(Date.now() / 1000) - 30 * 86_400
  const rows = db
    .prepare(
      `SELECT a.assigned_to AS from_name,
              b.assigned_to AS to_name,
              COUNT(DISTINCT a.id) AS shared,
              MAX(COALESCE(a.updated_at, a.created_at)) AS last_at
       FROM tasks a
       JOIN tasks b
         ON a.project_id = b.project_id
        AND a.workspace_id = b.workspace_id
        AND a.assigned_to IS NOT NULL
        AND b.assigned_to IS NOT NULL
        AND a.assigned_to != b.assigned_to
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


// ---------- skill ROI leaderboard ----------

export interface SkillRoiLeader {
  slug: string
  label: string
  valueUsdThisMonth: number
  uses: number
  employees: string[]
  primaryEmployeeSlug: string | null
  state: ActiveSkill['state']
  /** Last-30-day comparison delta in USD (positive = improving). */
  trend: 'up' | 'flat' | 'down'
}

/**
 * Top value-creating skills this month — feeds the Executive Briefing
 * leaderboard. Returns at most `limit` skills. Honest empty array when
 * no activity exists.
 */
export function skillRoiLeaderboard(workspaceId: number, limit = 3): SkillRoiLeader[] {
  const all = skillsInventory(workspaceId)
  if (!all.length) return []

  const candidates = all
    .filter((s) => s.valueUsdThisMonth > 0 || s.uses > 0)
    .sort((a, b) => b.valueUsdThisMonth - a.valueUsdThisMonth || b.uses - a.uses)
    .slice(0, limit)

  // 30-day window from workforce_memory for trend signal.
  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const monthAgo = now - 30 * 86_400
  const fortnightAgo = now - 14 * 86_400

  return candidates.map((s) => {
    let trend: 'up' | 'flat' | 'down' = 'flat'
    if (tableExists(db, 'workforce_memory') && columnExists(db, 'workforce_memory', 'value_impact_cents')) {
      try {
        const row = db
          .prepare(
            `SELECT
               COALESCE(SUM(CASE WHEN created_at >= ? THEN value_impact_cents END), 0) AS recent,
               COALESCE(SUM(CASE WHEN created_at >= ? AND created_at < ? THEN value_impact_cents END), 0) AS earlier
             FROM workforce_memory
             WHERE workspace_id = ?
               AND title = ?
               AND kind = 'skill-used'`,
          )
          .get(fortnightAgo, monthAgo, fortnightAgo, workspaceId, s.slug) as { recent: number; earlier: number } | undefined
        const recent = row?.recent ?? 0
        const earlier = row?.earlier ?? 0
        if (recent > earlier * 1.2) trend = 'up'
        else if (recent < earlier * 0.8) trend = 'down'
      } catch {
        trend = 'flat'
      }
    }
    return {
      slug: s.slug,
      label: s.label,
      valueUsdThisMonth: s.valueUsdThisMonth,
      uses: s.uses,
      employees: s.employees,
      primaryEmployeeSlug: s.employees[0] ?? null,
      state: s.state,
      trend,
    }
  })
}

// ---------- approval queue ----------

export interface ApprovalItem {
  taskId: number
  title: string
  status: string
  assignedTo: string | null
  assignedSlug: string | null
  ageHours: number
  severity: 'low' | 'medium' | 'high'
  /** Memory rationale that produced this escalation, if any. */
  reason: string | null
  reasonSource: 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal' | null
}

/**
 * All open `needs-review / review / waiting-approval` tasks across the
 * workspace, with the matched memory rationale (so the operator sees
 * "Why this was escalated" directly on each row).
 */
export function approvalQueue(workspaceId: number): ApprovalItem[] {
  const db = getDatabase()
  if (!tableExists(db, 'tasks') || !columnExists(db, 'tasks', 'assigned_to')) return []
  const now = Math.floor(Date.now() / 1000)

  const rows = db
    .prepare(
      `SELECT id, title, status, assigned_to,
              COALESCE(updated_at, created_at) AS since_at
       FROM tasks
       WHERE workspace_id = ?
         AND status IN ('needs-review','review','waiting-approval')
       ORDER BY since_at ASC
       LIMIT 50`,
    )
    .all(workspaceId) as Array<{
    id: number
    title: string
    status: string
    assigned_to: string | null
    since_at: number
  }>

  if (!rows.length) return []

  // Pull workforce_memory entries that look like rationales for these escalations.
  const memById = new Map<string, { rationale: string; source: ApprovalItem['reasonSource'] }>()
  if (tableExists(db, 'workforce_memory')) {
    try {
      const memRows = db
        .prepare(
          `SELECT agent_slug, kind, rationale, detail, created_at
           FROM workforce_memory
           WHERE workspace_id = ?
             AND (kind LIKE 'operator-memory%' OR kind = 'escalation' OR kind = 'skill-escalated')
             AND COALESCE(rationale, detail) IS NOT NULL
           ORDER BY created_at DESC
           LIMIT 100`,
        )
        .all(workspaceId) as Array<{
        agent_slug: string | null
        kind: string
        rationale: string | null
        detail: string | null
        created_at: number
      }>
      for (const m of memRows) {
        if (!m.agent_slug) continue
        const key = m.agent_slug
        if (memById.has(key)) continue
        const source: ApprovalItem['reasonSource'] = m.kind.includes('obsidian')
          ? 'Obsidian'
          : m.kind.includes('notion')
            ? 'Notion'
            : m.kind.includes('pinecone')
              ? 'Pinecone'
              : 'Internal'
        memById.set(key, { rationale: (m.rationale || m.detail || '').slice(0, 220), source })
      }
    } catch {
      // ignore
    }
  }

  return rows.map((r) => {
    const ageHours = Math.max(0, (now - r.since_at) / 3600)
    const severity: ApprovalItem['severity'] = ageHours > 48 ? 'high' : ageHours > 12 ? 'medium' : 'low'
    const slug = r.assigned_to ? r.assigned_to.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
    const memHit = slug ? memById.get(slug) : null
    return {
      taskId: r.id,
      title: r.title,
      status: r.status,
      assignedTo: r.assigned_to,
      assignedSlug: slug,
      ageHours,
      severity,
      reason: memHit?.rationale ?? null,
      reasonSource: memHit?.source ?? null,
    }
  })
}