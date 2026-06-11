/**
 * Profit-safe credit pricing — derived ENTIRELY from the canonical
 * provider-cost catalog. No hardcoded model prices live here.
 *
 * Rules:
 *   · 1 credit = $0.01
 *   · customer price = provider cost × markup (default 2.5×)
 *   · always round UP to whole credits, never down
 *   · minimum charge per action
 *   · include estimated OUTPUT tokens, not just input
 *   · include tool / SMS / voice / image / search / file / computer-use costs
 *   · apply a safety buffer for unknown token usage
 *   · MARGIN GUARD: a charge that would fall below target gross margin is
 *     flagged unsafe (callers block the config or raise the price)
 */
import {
  getModelCost,
  defaultModelCost,
  NON_LLM_COSTS,
  type NonLlmCostKind,
} from './provider-cost-catalog'

export const CREDIT_USD = 0.01
export const DEFAULT_MARKUP = 2.5
export const SAFETY_BUFFER = 1.15 // +15% on token usage for unknowns
export const MIN_CHARGE_CREDITS = 1
export const TARGET_GROSS_MARGIN = 0.6 // 2.5× markup ⇒ 60% gross margin floor

export interface UsageEstimate {
  model: string
  inputTokens: number
  outputTokens: number
  /** Portion of input served from cache (cheaper). */
  cachedInputTokens?: number
  /** Non-LLM tool usage counts, keyed by cost kind. */
  tools?: Partial<Record<NonLlmCostKind, number>>
}

export interface PriceResult {
  providerCostUsd: number
  customerCredits: number
  customerUsd: number
  grossMargin: number
  marginSafe: boolean
}

/** Raw provider cost in USD for a usage estimate (no markup, no buffer). */
export function providerCostUsd(u: UsageEstimate): number {
  const mc = getModelCost(u.model) ?? defaultModelCost()
  const cached = Math.max(0, u.cachedInputTokens ?? 0)
  const freshInput = Math.max(0, u.inputTokens - cached)
  let cost = (freshInput / 1e6) * mc.inputPerM + (u.outputTokens / 1e6) * mc.outputPerM
  if (cached > 0) cost += (cached / 1e6) * (mc.cachedInputPerM ?? mc.inputPerM)
  for (const [kind, count] of Object.entries(u.tools ?? {})) {
    const nc = NON_LLM_COSTS[kind as NonLlmCostKind]
    if (nc && count) cost += nc.unitUsd * count
  }
  return cost
}

/** Profit-safe customer charge for a usage estimate. */
export function priceUsage(
  u: UsageEstimate,
  opts: { markup?: number; minCredits?: number } = {},
): PriceResult {
  const markup = opts.markup ?? DEFAULT_MARKUP
  const minCredits = opts.minCredits ?? MIN_CHARGE_CREDITS
  const cost = providerCostUsd(u)
  // Buffer guards against under-estimated token usage, then apply markup.
  const targetUsd = cost * SAFETY_BUFFER * markup
  // Round UP to whole credits; never round down.
  const credits = Math.max(minCredits, Math.ceil(targetUsd / CREDIT_USD))
  const customerUsd = credits * CREDIT_USD
  const grossMargin = customerUsd > 0 ? (customerUsd - cost) / customerUsd : 1
  return {
    providerCostUsd: cost,
    customerCredits: credits,
    customerUsd,
    grossMargin,
    marginSafe: grossMargin >= TARGET_GROSS_MARGIN,
  }
}

export class MarginViolationError extends Error {
  constructor(public readonly result: PriceResult, public readonly target: number) {
    super(`Margin guard: gross margin ${(result.grossMargin * 100).toFixed(1)}% < target ${(target * 100).toFixed(0)}%`)
  }
}

/** Throws MarginViolationError if the charge is below target gross margin. */
export function assertMarginSafe(result: PriceResult, target = TARGET_GROSS_MARGIN): PriceResult {
  if (result.grossMargin < target) throw new MarginViolationError(result, target)
  return result
}

