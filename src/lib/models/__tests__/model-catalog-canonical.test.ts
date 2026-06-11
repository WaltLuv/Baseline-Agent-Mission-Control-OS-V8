/**
 * Model catalogue — canonical-source + no-deprecated-models guard.
 *
 * Proves (P1 requirements):
 *   1. one canonical catalogue (FEATURED_CATALOG / CURRENT_MODEL_SLUGS)
 *   2. selectors read from the canonical catalogue (no duplicate hardcoded lists)
 *   3. current tier labels exist (reasoning / coding / fast-cheap / multimodal / voice)
 *   4. seeded agents use current models
 *   5. NO deprecated model names anywhere in non-test source
 *   6. customer view hides provider internals
 *   7. admin/operator view exposes provider details
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  FEATURED_CATALOG,
  ALIASES,
  CURRENT_MODEL_SLUGS,
  DEPRECATED_MODEL_PATTERNS,
  isDeprecatedModel,
} from '../featured'

const SRC = join(process.cwd(), 'src')
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules' || name === '.next') continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

describe('canonical catalogue', () => {
  it('has a single source of truth with current slugs only', () => {
    expect(FEATURED_CATALOG.length).toBeGreaterThan(0)
    expect(CURRENT_MODEL_SLUGS.length).toBeGreaterThan(0)
    for (const e of FEATURED_CATALOG) expect(isDeprecatedModel(e.model_slug)).toBe(false)
    for (const slugs of Object.values(ALIASES)) {
      for (const s of slugs) expect(isDeprecatedModel(s)).toBe(false)
    }
  })

  it('labels the required tiers (reasoning, coding, fast/cheap, multimodal, voice/realtime)', () => {
    const tiers = new Set(FEATURED_CATALOG.map((e) => e.tier))
    for (const t of ['best_reasoning', 'best_coding', 'best_cheap_fast', 'best_multimodal', 'best_voice_realtime']) {
      expect(tiers.has(t as never)).toBe(true)
    }
  })

  it('features current flagships and NO deprecated families', () => {
    const slugs = CURRENT_MODEL_SLUGS.join(' ')
    expect(slugs).toContain('claude-opus-4-8')
    expect(slugs).toContain('gpt-5.5')
    expect(slugs).toContain('gemini-3.5')
    expect(slugs).not.toMatch(/gpt-4o|claude-3|gemini-pro|o1-preview/)
  })
})

describe('selectors read the canonical catalogue (no duplicate stale lists)', () => {
  it('the models API resolves from FEATURED_CATALOG', () => {
    const route = read('src/app/api/models/route.ts')
    expect(route).toContain('resolveFeatured')
    const resolve = read('src/lib/models/resolve.ts')
    expect(resolve).toContain("from './featured'")
    expect(resolve).toContain('FEATURED_CATALOG')
  })
})

describe('seeded agents use current models', () => {
  it('agent-templates has no deprecated model and uses current slugs', () => {
    const tpl = read('src/lib/agent-templates.ts')
    for (const re of DEPRECATED_MODEL_PATTERNS) expect(tpl).not.toMatch(re)
    expect(tpl).toContain('claude-opus-4-8')
    expect(tpl).toContain('claude-sonnet-4-6')
  })
  it('the PM first-run demo workforce models are current', () => {
    // workforce-template personas + first-run provisioning must not seed stale models
    const fr = read('src/lib/pm/first-run-demo.ts')
    for (const re of DEPRECATED_MODEL_PATTERNS) expect(fr).not.toMatch(re)
  })
})

describe('no deprecated model names anywhere in non-test source', () => {
  it('repo-wide scan is clean', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      // featured.ts DEFINES the deprecated patterns; skip its definition block.
      if (file.endsWith(join('models', 'featured.ts'))) continue
      const text = readFileSync(file, 'utf8')
      for (const re of DEPRECATED_MODEL_PATTERNS) {
        if (re.test(text)) offenders.push(`${file.replace(process.cwd() + '/', '')} :: ${re}`)
      }
    }
    expect(offenders, `deprecated models found:\n${offenders.join('\n')}`).toEqual([])
  })
})

describe('customer view hides provider internals; admin/operator sees them', () => {
  const route = read('src/app/api/models/route.ts')
  it('gates the response by role', () => {
    expect(route).toContain("auth.user.role === 'admin' || auth.user.role === 'operator'")
    expect(route).toContain("view: 'customer'")
    expect(route).toContain("view: 'advanced'")
  })
  it('customer view omits raw provider/slug internals + aliases', () => {
    // The customer branch returns friendly labels, not the raw `models`/`aliases`
    // arrays or `by_source` provider breakdown.
    const customerBlock = route.slice(route.indexOf("view: 'customer'"), route.indexOf("view: 'advanced'"))
    expect(customerBlock).toContain('label: TIER_LABELS')
    expect(customerBlock).not.toContain('by_source')
    expect(customerBlock).not.toContain('aliases,')
  })
})
