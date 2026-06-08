import { NextResponse } from 'next/server'
import { OLLAMA_HOST, ollamaModelFromEnv } from '@/lib/agent-factory/build-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Agent Factory readiness — honest local-model status. Reports whether Ollama is
 * reachable and which model the factory will use. No fake "ready": if Ollama
 * isn't running we say so, with the exact setup steps.
 */
export async function GET() {
  const model = ollamaModelFromEnv()
  let reachable = false
  let models: string[] = []
  try {
    const ctl = new AbortController()
    const tid = setTimeout(() => ctl.abort(), 1500)
    const r = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: ctl.signal })
    clearTimeout(tid)
    if (r.ok) {
      reachable = true
      const j = (await r.json()) as { models?: { name?: string }[] }
      models = (j.models ?? []).map((m) => m.name ?? '').filter(Boolean)
    }
  } catch { reachable = false }

  return NextResponse.json({
    reachable,
    model,
    models,
    host: OLLAMA_HOST,
    setup: reachable ? null : 'Install Ollama (https://ollama.com), run `ollama serve`, then `ollama pull gemma2`. Set ~/.fcc/.env MODEL="ollama/gemma2" to choose a model.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
