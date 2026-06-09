/**
 * GET /api/graphify          → cached knowledge graph + health (build on first
 *                              call; ?refresh=1 to rebuild). ?q=<question> → ranked nodes.
 * Graphify is the Structural Brain Layer: agents query it to locate exact files
 * before scanning the repo. The codebase graph is shared infra (the app's own
 * architecture); the route is auth-gated. Remote repo-import (per-workspace)
 * clones to a sandboxed temp dir — honest setup-needed until the runner is on.
 * Cacheable + repeatable: a query never triggers a full rebuild.
 */
import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { requireRole } from '@/lib/auth'
import { buildGraph, queryGraph, graphHealth, isExcluded, type FileInput, type KnowledgeGraph } from '@/lib/graphify/graph'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let cache: KnowledgeGraph | null = null

async function scan(dir: string, root: string, acc: string[] = []): Promise<string[]> {
  let entries: import('node:fs').Dirent[] = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'graphify-out'].includes(e.name) || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    const rel = full.slice(root.length + 1)
    if (isExcluded(rel)) continue
    if (e.isDirectory()) await scan(full, root, acc)
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) acc.push(rel)
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
  for (const c of [target, target + '.ts', target + '.tsx', target + '/index.ts', target + '/index.tsx']) if (ids.has(c)) return c
  return null
}

async function build(root: string): Promise<KnowledgeGraph> {
  const rels = await scan(join(root, 'src'), root)
  const ids = new Set(rels)
  let mtimeSum = 0
  const inputs: FileInput[] = []
  for (const rel of rels) {
    const imports: string[] = []
    try {
      const st = await stat(join(root, rel)); mtimeSum += Math.floor(st.mtimeMs)
      const txt = await readFile(join(root, rel), 'utf8')
      for (const m of txt.matchAll(/import[^'"]*['"]([^'"]+)['"]/g)) {
        const hit = resolveImport(m[1], rel, ids)
        if (hit) imports.push(hit)
      }
    } catch { /* skip */ }
    inputs.push({ path: rel, imports })
  }
  const graph = buildGraph(inputs, Date.now(), `${rels.length}:${mtimeSum}`)
  try { await mkdir(join(root, 'graphify-out'), { recursive: true }); await writeFile(join(root, 'graphify-out', 'graph.json'), JSON.stringify(graph)) } catch { /* non-fatal */ }
  return graph
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const url = new URL(request.url)
  const root = process.cwd()
  if (!cache || url.searchParams.get('refresh') === '1') {
    try { cache = JSON.parse(await readFile(join(root, 'graphify-out', 'graph.json'), 'utf8')) } catch { cache = null }
    if (!cache || url.searchParams.get('refresh') === '1') cache = await build(root)
  }
  const q = url.searchParams.get('q')
  if (q) return NextResponse.json({ query: q, results: queryGraph(cache, q), total: cache.nodes.length })
  return NextResponse.json({ graph: cache, health: graphHealth(cache) })
}
