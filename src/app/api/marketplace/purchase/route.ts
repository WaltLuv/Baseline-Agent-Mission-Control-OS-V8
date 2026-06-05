import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { getSkillBySlug, getEmployeeBySlug, getBundleBySlug } from '@/lib/marketplace-catalog'
import { createStripeCheckoutSession, isLiveStripeMode } from '@/lib/stripe-client'
import {
  installSkill,
  hireEmployee,
  deployBundle,
  recordMarketplaceAudit,
  recordPendingMarketplacePurchase,
  resolveItemCreditPrice,
  purchaseWithCredits,
  type MarketplaceItemType,
} from '@/lib/marketplace-fulfillment'
import { getWorkspaceBalance } from '@/lib/billing'

/**
 * Marketplace purchase endpoint — closes the loop browse → hire → pay → deploy.
 *
 * Body:
 *   { type: 'skill', slug }        — one-time purchase
 *   { type: 'employee', slug }     — monthly subscription
 *   { type: 'bundle', slug }       — preset team + skill pack
 *
 * Behaviour:
 *   - LIVE Stripe mode → returns `{ checkoutUrl }` to redirect operator.
 *   - TEST/mock mode   → immediately fulfills the install:
 *       * skills:    `workforce_skills` row + `workforce_memory` entry
 *       * employees: `agents` row + `workforce_subscriptions` row + first
 *                    starter task in `tasks` + memory entry
 *       * bundles:   does the above for every employee + skill in the bundle.
 *     Operator sees the new employee/skill instantly in the workforce, the
 *     executive briefing picks up the impact, and the audit trail records
 *     the install.
 *
 * Idempotency:
 *   `Idempotency-Key` header — if seen before, returns the cached response.
 */

interface PurchaseBody {
  type: 'skill' | 'employee' | 'bundle'
  slug: string
  /** Optional: when installing a skill, attach it directly to an existing AI Employee. */
  attachToAgentId?: number
  attachToAgentSlug?: string
}

