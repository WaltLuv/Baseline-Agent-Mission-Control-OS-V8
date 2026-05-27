/**
 * Stripe client + helpers.
 *
 * In test/mock mode (`STRIPE_SECRET_KEY` unset or `STRIPE_TEST_MODE=true`),
 * `getStripeClient()` returns null and callers fall back to immediate credit
 * fulfillment. In live mode, this loads the Stripe SDK at runtime so the dev
 * environment doesn't pay an import cost.
 */
import Stripe from 'stripe'

let cachedClient: Stripe | null = null

export function isLiveStripeMode(): boolean {
  if (process.env.STRIPE_TEST_MODE === 'true') return false
  return !!process.env.STRIPE_SECRET_KEY
}

export function getStripeClient(): Stripe | null {
  if (!isLiveStripeMode()) return null
  if (cachedClient) return cachedClient
  cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: {
      name: 'mission-control',
      version: '3.0.0',
    },
  })
  return cachedClient
}

export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null
}

export interface CreateCheckoutSessionArgs {
  workspaceId: number
  stripeSessionId: string
  packageId: number
  packageName: string
  packagePriceCents: number
  packageCredits: number
  successUrl: string
  cancelUrl: string
}

export async function createStripeCheckoutSession(
  args: CreateCheckoutSessionArgs,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient()
  if (!stripe) throw new Error('Stripe is not configured (no STRIPE_SECRET_KEY)')
  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: args.packagePriceCents,
          product_data: {
            name: `${args.packageName} — ${args.packageCredits.toLocaleString()} credits`,
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: args.stripeSessionId,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: {
      mc_workspace_id: String(args.workspaceId),
      mc_package_id: String(args.packageId),
      mc_stripe_session_id: args.stripeSessionId,
    },
  })
}
