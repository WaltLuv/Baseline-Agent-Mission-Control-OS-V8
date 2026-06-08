/**
 * P5 — forbidden names (Julian Goldie / Julian / Jack / Goldie) must not appear
 * anywhere in the tracked source, docs, scripts, seeds, or templates.
 *
 * Excludes node_modules / .git / .next / .data / build output (and git history,
 * which is unavoidable). Word-boundary matched so unrelated words ("hijack",
 * "jackpot") are not falsely flagged.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOTS = ['src', 'docs', 'scripts']
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.data', 'dist', 'coverage'])
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx', '.txt', '.yml', '.yaml', '.sql', '.css', '.html'])
const FORBIDDEN = /\bjulian\s+goldie\b|\bjulian\b|\bgoldie\b|\bjack\b/i

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = []
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (TEXT_EXT.has(extname(p))) out.push(p)
  }
  return out
}

describe('forbidden names removed', () => {
  it('has zero matches across tracked source/docs/scripts', () => {
    const hits: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        // Don't flag this test file's own pattern definition.
        if (file.endsWith('forbidden-names.test.ts')) continue
        const content = readFileSync(file, 'utf8')
        if (FORBIDDEN.test(content)) hits.push(file)
      }
    }
    expect(hits, `forbidden names found in: ${hits.join(', ')}`).toEqual([])
  })
})
