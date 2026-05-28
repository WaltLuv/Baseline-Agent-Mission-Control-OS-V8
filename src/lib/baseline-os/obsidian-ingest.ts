/**
 * Baseline OS — Obsidian Ingester (Layer 1: Operator Memory)
 *
 * Reads a markdown vault from disk, chunks the body, redacts known secret
 * patterns, and writes entries into `workforce_memory` with
 * `kind = 'operator-memory.obsidian'` so they show up in the Memory Feed
 * with a clear source badge and can be cited by the Executive Briefing.
 *
 * Iteration 17 — production-leaning hardening:
 *   - **content-hash idempotency**: re-sync only touches rows whose
 *     content actually changed. Existing audit IDs and trace deep-links
 *     are preserved.
 *   - **structured provenance**: the relative source path lives inside
 *     the rationale (`Source: Obsidian operator vault · path · #tags`)
 *     so the UI never has to parse the file system.
 *   - **workspace isolation**: every query carries `workspace_id`.
 *   - **secret redaction**: known credential patterns are stripped
 *     before chunking.
 *   - operator-only visibility (downstream UI gates on role).
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Database } from 'better-sqlite3'

export interface IngestSummary {
  vaultPath: string
  filesScanned: number
  filesIndexed: number
  chunksWritten: number
  chunksUnchanged: number
  chunksRemoved: number
  bytesRedacted: number
  startedAt: number
  finishedAt: number
}

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'openai', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'stripe', re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: 'aws', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github', re: /\bghp_[A-Za-z0-9]{30,}\b/g },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
]

function redactSecrets(text: string): { redacted: string; bytesRedacted: number } {
  let redacted = text
  let bytesRedacted = 0
  for (const { name, re } of SECRET_PATTERNS) {
    redacted = redacted.replace(re, (match) => {
      bytesRedacted += match.length
      return `[redacted:${name}]`
    })
  }
  return { redacted, bytesRedacted }
}

function walkMarkdown(dir: string, out: string[] = []): string[] {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name.startsWith('.') || name === 'node_modules' || name === 'private') continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      walkMarkdown(full, out)
    } else if (st.isFile() && /\.(md|markdown)$/i.test(name)) {
      out.push(full)
    }
  }
  return out
}

function extractTitle(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m)
  return (m ? m[1] : fallback).trim().slice(0, 120)
}

function extractTagsAndDate(content: string): { tags: string[]; isYesterday: boolean } {
  const tags: string[] = []
  const tagLine = content.match(/^>\s*Tags?:\s*(.+)$/m)
  if (tagLine) {
    for (const t of tagLine[1].split(/[·,\s]+/)) {
      const cleaned = t.replace(/[#`]/g, '').trim()
      if (cleaned) tags.push(cleaned)
    }
  }
  const dateLine = content.match(/^>\s*Date:\s*(.+)$/im)
  const isYesterday = !!dateLine && /yesterday/i.test(dateLine[1])
  return { tags, isYesterday }
}

/**
 * Chunk the body into operator-friendly paragraphs (≤ 600 chars each)
 * stripped of frontmatter quote-blocks.
 */
function chunkBody(content: string): string[] {
  const body = content
    // strip leading "> Tags:" / "> Owner:" frontmatter quote lines
    .replace(/^(>[^\n]*\n?)+/m, '')
    .replace(/\r\n/g, '\n')
    .trim()
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  for (const p of paragraphs) {
    if (p.length <= 600) {
      chunks.push(p)
    } else {
      // long paragraph — break on sentence boundary
      const sentences = p.split(/(?<=[.!?])\s+/)
      let buf = ''
      for (const s of sentences) {
        if ((buf + ' ' + s).length > 600) {
          if (buf) chunks.push(buf.trim())
          buf = s
        } else {
          buf = buf ? `${buf} ${s}` : s
        }
      }
      if (buf) chunks.push(buf.trim())
    }
  }
  return chunks.slice(0, 12) // demo-grade cap per file
}

function ensureWorkforceMemoryTable(db: Database) {
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
  // content_hash column is added once and ignored when already present.
  try { db.exec(`ALTER TABLE workforce_memory ADD COLUMN content_hash TEXT`) } catch { /* exists */ }
}

function chunkHash(content: string, rationale: string): string {
  return createHash('sha256').update(`${rationale}\n${content}`).digest('hex').slice(0, 32)
}

/**
 * Ingest a vault into `workforce_memory` for one workspace.
 * Idempotent: prior obsidian rows for this workspace are dropped first.
 */
/**
 * Delta-aware ingest. Re-syncs ONLY changed content:
 *   - Hashes every (rationale, chunk) pair the vault currently produces
 *   - Loads the existing hash set for this workspace
 *   - INSERTs rows whose hash is new
 *   - DELETEs rows whose hash is no longer present (file deleted / chunk removed)
 *   - Leaves unchanged rows alone — their IDs stay stable so trace
 *     deep-links and citation references continue to work.
 *
 * Always workspace-scoped. Operator-only visibility is enforced
 * downstream at the UI layer.
 */
