import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { plan, billingCycle, workspaceName, userEmail } = body

    // Test mode — always succeed, no real Stripe call
    const isTestMode = process.env.STRIPE_TEST_MODE === 'true' || !process.env.STRIPE_SECRET_KEY

    if (isTestMode) {
      const mockSessionId = `test_session_${Date.now()}_${Math.random().toString(36).slice(2)}`
      return NextResponse.json({
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?checkout=success&session=${mockSessionId}`,
        testMode: true,
        sessionId: mockSessionId,
      })
    }

    // Live mode — redirect to Stripe Checkout
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    const priceId =
      plan === 'starter'
        ? billingCycle === 'annual'
          ? process.env.STRIPE_PRICE_STARTER_ANNUAL
          : process.env.STRIPE_PRICE_STARTER_MONTHLY
        : billingCycle === 'annual'
          ? process.env.STRIPE_PRICE_GROWTH_ANNUAL
          : process.env.STRIPE_PRICE_GROWTH_MONTHLY

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/login?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancelled`,
      customer_email: userEmail,
      metadata: { workspaceName, plan, billingCycle },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[stripe-checkout] error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
