import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { tokenReportLimiter } from '@/lib/rate-limit'

/**
 * POST /api/skills/event — Skill activation phone-home.
 *
 * AI Employees / workflows call this every time an installed skill is used.
 * The event becomes:
 *   - a row in `workforce_memory` (kind='skill-used') so it shows up in
 *     the trace view, the skills-active inventory, and the memory feed
 *   - a counter increment on `workforce_skills` so the live ROI of every
 *     installed capability is measurable from the catalog side
 *
 * Body:
 *   {
 *     skillSlug: string,            // required — matches `workforce_skills.slug`
 *     agentSlug?: string,           // optional — which employee used it
 *     agentId?: number,             // optional — preferred over slug
 *     valueImpactCents?: number,    // optional — measured operator value
 *     durationMinutes?: number,     // optional — minutes saved vs manual
 *     success?: boolean,            // optional — false counts as escalation
 *     taskId?: number,              // optional — task context
 *     note?: string                 // optional — short rationale
 *   }
 *
 * Security: workspace-scoped via session (or x-api-key). Rate-limited the
 * same way `/api/tokens` is — 120/minute/agent.
 */
interface SkillEventBody {
  skillSlug?: string
  agentSlug?: string
  agentId?: number
  valueImpactCents?: number
  durationMinutes?: number
  success?: boolean
  taskId?: number
  note?: string
}

function ensureSkillsTable(db: ReturnType<typeof getDatabase>) {
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
  // Add the counters/state columns on workforce_skills if they don't exist.
  for (const col of ['use_count INTEGER NOT NULL DEFAULT 0', 'last_used_at INTEGER', 'value_impact_cents INTEGER NOT NULL DEFAULT 0', 'success_count INTEGER NOT NULL DEFAULT 0', 'escalation_count INTEGER NOT NULL DEFAULT 0']) {
    try { db.exec(`ALTER TABLE workforce_skills ADD COLUMN ${col}`) } catch { /* already exists */ }
  }
}

export async function POST(request: NextRequest) {
  const rl = tokenReportLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: SkillEventBody
  try {
    body = (await request.json()) as SkillEventBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.skillSlug || typeof body.skillSlug !== 'string') {
    return NextResponse.json({ error: 'skillSlug is required' }, { status: 400 })
  }

  const db = getDatabase()
  ensureSkillsTable(db)
  const now = Math.floor(Date.now() / 1000)
  const success = body.success !== false // default true
  const valueImpact = Number.isFinite(body.valueImpactCents) ? Math.max(0, Math.floor(body.valueImpactCents!)) : 0

  // Look up the installed skill record (must exist in this workspace).
  const skill = db
    .prepare(`SELECT id, name FROM workforce_skills WHERE workspace_id = ? AND slug = ? LIMIT 1`)
    .get(workspaceId, body.skillSlug) as { id: number; name: string } | undefined
  if (!skill) {
    return NextResponse.json(
      { error: 'skill not installed in this workspace', skillSlug: body.skillSlug },
      { status: 404 },
    )
  }

  // Idempotency: when the runtime supplies an idempotency-key, we
  // remember it for 24h. A duplicate POST returns the original result
  // without re-incrementing counters — critical for retry-storms.
  const idemKey = request.headers.get('idempotency-key') ?? request.headers.get('x-idempotency-key')
  if (idemKey) {
    db.exec(`CREATE TABLE IF NOT EXISTS idempotency_cache (
      key TEXT PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`)
    const cached = db
      .prepare(`SELECT created_at FROM idempotency_cache WHERE key = ? AND workspace_id = ? AND scope = 'skill-event'`)
      .get(idemKey, workspaceId) as { created_at: number } | undefined
    if (cached && now - cached.created_at < 86_400) {
      return NextResponse.json({ ok: true, deduped: true, skillSlug: body.skillSlug })
    }
    db.prepare(
      `INSERT OR IGNORE INTO idempotency_cache (key, workspace_id, scope, created_at) VALUES (?, ?, 'skill-event', ?)`,
    ).run(idemKey, workspaceId, now)
  }

  // Resolve agent if provided.
  let agentSlug: string | null = body.agentSlug ?? null
  let agentId: number | null = body.agentId ?? null
  if (agentId && !agentSlug) {
    const row = db.prepare(`SELECT name FROM agents WHERE id = ? AND workspace_id = ? LIMIT 1`).get(agentId, workspaceId) as { name: string } | undefined
    if (row) agentSlug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }

  // Write the workforce_memory row — this is what the trace + inventory read.
  const detail =
    body.note?.slice(0, 240) ??
    (success
      ? `${skill.name} used successfully${body.durationMinutes ? ` · saved ~${body.durationMinutes}m` : ''}.`
      : `${skill.name} escalated for review.`)
  const rationale = body.taskId ? `task #${body.taskId}` : 'Skill activation telemetry'

  db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, value_impact_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workspaceId,
    agentId,
    agentSlug,
    success ? 'skill-used' : 'skill-escalated',
    body.skillSlug,
    detail,
    rationale,
    valueImpact,
    now,
  )

  // Increment counters on the installed skill record.
  db.prepare(
    `UPDATE workforce_skills
       SET use_count = COALESCE(use_count, 0) + 1,
           last_used_at = ?,
           value_impact_cents = COALESCE(value_impact_cents, 0) + ?,
           success_count = COALESCE(success_count, 0) + ?,
           escalation_count = COALESCE(escalation_count, 0) + ?
       WHERE workspace_id = ? AND slug = ?`,
  ).run(now, valueImpact, success ? 1 : 0, success ? 0 : 1, workspaceId, body.skillSlug)

  return NextResponse.json({ ok: true, skillSlug: body.skillSlug, success, valueImpactCents: valueImpact })
}

export const dynamic = 'force-dynamic'
