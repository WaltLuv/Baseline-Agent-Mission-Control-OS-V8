/**
 * Stripe webhook handler.
 *
 * Verifies the Stripe-Signature header against STRIPE_WEBHOOK_SECRET, then
 * fulfills the matching purchase order. Idempotency comes from the
 * `fulfillPurchaseOrder` ledger constraint (Stripe event id is the key),
 * which makes webhook replays safe.
 *
 * Mock-mode test ergonomics:
 *   POST /api/stripe/webhook?mock=1
 *   body: { stripeSessionId, eventId? }
 * is accepted ONLY when STRIPE_SECRET_KEY is unset.
 */
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeClient, getWebhookSecret, isLiveStripeMode } from '@/lib/stripe-client'
import { fulfillPurchaseOrder, getWorkspaceBalance } from '@/lib/billing'
import { logBillingEvent } from '@/lib/billing-log'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface PurchaseOrderRow {
  workspace_id: number
  stripe_session_id: string
  status: string
}

function lookupOrder(stripeSessionId: string): PurchaseOrderRow | null {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT workspace_id, stripe_session_id, status FROM credit_purchase_orders WHERE stripe_session_id = ? LIMIT 1'
  ).get(stripeSessionId) as PurchaseOrderRow | undefined
  return row ?? null
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)

  // Mock-mode test hatch — must not be reachable in live mode.
  if (!isLiveStripeMode() && url.searchParams.get('mock') === '1') {
    const body = await request.json().catch(() => ({}))
    const { stripeSessionId, eventId } = body
    if (!stripeSessionId) {
      return NextResponse.json({ error: 'stripeSessionId required' }, { status: 400 })
    }
    const order = lookupOrder(stripeSessionId)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const safeEventId = eventId || `evt_mock_${stripeSessionId}_${Date.now()}`
    const result = fulfillPurchaseOrder(
      order.workspace_id,
      stripeSessionId,
      safeEventId,
      `mock_${safeEventId}`
    )
    const balance = getWorkspaceBalance(order.workspace_id)
    logBillingEvent('info', 'purchase.fulfilled', 'Mock webhook fulfilled purchase', {
      workspaceId: order.workspace_id,
      balanceAfter: balance.balance,
      metadata: { stripeSessionId, eventId: safeEventId, grantedCredits: result?.creditsGranted ?? 0 },
    })
    return NextResponse.json({
      success: true,
      mock: true,
      fulfilled: !!result,
      balanceAfter: balance.balance,
      grantedCredits: result?.creditsGranted ?? 0,
    })
  }

  // Live mode signature verification.
  const secret = getWebhookSecret()
  const stripe = getStripeClient()
  if (!secret || !stripe) {
    logBillingEvent('error', 'webhook.signature_invalid', 'Stripe webhook hit but live mode not configured', {})
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const sig = request.headers.get('stripe-signature') ?? ''
  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    logBillingEvent('error', 'webhook.signature_invalid', 'Stripe webhook signature verification failed', {
      reason: err instanceof Error ? err.message : 'unknown',
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // We only act on completed checkout sessions for now. async_payment_succeeded
  // is also relevant for delayed payment methods (ACH etc.) — same fulfillment
  // path either way.
  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return NextResponse.json({ received: true, ignored: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const stripeSessionId =
    session.client_reference_id ||
    (session.metadata?.mc_stripe_session_id as string | undefined) ||
    session.id
  const order = lookupOrder(stripeSessionId)
  if (!order) {
    logBillingEvent('warn', 'purchase.fulfilled', 'Stripe webhook for unknown order', {
      metadata: { stripeSessionId, eventId: event.id, type: event.type },
    })
    // Return 200 so Stripe doesn't replay — order is genuinely unknown.
    return NextResponse.json({ received: true, ignored: true })
  }

  const result = fulfillPurchaseOrder(
    order.workspace_id,
    stripeSessionId,
    event.id,
    `stripe_${event.id}`
  )
  const balance = getWorkspaceBalance(order.workspace_id)

  if (!result) {
    // Idempotent no-op (replay or duplicate event).
    logBillingEvent('info', 'webhook.replay_blocked', 'Duplicate Stripe webhook ignored', {
      workspaceId: order.workspace_id,
      metadata: { stripeSessionId, eventId: event.id },
    })
    return NextResponse.json({ received: true, replay: true, balanceAfter: balance.balance })
  }

  logBillingEvent('info', 'purchase.fulfilled', 'Stripe webhook fulfilled purchase', {
    workspaceId: order.workspace_id,
    balanceAfter: balance.balance,
    metadata: { stripeSessionId, eventId: event.id, grantedCredits: result.creditsGranted },
  })

  return NextResponse.json({
    received: true,
    fulfilled: true,
    grantedCredits: result.creditsGranted,
    balanceAfter: balance.balance,
  })
}
