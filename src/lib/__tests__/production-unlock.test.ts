/**
 * Production Unlock Center — data + wiring tests.
 * Verifies every required integration is present, references a real provider,
 * exposes env vars / features / impact, and that the surface is routed + nav-visible.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { UNLOCK_ITEMS, unlockItemsByImpact, getUnlockItem, allProviderRefsResolve } from '@/lib/production-unlock'
import { PROVIDER_CATALOG } from '@/lib/credentials/catalog'
import { FEATURE_SURFACES, getSurface } from '@/lib/parity/surfaces'

describe('Production Unlock Center', () => {
  it('covers every integration Walt named', () => {
    for (const id of [
      'stripe', 'google_oauth', 'notebooklm', 'notion', 'pinecone', 'elevenlabs',
      'realtime_voice', 'higgsfield', 'telegram', 'github', 'vercel', 'ollama',
      'claude_code_runtime', 'openrouter', 'supabase',
    ]) {
      expect(getUnlockItem(id), `missing unlock item ${id}`).toBeTruthy()
    }
  })

  it('Stripe item includes the webhook secret env var', () => {
    const stripe = getUnlockItem('stripe')!
    expect(stripe.requiredEnvVars).toContain('STRIPE_WEBHOOK_SECRET')
    expect(stripe.requiredEnvVars).toContain('STRIPE_SECRET_KEY')
    expect(stripe.impact).toBe('critical')
  })

  it('every backing provider id resolves to a real catalog entry (no dead refs)', () => {
    expect(allProviderRefsResolve()).toBe(true)
    const ids = new Set(PROVIDER_CATALOG.map((p) => p.id))
    for (const u of UNLOCK_ITEMS) {
      for (const pid of u.providerIds) expect(ids, `${u.id} → unknown provider ${pid}`).toContain(pid)
    }
  })

  it('every item has env vars or features, an impact, where-used, and setup instructions', () => {
    for (const u of UNLOCK_ITEMS) {
      expect(['critical', 'high', 'medium', 'low']).toContain(u.impact)
      expect(u.whereUsed.length).toBeGreaterThan(0)
      expect(u.setupInstructions.length).toBeGreaterThan(0)
      expect(u.requiredEnvVars.length + u.featuresUnlocked.length).toBeGreaterThan(0)
    }
  })

  it('Agent Factory unlock is Claude Code primary; Ollama is an optional fallback (not required)', () => {
    expect(getUnlockItem('claude_code_runtime')!.providerIds).toContain('claude_code')
    const ollama = getUnlockItem('ollama')!
    expect(ollama.impact).toBe('low')
    expect(ollama.setupInstructions.toLowerCase()).toMatch(/optional fallback/)
  })

  it('is sorted critical → low by impact', () => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const
    const ranks = unlockItemsByImpact().map((u) => order[u.impact])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('is routed in the panel router and nav-visible (no hidden surface)', () => {
    const surface = getSurface('production-unlock')
    expect(surface?.mcRoute).toBe('/app/production-unlock')
    expect(surface?.status).toBe('live')

    const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
    expect(router).toContain("case 'production-unlock'")
    expect(router).toContain('ProductionUnlockPanel')

    const nav = readFileSync('src/components/layout/nav-rail.tsx', 'utf8')
    expect(nav).toContain("id: 'production-unlock'")
  })

  it('does not mark setup-needed integrations as complete (status comes from live state)', () => {
    // The data module carries NO hard-coded "connected" status — it is data only.
    const panel = readFileSync('src/components/panels/production-unlock-panel.tsx', 'utf8')
    expect(panel).toContain('/api/credentials/catalog')
    expect(panel).toContain('Missing')
  })
})
