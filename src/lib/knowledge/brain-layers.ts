/**
 * The four-brain Knowledge OS architecture. NotebookLM is Brain Layer 4 —
 * a first-class knowledge + asset source, not a download-only page.
 */
export type BrainLayerId = 'obsidian' | 'notion' | 'pinecone' | 'notebooklm'

export type SyncState =
  | 'connected'
  | 'setup_needed' // needs credential / vault path
  | 'unsupported_by_api' // provider has no official sync API
  | 'manual_import' // import works, but only via manual/upload/drive
  | 'error'

export interface BrainLayer {
  id: BrainLayerId
  layer: 1 | 2 | 3 | 4
  label: string
  role: string
  /** What this layer is the source of truth for. */
  canonicalFor: string
  /** How content is connected. */
  connector: 'vault-path' | 'api-credential' | 'manual-or-drive'
}

export const BRAIN_LAYERS: BrainLayer[] = [
  { id: 'obsidian', layer: 1, label: 'Obsidian', role: 'Working memory + canonical human-readable vault', canonicalFor: 'Human-readable notes, backlinks, daily/project notes', connector: 'vault-path' },
  { id: 'notion', layer: 2, label: 'Notion', role: 'Structured business memory + SOPs', canonicalFor: 'Pages, databases, SOPs, projects', connector: 'api-credential' },
  { id: 'pinecone', layer: 3, label: 'Pinecone', role: 'Long-term semantic retrieval', canonicalFor: 'Vector embeddings + semantic search', connector: 'api-credential' },
  { id: 'notebooklm', layer: 4, label: 'NotebookLM', role: 'Research synthesis — audio/video/slides/summaries', canonicalFor: 'Notebooks, overviews, generated research artifacts', connector: 'manual-or-drive' },
]

export interface BrainLayerSignals {
  obsidianVaultPath?: boolean
  notionCredential?: boolean
  pineconeCredential?: boolean
  notebooklmConnected?: boolean
}

export function deriveLayerState(id: BrainLayerId, s: BrainLayerSignals): SyncState {
  switch (id) {
    case 'obsidian':
      return s.obsidianVaultPath ? 'connected' : 'setup_needed'
    case 'notion':
      return s.notionCredential ? 'connected' : 'setup_needed'
    case 'pinecone':
      return s.pineconeCredential ? 'connected' : 'setup_needed'
    case 'notebooklm':
      // NotebookLM has no official write API — honest manual/Drive import.
      return s.notebooklmConnected ? 'manual_import' : 'unsupported_by_api'
  }
}

export const SYNC_STATE_LABEL: Record<SyncState, string> = {
  connected: 'Connected',
  setup_needed: 'Setup needed',
  unsupported_by_api: 'Manual import (no official API)',
  manual_import: 'Manual import',
  error: 'Error',
}

export function getBrainLayer(id: string): BrainLayer | undefined {
  return BRAIN_LAYERS.find((b) => b.id === id)
}

/** NotebookLM is layer 4 — assert this is structurally true. */
export const NOTEBOOKLM_LAYER = 4
