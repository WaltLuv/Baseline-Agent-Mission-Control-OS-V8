#!/usr/bin/env node
/**
 * scripts/cleanup-legacy-skill-memory.mjs
 *
 * Backfills legacy `workforce_memory` rows whose title looks like
 *   "Skill installed: <Name>"
 * into the canonical slug form (matching the iteration-14 marketplace
 * write path). This eliminates the duplicate row in the Skill ROI
 * Leaderboard / Skills-Active Inventory without destroying history —
 * it only renames the `title` to the slug and stamps `kind` to
 * `skill-installed` (already the value for newly-written rows).
 *
 * Usage:
 *   node scripts/cleanup-legacy-skill-memory.mjs              # dry-run, prints what would change
 *   node scripts/cleanup-legacy-skill-memory.mjs --apply      # actually update rows
 *   DB_PATH=/path/to/db node scripts/cleanup-legacy-skill-memory.mjs --apply
 *
 * Idempotent — re-running the script is safe.
 */
import Database from 'better-sqlite3'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const apply = process.argv.includes('--apply')
const dbPath = process.env.DB_PATH || resolve(process.cwd(), '.data/mission-control.db')
if (!existsSync(dbPath)) {
  console.error(`✗ Database not found at ${dbPath}. Set DB_PATH or run from repo root.`)
  process.exit(1)
}
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const rows = db
  .prepare(
    `SELECT id, workspace_id, title
     FROM workforce_memory
     WHERE kind = 'skill-installed'
       AND (title LIKE 'Skill installed:%' OR title LIKE 'skill-installed-%')
     ORDER BY id ASC`,
  )
  .all()

if (!rows.length) {
  console.log('✓ No legacy skill-installed rows found. Nothing to do.')
  process.exit(0)
}

console.log(`Found ${rows.length} legacy rows.`)

// Build a name → slug map from existing workforce_skills so we can rename
// the legacy memory rows into the canonical slug that already has counters.
const lookupRows = db
  .prepare(`SELECT DISTINCT workspace_id, slug, LOWER(name) AS name_lc FROM workforce_skills`)
  .all()
const nameToSlug = new Map()
for (const r of lookupRows) {
  nameToSlug.set(`${r.workspace_id}::${r.name_lc}`, r.slug)
}

const updates = []
for (const r of rows) {
  let label = r.title
    .replace(/^Skill installed:\s*/i, '')
    .replace(/^skill-installed-/i, '')
    .trim()
  if (!label) continue
  // 1) prefer canonical slug from workforce_skills (name match)
  const canonical = nameToSlug.get(`${r.workspace_id}::${label.toLowerCase()}`)
  // 2) fall back to slugified label
  const slug = canonical ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  updates.push({ id: r.id, old: r.title, slug, workspaceId: r.workspace_id, canonical: !!canonical })
}

for (const u of updates.slice(0, 20)) {
  console.log(`  workspace=${u.workspaceId} id=${u.id} "${u.old}" → "${u.slug}"`)
}
if (updates.length > 20) console.log(`  …and ${updates.length - 20} more.`)

if (!apply) {
  console.log('\n(dry-run) Re-run with --apply to perform updates.')
  process.exit(0)
}

const stmt = db.prepare(`UPDATE workforce_memory SET title = ? WHERE id = ?`)
const tx = db.transaction(() => {
  for (const u of updates) stmt.run(u.slug, u.id)
})
tx()
console.log(`\n✓ Updated ${updates.length} rows.`)
