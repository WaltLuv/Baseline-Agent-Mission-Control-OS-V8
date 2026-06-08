/**
 * Agent Factory — local "build me X" pipeline: pure helpers, workspace safety,
 * routes/UI wiring, and honest local-model status.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { extractHtml, slugify, ollamaModelFromEnv, promptForFile, FACTORY_SYSTEM_PROMPT, OLLAMA_HOST } from '@/lib/agent-factory/build-helpers'
import { safeProject, DEFAULT_PROJECT } from '@/lib/agent-factory/workspace'

describe('build helpers', () => {
  it('extracts HTML from a fenced response', () => {
    const out = extractHtml('Here you go:\n```html\n<!DOCTYPE html><html><body>hi</body></html>\n```\nEnjoy!')
    expect(out.startsWith('<!DOCTYPE html')).toBe(true)
    expect(out.endsWith('</html>')).toBe(true)
  })
  it('extracts HTML with no fences + preamble', () => {
    const out = extractHtml('sure! <!DOCTYPE html><html>x</html> done')
    expect(out).toBe('<!DOCTYPE html><html>x</html>')
  })
  it('slugifies prompts safely', () => {
    expect(slugify('build me a Snake Game!!')).toBe('build-me-a-snake-game')
    expect(slugify('')).toBe('build')
  })
  it('falls back to a default model when no fcc env', () => {
    expect(ollamaModelFromEnv('/nonexistent-home-xyz')).toBeTruthy()
  })
  it('humanizes a build filename', () => {
    expect(promptForFile('neon-galaxy.html')).toBe('neon galaxy')
  })
  it('points at local Ollama and instructs a single self-contained file', () => {
    expect(OLLAMA_HOST).toMatch(/11434/)
    expect(FACTORY_SYSTEM_PROMPT).toMatch(/self-contained HTML/i)
  })
})

describe('workspace safety', () => {
  it('rejects traversal/invalid project names', () => {
    expect(safeProject('../etc')).toBe(DEFAULT_PROJECT)
    expect(safeProject('my-app')).toBe('my-app')
    expect(safeProject(null)).toBe(DEFAULT_PROJECT)
  })
})

describe('routes + UI exist and stay honest', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
  it('build/builds/preview/status routes exist', () => {
    for (const p of ['build', 'builds', 'status']) {
      expect(existsSync(`src/app/api/agent-factory/${p}/route.ts`), `missing ${p} route`).toBe(true)
    }
    expect(existsSync('src/app/api/agent-factory/preview/[...path]/route.ts')).toBe(true)
  })
  it('build route streams from local Ollama (no cloud, no fake)', () => {
    const src = read('src/app/api/agent-factory/build/route.ts')
    expect(src).toContain('/api/chat')
    expect(src).toContain('OLLAMA_HOST')
    expect(src).toMatch(/local model not reachable/i)
  })
  it('preview route blocks path traversal', () => {
    expect(read('src/app/api/agent-factory/preview/[...path]/route.ts')).toContain('forbidden')
  })
  it('panel has prompt, mic, build, live preview iframe, and gallery', () => {
    const src = read('src/components/agent-factory/agent-factory-panel.tsx')
    expect(src).toContain('factory-prompt')
    expect(src).toContain('factory-mic')
    expect(src).toContain('factory-build')
    expect(src).toContain('factory-preview')
    expect(src).toContain('factory-gallery')
    expect(src).toContain('/api/agent-factory/preview/')
    expect(src).toContain('factory-setup-needed') // honest local-model state
  })
  it('Slim Charles voice triggers a real factory build on "build me…"', () => {
    expect(read('src/components/voice/slim-charles-voice.tsx')).toContain('/api/agent-factory/build')
  })
})
