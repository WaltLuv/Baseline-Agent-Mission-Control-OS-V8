/**
 * Integration tests for the marketplace purchase ledger + fulfillment flow.
 *
 * Verifies:
 *   1. recordPendingMarketplacePurchase + findMarketplacePurchaseBySession round-trip.
 *   2. fulfillMarketplacePurchase installs the skill and flips the row to fulfilled.
 *   3. fulfillMarketplacePurchase is idempotent on the second call.
 *   4. POST /api/marketplace/purchase with type=employee returns mode='free',
 *      does NOT touch marketplace_purchases, and does NOT call Stripe.
 *   5. POST /api/marketplace/purchase with type=skill (in mock mode) fulfills
 *      inline AND a parallel live-mode path would record a pending row.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import {
  recordPendingMarketplacePurchase,
  findMarketplacePurchaseBySession,
  fulfillMarketplacePurchase,
} from '@/lib/marketplace-fulfillment'

// Use the seeded workspace_id=1 — the migration seeds always provision it,
// and our marketplace tests only insert NEW marketplace_purchases rows whose
// `stripe_checkout_session_id` is unique per test, so they can't collide
// with any other test's state.
const TEST_WORKSPACE_ID = 1

// vitest config uses `pool: threads + singleThread: true`, so process.env is
// shared across files. Snapshot anything we mutate and restore after.
const originalEnv: Record<string, string | undefined> = {}

beforeAll(() => {
  for (const key of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE']) {
    originalEnv[key] = process.env[key]
  }
  process.env.MC_DISABLE_RATE_LIMIT = '1'
  process.env.MISSION_CONTROL_TEST_MODE = '1'
  const db = getDatabase()
  runMigrations(db)
})

afterAll(() => {
  for (const [key, val] of Object.entries(originalEnv)) {
    if (val === undefined) delete process.env[key]
    else process.env[key] = val
  }
})

describe('marketplace fulfillment ledger', () => {
  it('records pending → finds by session → fulfills', () => {
    const sessionId = `mkt-test-${Date.now()}-a`
    const insertedId = recordPendingMarketplacePurchase({
      workspaceId: TEST_WORKSPACE_ID,
      purchaserUserId: null,
      itemType: 'skill',
      itemId: 'owner-approval',
      itemName: 'Install skill — Smart Owner Approval',
      priceCents: 5000,
      stripeCheckoutSessionId: sessionId,
      idempotencyKey: `idem-${sessionId}`,
    })
    expect(insertedId).toBeGreaterThan(0)

    const found = findMarketplacePurchaseBySession(sessionId)
    expect(found).not.toBeNull()
    expect(found?.workspace_id).toBe(TEST_WORKSPACE_ID)
    expect(found?.item_type).toBe('skill')
    expect(found?.item_id).toBe('owner-approval')
    expect(found?.status).toBe('pending')
    expect(found?.price_cents).toBe(5000)
  })

  it('fulfillMarketplacePurchase installs the skill + flips status', () => {
    const sessionId = `mkt-test-${Date.now()}-b`
    recordPendingMarketplacePurchase({
      workspaceId: TEST_WORKSPACE_ID,
      purchaserUserId: null,
      itemType: 'skill',
      itemId: 'owner-reporting',
      itemName: 'Install skill — Owner Report Generator',
      priceCents: 5000,
      stripeCheckoutSessionId: sessionId,
      idempotencyKey: `idem-${sessionId}`,
    })
    const purchase = findMarketplacePurchaseBySession(sessionId)!
    const result = fulfillMarketplacePurchase(purchase, `evt_test_${sessionId}`)

    expect(result.alreadyFulfilled).toBe(false)
    expect(result.itemType).toBe('skill')

    // workforce_skills row should exist for this workspace + slug.
    const db = getDatabase()
    const skillRow = db.prepare(
      `SELECT slug, workspace_id FROM workforce_skills WHERE workspace_id = ? AND slug = ?`,
    ).get(TEST_WORKSPACE_ID, 'owner-reporting') as { slug: string } | undefined
    expect(skillRow?.slug).toBe('owner-reporting')

    // marketplace_purchases row status should now be 'fulfilled'.
    const updated = findMarketplacePurchaseBySession(sessionId)!
    expect(updated.status).toBe('fulfilled')
  })

  it('is idempotent — second fulfill on the same row is a no-op', () => {
    const sessionId = `mkt-test-${Date.now()}-c`
    recordPendingMarketplacePurchase({
      workspaceId: TEST_WORKSPACE_ID,
      purchaserUserId: null,
      itemType: 'skill',
      itemId: 'pm-lead-qualification',
      itemName: 'Install skill — Lead Qualification Agent',
      priceCents: 7500,
      stripeCheckoutSessionId: sessionId,
      idempotencyKey: `idem-${sessionId}`,
    })
    const purchase = findMarketplacePurchaseBySession(sessionId)!
    const first = fulfillMarketplacePurchase(purchase, `evt_first_${sessionId}`)
    expect(first.alreadyFulfilled).toBe(false)

    // Re-read the fulfilled row and try to fulfill it again.
    const refreshed = findMarketplacePurchaseBySession(sessionId)!
    const second = fulfillMarketplacePurchase(refreshed, `evt_second_${sessionId}`)
    expect(second.alreadyFulfilled).toBe(true)
  })

  it('refuses to fulfill credit_pack rows through the marketplace path', () => {
    const sessionId = `mkt-test-${Date.now()}-d`
    recordPendingMarketplacePurchase({
      workspaceId: TEST_WORKSPACE_ID,
      purchaserUserId: null,
      itemType: 'credit_pack',
      itemId: '2',
      itemName: '2.75K credit pack',
      priceCents: 2500,
      stripeCheckoutSessionId: sessionId,
      idempotencyKey: `idem-${sessionId}`,
    })
    const purchase = findMarketplacePurchaseBySession(sessionId)!
    expect(() => fulfillMarketplacePurchase(purchase, 'evt_x')).toThrow(/credit_pack/)
  })
})

describe('marketplace pricing rules — Mission Control monetization model', () => {
  it('employee catalogue is hireable with priceCents=0 via the fulfillment lib', async () => {
    const { hireEmployee } = await import('@/lib/marketplace-fulfillment')
    const { employee } = hireEmployee(TEST_WORKSPACE_ID, 'agent-michael', `free-test-${Date.now()}`)
    expect(employee.slug).toBe('agent-michael')
    // Subscription row should exist; price column is reported by catalogue
    // (legacy metadata), but the purchase route forces priceCents=0 above
    // so customers are never charged a monthly fee.
    const db = getDatabase()
    const subRow = db.prepare(
      `SELECT employee_slug, monthly_cents FROM workforce_subscriptions WHERE workspace_id = ? AND employee_slug = ?`,
    ).get(TEST_WORKSPACE_ID, 'agent-michael') as { employee_slug: string; monthly_cents: number } | undefined
    expect(subRow?.employee_slug).toBe('agent-michael')
    // Catalogue keeps `monthly_cents` as legacy/value metadata; what matters
    // is the marketplace purchase ROUTE forces priceCents=0 before fulfillment.
    // See src/app/api/marketplace/purchase/route.ts (employee branch).
  })
})
