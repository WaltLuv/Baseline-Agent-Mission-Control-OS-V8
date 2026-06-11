/**
 * Star Employee ranking — picks the top performer by completed work × accuracy,
 * over real agent_trust_scores data. Workspace-scoped.
 */
import { describe, it, expect } from 'vitest'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { getStarEmployee } from '@/lib/pm/star-employee'

const WS = 9931 // isolated

function seed() {
  const db = getDatabase()
  runMigrations(db)
  const now = Math.floor(Date.now() / 1000)
  const ts = db.prepare(
    `INSERT INTO agent_trust_scores (agent_name, workspace_id, trust_score, successful_tasks, failed_tasks, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_name, workspace_id) DO UPDATE SET successful_tasks=excluded.successful_tasks, failed_tasks=excluded.failed_tasks, trust_score=excluded.trust_score`,
  )
  const ag = db.prepare(
    `INSERT INTO agents (name, role, status, last_activity, created_at, updated_at, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  // High volume + high accuracy → the star.
  ts.run('Marcus Doyle', WS, 0.959, 47, 2, now)
  ag.run('Marcus Doyle', 'Maintenance Dispatcher', 'busy', 'Triaging a leak', now, now, WS)
  // Slightly higher accuracy but much less work → should NOT win.
  ts.run('Owen Whitfield', WS, 1.0, 24, 0, now)
  ag.run('Owen Whitfield', 'Owner Relations', 'idle', 'Awaiting decision', now, now, WS)
  // Decent volume, lower accuracy.
  ts.run('Vince Cardella', WS, 0.974, 38, 1, now)
  ag.run('Vince Cardella', 'Vendor Coordinator', 'busy', 'Dispatching plumber', now, now, WS)
}

describe('Star Employee', () => {
  it('ranks by completed work × accuracy and returns the top performer', () => {
    seed()
    const star = getStarEmployee(WS)
    expect(star).not.toBeNull()
    expect(star!.name).toBe('Marcus Doyle')
    expect(star!.completed).toBe(47)
    expect(star!.accuracy).toBeCloseTo(47 / 49, 2)
    expect(star!.role).toBe('Maintenance Dispatcher')
    // 47×0.959 = 45.08 must beat 38×0.974 = 37.0 and 24×1.0 = 24
    expect(star!.score).toBeGreaterThan(37)
  })

  it('returns null for a workspace with no performance data', () => {
    expect(getStarEmployee(778899)).toBeNull()
  })
})