// Install / hire / deploy helpers now live in `src/lib/marketplace-fulfillment.ts`
// so the secure Stripe webhook can call the same code paths after a signed
// `checkout.session.completed` event lands. The route imports the helpers
// above; the webhook imports them too.

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1
  const actorId = auth.user.id

  let body: PurchaseBody
  try {
    body = (await request.json()) as PurchaseBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const idempotencyKey = request.headers.get('idempotency-key') || `purchase-${randomBytes(8).toString('hex')}`

  if (!body?.type || !body?.slug) {
    return NextResponse.json({ error: 'type and slug required' }, { status: 400 })
  }

  // --- Pricing & validation ---
  let priceCents = 0
  let label = ''
  let billingMode: 'one-time' | 'monthly' = 'one-time'

  // ─────────────────────────────────────────────────────────────────────
  // Unified token-pack model (P0-H, 2026-06-05):
  //   Marketplace purchases debit credits from the workspace ledger.
  //   Stripe is reserved for token-pack sales only. Per-item Stripe
  //   checkout remains as a legacy compatibility branch behind
  //   `?legacy_stripe=1`.
  // ─────────────────────────────────────────────────────────────────────
  const itemType = body.type as MarketplaceItemType
  const pricing = resolveItemCreditPrice(itemType, body.slug)
  if (!pricing) {
    return NextResponse.json({ error: `Unknown ${itemType}` }, { status: 404 })
  }

  if (body.type === 'skill') {
    label = `Install skill — ${pricing.name}`
  } else if (body.type === 'employee') {
    label = `Hire AI employee — ${pricing.name}`
  } else if (body.type === 'bundle') {
    label = `Deploy team — ${pricing.name}`
  } else {
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }
  priceCents = pricing.credits // (legacy field name; now carries credits)
  billingMode = 'one-time'

  // ── Credit-debit path (default) ───────────────────────────────────────
  const useLegacyStripe = new URL(request.url).searchParams.get('legacy_stripe') === '1' && isLiveStripeMode()
  if (!useLegacyStripe) {
    try {
      const result = purchaseWithCredits({
        workspaceId,
        purchaserUserId: actorId,
        itemType,
        itemId: body.slug,
        idempotencyKey,
      })
      // Free items: helper returns ok:false reason:'free_item' AFTER fulfilling.
      if (!result.ok && result.reason === 'free_item') {
        return NextResponse.json({
          ok: true,
          mode: 'free',
          type: body.type,
          slug: body.slug,
          label,
          chargedCredits: 0,
          billingMode,
          nextStep: body.type === 'employee' ? 'first-task-queued' : 'capability-attached',
        })
      }
      if (!result.ok && result.reason === 'included_item') {
        return NextResponse.json({ ok: true, mode: 'included', type: body.type, slug: body.slug })
      }
      if (!result.ok && result.reason === 'insufficient_credits') {
        return NextResponse.json(
          {
            error: 'You need more credits to unlock this item.',
            code: 'INSUFFICIENT_CREDITS',
            required: result.required,
            balance: result.balance,
            shortfall: result.required - result.balance,
            buy_credits_path: '/app/billing',
          },
          { status: 402 },
        )
      }
      if (!result.ok && result.reason === 'unknown_item') {
        return NextResponse.json({ error: 'unknown item' }, { status: 404 })
      }
      if (result.ok) {
        return NextResponse.json({
          ok: true,
          mode: 'credits',
          type: body.type,
          slug: body.slug,
          label,
          chargedCredits: result.chargedCredits,
          balanceAfter: result.balanceAfter,
          idempotent: result.idempotent,
          nextStep: body.type === 'employee' ? 'first-task-queued' : 'capability-attached',
        })
      }
    } catch (e) {
      return NextResponse.json({ error: 'purchase failed', detail: String(e).slice(0, 200) }, { status: 500 })
    }
  }

  // ── Legacy Stripe checkout (compatibility only, opt-in) ───────────────
  if (useLegacyStripe) {
    try {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`
      const stripeSessionId = `mkt-${idempotencyKey}`

      // 1. Record pending marketplace_purchases row BEFORE redirecting. The
      //    secure webhook will flip status → fulfilled and call the install
      //    helpers when the signed event lands.
      recordPendingMarketplacePurchase({
        workspaceId,
        purchaserUserId: actorId,
        itemType: body.type as MarketplaceItemType,
        itemId: body.slug,
        itemName: label,
        priceCents,
        stripeCheckoutSessionId: stripeSessionId,
        idempotencyKey,
        metadata: {
          attachToAgentId: body.attachToAgentId ?? null,
          attachToAgentSlug: body.attachToAgentSlug ?? null,
          billingMode,
        },
      })

      // 2. Create Stripe Checkout session.
      const session = await createStripeCheckoutSession({
        workspaceId,
        stripeSessionId,
        packageId: 0,
        packageName: label,
        packagePriceCents: priceCents,
        packageCredits: 0,
        successUrl: `${origin}/app/agents?install=success&type=${body.type}&slug=${body.slug}`,
        cancelUrl: `${origin}/marketplace?install=cancelled`,
      })
      return NextResponse.json({ ok: true, mode: 'stripe-legacy', checkoutUrl: session.url, deprecated: true })
    } catch (e) {
      return NextResponse.json({ error: 'Stripe checkout failed', detail: String(e).slice(0, 200) }, { status: 502 })
    }
  }

  // ── Fallthrough: shouldn't be reachable; the credit-debit path
  //    handles every type when `legacy_stripe=1` isn't set.
  return NextResponse.json({ error: 'no purchase path matched' }, { status: 500 })
}

// Silence unused-import warnings for compatibility branches.
void getSkillBySlug; void getEmployeeBySlug; void getBundleBySlug
void installSkill; void hireEmployee; void deployBundle
void getWorkspaceBalance; void recordMarketplaceAudit; void recordPendingMarketplacePurchase
