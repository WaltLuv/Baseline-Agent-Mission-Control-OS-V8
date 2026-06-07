import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedEmail } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { createPurchaseOrder, fulfillPurchaseOrder, getWorkspaceBalance } from '@/lib/billing'
import { purchaseOrderLimiter } from '@/lib/rate-limit'
import { logBillingEvent } from '@/lib/billing-log'
import { createStripeCheckoutSession, isLiveStripeMode } from '@/lib/stripe-client'

interface CreditPackageRow {
  id: number
  name: string
  price_cents: number
  credits: number
  bonus_credits: number | null
}

function siteOrigin(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (env) return env.replace(/\/$/, '')
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '127.0.0.1:3000'
  return `${proto}://${host}`
}

export async function POST(request: NextRequest) {
  const rl = purchaseOrderLimiter(request)
  if (rl) return rl

  const auth = requireVerifiedEmail(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()

  const body = await request.json().catch(() => ({}))
  const packageId = body.packageId

  if (!packageId) {
    return NextResponse.json({ error: 'packageId required' }, { status: 400 })
  }

  const pkg = db.prepare(
    'SELECT id, name, price_cents, credits, bonus_credits FROM credit_packages WHERE id = ? AND status = ? LIMIT 1'
  ).get(packageId, 'active') as CreditPackageRow | undefined

  if (!pkg) {
    return NextResponse.json({ error: 'Invalid credit package' }, { status: 404 })
  }

  const totalCredits = pkg.credits + (pkg.bonus_credits || 0)
  const stripeSessionId = `ps_${workspaceId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const orderId = createPurchaseOrder(
    workspaceId,
    packageId,
    stripeSessionId,
    totalCredits,
    pkg.price_cents
  )

  logBillingEvent('info', 'purchase.order_created', 'Purchase order created', {
    workspaceId,
    packageId,
    metadata: { stripeSessionId, totalCredits, priceCents: pkg.price_cents },
  })

  // ── Mode selection ──────────────────────────────────────────────────────
  if (isLiveStripeMode()) {
    // LIVE mode: redirect customer to Stripe Checkout. Credits only land
    // after the `checkout.session.completed` webhook fulfills the order.
    const origin = siteOrigin(request)
    try {
      const session = await createStripeCheckoutSession({
        workspaceId,
        stripeSessionId,
        packageId: pkg.id,
        packageName: pkg.name,
        packagePriceCents: pkg.price_cents,
        packageCredits: totalCredits,
        successUrl: `${origin}/app/billing?checkout=success`,
        cancelUrl: `${origin}/app/billing?checkout=cancelled`,
      })
      return NextResponse.json({
        orderId,
        stripeSessionId,
        packageName: pkg.name,
        credits: totalCredits,
        amountCents: pkg.price_cents,
        liveMode: true,
        checkoutUrl: session.url,
      })
    } catch (err) {
      logBillingEvent('error', 'purchase.order_created', 'Stripe Checkout session creation failed', {
        workspaceId,
        packageId,
        reason: err instanceof Error ? err.message : 'unknown',
      })
      return NextResponse.json(
        { error: 'Failed to start checkout. Please try again.' },
        { status: 502 },
      )
    }
  }

  // TEST/MOCK mode: auto-fulfill so credits land immediately. This is
  // critical for local demos — never leave a customer staring at a paywall.
  const idempotencyKey = `mock_fulfill_${stripeSessionId}`
  const result = fulfillPurchaseOrder(workspaceId, stripeSessionId, `evt_mock_${stripeSessionId}`, idempotencyKey)
  const balance = getWorkspaceBalance(workspaceId)
  logBillingEvent('info', 'purchase.fulfilled', 'Mock-mode purchase auto-fulfilled', {
    workspaceId,
    packageId,
    balanceAfter: balance.balance,
    metadata: { stripeSessionId, grantedCredits: result?.creditsGranted ?? 0 },
  })
  return NextResponse.json({
    orderId,
    stripeSessionId,
    packageName: pkg.name,
    credits: totalCredits,
    amountCents: pkg.price_cents,
    testMode: true,
    fulfilled: !!result,
    balanceAfter: balance.balance,
    grantedCredits: result?.creditsGranted ?? 0,
  })
}
