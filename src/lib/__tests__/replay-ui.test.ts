/**
 * Workforce Replay UI + API (Mission Control) — parity with Baseline OS.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { getSurface } from '@/lib/parity/surfaces'

const panel = readFileSync('src/components/panels/replay-panel.tsx', 'utf8')
const api = readFileSync('src/app/api/replay/route.ts', 'utf8')
const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
const nav = readFileSync('src/components/layout/nav-rail.tsx', 'utf8')

describe('MC Workforce Replay UI', () => {
  it('panel lists missions + plays a timeline', () => {
    for (const t of ['replay-panel', 'replay-list', 'replay-timeline']) {
      expect(panel, `missing ${t}`).toContain(`data-testid="${t}"`)
    }
    expect(panel).toContain('/api/replay')
    expect(panel).toContain('playhead')
  })

  it('API is workspace-scoped (list + record)', () => {
    expect(api).toContain('auth.user.workspace_id')
    expect(api).toContain('listReplays(ws')
    expect(api).toContain('startReplay(ws')
  })

  it('routed + nav-visible + live parity surface', () => {
    expect(router).toContain("case 'replay'")
    expect(nav).toContain("id: 'replay'")
    expect(getSurface('replay')?.status).toBe('live')
    expect(getSurface('replay')?.mcRoute).toBe('/app/replay')
  })

  it('Gemini Flow emits a replay to /api/replay (replay everywhere)', () => {
    const flow = readFileSync('src/components/panels/gemini-flow-panel.tsx', 'utf8')
    expect(flow).toContain("fetch('/api/replay'")
    expect(flow).toContain('flowReplayEvents')
  })

  it('replay panel is customer-safe', () => {
    expect(panel.toLowerCase()).not.toContain('slim charles')
  })
})
