/**
 * Understand API — durable decision-context entries.
 *
 *   GET    /api/understand[?topic=…&status=…&include_archived=1]
 *   POST   /api/understand            { topic, question, conclusion, evidence_md?, confidence?, tags? }
 *   PATCH  /api/understand?id=N       { topic?, question?, conclusion?, evidence_md?,
 *                                       confidence?, tags?, status?, supersedes_id? }
 *   DELETE /api/understand?id=N       — archive (soft-delete)
 *
 * "Why we chose X" persistence. Each entry captures a question + the
 * operator's conclusion + the evidence behind it + a confidence score.
 * Future entries can supersede earlier ones via the `supersedes_id`
 * patch, which flips the older entry's status to `superseded`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { mutationLimiter } from '@/lib/rate-limit'

interface UnderstandRow {
  id: number
  workspace_id: number
  author_user_id: number | null
  topic: string
  question: string
  conclusion: string
  evidence_md: string | null
  confidence: number
  tags_json: string | null
  status: 'live' | 'superseded' | 'archived'
  superseded_by: number | null
  created_at: number
  updated_at: number
}

const ALLOWED_STATUS = new Set(['live', 'superseded', 'archived'])
const TOPIC_MAX = 160
const QUESTION_MAX = 1000
const CONCLUSION_MAX = 4000
const EVIDENCE_MAX = 200_000

function clampConfidence(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

function parseTags(body: { tags?: unknown }): string[] | null {
  if (!Array.isArray(body.tags)) return null
  return body.tags
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 64)
    .slice(0, 24)
}

function rowToWire(row: UnderstandRow) {
  let tags: string[] = []
  if (row.tags_json) {
    try {
      const v = JSON.parse(row.tags_json)
      if (Array.isArray(v)) tags = v.filter((x): x is string => typeof x === 'string')
    } catch { /* ignore */ }
  }
  return { ...row, tags }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const url = new URL(request.url)
  const topic = url.searchParams.get('topic')
  const status = url.searchParams.get('status')
  const includeArchived = url.searchParams.get('include_archived') === '1'

  const db = getDatabase()
  const clauses: string[] = ['workspace_id = ?']
  const args: unknown[] = [workspaceId]
  if (topic) {
    clauses.push('topic = ?')
    args.push(topic)
  }
  if (status) {
    clauses.push('status = ?')
    args.push(status)
  } else if (!includeArchived) {
    clauses.push("status != 'archived'")
  }
  const rows = db.prepare(
    `SELECT * FROM understand_entries WHERE ${clauses.join(' AND ')} ORDER BY status = 'live' DESC, updated_at DESC LIMIT 500`,
  ).all(...args) as UnderstandRow[]

  // Topic tally for the UI's tab strip.
  const tallyRows = db.prepare(
    `SELECT topic, COUNT(*) AS n FROM understand_entries WHERE workspace_id = ? AND status = 'live' GROUP BY topic ORDER BY n DESC LIMIT 50`,
  ).all(workspaceId) as Array<{ topic: string; n: number }>

  return NextResponse.json({
    entries: rows.map(rowToWire),
    topics: tallyRows.map((r) => ({ topic: r.topic, count: r.n })),
  })
}

export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const conclusion = typeof body.conclusion === 'string' ? body.conclusion.trim() : ''
  if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })
  if (!conclusion) return NextResponse.json({ error: 'conclusion required' }, { status: 400 })
  if (topic.length > TOPIC_MAX) return NextResponse.json({ error: `topic too long (${TOPIC_MAX} char max)` }, { status: 400 })
  if (question.length > QUESTION_MAX) return NextResponse.json({ error: `question too long (${QUESTION_MAX} char max)` }, { status: 400 })
  if (conclusion.length > CONCLUSION_MAX) return NextResponse.json({ error: `conclusion too long (${CONCLUSION_MAX} char max)` }, { status: 400 })
  const evidence = typeof body.evidence_md === 'string' ? body.evidence_md : null
  if (evidence && evidence.length > EVIDENCE_MAX) return NextResponse.json({ error: 'evidence too long' }, { status: 400 })

  const confidence = clampConfidence(body.confidence)
  const tags = parseTags(body) ?? []

  const db = getDatabase()
  const res = db.prepare(
    `INSERT INTO understand_entries (workspace_id, author_user_id, topic, question, conclusion, evidence_md, confidence, tags_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  ).run(workspaceId, auth.user.id, topic, question, conclusion, evidence, confidence, JSON.stringify(tags))
  const id = Number(res.lastInsertRowid)
  const row = db.prepare(`SELECT * FROM understand_entries WHERE id = ?`).get(id) as UnderstandRow
  return NextResponse.json({ entry: rowToWire(row) }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id || !Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const db = getDatabase()
  const existing = db.prepare(`SELECT * FROM understand_entries WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as UnderstandRow | undefined
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updates: string[] = []
  const args: unknown[] = []
  for (const k of ['topic', 'question', 'conclusion'] as const) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== 'string') return NextResponse.json({ error: `${k} must be a string` }, { status: 400 })
      const v = (body[k] as string).trim()
      if (!v) return NextResponse.json({ error: `${k} cannot be empty` }, { status: 400 })
      const max = k === 'topic' ? TOPIC_MAX : k === 'question' ? QUESTION_MAX : CONCLUSION_MAX
      if (v.length > max) return NextResponse.json({ error: `${k} too long` }, { status: 400 })
      updates.push(`${k} = ?`)
      args.push(v)
    }
  }
  if (body.evidence_md !== undefined) {
    const v = body.evidence_md === null ? null : String(body.evidence_md)
    if (v && v.length > EVIDENCE_MAX) return NextResponse.json({ error: 'evidence too long' }, { status: 400 })
    updates.push('evidence_md = ?')
    args.push(v)
  }
  if (body.confidence !== undefined) {
    updates.push('confidence = ?')
    args.push(clampConfidence(body.confidence))
  }
  if (body.tags !== undefined) {
    const tags = parseTags(body) ?? []
    updates.push('tags_json = ?')
    args.push(JSON.stringify(tags))
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !ALLOWED_STATUS.has(body.status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    updates.push('status = ?')
    args.push(body.status)
  }

  // Supersede flow: the patched entry becomes the canonical one for that
  // topic; the older entry referenced by `supersedes_id` is flipped to
  // status='superseded' and its `superseded_by` is pointed at this entry.
  let supersedesId: number | null = null
  if (body.supersedes_id !== undefined && body.supersedes_id !== null) {
    const n = Number(body.supersedes_id)
    if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: 'invalid supersedes_id' }, { status: 400 })
    supersedesId = n
  }

  if (updates.length === 0 && supersedesId === null) return NextResponse.json({ entry: rowToWire(existing) })

  if (updates.length > 0) {
    updates.push('updated_at = unixepoch()')
    args.push(id, workspaceId)
    db.prepare(`UPDATE understand_entries SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...args)
  }
  if (supersedesId !== null) {
    db.prepare(
      `UPDATE understand_entries SET status = 'superseded', superseded_by = ?, updated_at = unixepoch() WHERE id = ? AND workspace_id = ?`,
    ).run(supersedesId, id, workspaceId)
  }
  const updated = db.prepare(`SELECT * FROM understand_entries WHERE id = ?`).get(id) as UnderstandRow
  return NextResponse.json({ entry: rowToWire(updated) })
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
    `UPDATE understand_entries SET status = 'archived', updated_at = unixepoch() WHERE id = ? AND workspace_id = ?`,
  ).run(id, workspaceId)
  if (res.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, archived: id })
}
