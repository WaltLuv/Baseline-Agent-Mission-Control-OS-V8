'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'

interface WorkforceFuelData {
  balance: number
  /** Estimated avg daily credit burn over the last 14 days. */
  dailyBurnRate: number
  /** Estimated days of runway at current burn. */
  daysRemaining: number
  /** Whether to surface the low-balance modal proactively. */
  lowBalance: boolean
  /** Recommended top-up amount in credits. */
  recommendedTopUp: number
  /** Suggested credit package id and dollar cost. */
  recommendedPackage: {
    id: number
    name: string
    credits: number
    bonusCredits: number
    priceCents: number
  } | null
}

interface Pkg {
  id: number
  name: string
  description: string
  price_cents: number
  credits: number
  bonus_credits: number
}

function computeFuelFromOverview(overview: {
  balance: { balance: number }
  recentUsage: Array<{ credits_charged: number; created_at: number }>
  packages: Pkg[]
}): WorkforceFuelData {
  const balance = overview.balance.balance
  const nowSec = Math.floor(Date.now() / 1000)
  const fourteenDaysAgo = nowSec - 14 * 24 * 60 * 60
  const recent = overview.recentUsage.filter((e) => e.created_at >= fourteenDaysAgo)
  const totalRecent = recent.reduce((a, b) => a + b.credits_charged, 0)
  // Assume a fresh workspace has no burn yet — default to a modest baseline so
  // a brand-new workspace doesn't see "infinite runway" (false confidence).
  const dailyBurnRate = totalRecent > 0 ? Math.max(1, Math.ceil(totalRecent / 14)) : 25
  const daysRemaining = balance > 0 ? Math.floor(balance / dailyBurnRate) : 0
  // Surface modal when runway drops under 5 days OR balance under 100 credits.
  const lowBalance = balance <= 0 || daysRemaining < 5 || balance < 100
  // Recommend the smallest package that covers at least 30 days of runway.
  const requiredCredits = Math.max(1000, dailyBurnRate * 30)
  const sortedPackages = [...overview.packages].sort((a, b) => a.credits + a.bonus_credits - (b.credits + b.bonus_credits))
  const recommendedPackage =
    sortedPackages.find((p) => p.credits + p.bonus_credits >= requiredCredits) ||
    sortedPackages[sortedPackages.length - 1] ||
    null
  return {
    balance,
    dailyBurnRate,
    daysRemaining,
    lowBalance,
    recommendedTopUp: recommendedPackage ? recommendedPackage.credits + recommendedPackage.bonus_credits : 1000,
    recommendedPackage: recommendedPackage
      ? {
          id: recommendedPackage.id,
          name: recommendedPackage.name,
          credits: recommendedPackage.credits,
          bonusCredits: recommendedPackage.bonus_credits,
          priceCents: recommendedPackage.price_cents,
        }
      : null,
  }
}

interface WorkforceFuelMeterProps {
  fuel: WorkforceFuelData
  onTopUpClick: () => void
}

/**
 * Workforce Fuel Meter — surfaces credits as "fuel" that powers the AI workforce.
 * Reframes the billing meter as a productivity gauge, not a token-burn counter.
 */
export function WorkforceFuelMeter({ fuel, onTopUpClick }: WorkforceFuelMeterProps) {
  const pct = Math.min(100, Math.max(0, (fuel.daysRemaining / 30) * 100))
  const tone =
    fuel.daysRemaining < 5 ? 'bg-red-500' : fuel.daysRemaining < 10 ? 'bg-amber-500' : 'bg-emerald-500'
  const label =
    fuel.daysRemaining < 5
      ? 'Refill soon — your AI workforce will pause without fuel'
      : fuel.daysRemaining < 10
      ? 'Plenty of work ahead — consider topping up'
      : 'Fully fueled'

  return (
    <div
      data-testid="workforce-fuel-meter"
      className="rounded-lg border border-border/50 bg-card/30 p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Workforce Fuel
          </p>
          <p className="text-2xl font-bold text-foreground" data-testid="fuel-balance">
            {fuel.balance.toLocaleString()} credits
          </p>
          <p className="text-xs text-muted-foreground" data-testid="fuel-runway">
            {fuel.daysRemaining > 30
              ? '30+ days of runway'
              : `~${fuel.daysRemaining} day${fuel.daysRemaining === 1 ? '' : 's'} of runway`}
            {' · '}
            <span>
              {fuel.dailyBurnRate} credits / day avg
            </span>
          </p>
        </div>
        <Button
          size="sm"
          data-testid="fuel-topup-button"
          onClick={onTopUpClick}
        >
          {fuel.lowBalance ? '⚡ Add Fuel Now' : 'Top Up'}
        </Button>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-muted/50 overflow-hidden">
        <div
          className={`h-full ${tone} transition-all duration-500`}
          style={{ width: `${pct}%` }}
          data-testid="fuel-meter-bar"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground" data-testid="fuel-label">
        {label}
      </p>
    </div>
  )
}

