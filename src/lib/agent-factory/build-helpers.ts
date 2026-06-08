/**
 * Agent Factory — pure helpers for the local "build me X" pipeline.
 *
 * The factory asks a LOCAL Ollama model (localhost:11434) for a single,
 * self-contained HTML file in one shot (no agentic tool loop, which hangs local
 * general models), then extracts and saves the HTML. These helpers are pure so
 * they can be unit-tested without a model or filesystem.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'

export const FACTORY_SYSTEM_PROMPT =
  'You are a world-class creative front-end developer. Output ONLY a single, ' +
  'complete, self-contained HTML file — vanilla JS + HTML5 canvas where useful, ' +
  'NO external libraries, no build step. It must be visually stunning, ' +
  'full-window, dark background, smooth 60fps. Start your output with ' +
  '<!DOCTYPE html> and output NOTHING else: no markdown fences, no explanation.'

/** Resolve the active local model from ~/.fcc/.env (MODEL="ollama/..."), else a default. */
export function ollamaModelFromEnv(home = os.homedir()): string {
  try {
    const env = readFileSync(path.join(home, '.fcc', '.env'), 'utf8')
    const line = env.split('\n').find((l) => l.trim().startsWith('MODEL='))
    if (line) {
      const v = line.slice(line.indexOf('=') + 1).replace(/^["']|["']$/g, '').trim()
      if (v.startsWith('ollama/')) return v.slice('ollama/'.length)
      if (v) return v
    }
  } catch { /* no fcc env — use default */ }
  return process.env.AGENT_FACTORY_MODEL || 'gemma2'
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'build'
}

/** Pull the HTML document out of a model response (handles fences + preamble). */
export function extractHtml(text: string): string {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i)
  let h = fence ? fence[1] : text
  const start = h.search(/<!DOCTYPE html|<html/i)
  if (start > 0) h = h.slice(start)
  const end = h.toLowerCase().lastIndexOf('</html>')
  if (end !== -1) h = h.slice(0, end + 7)
  return h.trim()
}

/** A nicer prompt label for a build file (used by the gallery self-heal). */
export function promptForFile(file: string): string {
  const base = file.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim()
  return base || file
}
