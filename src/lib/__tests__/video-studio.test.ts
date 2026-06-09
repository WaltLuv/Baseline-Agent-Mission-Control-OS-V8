/**
 * Mission Control Video / Creative Studio — workspace-scoped parity with the
 * Baseline OS creative workspace.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { getSurface } from '@/lib/parity/surfaces'

const panel = readFileSync('src/components/panels/video-studio-panel.tsx', 'utf8')
const assetsApi = readFileSync('src/app/api/creative/assets/route.ts', 'utf8')
const rawApi = readFileSync('src/app/api/creative/assets/raw/route.ts', 'utf8')
const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
const nav = readFileSync('src/components/layout/nav-rail.tsx', 'utf8')

describe('MC Video / Creative Studio parity', () => {
  it('has the 4-pane workspace + provider select + approval gate + proof', () => {
    for (const t of ['video-studio-panel', 'vs-asset-rail', 'vs-canvas', 'vs-ai-panel', 'vs-timeline', 'vs-proof-drawer', 'vs-provider', 'vs-approval-gate', 'vs-upload-dropzone']) {
      expect(panel, `missing ${t}`).toContain(`data-testid="${t}"`)
    }
  })

  it('embeds Agent Activity (structural awareness inherited)', () => {
    expect(panel).toContain('<AgentActivity agentId="creative-studio"')
  })

  it('uses the Universal Asset Library + honest setup-needed (no fake render)', () => {
    expect(panel).toContain('vs-ual')
    expect(panel).toContain('/api/creative/assets')
    expect(panel).toMatch(/setup-needed/i)
  })

  it('asset API is workspace-scoped + secret-safe + size-capped', () => {
    expect(assetsApi).toContain('auth.user.workspace_id')
    expect(assetsApi).toContain("`ws${ws}`")
    expect(assetsApi).toContain('ALLOWED')
    expect(assetsApi).toContain('64')
    expect(rawApi).toContain('auth.user.workspace_id') // raw serve also scoped
    expect(rawApi).toContain('basename(') // path-contained
  })

  it('is routed + nav-visible + parity surface points at the real workspace', () => {
    expect(router).toContain("case 'video-studio'")
    expect(nav).toContain("id: 'video-studio'")
    expect(getSurface('video-studio')?.mcRoute).toBe('/app/video-studio')
  })

  it('is customer-safe (no Slim Charles / Walt-private data)', () => {
    expect(panel.toLowerCase()).not.toContain('slim charles')
    expect(assetsApi.toLowerCase()).not.toContain('slim charles')
  })
})
