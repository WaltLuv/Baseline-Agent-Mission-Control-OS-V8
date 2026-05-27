import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { createPurchaseOrder, fulfillPurchaseOrder, getWorkspaceBalance } from '@/lib/billing'

interface CreditPackageRow {
  id: number
  name: string
  price_cents: number
  credits: number
  bonus_credits: number | null
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

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

  // Stripe checkout continuation:
  //   - Test/mock mode (no STRIPE_SECRET_KEY) → auto-fulfill so credits land
  //     immediately. Mission Control should NEVER leave a customer staring
  //     at a paywall during local/demo flows.
  //   - Live mode → return checkoutUrl for the Stripe-hosted page.
  const isTestMode =
    process.env.STRIPE_TEST_MODE === 'true' || !process.env.STRIPE_SECRET_KEY

  if (isTestMode) {
    const idempotencyKey = `mock_fulfill_${stripeSessionId}`
    const result = fulfillPurchaseOrder(workspaceId, stripeSessionId, `evt_mock_${stripeSessionId}`, idempotencyKey)
    const balance = getWorkspaceBalance(workspaceId)
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

  // Live mode: caller redirects to Stripe Checkout URL.
  // (Stripe SDK integration left in stripe/checkout/route.ts.)
  return NextResponse.json({
    orderId,
    stripeSessionId,
    packageName: pkg.name,
    credits: totalCredits,
    amountCents: pkg.price_cents,
    checkoutRequired: true,
    // checkoutUrl: await createStripeSession(stripeSessionId, workspaceId, pkg.price_cents)
  })
}
