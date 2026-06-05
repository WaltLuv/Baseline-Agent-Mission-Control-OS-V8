/**
 * Stripe webhook handler — single secure entry point.
 *
 * Always verifies the Stripe-Signature header against STRIPE_WEBHOOK_SECRET
 * (live mode only). Mock-mode test hatch is preserved for unit tests when
 * STRIPE_SECRET_KEY is unset.
 *
 * Handled events:
 *   • checkout.session.completed / async_payment_succeeded
 *       → fulfill a credit-pack or marketplace purchase order
 *   • invoice.paid
 *       → grant subscription renewal credits (idempotent on invoice id)
 *   • invoice.payment_failed
 *       → log + (future) mark subscription past_due
 *   • customer.subscription.created / updated / deleted
 *       → update lifecycle state on customer_subscriptions
 *   • everything else
 *       → record + return { received: true, ignored: true }
 *
 * Idempotency comes from:
 *   • the credit-ledger UNIQUE(idempotency_key) constraint, and
 *   • the stripe_webhook_events table (event id is the primary key).
 *
 * NOTE — there used to be a second handler at /api/webhooks/stripe that
 * did NOT verify signatures. It was deleted in this same change. The
 * Stripe dashboard webhook URL must point at /api/stripe/webhook.
 */
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeClient, getWebhookSecret, isLiveStripeMode } from '@/lib/stripe-client'
import {
  fulfillPurchaseOrder,
  getWorkspaceBalance,
  grantSubscriptionRenewalCredits,
  updateSubscriptionStatus,
} from '@/lib/billing'
import { logBillingEvent } from '@/lib/billing-log'
import { getDatabase } from '@/lib/db'
import {
  findMarketplacePurchaseBySession,
  fulfillMarketplacePurchase,
} from '@/lib/marketplace-fulfillment'

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

// Idempotency ledger: refuse to re-process an event we've already seen.
function recordWebhookEvent(eventId: string, type: string, rawBody: string): { duplicate: boolean } {
  const db = getDatabase()
  const existing = db.prepare(
    'SELECT processed FROM stripe_webhook_events WHERE stripe_event_id = ?'
  ).get(eventId) as { processed: number } | undefined
  if (existing) return { duplicate: true }
  db.prepare(
    'INSERT INTO stripe_webhook_events (stripe_event_id, type, raw_json, processed, created_at) VALUES (?, ?, ?, 0, unixepoch())'
  ).run(eventId, type, rawBody)
  return { duplicate: false }
}

