/**
 * Baseline OS — Pinecone Connector (Layer 2: Knowledge Intelligence)
 *
 * Real, optional, server-only embedding ingestion against the customer's
 * Pinecone serverless index. Workspace-scoped namespace; never crosses
 * tenants. Customer-facing name in UI: "Knowledge Intelligence".
 *
 * Why kept lightweight:
 *   - No SDK dependency — direct REST calls to Pinecone + OpenAI embeddings.
 *   - One namespace per workspace: `workspace_<id>`.
 *   - Embedding model is configurable; falls back to `text-embedding-3-small`.
 *   - Sync writes `kind='operator-memory.pinecone'` rows to `workforce_memory`
 *     so retrieval is unified with Obsidian/Notion.
 *
 * If env keys are missing, callers receive a setup-required result; the
 * UI shows the connector card as "needs configuration".
 */
import type { Database } from 'better-sqlite3'

export interface PinecoseSyncResult {
  ok: boolean
  reason?: 'missing-config' | 'embed-failed' | 'upsert-failed'
  upserts: number
  namespace: string
  indexName: string | null
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

interface PineconeEnv {
  apiKey: string
  indexHost: string // e.g. https://baseline-os-xxxxx.svc.us-east-1-aws.pinecone.io
  embedKey: string
  embedModel: string
}

function readEnv(): PineconeEnv | null {
  const apiKey = process.env.PINECONE_API_KEY
  const indexHost = process.env.PINECONE_INDEX_HOST
  // Embedding provider — OpenAI in this build. Emergent LLM key works too.
  const embedKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY
  const embedModel = process.env.PINECONE_EMBED_MODEL || 'text-embedding-3-small'
  if (!apiKey || !indexHost || !embedKey) return null
  return { apiKey, indexHost: indexHost.replace(/\/$/, ''), embedKey, embedModel }
}

async function embedBatch(env: PineconeEnv, texts: string[]): Promise<number[][]> {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.embedKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: env.embedModel, input: texts }),
  })
  if (!r.ok) {
    throw new Error(`embed ${r.status} ${(await r.text()).slice(0, 160)}`)
  }
  const j = (await r.json()) as { data: { embedding: number[] }[] }
  return j.data.map((d) => d.embedding)
}

async function pineconeUpsert(
  env: PineconeEnv,
  namespace: string,
  vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>,
): Promise<void> {
  const r = await fetch(`${env.indexHost}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': env.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vectors, namespace }),
  })
  if (!r.ok) {
    throw new Error(`pinecone upsert ${r.status} ${(await r.text()).slice(0, 160)}`)
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
}

/**
 * Ingest the current workforce_memory rows for a workspace into Pinecone
 * so the AI workforce can semantically recall its own decisions, hires,
 * Notion docs, and Obsidian doctrine. Idempotent per workspace namespace.
 */
export async function ingestPinecone(
  db: Database,
  workspaceId: number,
): Promise<PinecoseSyncResult> {
  ensureMemoryTable(db)
  const env = readEnv()
  const namespace = `workspace_${workspaceId}`
  if (!env) {
    return { ok: false, reason: 'missing-config', upserts: 0, namespace, indexName: null }
  }
  const indexName = env.indexHost.replace(/^https?:\/\//, '').split('.')[0] ?? null

  // Collect candidate memory items
  const rows = db
    .prepare(
      `SELECT id, kind, title, detail, rationale FROM workforce_memory
       WHERE workspace_id = ? AND kind NOT LIKE 'operator-memory.pinecone%'
       ORDER BY id DESC LIMIT 200`,
    )
    .all(workspaceId) as Array<{ id: number; kind: string; title: string; detail: string | null; rationale: string | null }>

  if (rows.length === 0) {
    return { ok: true, upserts: 0, namespace, indexName }
  }

  // Build embedding payload, redacting secrets, capping per-row size.
  const payload = rows.map((r) => ({
    id: `mem_${workspaceId}_${r.id}`,
    text: redact([r.title, r.detail || '', r.rationale || ''].join('\n').slice(0, 1800)),
    metadata: {
      workspace_id: workspaceId,
      kind: r.kind,
      title: r.title.slice(0, 200),
      source_memory_id: r.id,
    },
  }))

  // Batch in 32s — Pinecone & OpenAI both happy at this size.
  const BATCH = 32
  let upserts = 0
  try {
    for (let i = 0; i < payload.length; i += BATCH) {
      const slice = payload.slice(i, i + BATCH)
      const vectors = await embedBatch(env, slice.map((p) => p.text))
      const toUpsert = slice.map((p, idx) => ({ id: p.id, values: vectors[idx], metadata: p.metadata }))
      await pineconeUpsert(env, namespace, toUpsert)
      upserts += toUpsert.length
    }
  } catch (e) {
    const msg = String(e)
    const reason = /embed/.test(msg) ? 'embed-failed' : 'upsert-failed'
    return { ok: false, reason, upserts, namespace, indexName }
  }

  return { ok: true, upserts, namespace, indexName }
}

export function pineconeConfigured(): boolean {
  return readEnv() !== null
}
