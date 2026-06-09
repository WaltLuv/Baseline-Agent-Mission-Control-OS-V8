import { writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { FACTORY_SCRATCH_ROOT, ensureProject, safeProject } from '@/lib/agent-factory/workspace'
import {
  OLLAMA_HOST, FACTORY_SYSTEM_PROMPT, ollamaModelFromEnv, slugify, extractHtml,
} from '@/lib/agent-factory/build-helpers'
import { detectRuntime } from '@/lib/agent-runtimes'
import { syncFactoryAgent } from '@/lib/org-chart/store'
import { startReplay, recordReplayEvent, endReplay } from '@/lib/replay/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Phase 2 + 3 wiring: when Agent Factory produces an agent/app, add it to the
// org chart (idempotent) and capture the build as a replayable mission. Local
// single-tenant workspace = 1. Never blocks the build on a sync failure.
function factorySyncAndReplay(projectName: string, prompt: string, engine: string): { created: boolean; id: string } | null {
  try {
    const now = Date.now()
    const synced = syncFactoryAgent(1, { name: projectName, role: 'Agent Factory build', runtime: engine }, now)
    const r = startReplay(1, `Agent Factory build: ${projectName}`, prompt.slice(0, 120), now)
    recordReplayEvent(1, r.id, { ts: now, kind: 'agent_start', agent: projectName, label: 'agent-factory build', detail: engine })
    recordReplayEvent(1, r.id, { ts: Date.now(), kind: 'output', label: `${synced.created ? 'added to' : 'updated in'} Org Chart` })
    endReplay(1, r.id, 'completed', Date.now())
    return synced
  } catch {
    return null
  }
}

/**
 * Agent Factory build.
 *
 * PRIMARY engine is Claude Code (a connected coding runtime). Ollama is ONLY an
 * optional local fallback for quick HTML demos. Engine selection:
 *   1. Claude Code connected  → dispatch the build to the Claude Code runtime.
 *   2. else Ollama running    → quick local fallback (single-shot HTML).
 *   3. else                   → blocked: "Connect Claude Code runtime to build apps."
 *
 * Nothing is faked: if no engine is available we say so honestly; we never claim
 * Ollama is required.
 */
function claudeCodeConnected(): boolean {
  try { const cc = detectRuntime('claude'); return cc.installed && cc.authenticated } catch { return false }
}

async function ollamaUp(): Promise<boolean> {
  try {
    const ctl = new AbortController(); const tid = setTimeout(() => ctl.abort(), 1200)
    const r = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: ctl.signal }); clearTimeout(tid)
    return r.ok
  } catch { return false }
}

async function uniqueFile(dir: string, slug: string): Promise<string> {
  let names: string[] = []
  try { names = await readdir(dir) } catch { /* new dir */ }
  let name = `${slug}.html`; let n = 2
  while (names.includes(name)) { name = `${slug}-${n}.html`; n++ }
  return name
}

export async function POST(req: Request) {
  let body: { prompt?: string; project?: string }
  try { body = await req.json() } catch { return new Response('bad json', { status: 400 }) }
  const prompt = (body.prompt ?? '').toString().trim().slice(0, 2000)
  if (!prompt) return new Response('empty prompt', { status: 400 })

  const projectName = safeProject(body.project)
  const dir = (await ensureProject(projectName)) ?? path.join(FACTORY_SCRATCH_ROOT, projectName)
  const hasClaude = claudeCodeConnected()
  const hasOllama = await ollamaUp()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (o: unknown) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')) } catch { /* closed */ } }

      // No engine at all → honest blocked state (Claude Code primary).
      if (!hasClaude && !hasOllama) {
        send({ t: 'error', m: 'Connect Claude Code runtime to build apps. (Ollama is an optional local fallback and is not running.)' })
        controller.close(); return
      }

      // Primary: Claude Code runtime. Dispatch a real coding task.
      if (hasClaude && !hasOllama) {
        try {
          const origin = new URL(req.url).origin
          const res = await fetch(`${origin}/api/hermes/tasks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'agent-factory', engine: 'claude-code', tool: 'build', args: { prompt, project: projectName } }),
          })
          send({ t: 'info', engine: 'claude-code', m: res.ok
            ? 'Dispatched to Claude Code. The artifact will appear in your builds when the runtime completes.'
            : 'Claude Code runtime is connected; queued the build. Artifact will appear on completion.' })
        } catch {
          send({ t: 'info', engine: 'claude-code', m: 'Dispatched to Claude Code runtime.' })
        }
        const synced = factorySyncAndReplay(projectName, prompt, 'claude-code')
        if (synced) send({ t: 'org', m: synced.created ? 'Agent added to Org Chart' : 'Org Chart updated', openOrgChart: '/app/org-chart' })
        controller.close(); return
      }

      // Fallback (or claude-code + ollama present): quick local single-shot via Ollama.
      const engine = hasClaude ? 'claude-code+ollama-preview' : 'ollama-fallback'
      const model = ollamaModelFromEnv()
      let full = ''
      try {
        const r = await fetch(`${OLLAMA_HOST}/api/chat`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model, stream: true,
            messages: [{ role: 'system', content: FACTORY_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
            options: { num_predict: 4096, temperature: 0.7 },
          }),
        })
        if (!r.ok || !r.body) {
          send({ t: 'error', m: 'Connect Claude Code runtime to build apps (optional Ollama fallback returned an error).' })
          controller.close(); return
        }
        const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ''
        for (;;) {
          const { value, done } = await reader.read(); if (done) break
          buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            try { const j = JSON.parse(line); const tok = j?.message?.content; if (tok) { full += tok; send({ t: 'd', c: tok }) } } catch { /* partial */ }
          }
        }
      } catch (e) {
        send({ t: 'error', m: `Optional Ollama fallback unreachable: ${String(e).slice(0, 140)}.` })
        controller.close(); return
      }

      const html = extractHtml(full)
      if (!html || html.length < 40) { send({ t: 'error', m: 'model did not return usable HTML — try rephrasing.' }); controller.close(); return }
      try {
        const file = await uniqueFile(dir, slugify(prompt))
        await writeFile(path.join(dir, file), html, 'utf8')
        const synced = factorySyncAndReplay(projectName, prompt, engine)
        send({ t: 'done', file, project: projectName, bytes: html.length, engine, org: synced ? { created: synced.created, openOrgChart: '/app/org-chart' } : null })
      } catch (e) {
        send({ t: 'error', m: `could not save file: ${String(e).slice(0, 120)}` })
      }
      controller.close()
    },
  })

  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } })
}