function markEventProcessed(eventId: string) {
  const db = getDatabase()
  db.prepare(
    'UPDATE stripe_webhook_events SET processed = 1, processed_at = unixepoch() WHERE stripe_event_id = ?'
  ).run(eventId)
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)

  // ── Mock-mode test hatch — must not be reachable in live mode. ───────
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

  // ── Live mode signature verification. ────────────────────────────────
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

  // ── Idempotency — short-circuit on replay. ──────────────────────────
  const { duplicate } = recordWebhookEvent(event.id, event.type, rawBody)
  if (duplicate) {
    logBillingEvent('info', 'webhook.replay_blocked', 'Duplicate Stripe webhook ignored', {
      metadata: { eventId: event.id, type: event.type },
    })
    return NextResponse.json({ received: true, replay: true })
  }

  try {
    switch (event.type) {
      // ── One-time purchases (credit packs, paid skills, paid workflows) ──
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        const stripeSessionId =
          session.client_reference_id ||
          (session.metadata?.mc_stripe_session_id as string | undefined) ||
          session.id
        const order = lookupOrder(stripeSessionId)
        if (!order) {
          // Not a credit-pack purchase — check the marketplace purchase ledger
          // (skills / workflows / employees / bundles).
          const mkt = findMarketplacePurchaseBySession(stripeSessionId)
          if (mkt) {
            const result = fulfillMarketplacePurchase(mkt, event.id)
            logBillingEvent('info', 'purchase.fulfilled', 'Marketplace purchase fulfilled via Stripe webhook', {
              workspaceId: mkt.workspace_id,
              metadata: {
                stripeSessionId,
                eventId: event.id,
                itemType: result.itemType,
                itemId: result.itemId,
                alreadyFulfilled: result.alreadyFulfilled,
              },
            })
            markEventProcessed(event.id)
            return NextResponse.json({
              received: true,
              fulfilled: !result.alreadyFulfilled,
              itemType: result.itemType,
              itemId: result.itemId,
            })
          }
          logBillingEvent('warn', 'purchase.fulfilled', 'Stripe webhook for unknown order', {
            metadata: { stripeSessionId, eventId: event.id, type: event.type },
          })
          // 200 so Stripe doesn't replay an order we genuinely don't know about.
          markEventProcessed(event.id)
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
          logBillingEvent('info', 'webhook.replay_blocked', 'Duplicate Stripe webhook ignored at ledger', {
            workspaceId: order.workspace_id,
            metadata: { stripeSessionId, eventId: event.id },
          })
          markEventProcessed(event.id)
          return NextResponse.json({ received: true, replay: true, balanceAfter: balance.balance })
        }
        logBillingEvent('info', 'purchase.fulfilled', 'Stripe webhook fulfilled purchase', {
          workspaceId: order.workspace_id,
          balanceAfter: balance.balance,
          metadata: { stripeSessionId, eventId: event.id, grantedCredits: result.creditsGranted },
        })
        markEventProcessed(event.id)
        return NextResponse.json({
          received: true,
          fulfilled: true,
          grantedCredits: result.creditsGranted,
          balanceAfter: balance.balance,
        })
      }

      // ── Subscription renewal — grants the plan's included credits. ──
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null
          period_start?: number | null
          period_end?: number | null
        }
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id ?? null
        if (!subscriptionId) {
          // One-off invoices aren't a renewal grant; record + skip.
          logBillingEvent('info', 'webhook.replay_blocked', 'invoice.paid without subscription — skipped', {
            metadata: { eventId: event.id, invoiceId: invoice.id },
          })
          markEventProcessed(event.id)
          return NextResponse.json({ received: true, ignored: true })
        }
        const result = grantSubscriptionRenewalCredits({
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: invoice.id ?? '',
          stripeEventId: event.id,
          periodStart: invoice.period_start ?? null,
          periodEnd: invoice.period_end ?? null,
        })
        if (!result) {
          logBillingEvent('warn', 'purchase.fulfilled', 'invoice.paid for unknown subscription', {
            metadata: { subscriptionId, eventId: event.id, invoiceId: invoice.id },
          })
          markEventProcessed(event.id)
          return NextResponse.json({ received: true, ignored: true })
        }
        logBillingEvent('info', 'purchase.fulfilled', 'Subscription renewal credits granted', {
          workspaceId: result.workspaceId,
          balanceAfter: result.balanceAfter,
          metadata: {
            subscriptionId,
            invoiceId: invoice.id,
            eventId: event.id,
            grantedCredits: result.creditsGranted,
            idempotent: result.idempotent,
          },
        })
        markEventProcessed(event.id)
        return NextResponse.json({
          received: true,
          fulfilled: !result.idempotent,
          grantedCredits: result.creditsGranted,
          balanceAfter: result.balanceAfter,
        })
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null
        }
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id ?? null
        if (subscriptionId) updateSubscriptionStatus(subscriptionId, 'past_due')
        logBillingEvent('error', 'purchase.fulfilled', 'Invoice payment failed', {
          metadata: { subscriptionId, invoiceId: invoice.id, eventId: event.id },
        })
        markEventProcessed(event.id)
        return NextResponse.json({ received: true, status: 'past_due' })
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const status =
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : sub.status
        updateSubscriptionStatus(sub.id, status)
        logBillingEvent('info', 'purchase.fulfilled', 'Subscription lifecycle change', {
          metadata: { subscriptionId: sub.id, status, eventId: event.id, type: event.type },
        })
        markEventProcessed(event.id)
        return NextResponse.json({ received: true, status })
      }

      default: {
        logBillingEvent('info', 'webhook.replay_blocked', 'Unhandled webhook type', {
          metadata: { eventId: event.id, type: event.type },
        })
        markEventProcessed(event.id)
        return NextResponse.json({ received: true, ignored: true })
      }
    }
  } catch (err) {
    logBillingEvent('error', 'webhook.signature_invalid', 'Webhook processing error', {
      metadata: { eventId: event.id, type: event.type, reason: err instanceof Error ? err.message : 'unknown' },
    })
    // Don't mark processed → Stripe retries → idempotency layer above
    // catches the replay if we eventually succeed.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
