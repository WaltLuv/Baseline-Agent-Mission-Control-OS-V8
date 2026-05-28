/**
 * Baseline OS — Notion Connector (Layer 3: Business Knowledge Base)
 *
 * Real, optional, server-only ingestion against the customer's Notion
 * workspace. Reads pages they have explicitly shared with the
 * integration token. Workspace-scoped — never crosses tenants.
 *
 * Customer-facing UI name: "Business Knowledge Base".
 *
 * Design:
 *   - No SDK — direct REST calls to api.notion.com/v1.
 *   - Auth via NOTION_TOKEN (internal integration token). OAuth path is
 *     deferred to the production roadmap.
 *   - Pulls page list from `databases/{db}/query` if NOTION_DATABASE_ID is
 *     provided, else falls back to `search` for pages.
 *   - Writes `kind='operator-memory.notion'` to `workforce_memory` so the
 *     briefing/optimization/AI workforce surfaces it like Obsidian.
 */
import { createHash } from 'node:crypto'
import type { Database } from 'better-sqlite3'

export interface NotionSyncResult {
  ok: boolean
  reason?: 'missing-config' | 'fetch-failed' | 'no-pages'
  pagesIndexed: number
  chunksWritten: number
  chunksUnchanged: number
  chunksRemoved: number
}

interface NotionEnv {
  token: string
  databaseId: string | null
}

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'openai', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'stripe', re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: 'aws', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github', re: /\bghp_[A-Za-z0-9]{30,}\b/g },
]
function redact(text: string): string {
  return SECRET_PATTERNS.reduce((acc, { name, re }) => acc.replace(re, `[redacted:${name}]`), text)
}

function readEnv(): NotionEnv | null {
  const token = process.env.NOTION_TOKEN
  if (!token) return null
  return {
    token,
    databaseId: process.env.NOTION_DATABASE_ID || null,
  }
}

function ensureMemoryTable(db: Database) {
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
    CREATE INDEX IF NOT EXISTS idx_workforce_memory_kind ON workforce_memory(workspace_id, kind, created_at DESC);
  `)
  try { db.exec(`ALTER TABLE workforce_memory ADD COLUMN content_hash TEXT`) } catch { /* exists */ }
}

function chunkHash(content: string, rationale: string): string {
  return createHash('sha256').update(`${rationale}\n${content}`).digest('hex').slice(0, 32)
}

const NOTION_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
})

interface NotionPageRef {
  id: string
  title: string
  url: string
}

async function listPages(env: NotionEnv): Promise<NotionPageRef[]> {
  if (env.databaseId) {
    const r = await fetch(`https://api.notion.com/v1/databases/${env.databaseId}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS(env.token),
      body: JSON.stringify({ page_size: 25 }),
    })
    if (!r.ok) throw new Error(`notion db ${r.status}`)
    const j = (await r.json()) as { results: Array<{ id: string; url: string; properties: Record<string, unknown> }> }
    return j.results.map((p) => ({
      id: p.id,
      url: p.url,
      title: titleFromProperties(p.properties) || '(untitled)',
    }))
  }
  // Search for top-level pages shared with the integration.
  const r = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: NOTION_HEADERS(env.token),
    body: JSON.stringify({ filter: { value: 'page', property: 'object' }, page_size: 25 }),
  })
  if (!r.ok) throw new Error(`notion search ${r.status}`)
  const j = (await r.json()) as { results: Array<{ id: string; url: string; properties?: Record<string, unknown>; parent?: { type?: string } }> }
  return j.results.map((p) => ({ id: p.id, url: p.url, title: titleFromProperties(p.properties ?? {}) || '(untitled)' }))
}

function titleFromProperties(properties: Record<string, unknown>): string | null {
  for (const v of Object.values(properties)) {
    const obj = v as { type?: string; title?: Array<{ plain_text?: string }> }
    if (obj?.type === 'title' && Array.isArray(obj.title)) {
      return obj.title.map((t) => t.plain_text ?? '').join('').slice(0, 200) || null
    }
  }
  return null
}

