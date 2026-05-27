import { describe, it, expect, beforeEach, vi } from 'vitest'

// In-memory state mimicking minimal SQLite behavior for billing pipeline tests.
interface LedgerRow {
  id: number
  workspace_id: number
  type: string
  amount: number
  balance_after: number
  source_type: string
  source_id: string | null
  description: string
  idempotency_key: string
  created_at: number
}
interface UsageRow {
  id: number
  workspace_id: number
  agent_id: number | null
  task_id: number | null
  workflow_run_id: string | null
  event_type: string
  provider: string | null
  model: string | null
  input_tokens: number
  output_tokens: number
  raw_cost_cents: number
  retail_cost_cents: number
  credits_charged: number
  markup_multiplier: number
  metadata_json: string | null
  idempotency_key: string
  created_at: number
}
interface PricingRow {
  id: number
  event_type: string
  provider: string
  model: string
  wholesale_cost_cents: number
  retail_cost_cents: number
  credits_required: number
  status: string
}

const state = {
  ledger: [] as LedgerRow[],
  usage: [] as UsageRow[],
  pricing: [] as PricingRow[],
  nextId: 1,
}

function reset() {
  state.ledger = []
  state.usage = []
  state.pricing = []
  state.nextId = 1
}

function seedPricing() {
  state.pricing = [
    { id: 1, event_type: 'default', provider: 'default', model: 'default', wholesale_cost_cents: 500, retail_cost_cents: 1250, credits_required: 13, status: 'active' },
    { id: 2, event_type: 'llm_inference', provider: 'openrouter', model: 'anthropic/claude-sonnet-4', wholesale_cost_cents: 300, retail_cost_cents: 750, credits_required: 8, status: 'active' },
    { id: 3, event_type: 'sms_send', provider: 'twilio', model: 'sms_outbound', wholesale_cost_cents: 7, retail_cost_cents: 18, credits_required: 1, status: 'active' },
  ]
}

// Minimal SQL-aware mock: we hand-wire the queries that billing.ts uses.
const fakeDb = {
  prepare(sql: string) {
    const s = sql.replace(/\s+/g, ' ').trim()
    return {
      get(...args: unknown[]) {
        // applyCreditMutation idempotency check
        if (s.startsWith('SELECT balance_after, id FROM credit_ledger WHERE idempotency_key')) {
          const [key, ws] = args as [string, number]
          const row = state.ledger.find(r => r.idempotency_key === key && r.workspace_id === ws)
          return row ? { balance_after: row.balance_after, id: row.id } : undefined
        }
        // running balance
        if (s.startsWith('SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE workspace_id')) {
          const [ws] = args as [number]
          const balance = state.ledger.filter(r => r.workspace_id === ws).reduce((a, b) => a + b.amount, 0)
          return { balance }
        }
        // getWorkspaceBalance aggregate
        if (s.includes('as granted') && s.includes('as used') && s.includes('as refunded')) {
          const [ws] = args as [number]
          const rows = state.ledger.filter(r => r.workspace_id === ws)
          return {
            balance: rows.reduce((a, b) => a + b.amount, 0),
            granted: rows.filter(r => r.amount > 0).reduce((a, b) => a + b.amount, 0),
            used: rows.filter(r => r.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0),
            refunded: rows.filter(r => r.type === 'refund').reduce((a, b) => a + Math.abs(b.amount), 0),
          }
        }
        // pricing lookups
        if (s.startsWith('SELECT * FROM pricing_configs WHERE event_type = ? AND provider = ? AND model = ?')) {
          const [et, p, m] = args as [string, string, string]
          const row = state.pricing.find(r => r.event_type === et && r.provider === p && r.model === m && r.status === 'active')
          return row ? mapPricingRow(row) : undefined
        }
        if (s.startsWith('SELECT * FROM pricing_configs WHERE event_type = ? AND provider = ?')) {
          const [et, p] = args as [string, string]
          const row = state.pricing.find(r => r.event_type === et && r.provider === p && r.status === 'active')
          return row ? mapPricingRow(row) : undefined
        }
        if (s.startsWith('SELECT * FROM pricing_configs WHERE event_type = ?')) {
          const [et] = args as [string]
          const row = state.pricing.find(r => r.event_type === et && r.status === 'active')
          return row ? mapPricingRow(row) : undefined
        }
        if (s.includes("event_type = 'default'")) {
          const row = state.pricing.find(r => r.event_type === 'default' && r.status === 'active')
          return row ? mapPricingRow(row) : undefined
        }
        // usage_events idempotency
        if (s.startsWith('SELECT id FROM usage_events WHERE idempotency_key')) {
          const [key, ws] = args as [string, number]
          const row = state.usage.find(r => r.idempotency_key === key && r.workspace_id === ws)
          return row ? { id: row.id } : undefined
        }
        // margin report aggregate
        if (s.includes('FROM usage_events WHERE workspace_id')) {
          const [ws] = args as [number]
          const rows = state.usage.filter(r => r.workspace_id === ws)
          return {
            wholesale_cents: rows.reduce((a, b) => a + b.raw_cost_cents, 0),
            retail_cents: rows.reduce((a, b) => a + b.retail_cost_cents, 0),
            total_credits: rows.reduce((a, b) => a + b.credits_charged, 0),
            event_count: rows.length,
          }
        }
        return undefined
      },
      run(...args: unknown[]) {
        if (s.startsWith('INSERT INTO credit_ledger')) {
          const [workspaceId, type, amount, balance_after, source_type, source_id, description, idempotency_key] = args as [number, string, number, number, string, string | null, string, string]
          state.ledger.push({
            id: state.nextId++,
            workspace_id: workspaceId,
            type,
            amount,
            balance_after,
            source_type,
            source_id,
            description,
            idempotency_key,
            created_at: Math.floor(Date.now() / 1000),
          })
          return { lastInsertRowid: state.nextId - 1, changes: 1 }
        }
        if (s.startsWith('INSERT INTO usage_events')) {
          const [workspaceId, agentId, taskId, workflowRunId, eventType, provider, model, inputTokens, outputTokens, rawCostCents, retailCostCents, creditsCharged, markupMultiplier, metadataJson, idempotencyKey] = args as [number, number | null, number | null, string | null, string, string | null, string | null, number, number, number, number, number, number, string | null, string]
          state.usage.push({
            id: state.nextId++,
            workspace_id: workspaceId,
            agent_id: agentId,
            task_id: taskId,
            workflow_run_id: workflowRunId,
            event_type: eventType,
            provider,
            model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            raw_cost_cents: rawCostCents,
            retail_cost_cents: retailCostCents,
            credits_charged: creditsCharged,
            markup_multiplier: markupMultiplier,
            metadata_json: metadataJson,
            idempotency_key: idempotencyKey,
            created_at: Math.floor(Date.now() / 1000),
          })
          return { lastInsertRowid: state.nextId - 1, changes: 1 }
        }
        return { lastInsertRowid: 0, changes: 0 }
      },
      all() {
        return []
      },
    }
  },
}

