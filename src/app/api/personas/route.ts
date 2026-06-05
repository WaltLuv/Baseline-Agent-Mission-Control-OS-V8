/**
 * Personas API — full catalog of persona personas (employees) annotated
 * with whether the current workspace has hired each one.
 *
 *   GET /api/personas → { personas: [...] }
 *
 * Read-only. The catalogue itself lives in
 * `src/lib/marketplace-catalog.ts`; this endpoint joins it against
 * `workforce_subscriptions` so the UI can show "hired" vs "available"
 * without an extra round-trip per persona.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { EMPLOYEES, EMPLOYEE_DIVISIONS } from '@/lib/marketplace-catalog'

interface PersonaWire {
  slug: string
  name: string
  division: string
  role: string
  outcome: string
  for_whom: string
  reports_to: string | null
  manages: string[]
  hired: boolean
  hired_at: number | null
  agent_id: number | null
  agent_status: string | null
}

interface SubRow {
  employee_slug: string
  started_at: number
}

interface AgentRow {
  id: number
  name: string
  status: string | null
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const db = getDatabase()

  // Lazy-create the workforce tables — same pattern as /api/library.
  db.exec(`
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

  const subRows = db.prepare(
    `SELECT employee_slug, started_at FROM workforce_subscriptions WHERE workspace_id = ?`,
  ).all(workspaceId) as SubRow[]

  // Index by slug. If the same slug has multiple subscription rows (re-hire),
  // pick the most recent start.
  const hiredBySlug = new Map<string, SubRow>()
  for (const r of subRows) {
    const cur = hiredBySlug.get(r.employee_slug)
    if (!cur || r.started_at > cur.started_at) hiredBySlug.set(r.employee_slug, r)
  }

  // Fold in runtime agent state where the marketplace fulfilment provisioned
  // an `agents` row at hire time. Match by persona name (same convention
  // used in /api/library).
  const agentByName = new Map<string, AgentRow>()
  for (const a of db.prepare(`SELECT id, name, status FROM agents WHERE workspace_id = ?`).all(workspaceId) as AgentRow[]) {
    agentByName.set(a.name.toLowerCase(), a)
  }

  const personas: PersonaWire[] = EMPLOYEES.map((p) => {
    const hired = hiredBySlug.get(p.slug)
    const agent = agentByName.get(p.name.toLowerCase())
    return {
      slug: p.slug,
      name: p.name,
      division: p.division,
      role: p.role,
      outcome: p.outcome,
      for_whom: p.forWhom,
      reports_to: p.reportsTo ?? null,
      manages: p.manages ?? [],
      hired: Boolean(hired),
      hired_at: hired ? hired.started_at : null,
      agent_id: agent?.id ?? null,
      agent_status: agent?.status ?? null,
    }
  })

  // Stable division order so the UI can render sections without resorting.
  const divisionOrder = new Map<string, number>(
    EMPLOYEE_DIVISIONS.map((d, i) => [d, i] as const),
  )
  personas.sort((a, b) => {
    const da = divisionOrder.get(a.division) ?? 999
    const db_ = divisionOrder.get(b.division) ?? 999
    if (da !== db_) return da - db_
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json({
    personas,
    totals: {
      catalogue: personas.length,
      hired: personas.filter((p) => p.hired).length,
    },
    divisions: EMPLOYEE_DIVISIONS,
  })
}
