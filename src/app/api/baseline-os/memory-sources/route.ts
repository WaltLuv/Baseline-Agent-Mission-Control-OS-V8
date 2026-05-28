import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

/**
 * Baseline OS — Memory Source Registry
 *
 * Tracks the operator's connected memory sources across the 3 brain layers:
 *   Layer 1 — Operator Memory       (Obsidian)
 *   Layer 2 — Knowledge Intelligence (Pinecone)
 *   Layer 3 — Business Knowledge Base (Notion)
 *   Layer 0 — Internal (Mission Control built-in workforce_memory)
 *
 * GET  /api/baseline-os/memory-sources     list workspace connectors
 * POST /api/baseline-os/memory-sources     register or update a connector
 *
 * SECURITY:
 *   - Workspace-scoped — never cross-leaks.
 *   - Credentials are NOT stored here. Connectors only carry metadata;
 *     actual secrets (Pinecone API key, Notion OAuth, Obsidian vault path)
 *     live in server-side env or workspace vault, redacted before any
 *     index/sync.
 *   - Operator-only mutations (admin / operator role).
 */

const KNOWN_TYPES = ['obsidian', 'pinecone', 'notion', 'internal'] as const
type SourceType = (typeof KNOWN_TYPES)[number]

function ensureTable(db: ReturnType<typeof getDatabase>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected',
      last_sync_at INTEGER,
      document_count INTEGER NOT NULL DEFAULT 0,
      embedding_count INTEGER NOT NULL DEFAULT 0,
      permission_scope TEXT NOT NULL DEFAULT 'workspace',
      visibility TEXT NOT NULL DEFAULT 'operator-only',
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(workspace_id, source_type)
    );
    CREATE INDEX IF NOT EXISTS idx_memory_sources_workspace ON memory_sources(workspace_id);
  `)
}

function seedDefaults(db: ReturnType<typeof getDatabase>, workspaceId: number) {
  const now = Math.floor(Date.now() / 1000)
  const defaults: Array<{ type: SourceType; name: string }> = [
    { type: 'internal', name: 'Internal Workforce Memory' },
    { type: 'obsidian', name: 'Operator Memory (Obsidian)' },
    { type: 'pinecone', name: 'Knowledge Intelligence (Pinecone)' },
    { type: 'notion', name: 'Business Knowledge Base (Notion)' },
  ]
  for (const d of defaults) {
    db.prepare(
      `INSERT OR IGNORE INTO memory_sources (workspace_id, source_type, display_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(workspaceId, d.type, d.name, d.type === 'internal' ? 'connected' : 'disconnected', now, now)
  }
  // Seed the internal row's document_count to the workforce_memory count.
  try {
    const c = db.prepare(`SELECT COUNT(*) c FROM workforce_memory WHERE workspace_id = ?`).get(workspaceId) as { c: number } | undefined
    db.prepare(
      `UPDATE memory_sources SET document_count = ?, last_sync_at = ?, updated_at = ? WHERE workspace_id = ? AND source_type = 'internal'`,
    ).run(Number(c?.c || 0), now, now, workspaceId)
  } catch {
    // workforce_memory may not exist yet — skip.
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()
  ensureTable(db)
  seedDefaults(db, workspaceId)
  const rows = db.prepare(
    `SELECT id, source_type, display_name, status, last_sync_at, document_count, embedding_count, permission_scope, visibility, metadata, created_at, updated_at
     FROM memory_sources WHERE workspace_id = ? ORDER BY source_type`,
  ).all(workspaceId) as Array<{
    id: number
    source_type: SourceType
    display_name: string
    status: string
    last_sync_at: number | null
    document_count: number
    embedding_count: number
    permission_scope: string
    visibility: string
    metadata: string | null
    created_at: number
    updated_at: number
  }>
  return NextResponse.json({
    sources: rows.map((r) => ({
      id: r.id,
      sourceType: r.source_type,
      displayName: r.display_name,
      status: r.status,
      lastSyncAt: r.last_sync_at,
      documentCount: r.document_count,
      embeddingCount: r.embedding_count,
      permissionScope: r.permission_scope,
      visibility: r.visibility,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: { sourceType?: SourceType; action?: 'connect' | 'disconnect' | 'resync'; metadata?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.sourceType || !KNOWN_TYPES.includes(body.sourceType)) {
    return NextResponse.json({ error: 'Unknown sourceType' }, { status: 400 })
  }

  const db = getDatabase()
  ensureTable(db)
  const now = Math.floor(Date.now() / 1000)
  const status = body.action === 'connect' || body.action === 'resync' ? 'connected' : 'disconnected'
  // SECURITY: we explicitly do NOT store raw credentials here. Only safe
  // metadata (vault path / index name / page id) — secrets stay in env or
  // workspace vault and are accessed only at sync time.
  const safeMetadata = body.metadata ? JSON.stringify(redactSecrets(body.metadata)) : null
  db.prepare(
    `INSERT INTO memory_sources (workspace_id, source_type, display_name, status, last_sync_at, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, source_type) DO UPDATE SET status = excluded.status, metadata = excluded.metadata, last_sync_at = excluded.last_sync_at, updated_at = excluded.updated_at`,
  ).run(
    workspaceId,
    body.sourceType,
    defaultDisplay(body.sourceType),
    status,
    body.action === 'resync' || body.action === 'connect' ? now : null,
    safeMetadata,
    now,
    now,
  )
  return NextResponse.json({ ok: true, status })
}

function defaultDisplay(type: SourceType): string {
  switch (type) {
    case 'obsidian': return 'Operator Memory (Obsidian)'
    case 'pinecone': return 'Knowledge Intelligence (Pinecone)'
    case 'notion':   return 'Business Knowledge Base (Notion)'
    case 'internal': return 'Internal Workforce Memory'
  }
}

const SECRET_KEYS = ['apiKey', 'api_key', 'token', 'secret', 'password', 'access_token']
function redactSecrets(m: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(m)) {
    if (SECRET_KEYS.includes(k)) {
      out[k] = '[redacted]'
    } else {
      out[k] = v
    }
  }
  return out
}
