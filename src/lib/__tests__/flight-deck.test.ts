/**
 * Flight Deck V2 (Mission Control) — executive control tower. Aggregator returns
 * only real workspace-scoped data or honest setup-needed; panel renders all tiles.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { getSurface } from '@/lib/parity/surfaces'

const api = readFileSync('src/app/api/flight-deck/route.ts', 'utf8')
const panel = readFileSync('src/components/panels/flight-deck-panel.tsx', 'utf8')
const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')

describe('Flight Deck V2', () => {
  it('aggregator is workspace-scoped + auth-gated, no filler (real tables/creds)', () => {
    expect(api).toContain("requireRole(request, 'viewer')")
    expect(api).toContain('auth.user.workspace_id')
    expect(api).toContain('work_orders')
    expect(api).toContain('owner_approvals')
    expect(api).toContain('mission_replays')
    expect(api).toContain('credentialChecklist')
    expect(api).toContain('setup-needed') // honest states
  })
  it('panel renders the executive control-tower tiles', () => {
    expect(panel).toContain('data-testid="flight-deck-panel"')
    // tiles are rendered by <Tile testid="…"/> (data-testid={testid})
    for (const t of ['fd-runtimes', 'fd-comms', 'fd-billing', 'fd-approvals', 'fd-maintenance', 'fd-replay', 'fd-proof', 'fd-kanban', 'fd-health', 'fd-demo']) {
      expect(panel, `missing ${t}`).toContain(`testid="${t}"`)
    }
    expect(panel).toContain('/api/flight-deck')
  })
  it('routed + nav + live parity surface', () => {
    expect(router).toContain("case 'flight-deck'")
    expect(getSurface('flight-deck')?.status).toBe('live')
    expect(getSurface('flight-deck')?.mcRoute).toBe('/app/flight-deck')
  })
})
