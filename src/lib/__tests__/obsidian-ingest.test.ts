/**
 * Obsidian ingester — unit tests for the chunking, secret redaction, and
 * citation lookup logic. We don't spin up a real DB here; the ingester's
 * pure functions live behind small helpers exercised via the public API
 * in the integration smoke pass.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { ingestObsidianVault, recentObsidianCitations } from '@/lib/baseline-os/obsidian-ingest'

function freshDb() {
  const db = new Database(':memory:')
  return db
}

function freshVault(): string {
  const dir = mkdtempSync(join(tmpdir(), 'obsidian-test-'))
  return dir
}

describe('obsidian ingester', () => {
  it('ingests markdown files and writes chunked memory rows', () => {
    const vault = freshVault()
    writeFileSync(
      join(vault, 'doctrine.md'),
      `# Q1 Doctrine\n\n> Tags: doctrine · q1\n\nFollow-ups older than 48h are revenue leaks.\n\nNever file without reconciliation.`,
    )
    writeFileSync(
      join(vault, 'sop.md'),
      `# SOP — outreach\n\n> Date: yesterday\n\nCadence: T+0, T+72h, T+7d.`,
    )
    const db = freshDb()
    const summary = ingestObsidianVault(db, 1, vault)
    expect(summary.filesScanned).toBe(2)
    expect(summary.filesIndexed).toBe(2)
    expect(summary.chunksWritten).toBeGreaterThanOrEqual(3)

    const rows = db
      .prepare(`SELECT title, detail, rationale FROM workforce_memory WHERE workspace_id = 1 AND kind = 'operator-memory.obsidian' ORDER BY id`)
      .all() as Array<{ title: string; detail: string; rationale: string }>
    expect(rows[0].title).toContain('Q1 Doctrine')
    expect(rows.some((r) => /noted yesterday/.test(r.rationale))).toBe(true)
    expect(rows.some((r) => /Source: Obsidian operator vault/.test(r.rationale))).toBe(true)
  })

  it('redacts known secret patterns from ingested content', () => {
    const vault = freshVault()
    writeFileSync(
      join(vault, 'leaky.md'),
      `# Leaky\n\nAPI Key: sk-1234567890ABCDEFGHIJKL\n\nGitHub: ghp_abcdefghijklmnopqrstuvwxyz0123456789`,
    )
    const db = freshDb()
    const summary = ingestObsidianVault(db, 7, vault)
    expect(summary.bytesRedacted).toBeGreaterThan(0)
    const allDetail = (
      db.prepare(`SELECT detail FROM workforce_memory WHERE workspace_id = 7`).all() as Array<{ detail: string }>
    )
      .map((r) => r.detail)
      .join('\n')
    expect(allDetail).not.toMatch(/sk-[A-Za-z0-9]{20}/)
    expect(allDetail).toMatch(/\[redacted:/)
  })

  it('is idempotent — resync replaces prior rows', () => {
    const vault = freshVault()
    writeFileSync(join(vault, 'one.md'), `# One\n\nbody.`)
    const db = freshDb()
    ingestObsidianVault(db, 3, vault)
    const before = (db.prepare(`SELECT COUNT(*) c FROM workforce_memory WHERE workspace_id = 3 AND kind = 'operator-memory.obsidian'`).get() as { c: number }).c
    expect(before).toBeGreaterThan(0)
    // Resync — same content
    ingestObsidianVault(db, 3, vault)
    const after = (db.prepare(`SELECT COUNT(*) c FROM workforce_memory WHERE workspace_id = 3 AND kind = 'operator-memory.obsidian'`).get() as { c: number }).c
    expect(after).toBe(before)
  })

  it('recentObsidianCitations surfaces yesterday-noted entries first', () => {
    const vault = freshVault()
    writeFileSync(join(vault, 'y.md'), `# Yesterday note\n\n> Date: yesterday\n\nbody.`)
    writeFileSync(join(vault, 't.md'), `# Today note\n\nbody.`)
    const db = freshDb()
    ingestObsidianVault(db, 5, vault)
    const cites = recentObsidianCitations(db, 5, 48 * 60 * 60, 3)
    expect(cites.length).toBeGreaterThan(0)
    expect(cites.some((c) => /Yesterday note|Today note/.test(c.title))).toBe(true)
  })
})
