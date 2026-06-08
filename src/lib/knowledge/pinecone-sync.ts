/**
 * Pinecone semantic layer — deterministic chunking + dedupe + hashing so the
 * vector index never holds duplicates. Embeddings/upserts happen against a real
 * Pinecone credential (honest setup-needed until connected); this module owns
 * the deterministic, testable prep.
 */

export interface Chunk {
  /** sha-256-ish stable id derived from normalized content. */
  id: string
  text: string
  index: number
  sourceHash: string
}

/** Tiny stable non-crypto hash (FNV-1a) — deterministic across runs/platforms. */
export function stableHash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Chunk text by ~maxChars on sentence-ish boundaries. */
export function chunkText(text: string, sourceHash: string, maxChars = 800): Chunk[] {
  const clean = text.replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  const parts: string[] = []
  let buf = ''
  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    if ((buf + ' ' + sentence).length > maxChars && buf) {
      parts.push(buf.trim())
      buf = sentence
    } else {
      buf = buf ? `${buf} ${sentence}` : sentence
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts.map((text, index) => ({ id: `${sourceHash}:${stableHash(normalize(text))}`, text, index, sourceHash }))
}

/** Dedupe chunks across a corpus by content hash — no duplicate vectors. */
export function dedupeChunks(chunks: Chunk[], seen: Set<string> = new Set()): { unique: Chunk[]; duplicates: number } {
  const unique: Chunk[] = []
  let duplicates = 0
  for (const c of chunks) {
    if (seen.has(c.id)) { duplicates += 1; continue }
    seen.add(c.id)
    unique.push(c)
  }
  return { unique, duplicates }
}