export function ingestObsidianVault(
  db: Database,
  workspaceId: number,
  vaultPath: string,
): IngestSummary {
  ensureWorkforceMemoryTable(db)

  const startedAt = Math.floor(Date.now() / 1000)
  const yesterday = startedAt - 26 * 60 * 60 // ~yesterday

  // Load the current set of hashes for this workspace.
  const existingRows = db
    .prepare(
      `SELECT id, content_hash FROM workforce_memory
       WHERE workspace_id = ? AND kind = 'operator-memory.obsidian'`,
    )
    .all(workspaceId) as Array<{ id: number; content_hash: string | null }>
  const existingByHash = new Map<string, number>()
  const legacyIds: number[] = []
  for (const r of existingRows) {
    if (r.content_hash) existingByHash.set(r.content_hash, r.id)
    else legacyIds.push(r.id)
  }
  // Legacy rows (pre-hash) get wiped exactly once so the next pass can
  // populate the hash column. Subsequent syncs will be pure deltas.
  if (legacyIds.length > 0) {
    const placeholders = legacyIds.map(() => '?').join(',')
    db.prepare(
      `DELETE FROM workforce_memory WHERE workspace_id = ? AND id IN (${placeholders})`,
    ).run(workspaceId, ...legacyIds)
  }

  const files = walkMarkdown(vaultPath)
  let filesIndexed = 0
  let chunksWritten = 0
  let chunksUnchanged = 0
  let bytesRedactedTotal = 0

  const insert = db.prepare(
    `INSERT INTO workforce_memory
       (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, value_impact_cents, created_at, content_hash)
     VALUES (?, NULL, NULL, 'operator-memory.obsidian', ?, ?, ?, 0, ?, ?)`,
  )

  const seenHashes = new Set<string>()

  for (const file of files) {
    let raw = ''
    try {
      raw = readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    const { redacted, bytesRedacted } = redactSecrets(raw)
    bytesRedactedTotal += bytesRedacted
    const title = extractTitle(redacted, relative(vaultPath, file))
    const { tags, isYesterday } = extractTagsAndDate(redacted)
    const chunks = chunkBody(redacted)
    if (chunks.length === 0) continue
    filesIndexed += 1

    const rel = relative(vaultPath, file)
    const tagSuffix = tags.length > 0 ? ` · #${tags.join(' #')}` : ''
    let i = 0
    for (const chunk of chunks) {
      const rationale =
        `Source: Obsidian operator vault · ${rel}${tagSuffix}` +
        (isYesterday ? ' · noted yesterday' : '')
      const hash = chunkHash(chunk, rationale)
      seenHashes.add(hash)
      if (existingByHash.has(hash)) {
        chunksUnchanged += 1
        i += 1
        continue
      }
      const createdAt = isYesterday ? yesterday + chunksWritten * 60 : startedAt - chunksWritten
      insert.run(workspaceId, title, chunk, rationale, createdAt, hash)
      chunksWritten += 1
      i += 1
    }
  }

  // Remove chunks whose hash is no longer present (file or paragraph deleted).
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

  return {
    vaultPath,
    filesScanned: files.length,
    filesIndexed,
    chunksWritten,
    chunksUnchanged,
    chunksRemoved,
    bytesRedacted: bytesRedactedTotal,
    startedAt,
    finishedAt: Math.floor(Date.now() / 1000),
  }
}

/**
 * Resolve the Obsidian vault path from env, with a built-in demo fallback
 * so the demo conversion pass works out of the box.
 */
export function resolveObsidianVaultPath(): { path: string; isDemoVault: boolean } | null {
  const fromEnv = process.env.OBSIDIAN_VAULT_PATH
  if (fromEnv) return { path: fromEnv, isDemoVault: false }
  // Demo-mode fallback so the sales motion works without configuring a real vault.
  const demoVault = '/app/.demo-obsidian'
  try {
    const st = statSync(demoVault)
    if (st.isDirectory()) return { path: demoVault, isDemoVault: true }
  } catch {
    // not present
  }
  return null
}

/**
 * Count obsidian memory entries created within the last `withinSec` seconds.
 * Used by the briefing to decide whether to surface a citation block.
 */
export function recentObsidianCitations(
  db: Database,
  workspaceId: number,
  withinSec: number,
  limit = 3,
): Array<{ id: number; title: string; rationale: string | null; created_at: number }> {
  ensureWorkforceMemoryTable(db)
  const cutoff = Math.floor(Date.now() / 1000) - withinSec
  return db
    .prepare(
      `SELECT id, title, rationale, created_at
       FROM workforce_memory
       WHERE workspace_id = ? AND kind = 'operator-memory.obsidian' AND created_at >= ?
       GROUP BY title
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(workspaceId, cutoff, limit) as Array<{
    id: number
    title: string
    rationale: string | null
    created_at: number
  }>
}
