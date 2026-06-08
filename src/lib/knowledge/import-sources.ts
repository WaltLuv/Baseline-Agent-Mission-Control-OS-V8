/**
 * Knowledge Migration — import centers. Each source has honest connection
 * states + the import modes it actually supports. No fake access.
 */
import { DEFAULT_SCAN_PATHS } from './classification'

export type ImportMode = 'api' | 'file_upload' | 'google_drive' | 'manual_paste' | 'filesystem_scan'
export type SourceState = 'connected' | 'setup_needed' | 'unsupported_by_api' | 'manual_import'

export interface ImportSource {
  id: 'notebooklm' | 'notion' | 'filesystem'
  label: string
  description: string
  modes: ImportMode[]
  /** Fields captured per imported item. */
  captures: string[]
  /** Where imported content is mirrored. */
  mirrorsTo: ('obsidian' | 'pinecone' | 'asset-library')[]
  defaultState: SourceState
  scanPaths?: string[]
}

export const IMPORT_SOURCES: ImportSource[] = [
  {
    id: 'notebooklm',
    label: 'NotebookLM Import Center',
    description: 'Import NotebookLM sources + generated overviews (audio/video/slides/summaries). No official write API — manual / Drive / upload.',
    modes: ['file_upload', 'google_drive', 'manual_paste'],
    captures: ['source title', 'source URL', 'notebook name', 'generated summary', 'extracted text', 'tags', 'timestamps', 'audio overview metadata', 'video overview metadata', 'slide deck metadata'],
    mirrorsTo: ['obsidian', 'pinecone', 'asset-library'],
    defaultState: 'unsupported_by_api',
  },
  {
    id: 'notion',
    label: 'Notion Import Center',
    description: 'Import pages, databases, tasks, notes, projects, SOPs via the Notion API.',
    modes: ['api', 'file_upload'],
    captures: ['source URL', 'page ID', 'created date', 'modified date', 'title', 'content', 'tags'],
    mirrorsTo: ['obsidian', 'pinecone'],
    defaultState: 'setup_needed',
  },
  {
    id: 'filesystem',
    label: 'Filesystem Import Center (Mac Mini)',
    description: 'Scan allowlisted local paths; classify + ingest knowledge files only. Never indexes secrets/credentials/binaries.',
    modes: ['filesystem_scan'],
    captures: ['path', 'filename', 'size', 'modified date', 'classified kind'],
    mirrorsTo: ['obsidian', 'pinecone', 'asset-library'],
    defaultState: 'setup_needed',
    scanPaths: DEFAULT_SCAN_PATHS,
  },
]

export interface QueueItem {
  id: string
  source: ImportSource['id']
  title: string
  state: 'queued' | 'classified' | 'imported' | 'failed' | 'duplicate'
}

export function queueSummary(items: QueueItem[]): Record<QueueItem['state'], number> {
  const out = { queued: 0, classified: 0, imported: 0, failed: 0, duplicate: 0 }
  for (const i of items) out[i.state] += 1
  return out
}

export function getImportSource(id: string): ImportSource | undefined {
  return IMPORT_SOURCES.find((s) => s.id === id)
}
