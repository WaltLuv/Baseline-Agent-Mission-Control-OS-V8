/**
 * Baseline OS ↔ Mission Control parity — every Baseline OS major surface must
 * have a Mission Control route (live or honest-state), never missing.
 */
import { readFileSync, existsSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { FEATURE_SURFACES, nonLiveSurfaces, getSurface } from '@/lib/parity/surfaces'

const routerSrc = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
const navSrc = readFileSync('src/components/layout/nav-rail.tsx', 'utf8')

describe('MC ↔ Baseline OS parity', () => {
  it('parity matrix doc exists', () => {
    expect(existsSync('docs/audit/BASELINE_TO_MISSION_CONTROL_PARITY.md')).toBe(true)
  })

  it('every major Baseline OS surface from Walt\'s audit list has an MC surface', () => {
    const slugs = new Set(FEATURE_SURFACES.map((s) => s.slug))
    for (const required of [
      'overview', 'activate', 'workforce', 'agents', 'personas', 'runtimes', 'claude-code',
      'codex', 'openclaw', 'hermes', 'hermes-manage', 'hermes-vps', 'slim-voice', 'oh-my-pi', 'antigravity', 'gemini', 'free-claude', 'browser-use', 'ruflo',
      'creative', 'higgsfield', 'hyperframes', 'minimax', 'video-studio', 'asset-library',
      'knowledge-os', 'memory', 'notebooklm', 'obsidian', 'notion', 'pinecone', 'pi-agent', 'documents', 'library',
      'skills', 'marketplace', 'billing', 'credentials', 'flight-deck', 'orchestration', 'kanban', 'approvals', 'proofs',
      'activity', 'value', 'daily-brief', 'executive-briefing', 'goals', 'seo', 'settings', 'admin', 'help',
    ]) {
      expect(slugs, `parity surface missing: ${required}`).toContain(required)
    }
  })

  it('the MC nav exposes every panel-routed parity surface (no hidden nav)', () => {
    const navExposed = FEATURE_SURFACES.filter((s) => s.mcRoute === `/app/${s.slug}` || s.mcRoute === '/app')
    for (const s of navExposed) {
      const id = s.slug === 'overview' ? 'overview' : s.slug
      expect(navSrc, `nav missing tab for ${s.slug}`).toContain(`id: '${id}'`)
    }
  })

  it('every surface has a real mcRoute + a status (no "missing")', () => {
    for (const s of FEATURE_SURFACES) {
      expect(s.mcRoute, `${s.slug} has no mcRoute`).toMatch(/^\//)
      expect(['live', 'cloud_pairing', 'connect_baseline', 'setup_needed']).toContain(s.status)
    }
  })

  it('every non-live surface is wired into the panel router (no 404)', () => {
    for (const s of nonLiveSurfaces()) {
      // non-live surfaces either route to an existing live panel (e.g. /app/runtimes)
      // or are handled by FeatureSurfacePanel via a case in the router.
      const routesToLive = !s.mcRoute.startsWith(`/app/${s.slug}`)
      const hasCase = routerSrc.includes(`case '${s.slug}'`)
      expect(hasCase || routesToLive, `${s.slug} not wired (no router case, no live redirect)`).toBe(true)
    }
  })

  it('non-live surfaces carry an honest enable hint', () => {
    for (const s of nonLiveSurfaces()) {
      if (s.mcRoute.startsWith(`/app/${s.slug}`)) {
        expect(s.enableHint, `${s.slug} missing enableHint`).toBeTruthy()
      }
    }
  })

  it('PI Agent and Oh My Pi are distinct surfaces (not conflated)', () => {
    expect(getSurface('pi-agent')?.category).toBe('Knowledge')
    expect(getSurface('oh-my-pi')?.category).toBe('Agents & Runtimes')
  })
})
