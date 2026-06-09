/**
 * Creative assets — workspace-scoped Universal Asset Library for the MC Video /
 * Creative Studio. GET lists this workspace's assets; POST ingests one (base64)
 * to <dataDir>/creative/ws<id>/ with a lineage record. Customer-safe: every
 * read/write is bound to the caller's workspace_id (no cross-tenant access, no
 * Walt-private data). operator+ to write.
 */
import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'pdf', 'txt', 'md', 'json', 'csv'])
const MAX = 64 * 1024 * 1024

function wsDir(ws: number): string {
  return join(config.dataDir, 'creative', `ws${ws}`)
}
function kindOf(ext: string): string {
  return /png|jpe?g|webp|gif|svg/.test(ext) ? 'image' : /mp4|webm|mov/.test(ext) ? 'video' : /mp3|wav|ogg|m4a/.test(ext) ? 'audio' : 'document'
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const dir = wsDir(ws)
  const items: { name: string; size: number; mtime: number; kind: string; url: string }[] = []
  if (existsSync(dir)) {
    for (const name of await readdir(dir).catch(() => [])) {
      if (name.startsWith('.')) continue
      try {
        const st = await stat(join(dir, name))
        if (!st.isFile()) continue
        items.push({ name, size: st.size, mtime: st.mtimeMs, kind: kindOf(extname(name).slice(1).toLowerCase()), url: `/api/creative/assets/raw?name=${encodeURIComponent(name)}` })
      } catch { /* skip */ }
    }
  }
  return NextResponse.json({ workspace: ws, items })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const body = await request.json().catch(() => null) as { name?: string; base64?: string } | null
  if (!body?.name || !body?.base64) return NextResponse.json({ error: 'name + base64 required' }, { status: 400 })
  const rawName = basename(String(body.name)).replace(/[^A-Za-z0-9._-]/g, '_')
  const ext = extname(rawName).slice(1).toLowerCase()
  if (!ALLOWED.has(ext)) return NextResponse.json({ error: `unsupported type .${ext}` }, { status: 415 })
  const buf = Buffer.from(String(body.base64).replace(/^data:[^;]+;base64,/, ''), 'base64')
  if (buf.length > MAX) return NextResponse.json({ error: 'too large (64MB max)' }, { status: 413 })
  const dir = wsDir(ws)
  await mkdir(join(dir, '.lineage'), { recursive: true })
  const stamped = `${Date.now().toString(36)}-${rawName}`
  await writeFile(join(dir, stamped), buf)
  const lineage = { name: stamped, original: rawName, kind: kindOf(ext), size: buf.length, source: 'upload', workspace: ws, uploadedAt: new Date().toISOString(), library: 'universal-asset' }
  await writeFile(join(dir, '.lineage', `${stamped}.json`), JSON.stringify(lineage, null, 2))
  return NextResponse.json({ ok: true, asset: { name: stamped, size: buf.length, kind: kindOf(ext), url: `/api/creative/assets/raw?name=${encodeURIComponent(stamped)}`, lineage } })
}
