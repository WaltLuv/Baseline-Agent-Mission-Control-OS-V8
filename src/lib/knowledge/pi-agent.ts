/**
 * PI Agent — the Chief Memory Officer. Owns the four-brain Knowledge OS:
 * ingestion + sync status, deduplication, asset indexing, source mapping,
 * memory-health reporting. DISTINCT from "Oh My Pi" (a coding-harness runtime).
 */
import { BRAIN_LAYERS, type BrainLayerId, type SyncState } from './brain-layers'

export const PI_AGENT = {
  id: 'pi-agent',
  name: 'PI Agent',
  title: 'Chief Memory Officer',
  /** Hard separation from the Oh My Pi coding runtime. */
  notToBeConfusedWith: 'oh-my-pi',
  owns: [
    'four-brain-layer-dashboard',
    'memory-governance',
    'source-sync-status',
    'deduplication',
    'asset-indexing',
    'notebooklm-sync',
    'obsidian-sync',
    'notion-sync',
    'pinecone-sync',
    'memory-health-report',
    'ingestion-status',
    'indexing-reports',
    'source-mapping',
    'sync-failures',
  ],
} as const

export interface KnowledgeMetrics {
  totalDocuments: number
  totalVectors: number
  totalNotebooks: number
  totalNotionPages: number
  totalObsidianNotes: number
  duplicatesDetected: number
  failedImports: number
  queueDepth: number
}

export interface MemoryHealth {
  score: number // 0..100
  status: 'healthy' | 'degraded' | 'attention'
  layers: { id: BrainLayerId; layer: number; state: SyncState }[]
  notes: string[]
}

/** Compute an honest memory-health report from layer states + metrics. */
export function memoryHealth(
  layerStates: Record<BrainLayerId, SyncState>,
  metrics: KnowledgeMetrics,
): MemoryHealth {
  const layers = BRAIN_LAYERS.map((b) => ({ id: b.id, layer: b.layer, state: layerStates[b.id] }))
  const connected = layers.filter((l) => l.state === 'connected' || l.state === 'manual_import').length
  const notes: string[] = []
  let score = Math.round((connected / BRAIN_LAYERS.length) * 100)
  if (metrics.failedImports > 0) { score -= Math.min(20, metrics.failedImports); notes.push(`${metrics.failedImports} failed imports`) }
  if (metrics.queueDepth > 0) notes.push(`${metrics.queueDepth} items queued`)
  if (metrics.duplicatesDetected > 0) notes.push(`${metrics.duplicatesDetected} duplicates de-duplicated`)
  score = Math.max(0, Math.min(100, score))
  const status: MemoryHealth['status'] = score >= 75 ? 'healthy' : score >= 40 ? 'degraded' : 'attention'
  return { score, status, layers, notes }
}

export const EMPTY_METRICS: KnowledgeMetrics = {
  totalDocuments: 0, totalVectors: 0, totalNotebooks: 0, totalNotionPages: 0,
  totalObsidianNotes: 0, duplicatesDetected: 0, failedImports: 0, queueDepth: 0,
}