interface LowBalanceModalProps {
  fuel: WorkforceFuelData
  onClose: () => void
  onPurchase: (packageId: number) => Promise<void>
}

/**
 * Low Balance Modal — proactively surfaces a 1-click top-up flow before the
 * workforce hits a payment wall. Recovers the 402 INSUFFICIENT_CREDITS event
 * into a 5-second purchase moment.
 */
export function LowBalanceModal({ fuel, onClose, onPurchase }: LowBalanceModalProps) {
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!fuel.recommendedPackage) return null
  const pkg = fuel.recommendedPackage
  const totalCredits = pkg.credits + pkg.bonusCredits
  const dollars = (pkg.priceCents / 100).toFixed(0)

  const handlePurchase = async () => {
    setPurchasing(true)
    setError(null)
    try {
      await onPurchase(pkg.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top-up failed')
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div
      data-testid="low-balance-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="max-w-md w-full rounded-2xl border border-border/60 bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="text-3xl">⚡</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground">Your AI workforce is running low on fuel</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {fuel.daysRemaining <= 0
                ? 'Workspace will pause new AI work until you top up.'
                : `About ${fuel.daysRemaining} day${fuel.daysRemaining === 1 ? '' : 's'} of runway left at current pace.`}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Recommended Top-Up
              </p>
              <p className="mt-1 text-xl font-bold text-foreground" data-testid="low-balance-recommended">
                {pkg.name} — {totalCredits.toLocaleString()} credits
              </p>
              <p className="text-xs text-muted-foreground">
                {pkg.bonusCredits > 0
                  ? `${pkg.credits.toLocaleString()} + ${pkg.bonusCredits.toLocaleString()} bonus`
                  : `${pkg.credits.toLocaleString()} credits`}
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">${dollars}</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            That&apos;s about {Math.floor(totalCredits / fuel.dailyBurnRate)} days of runway at your current pace.
          </p>
        </div>

        {error && (
          <p
            className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300"
            data-testid="low-balance-error"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            data-testid="low-balance-dismiss"
            className="flex-1"
          >
            Later
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={purchasing}
            data-testid="low-balance-purchase"
            className="flex-1"
          >
            {purchasing ? 'Opening checkout…' : `Top Up — $${dollars}`}
          </Button>
        </div>

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Secure checkout via Stripe. Credits land in your workspace within seconds.
        </p>
      </div>
    </div>
  )
}

interface UseWorkforceFuelOpts {
  /** Optional poll interval in ms. Defaults to 60s. */
  pollMs?: number
}

interface UseWorkforceFuelResult {
  fuel: WorkforceFuelData | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  startPurchase: (packageId: number) => Promise<void>
}

/**
 * useWorkforceFuel — fetches the billing overview and computes fuel projections.
 * Returns helpers for the workforce fuel meter and one-click top-up flow.
 */
export function useWorkforceFuel(opts: UseWorkforceFuelOpts = {}): UseWorkforceFuelResult {
  const pollMs = opts.pollMs ?? 180_000
  const [fuel, setFuel] = useState<WorkforceFuelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/billing/overview')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFuel(computeFuelFromOverview(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fuel data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      reload()
    }, pollMs)
    return () => clearInterval(id)
  }, [reload, pollMs])

  const startPurchase = useCallback(async (packageId: number) => {
    const res = await fetch('/api/billing/purchase-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId }),
    })
    if (!res.ok) throw new Error(`Top-up failed (HTTP ${res.status})`)
    const data = await res.json()
    if (data?.checkoutUrl) {
      window.location.href = data.checkoutUrl
      return
    }
    if (data?.checkoutRequired || data?.testMode) {
      // Test/mock mode — just reload state.
      await reload()
      return
    }
    if (data?.success === false) throw new Error(data.error || 'Top-up failed')
    await reload()
  }, [reload])

  return { fuel, loading, error, reload, startPurchase }
}

export { computeFuelFromOverview }
export type { WorkforceFuelData }
