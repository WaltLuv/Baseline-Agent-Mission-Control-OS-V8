/**
 * Agent Factory workspace — where "build me X" creations land.
 *
 * Scratch root is the configurable output path (config.paths.output, env
 * MC_OUTPUT_PATH) so nothing is hardcoded to a machine. Each project is a
 * subdirectory; the preview route serves files from here so a built HTML page
 * can resolve its own relative assets.
 */
import { readdir, stat, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from '@/lib/config'

export const FACTORY_SCRATCH_ROOT =
  process.env.AGENT_FACTORY_SCRATCH || path.join(config.paths.output, 'agent-factory')

export const DEFAULT_PROJECT = 'agent-factory'

export type FactoryFileKind = 'text' | 'image' | 'video' | 'audio' | 'binary'

export interface FactoryFile {
  name: string
  relPath: string
  bytes: number
  mtime: number
  kind: FactoryFileKind
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv'])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac'])
const TEXT_EXTS = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.md', '.txt', '.svg'])
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build'])

function fileKind(name: string): FactoryFileKind {
  const ext = path.extname(name).toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (TEXT_EXTS.has(ext)) return 'text'
  return 'binary'
}

/** Only safe, single-segment project names (no traversal). */
export function safeProject(p: string | null | undefined): string {
  return p && /^[A-Za-z0-9_.-]+$/.test(p) ? p : DEFAULT_PROJECT
}

export async function ensureProject(name: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return null
  const dir = path.join(FACTORY_SCRATCH_ROOT, name)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  return dir
}

export async function listProjectFiles(project: string, limit = 200): Promise<{ files: FactoryFile[] }> {
  const dir = path.join(FACTORY_SCRATCH_ROOT, safeProject(project))
  const out: FactoryFile[] = []
  async function walk(d: string, rel: string, depth: number): Promise<void> {
    if (depth < 0 || out.length >= limit) return
    let items: import('node:fs').Dirent[] = []
    try { items = await readdir(d, { withFileTypes: true }) } catch { return }
    for (const it of items) {
      if (SKIP_DIRS.has(it.name)) continue
      const full = path.join(d, it.name)
      const relPath = rel ? `${rel}/${it.name}` : it.name
      if (it.isDirectory()) await walk(full, relPath, depth - 1)
      else if (it.isFile()) {
        const s = await stat(full).catch(() => null)
        if (!s) continue
        out.push({ name: it.name, relPath, bytes: s.size, mtime: s.mtimeMs, kind: fileKind(it.name) })
      }
      if (out.length >= limit) return
    }
  }
  await walk(dir, '', 4)
  return { files: out }
}
