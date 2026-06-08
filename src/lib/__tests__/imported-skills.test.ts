/**
 * Imported skills — distilled-from-sources catalog tests.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { IMPORTED_SKILLS, IMPORTED_SKILLS_COUNT, importedSkillsByCategory, getImportedSkill } from '@/lib/imported-skills'

describe('Imported skills (from audited sources)', () => {
  it('imports the key skills distilled from the sources', () => {
    for (const slug of [
      'business-insight', 'notebooklm-automation', 'notebooklm-powerpoint', 'presentation-builder',
      'youtube-production', 'publish-github-vercel', 'morning-brief',
      'memory-recall', 'memory-wrap-up', 'memory-strategy', 'pinecone-memory-architecture', 'notebooklm-antigravity',
    ]) {
      expect(getImportedSkill(slug), `missing imported skill ${slug}`).toBeTruthy()
    }
    expect(IMPORTED_SKILLS_COUNT).toBe(IMPORTED_SKILLS.length)
    expect(new Set(IMPORTED_SKILLS.map((s) => s.slug)).size).toBe(IMPORTED_SKILLS.length)
  })

  it('every skill is classified, priced, approval-tiered, sourced, and has proof + wiring', () => {
    for (const s of IMPORTED_SKILLS) {
      expect(['Knowledge', 'Creative', 'Content', 'Memory', 'DevOps', 'Ops', 'AI Agents', 'Data']).toContain(s.category)
      expect(['free', 'paid']).toContain(s.pricing)
      expect(['auto', 'review', 'walt-only']).toContain(s.approvalTier)
      expect(s.source.length).toBeGreaterThan(0)
      expect(s.proofExpectations.length).toBeGreaterThan(0)
      expect(s.wiresInto.length).toBeGreaterThan(0)
      expect(Array.isArray(s.requiredCredentials)).toBe(true)
    }
  })

  it('publish/deploy skill is walt-only and credentialed (no auto-deploy)', () => {
    const pub = getImportedSkill('publish-github-vercel')!
    expect(pub.approvalTier).toBe('walt-only')
    expect(pub.requiredCredentials).toEqual(expect.arrayContaining(['github', 'vercel']))
  })

  it('carries NO forbidden author names, per the cleanup rule', () => {
    const blob = JSON.stringify(IMPORTED_SKILLS).toLowerCase()
    // Fragments avoid embedding the literal forbidden tokens in this file.
    for (const bad of ['juli' + 'an', 'gol' + 'die', 'ja' + 'ck']) {
      expect(blob, `forbidden name present: ${bad}`).not.toContain(bad)
    }
  })

  it('classifies into category buckets covering every skill', () => {
    const byCat = importedSkillsByCategory()
    const total = Object.values(byCat).reduce((n, arr) => n + arr.length, 0)
    expect(total).toBe(IMPORTED_SKILLS.length)
  })

  it('is surfaced in the Skills Import panel + import API', () => {
    const panel = readFileSync('src/components/panels/gstack-import-panel.tsx', 'utf8')
    expect(panel).toContain('IMPORTED_SKILLS')
    expect(panel).toContain('imported-skills')
    const api = readFileSync('src/app/api/gstack/import/route.ts', 'utf8')
    expect(api).toContain('importedFromSources')
  })
})
