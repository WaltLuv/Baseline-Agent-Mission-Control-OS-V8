/**
 * Knowledge sync pipeline. Provider/source output flows through deterministic,
 * idempotent stages into the four brain layers + the agent-accessible memory
 * index, ending with a proof/event record. Hash-based idempotency; secrets are
 * never ingested (scrubbed upstream in universal-asset).
 */
import type { UniversalAsset } from './universal-asset'

export interface SyncStage {
  id: string
  label: string
  description: string
  /** Brain layer this stage targets (if any). */
  layer?: 'obsidian' | 'notion' | 'pinecone' | 'notebooklm'
}

export const SYNC_STAGES: SyncStage[] = [
  { id: 'ingest', label: 'Universal Asset Library', description: 'Store/index the asset (idempotent by content hash).' },
  { id: 'metadata', label: 'Metadata extraction', description: 'Extract title, author, dates, tags, provider.' },
  { id: 'transcript', label: 'Transcript / OCR', description: 'Whisper/OCR when the asset is audio/video/image (best-effort).' },
  { id: 'obsidian', label: 'Obsidian mapping', description: 'Create a human-readable note + backlinks + tags.', layer: 'obsidian' },
  { id: 'notion', label: 'Notion mapping', description: 'Mirror to a structured Notion page/database.', layer: 'notion' },
  { id: 'pinecone', label: 'Pinecone vectors', description: 'Chunk + embed extracted text into the vector index.', layer: 'pinecone' },
  { id: 'notebooklm', label: 'NotebookLM source ref', description: 'Reference the asset as a NotebookLM source.', layer: 'notebooklm' },
  { id: 'index', label: 'Agent memory index', description: 'Make the asset queryable by scoped agents.' },
  { id: 'proof', label: 'Proof / event record', description: 'Write an immutable proof + event for the sync.' },
]

export type StageState = 'pending' | 'done' | 'skipped' | 'blocked'

export interface LayerAvailability {
  obsidian?: boolean
  notion?: boolean
  pinecone?: boolean
  notebooklm?: boolean
  transcriptionAvailable?: boolean
}

/** Build an honest, idempotent sync plan for an asset given layer availability. */
export function buildSyncPlan(asset: UniversalAsset, avail: LayerAvailability): { stage: SyncStage; state: StageState }[] {
  return SYNC_STAGES.map((stage) => {
    let state: StageState = 'pending'
    if (stage.id === 'transcript') {
      const needs = asset.kind === 'audio' || asset.kind === 'video' || asset.kind === 'image'
      state = !needs ? 'skipped' : avail.transcriptionAvailable ? 'pending' : 'blocked'
    } else if (stage.layer) {
      state = avail[stage.layer] ? 'pending' : 'blocked'
    }
    return { stage, state }
  })
}

/** Idempotency: a sync is a no-op if the asset hash already exists in a layer ref. */
export function alreadySynced(asset: UniversalAsset, layer: 'obsidian' | 'notion' | 'pinecone' | 'notebooklm'): boolean {
  return Boolean(asset.brainLayers[layer])
}
