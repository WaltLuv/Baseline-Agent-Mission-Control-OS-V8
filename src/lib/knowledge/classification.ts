/**
 * Knowledge ingestion classifier. DO NOT blindly ingest everything — every
 * candidate path is classified include/exclude with a reason. Secrets,
 * build/dependency artifacts, binaries, and logs are always excluded.
 */
import type { AssetKind } from './universal-asset'

export interface Classification {
  include: boolean
  kind: AssetKind | 'document' | 'note'
  reason: string
}

/** Path segments / dirs that are always excluded. */
const EXCLUDE_DIRS = [
  'node_modules', 'dist', 'build', '.git', '.cache', 'cache', '.next',
  'tmp', 'temp', '.venv', 'venv', '__pycache__', 'vendor', '.turbo',
]
const EXCLUDE_FILE_PATTERNS: RegExp[] = [
  /package-lock\.json$/i, /pnpm-lock\.yaml$/i, /yarn\.lock$/i,
  /\.(lock|log|bin|exe|dll|so|dylib|o|a|class|pyc)$/i,
  /\.(zip|tar|gz|tgz|rar|7z|dmg|iso)$/i, // archives
  /\.(env|pem|key|crt|p12|keystore)$/i, // credentials/keys
  /(^|\/)\.?(secrets?|credentials?|tokens?)(\.|\/|$)/i,
  /id_rsa|id_ed25519/i,
]

/** Extensions we DO ingest, mapped to a kind. */
const INCLUDE_EXT: Record<string, Classification['kind']> = {
  md: 'note', markdown: 'note', txt: 'note',
  pdf: 'pdf',
  doc: 'document', docx: 'document', rtf: 'document', odt: 'document',
  csv: 'document', json: 'document', yaml: 'document', yml: 'document',
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', svg: 'image',
  mp4: 'video', mov: 'video', webm: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio',
  pptx: 'slides', key: 'slides',
  vtt: 'transcript', srt: 'transcript',
}

/** Content categories that earn inclusion regardless of extension hints. */
const KNOWLEDGE_HINTS = [
  'sop', 'workflow', 'strategy', 'meeting', 'notes', 'research', 'spec',
  'specification', 'plan', 'storyboard', 'script', 'report', 'business',
]

function ext(path: string): string {
  const base = path.split('/').pop() ?? ''
  const i = base.lastIndexOf('.')
  return i >= 0 ? base.slice(i + 1).toLowerCase() : ''
}

export function classifyPath(path: string): Classification {
  const lower = path.toLowerCase()
  const segments = lower.split('/')

  for (const d of EXCLUDE_DIRS) {
    if (segments.includes(d)) return { include: false, kind: 'document', reason: `excluded dir: ${d}` }
  }
  for (const re of EXCLUDE_FILE_PATTERNS) {
    if (re.test(lower)) return { include: false, kind: 'document', reason: 'excluded (build/secret/binary/log/archive)' }
  }

  const e = ext(path)
  const kind = INCLUDE_EXT[e]
  if (kind) {
    const hinted = KNOWLEDGE_HINTS.some((h) => lower.includes(h))
    return { include: true, kind, reason: hinted ? `included (${e}, knowledge-hint)` : `included (${e})` }
  }
  return { include: false, kind: 'document', reason: `unsupported extension: ${e || 'none'}` }
}

/** Default Mac Mini scan roots (allowlist). */
export const DEFAULT_SCAN_PATHS = [
  '~/Documents', '~/Downloads', '~/Desktop', '~/Projects', '~/Knowledge', '~/Business',
]

export function classifyBatch(paths: string[]): { included: string[]; excluded: { path: string; reason: string }[] } {
  const included: string[] = []
  const excluded: { path: string; reason: string }[] = []
  for (const p of paths) {
    const c = classifyPath(p)
    if (c.include) included.push(p)
    else excluded.push({ path: p, reason: c.reason })
  }
  return { included, excluded }
}
