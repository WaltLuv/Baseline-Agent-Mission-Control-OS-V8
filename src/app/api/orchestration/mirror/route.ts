/**
 * POST /api/orchestration/mirror
 *
 * Mirror ingest endpoint. Baseline OS posts batches of kanban events
 * here; cloud appends each event to orchestration_events with the
 * caller-declared source (baseline-local or maestro-import) and dedupes
 * via UNIQUE(workspace_id, source, external_id).
 *
 * Auth: admin session OR agent-scoped API key whose workspace matches.
 * Walt's rule: cloud does NOT trust the caller's workspace claim — we
 * use the auth's workspace_id.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { ingestMirrorBatch, type IncomingEvent } from '@/lib/orchestration/mirror'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as {
    source?: 'baseline-local' | 'maestro-import'
    events?: IncomingEvent[]
  }
  const source = body.source ?? 'baseline-local'
  if (source !== 'baseline-local' && source !== 'maestro-import') {
    return NextResponse.json({ error: 'bad_source' }, { status: 400 })
  }
  if (!Array.isArray(body.events)) {
    return NextResponse.json({ error: 'events_required' }, { status: 400 })
  }
  if (body.events.length === 0) {
    return NextResponse.json({ accepted: 0, duplicates: 0, proofs: 0, errors: [] })
  }

  const result = ingestMirrorBatch({
    workspaceId: auth.user.workspace_id,
    source,
    events: body.events,
    userId: auth.user.id > 0 ? auth.user.id : null,
  })
  return NextResponse.json(result)
}