async function getPageBlocks(env: NotionEnv, pageId: string): Promise<string> {
  const r = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`, {
    headers: NOTION_HEADERS(env.token),
  })
  if (!r.ok) return ''
  const j = (await r.json()) as { results: Array<Record<string, unknown>> }
  return j.results
    .map((b) => extractBlockText(b))
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000)
}

function extractBlockText(block: Record<string, unknown>): string {
  const type = block.type as string
  const data = block[type] as { rich_text?: Array<{ plain_text?: string }> } | undefined
  if (!data?.rich_text) return ''
  return data.rich_text.map((t) => t.plain_text ?? '').join('').trim()
}

function chunk(text: string, maxLen = 600, maxChunks = 8): string[] {
  const paragraphs = text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  for (const p of paragraphs) {
    if (p.length <= maxLen) {
      out.push(p)
    } else {
      const sentences = p.split(/(?<=[.!?])\s+/)
      let buf = ''
      for (const s of sentences) {
        if ((buf + ' ' + s).length > maxLen) {
          if (buf) out.push(buf.trim())
          buf = s
        } else {
          buf = buf ? `${buf} ${s}` : s
        }
      }
      if (buf) out.push(buf.trim())
    }
    if (out.length >= maxChunks) break
  }
  return out.slice(0, maxChunks)
}

export async function ingestNotion(
  db: Database,
  workspaceId: number,
): Promise<NotionSyncResult> {
  ensureMemoryTable(db)
  const env = readEnv()
  if (!env) return { ok: false, reason: 'missing-config', pagesIndexed: 0, chunksWritten: 0, chunksUnchanged: 0, chunksRemoved: 0 }

  let pages: NotionPageRef[]
  try {
    pages = await listPages(env)
  } catch {
    return { ok: false, reason: 'fetch-failed', pagesIndexed: 0, chunksWritten: 0, chunksUnchanged: 0, chunksRemoved: 0 }
  }
  if (pages.length === 0) {
    return { ok: false, reason: 'no-pages', pagesIndexed: 0, chunksWritten: 0, chunksUnchanged: 0, chunksRemoved: 0 }
  }

  // Load existing hashes for delta diffing — mirror the Obsidian pattern.
  // Stable IDs across syncs preserves trace deep-links + citation references.
  const existing = db
    .prepare(
      `SELECT id, content_hash FROM workforce_memory
       WHERE workspace_id = ? AND kind = 'operator-memory.notion'`,
    )
    .all(workspaceId) as Array<{ id: number; content_hash: string | null }>
  const existingByHash = new Map<string, number>()
  const legacyIds: number[] = []
  for (const r of existing) {
    if (r.content_hash) existingByHash.set(r.content_hash, r.id)
    else legacyIds.push(r.id)
  }
  // One-time legacy migration so pre-hash rows repopulate cleanly.
  if (legacyIds.length > 0) {
    const placeholders = legacyIds.map(() => '?').join(',')
    db.prepare(
      `DELETE FROM workforce_memory WHERE workspace_id = ? AND id IN (${placeholders})`,
    ).run(workspaceId, ...legacyIds)
  }

  const insert = db.prepare(
    `INSERT INTO workforce_memory
       (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, value_impact_cents, created_at, content_hash)
     VALUES (?, NULL, NULL, 'operator-memory.notion', ?, ?, ?, 0, ?, ?)`,
  )

  const now = Math.floor(Date.now() / 1000)
  let chunksWritten = 0
  let chunksUnchanged = 0
  let pagesIndexed = 0
  const seenHashes = new Set<string>()
  for (const page of pages) {
    let body = ''
    try {
      body = await getPageBlocks(env, page.id)
    } catch {
      continue
    }
    const chunks = chunk(redact(body))
    if (chunks.length === 0) continue
    pagesIndexed += 1
    const rationale = `Source: Notion · ${page.title} · ${page.url}`
    for (const c of chunks) {
      const hash = chunkHash(c, rationale)
      seenHashes.add(hash)
      if (existingByHash.has(hash)) {
        chunksUnchanged += 1
        continue
      }
      insert.run(workspaceId, page.title, c, rationale, now - chunksWritten, hash)
      chunksWritten += 1
    }
  }

  // Remove rows whose hash is no longer present (page deleted or paragraph removed).
  const toDelete: number[] = []
  for (const [hash, id] of existingByHash) {
    if (!seenHashes.has(hash)) toDelete.push(id)
  }
  let chunksRemoved = 0
  if (toDelete.length > 0) {
    const placeholders = toDelete.map(() => '?').join(',')
    const r = db
      .prepare(`DELETE FROM workforce_memory WHERE workspace_id = ? AND id IN (${placeholders})`)
      .run(workspaceId, ...toDelete)
    chunksRemoved = Number(r.changes ?? 0)
  }

  return { ok: true, pagesIndexed, chunksWritten, chunksUnchanged, chunksRemoved }
}

export function notionConfigured(): boolean {
  return readEnv() !== null
}
