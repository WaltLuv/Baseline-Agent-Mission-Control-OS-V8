/**
 * Library API — workspace inventory across skills, employees, workflows.
 *
 *   GET /api/library  → { skills, employees, workflows, totals }
 *
 * Read-only aggregator. Reads from:
 *   · workforce_skills        (installed skills + workflows)
 *   · workforce_subscriptions (hired employees) + agents
 *
 * Workflows are surfaced as a distinct group when a row has
 * `workforce_skills.category = 'workflow'`. They share the schema today
 * (a paid workflow installs into the same table) and will move into a
 * dedicated `workforce_workflows` table when that split lands.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

interface SkillRow {
  id: number
  workspace_id: number
  slug: string
  name: string
  category: string
  price_cents: number
  attached_agent_id: number | null
  installed_at: number
}

interface SubRow {
  id: number
  workspace_id: number
  employee_slug: string
  monthly_cents: number
  status: string
  started_at: number
}

interface AgentRow {
  id: number
  name: string
  role: string | null
  status: string | null
}

function isWorkflow(category: string): boolean {
  // The marketplace catalogue uses "workflow" or "Workflow" as the category
  // marker. Be tolerant of casing so a paid workflow doesn't get hidden if
  // the catalogue ships a variant casing.
  return /workflow/i.test(category)
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const db = getDatabase()

  // Ensure the workforce tables exist before we read — the marketplace
  // fulfillment module creates them lazily on first install, so a fresh
  // workspace that has never installed anything will otherwise 500.
  db.exec(`
    CREATE TABLE IF NOT EXISTS workforce_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      attached_agent_id INTEGER,
      installed_at INTEGER NOT NULL,
      idempotency_key TEXT,
      UNIQUE(workspace_id, slug, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS workforce_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      employee_slug TEXT NOT NULL,
      monthly_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      started_at INTEGER NOT NULL,
      idempotency_key TEXT,
      UNIQUE(workspace_id, employee_slug, idempotency_key)
    );
  `)

  const skillRows = db.prepare(
    `SELECT id, workspace_id, slug, name, category, price_cents, attached_agent_id, installed_at
       FROM workforce_skills WHERE workspace_id = ? ORDER BY installed_at DESC`,
  ).all(workspaceId) as SkillRow[]

  const subRows = db.prepare(
    `SELECT id, workspace_id, employee_slug, monthly_cents, status, started_at
       FROM workforce_subscriptions WHERE workspace_id = ? ORDER BY started_at DESC`,
  ).all(workspaceId) as SubRow[]

  // Map subscription rows to a richer "employee" view by joining against
  // agents on the matching name (the marketplace fulfilment provisions an
  // `agents` row at hire time). The join is by name because some forks of
  // the schema don't carry the FK; the marketplace lib does ensure a
  // 1:1 between subscription and agent.
  const agentByName = new Map<string, AgentRow>()
  for (const a of db.prepare(`SELECT id, name, role, status FROM agents WHERE workspace_id = ?`).all(workspaceId) as AgentRow[]) {
    agentByName.set(a.name.toLowerCase(), a)
  }

  const skills = skillRows.filter((r) => !isWorkflow(r.category))
  const workflows = skillRows.filter((r) => isWorkflow(r.category))

  const employees = subRows.map((s) => {
    // Resolve the agent by the catalogue's employee name (subscription only
    // carries the slug). Falling back to slug-based lookup keeps this honest
    // when the catalogue can't be reached at request time.
    const guess = s.employee_slug.replace(/^agent-/, '').replace(/-/g, ' ').toLowerCase()
    const matched = agentByName.get(guess)
    return {
      subscription_id: s.id,
      employee_slug: s.employee_slug,
      status: s.status,
      started_at: s.started_at,
      monthly_cents: s.monthly_cents,
      agent_id: matched?.id ?? null,
      agent_name: matched?.name ?? null,
      agent_role: matched?.role ?? null,
      agent_status: matched?.status ?? null,
    }
  })

  return NextResponse.json({
    skills,
    workflows,
    employees,
    totals: {
      skills: skills.length,
      workflows: workflows.length,
      employees: employees.length,
    },
  })
}
