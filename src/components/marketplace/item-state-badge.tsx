'use client'

/**
 * Marketplace item-state badge — the single source of truth for the
 * UI states Walt requires:
 *
 *   Free · Included · X credits · Purchased · Locked · Insufficient credits
 *
 * Consumed by the marketplace cards (employee / skill / bundle) and the
 * dedicated detail surfaces. State is derived from inputs the parent
 * already has — `pricing` from `resolveItemCreditPrice` + a `purchased`
 * boolean from the workspace inventory + the current credit balance.
 */

export type ItemState =
  | { kind: 'free' }
  | { kind: 'included' }
  | { kind: 'credits'; priceCredits: number }
  | { kind: 'purchased' }
  | { kind: 'locked'; reason: string }
  | { kind: 'insufficient_credits'; required: number; balance: number }

export function deriveItemState(opts: {
  priceCredits: number
  pricingType: 'free' | 'credits' | 'included'
  purchased: boolean
  balance: number
}): ItemState {
  if (opts.purchased) return { kind: 'purchased' }
  if (opts.pricingType === 'free' || opts.priceCredits === 0) return { kind: 'free' }
  if (opts.pricingType === 'included') return { kind: 'included' }
  // Always show the PRICE. We never surface "Insufficient credits" in the
  // catalog — customers want to see prices, not a balance gate. Balance is
  // handled at checkout, not by hiding the price. (Walt)
  return { kind: 'credits', priceCredits: opts.priceCredits }
}

export function buttonLabelFor(state: ItemState, itemType: 'employee' | 'skill' | 'workflow' | 'bundle'): string {
  switch (state.kind) {
    case 'free':
      return itemType === 'employee' ? 'Install (free)' : itemType === 'bundle' ? 'Deploy (free)' : 'Install (free)'
    case 'included':
      return 'Included'
    case 'credits':
      return `Buy with ${state.priceCredits.toLocaleString()} credits`
    case 'purchased':
      return itemType === 'employee' ? 'Open' : 'Configure'
    case 'locked':
      return 'Locked'
    case 'insufficient_credits':
      return 'Buy Credits'
  }
}

export function ItemStateBadge({ state, testId }: { state: ItemState; testId?: string }) {
  const base = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold'
  if (state.kind === 'free') {
    return <span data-testid={testId} className={`${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`}>Free</span>
  }
  if (state.kind === 'included') {
    return <span data-testid={testId} className={`${base} border-cyan-500/30 bg-cyan-500/10 text-cyan-300`}>Included</span>
  }
  if (state.kind === 'credits') {
    return (
      <span data-testid={testId} className={`${base} border-violet-500/30 bg-violet-500/10 text-violet-300`}>
        {state.priceCredits.toLocaleString()} credits
      </span>
    )
  }
  if (state.kind === 'purchased') {
    return <span data-testid={testId} className={`${base} border-emerald-500/30 bg-emerald-500/15 text-emerald-200`}>Purchased</span>
  }
  if (state.kind === 'locked') {
    return <span data-testid={testId} className={`${base} border-white/15 bg-white/[0.04] text-white/55`}>Locked</span>
  }
  return (
    <span data-testid={testId} className={`${base} border-amber-500/30 bg-amber-500/10 text-amber-300`}>
      Insufficient credits
    </span>
  )
}
