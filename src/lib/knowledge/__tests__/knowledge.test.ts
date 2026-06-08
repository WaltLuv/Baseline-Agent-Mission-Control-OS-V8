/**
 * Knowledge OS / NotebookLM Brain Layer 4 + Universal Asset Library + PI Agent
 * + sync pipeline + classification + shared agent memory.
 */
import { describe, it, expect } from 'vitest'
import {
  ASSET_KINDS, ASSET_PROVIDERS, ingestAsset, scrubSecrets, looksSecret,
  assetCountsByKind, type UniversalAsset,
} from '@/lib/knowledge/universal-asset'
import { BRAIN_LAYERS, deriveLayerState, getBrainLayer, NOTEBOOKLM_LAYER } from '@/lib/knowledge/brain-layers'
import { classifyPath, classifyBatch, DEFAULT_SCAN_PATHS } from '@/lib/knowledge/classification'
import { SYNC_STAGES, buildSyncPlan } from '@/lib/knowledge/sync-pipeline'
import { chunkText, dedupeChunks, stableHash } from '@/lib/knowledge/pinecone-sync'
import { PI_AGENT, memoryHealth, EMPTY_METRICS } from '@/lib/knowledge/pi-agent'
import { MEMORY_AGENTS, canQueryLayer } from '@/lib/knowledge/agent-memory'
import { IMPORT_SOURCES } from '@/lib/knowledge/import-sources'

describe('Universal Asset Library', () => {
  it('supports image/video/audio/slides/pdf + all required kinds', () => {
    for (const k of ['image', 'video', 'audio', 'slides', 'pdf', 'infographic', 'soul-id', 'transcript', 'prompt-pack', 'proof']) {
      expect(ASSET_KINDS).toContain(k)
    }
  })
  it('indexes output from every provider', () => {
    for (const p of ['higgsfield', 'hyperframes', 'notebooklm', 'gemini', 'openclaw', 'hermes', 'codex', 'antigravity', 'minimax', 'heygen', 'elevenlabs', 'runway', 'pika', 'browser-use', 'oh-my-pi']) {
      expect(ASSET_PROVIDERS).toContain(p)
    }
  })
  it('is idempotent by content hash (no duplicate ingestion)', () => {
    const idx = new Map<string, UniversalAsset>()
    const a = ingestAsset({ provider: 'higgsfield', kind: 'image', title: 'hero', hash: 'abc123', createdAt: 1 }, idx)
    const b = ingestAsset({ provider: 'higgsfield', kind: 'image', title: 'hero (again)', hash: 'abc123', createdAt: 2 }, idx)
    expect(a.ingested).toBe(true)
    expect(b.ingested).toBe(false)
    expect(idx.size).toBe(1)
  })
  it('excludes secret-like strings from indexed metadata', () => {
    expect(looksSecret('sk-ABCDEFGHIJKLMNOPQRSTUV')).toBe(true)
    expect(looksSecret('ghp_ABCDEFGHIJKLMNOPQRSTUVWX0123')).toBe(true)
    const clean = scrubSecrets({ prompt: 'a sunset', api_key: 'sk-ABCDEFGHIJKLMNOPQRSTUV', note: 'fine' })
    expect(clean).toHaveProperty('prompt')
    expect(clean).toHaveProperty('note')
    expect(clean).not.toHaveProperty('api_key')
  })
  it('counts by kind', () => {
    const assets = [
      { kind: 'image' }, { kind: 'image' }, { kind: 'video' },
    ] as UniversalAsset[]
    expect(assetCountsByKind(assets)).toEqual({ image: 2, video: 1 })
  })
})

describe('Four-brain layers — NotebookLM is Layer 4', () => {
  it('has Obsidian/Notion/Pinecone/NotebookLM at layers 1-4', () => {
    expect(BRAIN_LAYERS.map((b) => b.id)).toEqual(['obsidian', 'notion', 'pinecone', 'notebooklm'])
    expect(getBrainLayer('notebooklm')?.layer).toBe(4)
    expect(NOTEBOOKLM_LAYER).toBe(4)
  })
  it('honest layer state: NotebookLM has no official write API', () => {
    expect(deriveLayerState('notebooklm', { notebooklmConnected: false })).toBe('unsupported_by_api')
    expect(deriveLayerState('notebooklm', { notebooklmConnected: true })).toBe('manual_import')
    expect(deriveLayerState('notion', { notionCredential: false })).toBe('setup_needed')
    expect(deriveLayerState('pinecone', { pineconeCredential: true })).toBe('connected')
  })
})

