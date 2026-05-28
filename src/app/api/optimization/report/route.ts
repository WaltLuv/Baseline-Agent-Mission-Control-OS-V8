import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * POST /api/optimization/report
 *
 * Phone-home endpoint for AI Employees to push optimization signals back to
 * Mission Control. Mission Control / Baseline OS then surfaces these in the
 * Daily Optimization panel and the Executive Briefing.
 *
 * Body:
 *   {
 *     agent: string,
 *     kind: 'bottleneck' | 'underused' | 'overloaded' | 'roi' | 'cost' | 'risk',
 *     impact: 'low' | 'medium' | 'high',
 *     summary: string,            // 1-line operator-facing summary
 *     rationale?: string,         // why was this generated?
 *     evidence?: any,             // raw signal data (logs/metrics)
 *     confidence?: number,        // 0..1
 *     suggestedAction?: { label: string; href?: string },
 *   }
 *
 * Persisted into `workforce_memory` with kind=`baseline-os.optimization` so
 * the operator timeline reflects every recommendation with its provenance.
 *
 * SECURITY:
 *   - operator-only
 *   - workspace-scoped
 *   - rate-limited at the gateway via existing tokenReportLimiter pattern
 */
const VALID_KINDS = ['bottleneck', 'underused', 'overloaded', 'roi', 'cost', 'risk'] as const
const VALID_IMPACT = ['low', 'medium', 'high'] as const

interface ReportBody {
  agent?: string
  kind?: (typeof VALID_KINDS)[number]
  impact?: (typeof VALID_IMPACT)[number]
  summary?: string
  rationale?: string
  evidence?: unknown
  confidence?: number
  suggestedAction?: { label?: string; href?: string }
}

function ensureTable(db: ReturnType<typeof getDatabase>) {
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
    CREATE INDEX IF NOT EXISTS idx_workforce_memory_workspace ON workforce_memory(workspace_id, created_at DESC);
  `)
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: ReportBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const agent = typeof body.agent === 'string' ? body.agent.trim().slice(0, 80) : null
  const kind = body.kind && VALID_KINDS.includes(body.kind) ? body.kind : null
  const impact = body.impact && VALID_IMPACT.includes(body.impact) ? body.impact : 'medium'
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 200) : null
  const rationale = typeof body.rationale === 'string' ? body.rationale.trim().slice(0, 600) : null
  const confidence =
    typeof body.confidence === 'number' && body.confidence >= 0 && body.confidence <= 1
      ? body.confidence
      : null

  if (!agent || !kind || !summary) {
    return NextResponse.json(
      { error: 'agent, kind, and summary are required' },
      { status: 400 },
    )
  }

  try {
    const db = getDatabase()
    ensureTable(db)
    const now = Math.floor(Date.now() / 1000)
    const result = db
      .prepare(
        `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, detail, rationale, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        auth.user.workspace_id ?? 1,
        agent,
        'baseline-os.optimization',
        summary,
        // detail captures the structured signal (kind + impact + confidence + suggestion)
        JSON.stringify({
          kind,
          impact,
          confidence,
          evidence: body.evidence ?? null,
          suggestedAction: body.suggestedAction ?? null,
        }),
        rationale,
        now,
      )

    return NextResponse.json({
      ok: true,
      id: Number(result.lastInsertRowid),
      kind,
      impact,
    })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/optimization/report failed')
    return NextResponse.json({ error: 'Failed to record optimization' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
