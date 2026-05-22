import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { fulfillPurchaseOrder } from '@/lib/billing'
import { logStructured } from '@/lib/observability'

/**
 * Stripe Webhook Handler
 * - Verifies event idempotency (never process same event twice)
 * - Grants credits ONLY through billing service (never from success page)
 * - Marks webhook as processed
 * - Fulfills purchase orders
 *
 * CRITICAL RULES:
 * - Stripe confirms money movement; database controls balances
 * - Never grant credits from success redirect
 * - Never process same Stripe event twice
 * - Never update balance without immutable ledger row
 */
export async function POST(request: NextRequest) {
  const db = getDatabase()

  // Parse raw body (for Stripe signature verification in production)
  const rawBody = await request.text()
  const sigHeader = request.headers.get('stripe-signature')

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const stripeEventId = event.id
  const eventType = event.type

  // ── Idempotency: has this event been processed? ──
  const existing = db.prepare(
    'SELECT id, processed FROM stripe_webhook_events WHERE stripe_event_id = ?'
  ).get(stripeEventId) as { id: number; processed: number } | undefined

  if (existing) {
    logStructured({ level: 'warn', message: 'Duplicate webhook event', stripeEventId, type: eventType })
    return NextResponse.json({ received: true, duplicate: true })
  }

  // ── Record webhook event ──
  db.prepare(
    'INSERT INTO stripe_webhook_events (stripe_event_id, type, raw_json, processed, created_at) VALUES (?, ?, ?, 0, unixepoch())'
  ).run(stripeEventId, eventType, rawBody)

  try {
    switch (eventType) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const stripeSessionId = session.id
        const metadata = session.metadata || {}

        // Find and fulfill the purchase order
        const workspaceId = metadata.workspace_id ? parseInt(metadata.workspace_id) : null
        if (!workspaceId) {
          logStructured({ level: 'error', message: 'Webhook missing workspace_id', stripeEventId })
          break
        }

        // Extract Stripe event idempotency key
        const idempotencyKey = `stripe_${stripeEventId}`

        // Fulfill: grants credits + marks order paid
        const result = fulfillPurchaseOrder(workspaceId, stripeSessionId, stripeEventId, idempotencyKey)
        if (result) {
          logStructured({
            level: 'info',
            message: 'Credits granted via Stripe webhook',
            workspaceId,
            creditsGranted: result.creditsGranted,
            balanceAfter: result.balanceAfter,
            stripeEventId,
          })
        } else {
          logStructured({
            level: 'warn',
            message: 'No pending purchase order for webhook',
            stripeSessionId,
            stripeEventId,
          })
        }
        break
      }

      case 'invoice.paid': {
        // Monthly subscription payment — could trigger included credit grant
        const invoice = event.data.object
        const subscription = invoice.subscription
        logStructured({ level: 'info', message: 'Invoice paid', subscription, stripeEventId })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        logStructured({ level: 'error', message: 'Invoice payment failed', stripeEventId, customer: invoice.customer })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        logStructured({ level: 'info', message: 'Subscription change', type: eventType, stripeEventId, subscription: subscription.id })
        break
      }

      default:
        logStructured({ level: 'info', message: 'Unhandled webhook type', type: eventType, stripeEventId })
    }

    // Mark webhook as processed
    db.prepare(
      'UPDATE stripe_webhook_events SET processed = 1, processed_at = unixepoch() WHERE stripe_event_id = ?'
    ).run(stripeEventId)

    return NextResponse.json({ received: true })
  } catch (error) {
    logStructured({ level: 'error', message: 'Webhook processing error', stripeEventId, error: String(error) })
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