describe('Classification — do not blindly ingest', () => {
  it('includes knowledge files, excludes build/secret/binary/log', () => {
    expect(classifyPath('~/Documents/strategy.md').include).toBe(true)
    expect(classifyPath('~/Business/Q3-plan.pdf').include).toBe(true)
    expect(classifyPath('~/Projects/app/node_modules/x.js').include).toBe(false)
    expect(classifyPath('~/Projects/app/.git/config').include).toBe(false)
    expect(classifyPath('~/secrets/.env').include).toBe(false)
    expect(classifyPath('~/Downloads/backup.zip').include).toBe(false)
    expect(classifyPath('~/x/pnpm-lock.yaml').include).toBe(false)
    expect(classifyPath('~/Documents/notes.md').kind).toBe('note')
  })
  it('batch splits included/excluded with reasons', () => {
    const r = classifyBatch(['~/a/sop.md', '~/b/node_modules/y.js', '~/c/keys.pem'])
    expect(r.included).toEqual(['~/a/sop.md'])
    expect(r.excluded.length).toBe(2)
    expect(DEFAULT_SCAN_PATHS).toContain('~/Documents')
  })
})

describe('Sync pipeline', () => {
  it('maps an asset into all four layers + index + proof', () => {
    expect(SYNC_STAGES.map((s) => s.id)).toEqual(['ingest', 'metadata', 'transcript', 'obsidian', 'notion', 'pinecone', 'notebooklm', 'index', 'proof'])
    const asset = { kind: 'video', brainLayers: {} } as UniversalAsset
    const plan = buildSyncPlan(asset, { obsidian: true, notion: false, pinecone: true, notebooklm: false, transcriptionAvailable: false })
    const byId = Object.fromEntries(plan.map((p) => [p.stage.id, p.state]))
    expect(byId.obsidian).toBe('pending')
    expect(byId.notion).toBe('blocked') // no notion creds
    expect(byId.transcript).toBe('blocked') // video needs transcription, unavailable
  })
})

describe('Pinecone sync — chunk + dedupe + hash, no duplicate vectors', () => {
  it('chunks deterministically and dedupes by content hash', () => {
    const text = 'First sentence here. Second sentence follows. Third one too.'
    const chunks = chunkText(text, 'srchash', 30)
    expect(chunks.length).toBeGreaterThan(1)
    const dup = [...chunks, chunks[0]]
    const { unique, duplicates } = dedupeChunks(dup)
    expect(duplicates).toBe(1)
    expect(unique.length).toBe(chunks.length)
    expect(stableHash('x')).toBe(stableHash('x')) // deterministic
  })
})

describe('PI Agent — Chief Memory Officer', () => {
  it('owns the four-brain layers and is distinct from Oh My Pi', () => {
    expect(PI_AGENT.title).toBe('Chief Memory Officer')
    expect(PI_AGENT.notToBeConfusedWith).toBe('oh-my-pi')
    expect(PI_AGENT.owns).toContain('memory-health-report')
    expect(PI_AGENT.owns).toContain('deduplication')
  })
  it('reports honest memory health across all four layers', () => {
    const h = memoryHealth(
      { obsidian: 'connected', notion: 'setup_needed', pinecone: 'connected', notebooklm: 'manual_import' },
      { ...EMPTY_METRICS, failedImports: 0 },
    )
    expect(h.layers.length).toBe(4)
    expect(h.score).toBeGreaterThan(0)
    expect(['healthy', 'degraded', 'attention']).toContain(h.status)
  })
})

describe('Shared agent memory', () => {
  it('PI Agent + Hermes + Maestro can read all four layers', () => {
    for (const id of ['pi-agent', 'hermes', 'maestro']) {
      for (const layer of ['obsidian', 'notion', 'pinecone', 'notebooklm'] as const) {
        expect(canQueryLayer(id, layer), `${id} should query ${layer}`).toBe(true)
      }
    }
  })
  it('covers the full agent roster (no isolated silos)', () => {
    for (const id of ['slim', 'claude-code', 'codex', 'openclaw', 'antigravity', 'gemini', 'browser-use', 'notebooklm-agent', 'oh-my-pi', 'video-team', 'workforce']) {
      expect(MEMORY_AGENTS.map((m) => m.id)).toContain(id)
    }
  })
})

describe('Import centers', () => {
  it('NotebookLM / Notion / Filesystem with honest states + mirror targets', () => {
    expect(IMPORT_SOURCES.map((s) => s.id)).toEqual(['notebooklm', 'notion', 'filesystem'])
    const nb = IMPORT_SOURCES.find((s) => s.id === 'notebooklm')!
    expect(nb.defaultState).toBe('unsupported_by_api') // no fake API access
    expect(nb.mirrorsTo).toContain('pinecone')
    expect(IMPORT_SOURCES.find((s) => s.id === 'filesystem')?.scanPaths?.length).toBeGreaterThan(0)
  })
})
