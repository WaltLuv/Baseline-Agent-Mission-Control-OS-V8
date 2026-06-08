/**
 * Pipeline — Idea → … → Proof, real approval gate, workspace isolation.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import {
  captureIdea, advanceIdea, approveIdea, routeIdea, shipIdea, deleteIdea,
  nextStage, PIPELINE_STAGES, getIdea, listIdeas,
} from '@/lib/pipeline/store'

const WS_A = 301
const WS_B = 402

beforeAll(() => { runMigrations(getDatabase()) })

describe('pipeline stages', () => {
  it('has the full stage sequence', () => {
    expect(PIPELINE_STAGES).toEqual(['idea', 'plan', 'route', 'approve', 'build', 'test', 'ship', 'proof'])
    expect(nextStage('idea')).toBe('plan')
    expect(nextStage('proof')).toBeNull()
  })
})

describe('pipeline flow with approval gate', () => {
  it('captures, routes, gates on approval, ships with proof', () => {
    const now = 5_000
    const idea = captureIdea(WS_A, 'New onboarding flow', 'detail', now)
    expect(idea.stage).toBe('idea')

    routeIdea(WS_A, idea.id, 'Maestro', now + 1)
    expect(getIdea(WS_A, idea.id)?.routedTo).toBe('Maestro')

    advanceIdea(WS_A, idea.id, now + 2) // plan
    advanceIdea(WS_A, idea.id, now + 3) // route
    advanceIdea(WS_A, idea.id, now + 4) // approve
    expect(getIdea(WS_A, idea.id)?.stage).toBe('approve')

    const blocked = advanceIdea(WS_A, idea.id, now + 5)
    expect(blocked.blocked).toBeTruthy()
    expect(getIdea(WS_A, idea.id)?.stage).toBe('approve')

    approveIdea(WS_A, idea.id, 'Walt', now + 6)
    const ok = advanceIdea(WS_A, idea.id, now + 7)
    expect(ok.blocked).toBeFalsy()
    expect(getIdea(WS_A, idea.id)?.stage).toBe('build')

    shipIdea(WS_A, idea.id, '/app/onboarding', 'proof-pkg-1', now + 8)
    expect(getIdea(WS_A, idea.id)?.stage).toBe('proof')
    expect(getIdea(WS_A, idea.id)?.artifact).toBe('/app/onboarding')

    deleteIdea(WS_A, idea.id)
    expect(getIdea(WS_A, idea.id)).toBeNull()
  })
})

describe('pipeline workspace isolation — no cross-tenant leakage', () => {
  it('workspace B cannot read, advance, approve, ship, or delete workspace A ideas', () => {
    const now = 9_000
    const mine = captureIdea(WS_A, 'Acme idea', '', now)
    captureIdea(WS_B, 'Other Co idea', '', now + 1)

    expect(listIdeas(WS_A).map((i) => i.title)).toContain('Acme idea')
    expect(listIdeas(WS_A).map((i) => i.title)).not.toContain('Other Co idea')
    expect(listIdeas(WS_B).map((i) => i.title)).not.toContain('Acme idea')

    expect(getIdea(WS_B, mine.id)).toBeNull()
    expect(advanceIdea(WS_B, mine.id, now + 2).idea).toBeNull()
    expect(approveIdea(WS_B, mine.id, 'attacker', now + 3)).toBeNull()
    expect(shipIdea(WS_B, mine.id, 'x', 'y', now + 4)).toBeNull()
    expect(deleteIdea(WS_B, mine.id)).toBe(false)
    // A's idea untouched
    expect(getIdea(WS_A, mine.id)?.approved).toBe(false)

    deleteIdea(WS_A, mine.id)
    listIdeas(WS_B).forEach((i) => deleteIdea(WS_B, i.id))
  })
})
