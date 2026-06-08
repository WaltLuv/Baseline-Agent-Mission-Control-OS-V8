import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { FACTORY_SCRATCH_ROOT, safeProject, listProjectFiles } from '@/lib/agent-factory/workspace'
import { promptForFile } from '@/lib/agent-factory/build-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-persisted "what you've built" history for the Agent Factory.
 * Lives at <scratch>/<project>/.builds.json so it survives browser clears.
 * GET self-heals: any .html in the project that isn't tracked is folded in.
 */
interface Build { id: number; prompt: string; file: string | null; ts: number }

function buildsPath(project: string): string {
  return path.join(FACTORY_SCRATCH_ROOT, project, '.builds.json')
}

async function readBuilds(project: string): Promise<Build[]> {
  try {
    const raw = await readFile(buildsPath(project), 'utf8')
    const j = JSON.parse(raw)
    return Array.isArray(j) ? j : []
  } catch { return [] }
}

async function writeBuilds(project: string, builds: Build[]): Promise<void> {
  try { await writeFile(buildsPath(project), JSON.stringify(builds, null, 2), 'utf8') } catch { /* read-only fs */ }
}

export async function GET(req: Request) {
  const project = safeProject(new URL(req.url).searchParams.get('project'))
  let builds = await readBuilds(project)

  const ws = await listProjectFiles(project, 200)
  const htmls = ws.files.filter((f) => /\.html?$/i.test(f.relPath))
  const known = new Set(builds.map((b) => b.file))
  const missing = htmls.filter((f) => !known.has(f.relPath))
  if (missing.length || builds.length === 0) {
    let maxId = builds.reduce((m, b) => Math.max(m, b.id), 0)
    const added: Build[] = missing.map((f) => ({ id: ++maxId, prompt: promptForFile(f.relPath), file: f.relPath, ts: f.mtime }))
    builds = [...added, ...builds].sort((a, b) => b.ts - a.ts)
    await writeBuilds(project, builds)
  }
  return NextResponse.json({ project, builds })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const project = safeProject(typeof body.project === 'string' ? body.project : null)
  const prompt = String(body.prompt ?? '').trim().slice(0, 2000)
  const file = body.file == null ? null : String(body.file).slice(0, 200)
  if (!prompt) return NextResponse.json({ error: 'empty prompt' }, { status: 400 })

  const builds = await readBuilds(project)
  const filtered = file ? builds.filter((b) => b.file !== file) : builds
  const id = builds.reduce((m, b) => Math.max(m, b.id), 0) + 1
  const entry: Build = { id, prompt, file, ts: Date.now() }
  const next = [entry, ...filtered].slice(0, 200)
  await writeBuilds(project, next)
  return NextResponse.json({ build: entry, builds: next })
}
