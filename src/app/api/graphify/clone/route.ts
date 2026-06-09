/**
 * POST /api/graphify/clone — remote-repo runner (#6). Clone a public repo
 * (https-only, host-allowlisted) to a sandboxed per-request temp dir with
 * --depth 1, build its knowledge graph, return graph + health, then delete the
 * clone. operator+, workspace-scoped intent (the graph is the repo's structure,
 * no customer data). git invoked via execFile (argv, no shell) with a hard timeout.
 */
import { NextRequest, NextResponse } from 'next/server'
import { mkdtemp, rm, readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { requireRole } from '@/lib/auth'
import { buildGraph, graphHealth, isExcluded, type FileInput } from '@/lib/graphify/graph'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const efp = promisify(execFile)
const ALLOWED_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org']
const HEAVY = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'graphify-out', '.cache', 'logs', 'vendor', 'venv', '__pycache__']
const MAX_FILES = 4000

async function scan(dir: string, root: string, acc: string[] = []): Promise<string[]> {
  if (acc.length > MAX_FILES) return acc
  let entries: import('node:fs').Dirent[] = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    if (HEAVY.includes(e.name) || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    const rel = full.slice(root.length + 1)
    if (isExcluded(rel)) continue
    if (e.isDirectory()) await scan(full, root, acc)
    else if (/\.(ts|tsx|js|jsx|py|go|rs|java|rb)$/.test(e.name)) acc.push(rel)
    if (acc.length > MAX_FILES) break
  }
  return acc
}

function resolveImport(spec: string, fromRel: string, ids: Set<string>): string | null {
  let target: string | null = null
  if (spec.startsWith('@/')) target = 'src/' + spec.slice(2)
  else if (spec.startsWith('.')) {
    const parts = (fromRel.split('/').slice(0, -1).join('/') + '/' + spec).split('/')
    const out: string[] = []
    for (const seg of parts) { if (seg === '.' || seg === '') continue; if (seg === '..') out.pop(); else out.push(seg) }
    target = out.join('/')
  }
  if (!target) return null
  for (const c of [target, target + '.ts', target + '.tsx', target + '.js', target + '/index.ts', target + '/index.tsx']) if (ids.has(c)) return c
  return null
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = (await request.json().catch(() => null)) as { url?: string } | null
  const repoUrl = String(body?.url ?? '').trim()
  let parsed: URL
  try { parsed = new URL(repoUrl) } catch { return NextResponse.json({ error: 'invalid url' }, { status: 400 }) }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: 'https only, host must be github.com / gitlab.com / bitbucket.org' }, { status: 400 })
  }
  if (/[;&|`$(){}<>\s]/.test(repoUrl)) return NextResponse.json({ error: 'illegal characters in url' }, { status: 400 })

  let dir = ''
  try {
    dir = await mkdtemp(join(tmpdir(), 'graphify-clone-'))
    await efp('git', ['clone', '--depth', '1', '--single-branch', '--no-tags', repoUrl, dir], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 })
    const rels = await scan(dir, dir)
    const ids = new Set(rels)
    let mtimeSum = 0
    const inputs: FileInput[] = []
    for (const rel of rels) {
      const imports: string[] = []
      try {
        const st = await stat(join(dir, rel)); mtimeSum += Math.floor(st.mtimeMs)
        const txt = await readFile(join(dir, rel), 'utf8')
        for (const m of txt.matchAll(/(?:import|from|require)[^'"]*['"]([^'"]+)['"]/g)) {
          const hit = resolveImport(m[1], rel, ids)
          if (hit) imports.push(hit)
        }
      } catch { /* skip */ }
      inputs.push({ path: rel, imports })
    }
    const graph = buildGraph(inputs, Date.now(), `${rels.length}:${mtimeSum}`)
    return NextResponse.json({ ok: true, graph, health: { ...graphHealth(graph), source: repoUrl } })
  } catch (e) {
    return NextResponse.json({ error: `clone/build failed: ${(e as Error).message}` }, { status: 502 })
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