// ─── Workflow pricing (P5) ──────────────────────────────────────────────
// Each profile estimates the WORK a workflow does (model + token + tool usage).
// The PRICE is derived from the canonical catalog — never hand-set.

export type WorkflowId =
  | 'maintenance_request'
  | 'owner_approval'
  | 'vendor_dispatch'
  | 'inspection_review'
  | 'voice_intake'
  | 'market_swarm_research'
  | 'proof_package'
  | 'replay_generation'
  | 'kanban_execution'
  | 'agent_factory_build'

export interface WorkflowProfile {
  id: WorkflowId
  label: string
  usage: UsageEstimate
}

export const WORKFLOW_PROFILES: WorkflowProfile[] = [
  { id: 'maintenance_request', label: 'Maintenance Request', usage: { model: 'anthropic/claude-sonnet-4-6', inputTokens: 4000, outputTokens: 1500 } },
  { id: 'owner_approval', label: 'Owner Approval', usage: { model: 'anthropic/claude-sonnet-4-6', inputTokens: 3000, outputTokens: 1000, tools: { sms_outbound: 1 } } },
  { id: 'vendor_dispatch', label: 'Vendor Dispatch', usage: { model: 'anthropic/claude-sonnet-4-6', inputTokens: 5000, outputTokens: 2000, tools: { sms_outbound: 2 } } },
  { id: 'inspection_review', label: 'Inspection Review', usage: { model: 'anthropic/claude-opus-4-8', inputTokens: 12000, outputTokens: 3000, tools: { file_parse_per_doc: 2, image_gen_per_image: 0 } } },
  { id: 'voice_intake', label: 'Voice Intake', usage: { model: 'openai/gpt-5.5', inputTokens: 2500, outputTokens: 1500, tools: { voice_per_min: 3, stt_per_min: 3, tts_per_1k_chars: 2 } } },
  { id: 'market_swarm_research', label: 'Market Swarm Research', usage: { model: 'anthropic/claude-opus-4-8', inputTokens: 30000, outputTokens: 8000, tools: { web_search_per_call: 12 } } },
  { id: 'proof_package', label: 'Proof Package', usage: { model: 'anthropic/claude-sonnet-4-6', inputTokens: 6000, outputTokens: 2000, tools: { file_parse_per_doc: 4 } } },
  { id: 'replay_generation', label: 'Replay Generation', usage: { model: 'anthropic/claude-haiku-4-5', inputTokens: 4000, outputTokens: 1000 } },
  { id: 'kanban_execution', label: 'Kanban 2.0 Execution', usage: { model: 'anthropic/claude-sonnet-4-6', inputTokens: 5000, outputTokens: 2000 } },
  { id: 'agent_factory_build', label: 'Agent Factory Build', usage: { model: 'anthropic/claude-opus-4-8', inputTokens: 20000, outputTokens: 6000 } },
]

export function priceWorkflow(id: WorkflowId, opts?: { markup?: number; minCredits?: number }): PriceResult {
  const p = WORKFLOW_PROFILES.find((w) => w.id === id)
  if (!p) throw new Error(`unknown workflow: ${id}`)
  return priceUsage(p.usage, opts)
}

export interface WorkflowMarginRow {
  workflow: string
  providerCostUsd: number
  customerCredits: number
  customerUsd: number
  grossMargin: number
  launchSafe: boolean
}

/** The Workflow | Provider Cost | Credits | Gross Margin table. */
export function workflowMarginTable(): WorkflowMarginRow[] {
  return WORKFLOW_PROFILES.map((w) => {
    const r = priceWorkflow(w.id)
    return {
      workflow: w.label,
      providerCostUsd: Number(r.providerCostUsd.toFixed(4)),
      customerCredits: r.customerCredits,
      customerUsd: Number(r.customerUsd.toFixed(2)),
      grossMargin: Number((r.grossMargin * 100).toFixed(1)),
      launchSafe: r.marginSafe,
    }
  })
}