function mapPricingRow(r: PricingRow) {
  return {
    eventType: r.event_type,
    provider: r.provider,
    model: r.model,
    wholesaleCostCents: r.wholesale_cost_cents,
    retailCostCents: r.retail_cost_cents,
    creditsRequired: r.credits_required,
    status: r.status,
  }
}

vi.mock('@/lib/db', () => ({ getDatabase: () => fakeDb }))
vi.mock('@/lib/observability', () => ({ logStructured: vi.fn() }))

import {
  grantCredits,
  deductCredits,
  refundCredits,
  chargeForAction,
  chargeForAgentSession,
  getWorkspaceBalance,
  getPricingConfig,
  getMarginReport,
  recalculateBalance,
} from '../billing'

beforeEach(() => {
  reset()
  seedPricing()
})

describe('credit ledger primitives', () => {
  it('grants credits and updates balance', () => {
    grantCredits({ workspaceId: 1, credits: 500, sourceType: 'manual', sourceId: null, description: 'init', idempotencyKey: 'g1' })
    expect(getWorkspaceBalance(1).balance).toBe(500)
    expect(recalculateBalance(1)).toBe(500)
  })

  it('is idempotent on repeated idempotencyKey', () => {
    grantCredits({ workspaceId: 1, credits: 100, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'dup' })
    grantCredits({ workspaceId: 1, credits: 100, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'dup' })
    expect(getWorkspaceBalance(1).balance).toBe(100)
  })

  it('deducts credits and updates balance correctly', () => {
    grantCredits({ workspaceId: 1, credits: 100, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    deductCredits(1, 30, 'task', '1', 'used', 'd1')
    const bal = getWorkspaceBalance(1)
    expect(bal.balance).toBe(70)
    expect(bal.used).toBe(30)
  })

  it('refunds credits back to balance', () => {
    grantCredits({ workspaceId: 1, credits: 100, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    deductCredits(1, 30, 'task', '1', 'used', 'd1')
    refundCredits(1, 10, 'task', '1', 'refund', 'r1')
    expect(getWorkspaceBalance(1).balance).toBe(80)
  })
})

describe('getPricingConfig fallback chain', () => {
  it('returns the exact match first', () => {
    const c = getPricingConfig('sms_send', 'twilio', 'sms_outbound')
    expect(c.creditsRequired).toBe(1)
  })

  it('falls back to provider-level config for unknown model', () => {
    const c = getPricingConfig('llm_inference', 'openrouter', 'unknown-model')
    expect(c.provider).toBe('openrouter')
  })

  it('falls back to event_type level when provider/model both unknown', () => {
    const c = getPricingConfig('llm_inference', 'unknown', 'unknown')
    expect(c.eventType).toBe('llm_inference')
  })

  it('falls back to "default" config row when event_type unknown', () => {
    const c = getPricingConfig('totally-unknown-event', 'unknown', 'unknown')
    expect(c.eventType).toBe('default')
    expect(c.creditsRequired).toBe(13)
  })

  it('falls back to hardcoded 13 credits when ALL configs are deleted', () => {
    state.pricing = []
    const c = getPricingConfig('anything', 'whatever', 'whichever')
    expect(c.creditsRequired).toBe(13)
    expect(c.wholesaleCostCents).toBe(500)
    expect(c.retailCostCents).toBe(1250)
  })
})

describe('chargeForAction — three cost modes', () => {
  it('MODE 1: token-based costing with markup', () => {
    grantCredits({ workspaceId: 1, credits: 10_000, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    const r = chargeForAction(1, 'agent_session', 'agent_session', 'agent_1', 'k-mode-1', 1, null, {
      model: 'anthropic/claude-sonnet-4',
      provider: 'openrouter',
      inputTokens: 10_000,
      outputTokens: 5_000,
    })
    // wholesale 0.105 USD, retail 0.2625 USD → 27 credits (ceil)
    expect(r.creditsCharged).toBe(27)
    expect(r.wholesaleCostCents).toBeGreaterThan(0)
    expect(r.retailCostCents).toBeGreaterThan(r.wholesaleCostCents)
  })

  it('MODE 2: explicit customCredits override', () => {
    grantCredits({ workspaceId: 1, credits: 1000, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    const r = chargeForAction(1, 'misc', 'manual', '1', 'k-mode-2', null, null, { customCredits: 42 })
    expect(r.creditsCharged).toBe(42)
  })

  it('MODE 2: Math.max(1, customCredits) prevents zero-charge bug', () => {
    grantCredits({ workspaceId: 1, credits: 1000, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    const r = chargeForAction(1, 'misc', 'manual', '1', 'k-mode-2b', null, null, { customCredits: 0 })
    expect(r.creditsCharged).toBe(1)
  })

  it('MODE 3: pricing config lookup', () => {
    grantCredits({ workspaceId: 1, credits: 1000, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    const r = chargeForAction(1, 'sms_send', 'manual', '1', 'k-mode-3', null, null, { provider: 'twilio', model: 'sms_outbound' })
    expect(r.creditsCharged).toBe(1)
  })

  it('throws INSUFFICIENT_CREDITS when balance < required', () => {
    grantCredits({ workspaceId: 1, credits: 5, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    expect(() => chargeForAction(1, 'agent_session', 'agent_session', 'a1', 'k-ic', null, null, {
      model: 'anthropic/claude-sonnet-4',
      provider: 'openrouter',
      inputTokens: 10_000,
      outputTokens: 5_000,
    })).toThrowError(/Insufficient credits/)
    // balance unchanged
    expect(getWorkspaceBalance(1).balance).toBe(5)
  })

  it('is idempotent on repeated charge with same key', () => {
    grantCredits({ workspaceId: 1, credits: 1000, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    chargeForAction(1, 'sms_send', 'manual', '1', 'k-idem', null, null, { provider: 'twilio', model: 'sms_outbound' })
    chargeForAction(1, 'sms_send', 'manual', '1', 'k-idem', null, null, { provider: 'twilio', model: 'sms_outbound' })
    expect(getWorkspaceBalance(1).balance).toBe(999)
  })
})

describe('chargeForAgentSession end-to-end', () => {
  it('drives the full token → wholesale → markup → credits → deduct flow', () => {
    grantCredits({ workspaceId: 1, credits: 10_000, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    const r = chargeForAgentSession(1, 5, 99, 'anthropic/claude-sonnet-4', 'openrouter', 10_000, 5_000, 'session-1')
    expect(r.creditsCharged).toBe(27)
    expect(getWorkspaceBalance(1).balance).toBe(10_000 - 27)
  })
})

describe('getMarginReport', () => {
  it('computes wholesale vs retail and margin %', () => {
    grantCredits({ workspaceId: 1, credits: 10_000, sourceType: 'manual', sourceId: null, description: 'g', idempotencyKey: 'g' })
    chargeForAgentSession(1, 1, null, 'anthropic/claude-sonnet-4', 'openrouter', 10_000, 5_000, 's1')
    chargeForAgentSession(1, 1, null, 'anthropic/claude-sonnet-4', 'openrouter', 10_000, 5_000, 's2')
    const report = getMarginReport(1, 'all')
    expect(report.eventCount).toBe(2)
    expect(report.retailCents).toBeGreaterThan(report.wholesaleCents)
    // Margin should be in the 55-65% range for a 2.5x markup
    expect(report.marginPercent).toBeGreaterThanOrEqual(55)
    expect(report.marginPercent).toBeLessThanOrEqual(65)
  })

  it('returns zeros for a fresh workspace', () => {
    const report = getMarginReport(999, 'all')
    expect(report.eventCount).toBe(0)
    expect(report.wholesaleCents).toBe(0)
    expect(report.retailCents).toBe(0)
    expect(report.marginPercent).toBe(0)
  })
})
