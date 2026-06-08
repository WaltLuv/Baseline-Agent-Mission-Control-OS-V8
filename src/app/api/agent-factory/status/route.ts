import { NextResponse } from 'next/server'
import { OLLAMA_HOST, ollamaModelFromEnv } from '@/lib/agent-factory/build-helpers'
import { deriveFactoryStatus, OLLAMA_RECOMMENDED_MODELS } from '@/lib/agent-factory/engine'
import { detectRuntime } from '@/lib/agent-runtimes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Agent Factory readiness — PRIMARY engine is Claude Code; Ollama is an optional
 * fallback only. Honest: a Claude Code runtime that's installed + authenticated
 * makes the factory READY regardless of Ollama. Ollama state is reported purely
 * as an optional fallback.
 */
export async function GET() {
  // Primary engine: Claude Code coding runtime.
  let claudeCodeConnected = false
  let claudeAuthHint = ''
  try {
    const cc = detectRuntime('claude')
    claudeCodeConnected = cc.installed && cc.authenticated
    claudeAuthHint = cc.authenticated ? '' : cc.authHint
  } catch { claudeCodeConnected = false }

  // Optional fallback: local Ollama.
  let ollamaRunning = false
  let models: string[] = []
  try {
    const ctl = new AbortController()
    const tid = setTimeout(() => ctl.abort(), 1500)
    const r = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: ctl.signal })
    clearTimeout(tid)
    if (r.ok) {
      ollamaRunning = true
      const j = (await r.json()) as { models?: { name?: string }[] }
      models = (j.models ?? []).map((m) => m.name ?? '').filter(Boolean)
    }
  } catch { ollamaRunning = false }

  const status = deriveFactoryStatus({ claudeCodeConnected, ollamaRunning })

  return NextResponse.json({
    ...status,
    claudeCode: { connected: claudeCodeConnected, authHint: claudeAuthHint },
    ollama: {
      running: ollamaRunning,
      host: OLLAMA_HOST,
      model: ollamaModelFromEnv(),
      models,
      recommendedModels: OLLAMA_RECOMMENDED_MODELS,
      note: 'Ollama fallback — optional. Not required for Agent Factory.',
      setup: ollamaRunning ? null : 'Optional: install Ollama (https://ollama.com), run `ollama serve`, then `ollama pull gemma2`.',
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
