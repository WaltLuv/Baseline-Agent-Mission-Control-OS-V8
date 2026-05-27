/**
 * Structured logger for credit / billing mutations.
 *
 * Every state-changing billing event goes through this surface. We tee the
 * line to console for local debug AND into the `usage_events` table via
 * `observability.logStructured` so customers can audit "who did what" later.
 */
import { logStructured } from './observability'

type BillingEventLevel = 'info' | 'warn' | 'error'

type BillingEventType =
  | 'credit.grant'
  | 'credit.deduct'
  | 'credit.refund'
  | 'credit.recalculated'
  | 'credit.insufficient'
  | 'token.charged'
  | 'pricing.fallback'
  | 'purchase.order_created'
  | 'purchase.fulfilled'
  | 'webhook.signature_invalid'
  | 'webhook.replay_blocked'
  | 'autoreload.triggered'
  | 'autoreload.failed'

export interface BillingEventPayload {
  workspaceId?: number | null
  amount?: number
  balanceAfter?: number
  packageId?: number | null
  sessionId?: string | null
  reason?: string
  /** Free-form metadata. Always serializable. */
  metadata?: Record<string, string | number | boolean | null>
}

export function logBillingEvent(
  level: BillingEventLevel,
  type: BillingEventType,
  message: string,
  payload: BillingEventPayload = {},
): void {
  try {
    logStructured({
      level,
      message,
      context: 'billing',
      billingEventType: type,
      ...payload,
    })
  } catch {
    // Never let logging break a billing mutation.
  }
}
