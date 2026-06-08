/**
 * Universal Asset Library — the single, provider-sovereign store for every
 * generated or imported asset, from any provider. Assets/proofs are owned by
 * Mission Control / Baseline OS; the provider is just the compute layer.
 *
 * Truth-first: idempotent by content hash (no duplicate ingestion), and
 * secret-like strings are scrubbed/rejected before anything is indexed into
 * memory.
 */

export type AssetKind =
  | 'image' | 'video' | 'audio' | 'slides' | 'pdf' | 'infographic'
  | 'storyboard' | 'thumbnail' | 'soul-id' | 'transcript' | 'prompt-pack' | 'proof'

export const ASSET_KINDS: AssetKind[] = [
  'image', 'video', 'audio', 'slides', 'pdf', 'infographic',
  'storyboard', 'thumbnail', 'soul-id', 'transcript', 'prompt-pack', 'proof',
]

/** Every provider whose output must land in the Universal Asset Library. */
export const ASSET_PROVIDERS = [
  'higgsfield', 'hyperframes', 'notebooklm', 'claude-code-studio', 'gemini',
  'openclaw', 'hermes', 'codex', 'antigravity', 'minimax', 'heygen',
  'elevenlabs', 'runway', 'pika', 'browser-use', 'oh-my-pi',
] as const

export interface UniversalAsset {
  /** Stable id = content hash (idempotency key). */
  id: string
  provider: string
  kind: AssetKind
  title: string
  url: string | null
  /** sha-256 of the content/source (idempotency + dedupe). */
  hash: string
  metadata: Record<string, string>
  createdAt: number
  /** Brain-layer references populated by the sync pipeline. */
  brainLayers: { obsidian?: string; notion?: string; pinecone?: string; notebooklm?: string }
}

// ── Secret scrubbing ────────────────────────────────────────────────
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{16,}\b/, // OpenAI-style
  /\bghp_[A-Za-z0-9]{20,}\b/, // GitHub PAT
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private key
  /\b[A-Fa-f0-9]{64,}\b/, // long hex secret/token
  /\b(api[_-]?key|secret|password|token)\s*[:=]\s*\S{8,}/i,
]

export function looksSecret(value: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(value))
}

/** Remove any metadata values that look like secrets (never index them). */
export function scrubSecrets(metadata: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(metadata)) {
    if (looksSecret(`${k}=${v}`) || looksSecret(v)) continue
    clean[k] = v
  }
  return clean
}

export interface IngestInput {
  provider: string
  kind: AssetKind
  title: string
  url?: string | null
  /** Precomputed content hash (sha-256 hex). */
  hash: string
  metadata?: Record<string, string>
  createdAt: number
}

export interface IngestResult {
  asset: UniversalAsset
  /** false when an asset with the same hash already existed (idempotent no-op). */
  ingested: boolean
}

/**
 * Idempotent ingest: dedupes by hash against the provided index. Secrets are
 * scrubbed from metadata. Returns ingested:false when the asset already exists.
 */
export function ingestAsset(input: IngestInput, existing: Map<string, UniversalAsset>): IngestResult {
  const found = existing.get(input.hash)
  if (found) return { asset: found, ingested: false }
  const asset: UniversalAsset = {
    id: input.hash,
    provider: input.provider,
    kind: input.kind,
    title: input.title,
    url: input.url ?? null,
    hash: input.hash,
    metadata: scrubSecrets(input.metadata ?? {}),
    createdAt: input.createdAt,
    brainLayers: {},
  }
  existing.set(asset.hash, asset)
  return { asset, ingested: true }
}

export function assetCountsByKind(assets: UniversalAsset[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const a of assets) counts[a.kind] = (counts[a.kind] ?? 0) + 1
  return counts
}
