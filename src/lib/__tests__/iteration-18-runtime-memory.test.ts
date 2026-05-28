/**
 * Pass 1 — Runtime + Memory Continuity tests.
 * Covers: memory provenance helper, Obsidian deep-links, Notion delta
 * sync, OpenClaw hook template, skill-event idempotency.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'

import { deriveProvenance, obsidianVaultName } from '@/lib/baseline-os/memory-provenance'

describe('memory-provenance.deriveProvenance', () => {
  it('parses Obsidian rationale into a vault-relative path + deep-link', () => {
    const p = deriveProvenance(
      'operator-memory.obsidian',
      'Source: Obsidian operator vault · 00-doctrine.md · #doctrine',
      'OperatorVault',
    )
    expect(p.source).toBe('Obsidian')
    expect(p.sourcePath).toBe('00-doctrine.md')
    expect(p.deepLink).toMatch(/^obsidian:\/\/open\?vault=OperatorVault&file=00-doctrine\.md$/)
  })

  it('handles nested paths and the "noted yesterday" suffix', () => {
    const p = deriveProvenance(
      'operator-memory.obsidian',
      'Source: Obsidian operator vault · sops/intake.md · noted yesterday',
      'OperatorVault',
    )
    expect(p.sourcePath).toBe('sops/intake.md')
    expect(p.deepLink).toContain('file=sops%2Fintake.md')
  })

  it('parses Notion rationale into the page URL deep-link', () => {
    const p = deriveProvenance(
      'operator-memory.notion',
      'Source: Notion · Q1 Doctrine · https://www.notion.so/page-abc',
    )
    expect(p.source).toBe('Notion')
    expect(p.deepLink).toBe('https://www.notion.so/page-abc')
  })

  it('returns Pinecone with no deep-link (vector storage is internal)', () => {
    const p = deriveProvenance('operator-memory.pinecone', 'Source: Pinecone · index-abc')
    expect(p.source).toBe('Pinecone')
    expect(p.deepLink).toBeNull()
  })

  it('falls back to Workforce Memory for unknown kinds', () => {
    const p = deriveProvenance('escalation', 'just some text')
    expect(p.source).toBe('Workforce Memory')
    expect(p.deepLink).toBeNull()
  })

  it('vault name falls back to "Operator Vault" when env unset', () => {
    const orig = process.env.OBSIDIAN_VAULT_PATH
    delete process.env.OBSIDIAN_VAULT_PATH
    expect(obsidianVaultName()).toBe('Operator Vault')
    if (orig) process.env.OBSIDIAN_VAULT_PATH = orig
  })
})

describe('OpenClaw runtime hook template', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/app/api/openclaw/hooks/route.ts'), 'utf8')
  it('exposes a handle(event, payload) entrypoint', () => {
    expect(source).toContain('export async function handle(event, payload')
  })
  it('routes the iteration-15/16 event names to the right endpoints', () => {
    for (const evt of ['tool:start', 'tool:end', 'tool:invoked', 'task:complete', 'skill:used', 'skill:escalated', 'memory:cited', 'agent:handoff']) {
      expect(source).toContain(`'${evt}'`)
    }
    for (const path of [
      '/api/skills/event',
      '/api/agents/outcome',
      '/api/agents/escalation',
      '/api/agents/memory-use',
      '/api/agents/collaboration',
    ]) {
      expect(source).toContain(path)
    }
  })
  it('uses fire-and-forget _post with timeout and never-throws', () => {
    expect(source).toContain('async function _post(')
    expect(source).toContain('new AbortController()')
    expect(source).toMatch(/setTimeout.+4_000/)
    expect(source).toContain('// OpenClaw must never crash on telemetry failure.')
  })
  it('restricts the customer-facing memory source enum', () => {
    expect(source).toContain("['Obsidian', 'Notion', 'Pinecone', 'Internal']")
    expect(source).not.toContain('vector_namespace')
    expect(source).not.toContain('embedding_index')
  })
})

// Notion delta sync — we mock the network layer to drive ingestNotion in isolation.
const memDb = new Database(':memory:')
vi.mock('@/lib/db', () => ({ getDatabase: () => memDb }))

let mockPages: Array<{ id: string; title: string; url: string; body: string }> = []
vi.mock('@/lib/baseline-os/notion-fetcher', () => ({
  fetchNotionWorkspace: vi.fn(async () => mockPages),
}))

// We re-implement listPages/getPageBlocks inline because the production
// notion-ingest reads NOTION_TOKEN. We can intercept by mocking node-fetch
// indirectly. Simplest: patch process.env to provide config + the global
// fetch impl.

describe('Notion delta-aware ingest', () => {
  let savedEnv: typeof process.env
  let originalFetch: typeof fetch
  beforeEach(() => {
    savedEnv = { ...process.env }
    process.env.NOTION_TOKEN = 'fake'
    process.env.NOTION_DATABASE_ID = 'fake-db'
    memDb.exec(`
      DROP TABLE IF EXISTS workforce_memory;
      CREATE TABLE workforce_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        agent_id INTEGER, agent_slug TEXT,
        kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, rationale TEXT,
        value_impact_cents INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `)
    originalFetch = globalThis.fetch
    globalThis.fetch = ((url: string) => {
      const u = String(url)
      if (u.includes('/databases/') && u.includes('/query')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: mockPages.map((p) => ({
                id: p.id,
                url: p.url,
                properties: { Name: { title: [{ plain_text: p.title }] } },
              })),
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
      }
      if (u.includes('/blocks/') && u.includes('/children')) {
        const id = u.match(/blocks\/([^/]+)\/children/)?.[1]
        const page = mockPages.find((p) => p.id === id)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: page?.body ?? '' }] } }],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    }) as typeof fetch
  })

  it('delta sync preserves IDs across identical resyncs', async () => {
    const { ingestNotion } = await import('@/lib/baseline-os/notion-ingest')
    mockPages = [
      { id: 'p-1', title: 'Q1 SOP', url: 'https://notion.so/p-1', body: 'cadence T+0, T+72h, T+7d' },
      { id: 'p-2', title: 'Doctrine', url: 'https://notion.so/p-2', body: 'never file when totals do not reconcile' },
    ]
    const r1 = await ingestNotion(memDb, 7)
    expect(r1.ok).toBe(true)
    expect(r1.chunksWritten).toBeGreaterThan(0)
    expect(r1.chunksUnchanged).toBe(0)
    const idsBefore = memDb
      .prepare(`SELECT id, content_hash FROM workforce_memory WHERE workspace_id = 7 ORDER BY id`)
      .all() as Array<{ id: number; content_hash: string }>
    expect(idsBefore.every((r) => !!r.content_hash)).toBe(true)
    const r2 = await ingestNotion(memDb, 7)
    expect(r2.chunksWritten).toBe(0)
    expect(r2.chunksUnchanged).toBe(idsBefore.length)
    expect(r2.chunksRemoved).toBe(0)
    const idsAfter = memDb
      .prepare(`SELECT id FROM workforce_memory WHERE workspace_id = 7 ORDER BY id`)
      .all() as Array<{ id: number }>
    expect(idsAfter.map((r) => r.id)).toEqual(idsBefore.map((r) => r.id))
  })

  it('removes deleted Notion pages from the workspace memory', async () => {
    const { ingestNotion } = await import('@/lib/baseline-os/notion-ingest')
    mockPages = [{ id: 'p-1', title: 'Q1 SOP', url: 'https://notion.so/p-1', body: 'cadence text' }]
    await ingestNotion(memDb, 8)
    // Delete the Notion page upstream.
    mockPages = []
    const r2 = await ingestNotion(memDb, 8)
    expect(r2.ok).toBe(false) // no pages → ingester returns no-pages, but doesn't delete
    // After the next pass with pages returning, removed chunks should drop.
    mockPages = [{ id: 'p-2', title: 'Other', url: 'https://notion.so/p-2', body: 'fresh content' }]
    const r3 = await ingestNotion(memDb, 8)
    expect(r3.ok).toBe(true)
    expect(r3.chunksRemoved).toBeGreaterThan(0)
  })

  afterEach(() => {
    process.env = savedEnv
    if (originalFetch) globalThis.fetch = originalFetch
  })
})

import { afterEach } from 'vitest'
