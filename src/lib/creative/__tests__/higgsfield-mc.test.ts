/**
 * Mission Control Higgsfield surface — model + wiring tests.
 * Honest cloud status, no-fake-media universal-asset contract, 4 skills wired
 * into the marketplace, provider sovereignty (assets belong to MC/Baseline OS).
 */
import { describe, it, expect } from 'vitest'
import {
  HIGGSFIELD_SKILLS,
  deriveHiggsfieldCloudStatus,
  higgsfieldCloudConnected,
  projectCloudAssets,
  HIGGSFIELD_SUBSYSTEMS,
} from '@/lib/creative/higgsfield'
import { SKILLS } from '@/lib/marketplace-catalog'

describe('MC Higgsfield surface — honest cloud status', () => {
  it('no credential → credentials_missing, never connected', () => {
    const s = deriveHiggsfieldCloudStatus({ credentialPresent: false, linked: true })
    expect(s).toBe('credentials_missing')
    expect(higgsfieldCloudConnected(s)).toBe(false)
  })
  it('credential but not linked → setup_required', () => {
    expect(deriveHiggsfieldCloudStatus({ credentialPresent: true, linked: false })).toBe('setup_required')
  })
  it('credential + linked → ready', () => {
    const s = deriveHiggsfieldCloudStatus({ credentialPresent: true, linked: true })
    expect(s).toBe('ready')
    expect(higgsfieldCloudConnected(s)).toBe(true)
  })
  it('probe error → error, never ready', () => {
    expect(deriveHiggsfieldCloudStatus({ error: true, credentialPresent: true, linked: true })).toBe('error')
  })
})

describe('Universal asset contract — no fake media', () => {
  it('null cloud response → honest storage_not_configured (no fabricated assets)', () => {
    const r = projectCloudAssets(null)
    expect(r.state).toBe('storage_not_configured')
    expect(r.assets).toEqual([])
    expect(r.reason).toBeTruthy()
  })
  it('empty array → honest empty state', () => {
    expect(projectCloudAssets([]).state).toBe('empty')
  })
  it('records project without inventing URLs', () => {
    const r = projectCloudAssets([{ id: '1', type: 'video', url: 'https://cdn/x.mp4', prompt: 'p' }, { id: '2', type: 'image' }])
    expect(r.state).toBe('ok')
    expect(r.assets[0].kind).toBe('video')
    expect(r.assets[0].url).toBe('https://cdn/x.mp4')
    expect(r.assets[1].url).toBeNull() // never invented
  })
})

describe('The 4 Higgsfield skills', () => {
  it('exist with full metadata + pinned hashes', () => {
    expect(HIGGSFIELD_SKILLS.map((s) => s.slug).sort()).toEqual([
      'higgsfield-generate', 'higgsfield-marketplace-cards', 'higgsfield-product-photoshoot', 'higgsfield-soul-id',
    ])
    for (const s of HIGGSFIELD_SKILLS) {
      expect(s.inputs.length).toBeGreaterThan(0)
      expect(s.outputs.length).toBeGreaterThan(0)
      expect(s.requiredCredentials).toContain('HIGGSFIELD_API_KEY_ID')
      expect(s.sourceHash).toMatch(/^[a-f0-9]{64}$/)
      expect(['available', 'installed']).toContain(s.installStatus)
      expect(['listed', 'unlisted']).toContain(s.marketplaceStatus)
      expect(['free', 'included', 'paid']).toContain(s.pricing)
    }
  })
  it('Soul ID is HIGH approval (real likeness)', () => {
    expect(HIGGSFIELD_SKILLS.find((s) => s.slug === 'higgsfield-soul-id')?.approval).toBe('high')
    expect(HIGGSFIELD_SUBSYSTEMS.find((s) => s.id === 'soul-id')?.approval).toBe('high')
  })
  it('all 4 are wired into the marketplace catalog (Creative category)', () => {
    const creative = SKILLS.filter((s) => s.category === 'Creative').map((s) => s.slug)
    for (const slug of HIGGSFIELD_SKILLS.map((s) => s.slug)) {
      expect(creative, `${slug} missing from marketplace`).toContain(slug)
    }
  })
})
