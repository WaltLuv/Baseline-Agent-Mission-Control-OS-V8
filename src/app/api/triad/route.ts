/**
 * Triad Council API — decisions resolved by 3-model voting.
 *
 *   GET  /api/triad[?status=open|voting|resolved|...]
 *        → { decisions: [{ ...row, votes: [...] }] }
 *
 *   POST /api/triad
 *        body: { prompt, summary?, context_md? }
 *        → { decision: { ... } } — status defaults to 'voting'
 *
 *   POST /api/triad?id=N&action=vote
 *        body: { model_id, model_label?, vote, rationale?, confidence? }
 *        → { vote: { ... }, decision: { ... } }
 *        Idempotent on (decision_id, model_id) via UNIQUE — repeated POSTs
 *        return the existing row.
 *
 *   POST /api/triad?id=N&action=resolve
 *        body: { outcome }
 *        → { decision: { ... } } — flips status to 'resolved'
 *
 * Honest stance: this endpoint RECORDS votes. The actual model calls
 * happen in upstream agent runtimes; the cloud surface just persists +
 * tallies. The page renders only real DB rows; no synthetic votes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { mutationLimiter } from '@/lib/rate-limit'

interface DecisionRow {
  id: number
  workspace_id: number
  author_user_id: number | null
  prompt: string
  summary: string | null
  context_md: string | null
  status: 'open' | 'voting' | 'resolved' | 'vetoed' | 'archived'
  resolved_outcome: string | null
  resolved_at: number | null
  created_at: number
  updated_at: number
}

interface VoteRow {
  id: number
  decision_id: number
  model_id: string
  model_label: string | null
  vote: 'approve' | 'reject' | 'abstain' | 'veto'
  rationale: string | null
  confidence: number | null
  created_at: number
}

const VOTE_OPTIONS = new Set(['approve', 'reject', 'abstain', 'veto'])
const PROMPT_MAX = 2000
const RATIONALE_MAX = 4000
const CONTEXT_MAX = 50_000

function decisionWithVotes(row: DecisionRow) {
  const db = getDatabase()
  const votes = db.prepare(
    `SELECT * FROM triad_votes WHERE decision_id = ? ORDER BY created_at ASC`,
  ).all(row.id) as VoteRow[]
  const tallies = { approve: 0, reject: 0, abstain: 0, veto: 0 }
  for (const v of votes) tallies[v.vote] += 1
  return { ...row, votes, tallies }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const url = new URL(request.url)
  const status = url.searchParams.get('status')

  const db = getDatabase()
  let rows: DecisionRow[]
  if (status) {
    rows = db.prepare(
      `SELECT * FROM triad_decisions WHERE workspace_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 200`,
    ).all(workspaceId, status) as DecisionRow[]
  } else {
    rows = db.prepare(
      `SELECT * FROM triad_decisions WHERE workspace_id = ? AND status != 'archived' ORDER BY status = 'resolved', updated_at DESC LIMIT 200`,
    ).all(workspaceId) as DecisionRow[]
  }
  return NextResponse.json({ decisions: rows.map(decisionWithVotes) })
}

export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const url = new URL(request.url)
  const action = url.searchParams.get('action')
  const id = Number(url.searchParams.get('id') ?? 0)

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const db = getDatabase()

  // ── Vote action — append (or fetch existing) on a decision ────────
  if (action === 'vote') {
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const decision = db.prepare(`SELECT * FROM triad_decisions WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as DecisionRow | undefined
    if (!decision) return NextResponse.json({ error: 'decision not found' }, { status: 404 })

    const modelId = typeof body.model_id === 'string' ? body.model_id.trim() : ''
    const modelLabel = typeof body.model_label === 'string' ? body.model_label.trim() : null
    const vote = typeof body.vote === 'string' ? body.vote : ''
    const rationale = typeof body.rationale === 'string' ? body.rationale : null
    const confidence = typeof body.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(body.confidence))) : null

    if (!modelId) return NextResponse.json({ error: 'model_id required' }, { status: 400 })
    if (!VOTE_OPTIONS.has(vote)) return NextResponse.json({ error: 'invalid vote' }, { status: 400 })
    if (rationale && rationale.length > RATIONALE_MAX) return NextResponse.json({ error: 'rationale too long' }, { status: 400 })

    const existing = db.prepare(`SELECT * FROM triad_votes WHERE decision_id = ? AND model_id = ?`).get(id, modelId) as VoteRow | undefined
    if (existing) {
      return NextResponse.json({ vote: existing, decision: decisionWithVotes(decision), idempotent: true })
    }
    db.prepare(
      `INSERT INTO triad_votes (decision_id, model_id, model_label, vote, rationale, confidence) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, modelId, modelLabel, vote, rationale, confidence)
    db.prepare(`UPDATE triad_decisions SET updated_at = unixepoch() WHERE id = ?`).run(id)
    const refreshed = db.prepare(`SELECT * FROM triad_decisions WHERE id = ?`).get(id) as DecisionRow
    const newVote = db.prepare(`SELECT * FROM triad_votes WHERE decision_id = ? AND model_id = ?`).get(id, modelId) as VoteRow
    return NextResponse.json({ vote: newVote, decision: decisionWithVotes(refreshed) }, { status: 201 })
  }

  // ── Resolve action — flips a decision to 'resolved' with an outcome ──
  if (action === 'resolve') {
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const decision = db.prepare(`SELECT * FROM triad_decisions WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as DecisionRow | undefined
    if (!decision) return NextResponse.json({ error: 'decision not found' }, { status: 404 })
    const outcome = typeof body.outcome === 'string' ? body.outcome.trim() : ''
    if (!outcome) return NextResponse.json({ error: 'outcome required' }, { status: 400 })
    db.prepare(
      `UPDATE triad_decisions SET status = 'resolved', resolved_outcome = ?, resolved_at = unixepoch(), updated_at = unixepoch() WHERE id = ?`,
    ).run(outcome, id)
    const refreshed = db.prepare(`SELECT * FROM triad_decisions WHERE id = ?`).get(id) as DecisionRow
    return NextResponse.json({ decision: decisionWithVotes(refreshed) })
  }

  // ── Create decision ───────────────────────────────────────────────
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  if (prompt.length > PROMPT_MAX) return NextResponse.json({ error: `prompt too long (${PROMPT_MAX} char max)` }, { status: 400 })
  const summary = typeof body.summary === 'string' ? body.summary.trim() : null
  const contextMd = typeof body.context_md === 'string' ? body.context_md : null
  if (contextMd && contextMd.length > CONTEXT_MAX) return NextResponse.json({ error: 'context too long' }, { status: 400 })

  const res = db.prepare(
    `INSERT INTO triad_decisions (workspace_id, author_user_id, prompt, summary, context_md, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'voting', unixepoch(), unixepoch())`,
  ).run(workspaceId, auth.user.id, prompt, summary, contextMd)
  const newRow = db.prepare(`SELECT * FROM triad_decisions WHERE id = ?`).get(Number(res.lastInsertRowid)) as DecisionRow
  return NextResponse.json({ decision: decisionWithVotes(newRow) }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id || !Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getDatabase()
  const res = db.prepare(
    `UPDATE triad_decisions SET status = 'archived', updated_at = unixepoch() WHERE id = ? AND workspace_id = ?`,
  ).run(id, workspaceId)
  if (res.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, archived: id })
}
