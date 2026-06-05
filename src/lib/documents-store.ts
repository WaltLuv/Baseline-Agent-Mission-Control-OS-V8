/**
 * Documents storage — content-addressed blobs on disk + SQLite metadata.
 *
 * Path layout:
 *   <dataDir>/documents/<workspace_id>/<sha256>
 *
 * Identical bytes within a workspace dedupe at the filesystem level.
 * Metadata is in the `documents` table. Soft-deletes (archive) leave the
 * blob in place; a future GC job can prune blobs whose every metadata
 * row is `archived`.
 *
 * No magic-byte sniffing — callers provide the MIME type. We do enforce
 * size limits and refuse paths outside the workspace root.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { config } from '@/lib/config'

export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024 // 50 MB

function documentsRoot(workspaceId: number): string {
  const root = resolve(config.dataDir || '.data', 'documents', String(workspaceId))
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  return root
}

export function storagePathFor(workspaceId: number, storageKey: string): string {
  const root = documentsRoot(workspaceId)
  const full = resolve(root, storageKey)
  // Defence-in-depth: refuse keys that escape the workspace root.
  if (!full.startsWith(root + '/') && full !== root) {
    throw new Error('document storage key escapes workspace root')
  }
  return full
}

export interface PutBlobResult {
  sha256: string
  storage_key: string
  size_bytes: number
  dedup: boolean
}

export function putBlob(workspaceId: number, buf: Buffer): PutBlobResult {
  if (buf.byteLength > DOCUMENT_MAX_BYTES) {
    throw Object.assign(new Error('document exceeds 50 MB max'), { code: 'TOO_LARGE' })
  }
  const sha = createHash('sha256').update(buf).digest('hex')
  const storageKey = sha
  const path = storagePathFor(workspaceId, storageKey)
  if (existsSync(path)) {
    const st = statSync(path)
    if (st.size === buf.byteLength) {
      return { sha256: sha, storage_key: storageKey, size_bytes: st.size, dedup: true }
    }
    // Defensive: a path exists with the same SHA but different size means
    // the prior write was truncated. Overwrite.
  }
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buf)
  return { sha256: sha, storage_key: storageKey, size_bytes: buf.byteLength, dedup: false }
}

export function readBlob(workspaceId: number, storageKey: string): Buffer {
  const path = storagePathFor(workspaceId, storageKey)
  return readFileSync(path)
}
