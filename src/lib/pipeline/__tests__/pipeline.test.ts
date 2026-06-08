/**
 * Pipeline — Idea → … → Proof, with a real approval gate.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import {
  captureIdea, advanceIdea, approveIdea, routeIdea, shipIdea, deleteIdea,
  nextStage, PIPELINE_STAGES, getIdea,
} from '@/lib/pipeline/store'

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
    const idea = captureIdea('New onboarding flow', 'detail', now)
    expect(idea.stage).toBe('idea')

    routeIdea(idea.id, 'Maestro', now + 1)
    expect(getIdea(idea.id)?.routedTo).toBe('Maestro')

    // advance idea → plan → route → approve
    advanceIdea(idea.id, now + 2) // plan
    advanceIdea(idea.id, now + 3) // route
    advanceIdea(idea.id, now + 4) // approve
    expect(getIdea(idea.id)?.stage).toBe('approve')

    // blocked: cannot pass approve without approval
    const blocked = advanceIdea(idea.id, now + 5)
    expect(blocked.blocked).toBeTruthy()
    expect(getIdea(idea.id)?.stage).toBe('approve')

    approveIdea(idea.id, 'Walt', now + 6)
    const ok = advanceIdea(idea.id, now + 7)
    expect(ok.blocked).toBeFalsy()
    expect(getIdea(idea.id)?.stage).toBe('build')

    shipIdea(idea.id, '/app/onboarding', 'proof-pkg-1', now + 8)
    expect(getIdea(idea.id)?.stage).toBe('proof')
    expect(getIdea(idea.id)?.artifact).toBe('/app/onboarding')

    deleteIdea(idea.id)
    expect(getIdea(idea.id)).toBeNull()
  })
})
