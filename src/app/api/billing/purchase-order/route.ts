import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { createPurchaseOrder } from '@/lib/billing'

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

  // Get package details
  const pkg = db.prepare(
    'SELECT id, name, price_cents, credits, bonus_credits FROM credit_packages WHERE id = ? AND status = ? LIMIT 1'
  ).get(packageId, 'active') as any

  if (!pkg) {
    return NextResponse.json({ error: 'Invalid credit package' }, { status: 404 })
  }

  const totalCredits = pkg.credits + (pkg.bonus_credits || 0)
  const stripeSessionId = `ps_${workspaceId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Create purchase order BEFORE any checkout
  const orderId = createPurchaseOrder(
    workspaceId,
    packageId,
    stripeSessionId,
    totalCredits,
    pkg.price_cents
  )

  return NextResponse.json({
    orderId,
    stripeSessionId,
    packageName: pkg.name,
    credits: totalCredits,
    amountCents: pkg.price_cents,
    // In production, you'd redirect to Stripe Checkout here:
    // checkoutUrl: await createStripeSession(stripeSessionId, workspaceId, pkg.price_cents)
    checkoutRequired: true,
  })
}
