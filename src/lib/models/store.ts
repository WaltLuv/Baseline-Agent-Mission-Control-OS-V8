/**
 * Model catalogue store — SQLite-backed.
 *
 * Read paths: every model selector + the /api/models endpoint.
 * Write paths: OpenRouter sync, manual curated edits, custom-model adds.
 */

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import type { ModelProvider, ModelRow, ModelSource, ModelStatus } from './types'

type DbRow = {
  id: number
  provider: string
  model_slug: string
  display_name: string
  family: string | null
  context_window: number | null
  input_price_usd_per_million: number | null
  output_price_usd_per_million: number | null
  supports_tools: number
  supports_images: number
  supports_audio: number
  supports_video: number
  supports_reasoning: number
  supports_json: number
  source: string
  status: string
  last_synced_at: number
  metadata_json: string | null
  created_at: number
  updated_at: number
}

function toRow(r: DbRow): ModelRow {
  return {
    id: r.id,
    provider: r.provider as ModelProvider,
    model_slug: r.model_slug,
    display_name: r.display_name,
    family: r.family,
    context_window: r.context_window,
    input_price_usd_per_million: r.input_price_usd_per_million,
    output_price_usd_per_million: r.output_price_usd_per_million,
    supports_tools: !!r.supports_tools,
    supports_images: !!r.supports_images,
    supports_audio: !!r.supports_audio,
    supports_video: !!r.supports_video,
    supports_reasoning: !!r.supports_reasoning,
    supports_json: !!r.supports_json,
    source: r.source as ModelSource,
    status: r.status as ModelStatus,
    last_synced_at: r.last_synced_at,
    metadata: r.metadata_json ? (JSON.parse(r.metadata_json) as Record<string, unknown>) : {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

export type ListFilter = {
  source?: ModelSource
  provider?: ModelProvider
  status?: ModelStatus
}

export function listModels(filter: ListFilter = {}): ModelRow[] {
  const db = getDatabase()
  runMigrations(db)
  const clauses: string[] = []
  const args: unknown[] = []
  if (filter.source) {
    clauses.push('source = ?')
    args.push(filter.source)
  }
  if (filter.provider) {
    clauses.push('provider = ?')
    args.push(filter.provider)
  }
  if (filter.status) {
    clauses.push('status = ?')
    args.push(filter.status)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db
    .prepare(`SELECT * FROM model_catalog ${where} ORDER BY provider ASC, model_slug ASC`)
    .all(...args) as DbRow[]
  return rows.map(toRow)
}

export function findModel(source: ModelSource, slug: string): ModelRow | null {
  const db = getDatabase()
  runMigrations(db)
  const row = db
    .prepare(`SELECT * FROM model_catalog WHERE source = ? AND model_slug = ?`)
    .get(source, slug) as DbRow | undefined
  return row ? toRow(row) : null
}

export type UpsertInput = {
  provider: ModelProvider
  model_slug: string
  display_name: string
  family?: string | null
  context_window?: number | null
  input_price_usd_per_million?: number | null
  output_price_usd_per_million?: number | null
  supports_tools?: boolean
  supports_images?: boolean
  supports_audio?: boolean
  supports_video?: boolean
  supports_reasoning?: boolean
  supports_json?: boolean
  source: ModelSource
  status?: ModelStatus
  metadata?: Record<string, unknown>
}

export function upsertModel(input: UpsertInput): ModelRow {
  const db = getDatabase()
  runMigrations(db)
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    `INSERT INTO model_catalog (
       provider, model_slug, display_name, family, context_window,
       input_price_usd_per_million, output_price_usd_per_million,
       supports_tools, supports_images, supports_audio, supports_video,
       supports_reasoning, supports_json, source, status, last_synced_at,
       metadata_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source, model_slug) DO UPDATE SET
       provider = excluded.provider,
       display_name = excluded.display_name,
       family = excluded.family,
       context_window = excluded.context_window,
       input_price_usd_per_million = excluded.input_price_usd_per_million,
       output_price_usd_per_million = excluded.output_price_usd_per_million,
       supports_tools = excluded.supports_tools,
       supports_images = excluded.supports_images,
       supports_audio = excluded.supports_audio,
       supports_video = excluded.supports_video,
       supports_reasoning = excluded.supports_reasoning,
       supports_json = excluded.supports_json,
       status = excluded.status,
       last_synced_at = excluded.last_synced_at,
       metadata_json = excluded.metadata_json,
       updated_at = excluded.updated_at`,
  ).run(
    input.provider,
    input.model_slug,
    input.display_name,
    input.family ?? null,
    input.context_window ?? null,
    input.input_price_usd_per_million ?? null,
    input.output_price_usd_per_million ?? null,
    input.supports_tools ? 1 : 0,
    input.supports_images ? 1 : 0,
    input.supports_audio ? 1 : 0,
    input.supports_video ? 1 : 0,
    input.supports_reasoning ? 1 : 0,
    input.supports_json ? 1 : 0,
    input.source,
    input.status ?? 'available',
    now,
    input.metadata ? JSON.stringify(input.metadata) : null,
    now,
    now,
  )
  const out = findModel(input.source, input.model_slug)
  if (!out) throw new Error('upsert succeeded but readback failed')
  return out
}

export function markDeprecated(source: ModelSource, slug: string): boolean {
  const db = getDatabase()
  runMigrations(db)
  const res = db
    .prepare(`UPDATE model_catalog SET status = 'deprecated', updated_at = unixepoch()
              WHERE source = ? AND model_slug = ?`)
    .run(source, slug)
  return res.changes > 0
}

export function deleteModel(source: ModelSource, slug: string): boolean {
  const db = getDatabase()
  runMigrations(db)
  const res = db
    .prepare(`DELETE FROM model_catalog WHERE source = ? AND model_slug = ?`)
    .run(source, slug)
  return res.changes > 0
}
