/**
 * GStack import — manifest + validator + wiring tests.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import {
  GSTACK_MANIFEST,
  GSTACK_FIRST_25_COUNT,
  validateGStackManifest,
  classifyManifest,
} from '@/lib/gstack/manifest'
import { getSurface } from '@/lib/parity/surfaces'

describe('GStack import', () => {
  it('bundles a first-25 manifest with unique slugs', () => {
    expect(GSTACK_FIRST_25_COUNT).toBe(25)
    expect(GSTACK_MANIFEST.length).toBe(25)
    expect(new Set(GSTACK_MANIFEST.map((s) => s.slug)).size).toBe(25)
  })

  it('every skill is classified, priced, approval-tiered, with proof expectations', () => {
    for (const s of GSTACK_MANIFEST) {
      expect(s.category, `${s.slug} category`).toBeTruthy()
      expect(['free', 'paid']).toContain(s.pricing)
      expect(typeof s.priceUsd).toBe('number')
      expect(['auto', 'review', 'walt-only']).toContain(s.approvalTier)
      expect(Array.isArray(s.requiredCredentials)).toBe(true)
      expect(s.proofExpectations.length).toBeGreaterThan(0)
    }
  })

  it('paid skills have a positive price, free skills are zero', () => {
    for (const s of GSTACK_MANIFEST) {
      if (s.pricing === 'paid') expect(s.priceUsd).toBeGreaterThan(0)
      else expect(s.priceUsd).toBe(0)
    }
  })

  it('classifies the manifest by category covering every skill', () => {
    const byCat = classifyManifest()
    const total = Object.values(byCat).reduce((n, arr) => n + arr.length, 0)
    expect(total).toBe(25)
  })

  it('validator accepts the bundled manifest and rejects bad input', () => {
    expect(validateGStackManifest(GSTACK_MANIFEST).ok).toBe(true)
    expect(validateGStackManifest('not-an-array').ok).toBe(false)
    expect(validateGStackManifest([{ name: 'no slug' }]).ok).toBe(false)
    const dupe = validateGStackManifest([GSTACK_MANIFEST[0], GSTACK_MANIFEST[0]])
    expect(dupe.ok).toBe(false)
    expect(dupe.errors.join(' ')).toMatch(/duplicate/)
  })

  it('is routed + nav-visible + has an import API', () => {
    const surface = getSurface('gstack-import')
    expect(surface?.mcRoute).toBe('/app/gstack-import')
    expect(surface?.status).toBe('live')

    const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
    expect(router).toContain("case 'gstack-import'")
    expect(router).toContain('GStackImportPanel')

    const nav = readFileSync('src/components/layout/nav-rail.tsx', 'utf8')
    expect(nav).toContain("id: 'gstack-import'")

    // a real import API route exists
    const api = readFileSync('src/app/api/gstack/import/route.ts', 'utf8')
    expect(api).toContain('validateGStackManifest')
  })
})
