'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { useMissionControl } from '@/store'
import { useSmartPoll } from '@/lib/use-smart-poll'
import {
  WorkforceFuelMeter,
  LowBalanceModal,
  computeFuelFromOverview,
  type WorkforceFuelData,
} from '@/components/billing/workforce-fuel'
import { WorkforceHealthScore, useDerivedHealthInputs } from '@/components/billing/workforce-health-score'

interface BillingOverview {
  balance: {
    balance: number
    granted: number
    used: number
    refunded: number
    ledgerVerified: boolean
  }
  subscription: {
    id: number
    plan_name: string
    setup_fee_cents: number
    monthly_price_cents: number
    included_credits: number
    status: string
    current_period_end: number
  } | null
  packages: Array<{
    id: number
    name: string
    description: string
    price_cents: number
    credits: number
    bonus_credits: number
  }>
  recentLedger: Array<{
    id: number
    type: string
    amount: number
    balance_after: number
    source_type: string
    description: string
    created_at: number
  }>
  recentUsage: Array<{
    id: number
    event_type: string
    credits_charged: number
    agent_id: number | null
    task_id: number | null
    created_at: number
    provider?: string | null
    model?: string | null
  }>
  topAgents: Array<{
    agent_id: number
    agent_name: string
    task_count: number
    total_credits: number
  }>
}

const creditTypeLabels: Record<string, string> = {
  grant: 'Granted',
  usage: 'Used',
  refund: 'Refunded',
  adjustment: 'Adjusted',
  purchase: 'Purchased',
}

const creditTypeColors: Record<string, string> = {
  grant: 'text-green-400',
  usage: 'text-red-400',
  refund: 'text-blue-400',
  adjustment: 'text-yellow-400',
  purchase: 'text-purple-400',
}

function formatCredits(amount: number): string {
  return amount.toLocaleString()
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp * 1000
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function BillingPanel() {
  const t = useTranslations('billing')
  const { agents } = useMissionControl()

  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'ledger' | 'usage' | 'buy'>('overview')
  const [fuel, setFuel] = useState<WorkforceFuelData | null>(null)
  const [showLowBalance, setShowLowBalance] = useState(false)
  const [autoDismissedLowBalance, setAutoDismissedLowBalance] = useState(false)
  const [marginData, setMarginData] = useState<{
    wholesaleCents: number
    retailCents: number
    marginPercent: number
  } | null>(null)
  const [autoreload, setAutoreload] = useState<{
    enabled: boolean
    thresholdCredits: number
    packageId: number
    maxPerMonthCents: number
  } | null>(null)
  const { currentUser } = useMissionControl()
  const isAdmin = currentUser?.role === 'admin'
  // Detect Stripe live vs test/mock mode. Public env var so the client can
  // surface the safety banner without a roundtrip.
  const isStripeTestMode =
    typeof window !== 'undefined' &&
    (process.env.NEXT_PUBLIC_STRIPE_LIVE_MODE !== 'true')

  const fetchOverview = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/billing/overview')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setOverview(data)
      const f = computeFuelFromOverview(data)
      setFuel(f)
      // Surface modal automatically when low balance is detected for the
      // first time per session (user can dismiss; we won't re-pop within the
      // same panel-mount).
      if (f.lowBalance && !autoDismissedLowBalance) {
        setShowLowBalance(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch billing data')
    } finally {
      setLoading(false)
    }
  }, [autoDismissedLowBalance])

  useEffect(() => { fetchOverview() }, [fetchOverview])
  useSmartPoll(fetchOverview, 60000) // refresh every 60s

  // Lazy fetch admin-only / settings data once on mount.
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/billing/margin?timeframe=week')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMarginData({
          wholesaleCents: d.wholesaleCents ?? 0,
          retailCents: d.retailCents ?? 0,
          marginPercent: d.marginPercent ?? 0,
        })
      })
      .catch(() => {})
  }, [isAdmin])
  useEffect(() => {
    fetch('/api/billing/autoreload')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAutoreload(d) })
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader variant="inline" label={t('loadingBilling')} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={fetchOverview}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">{t('noBillingData')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('noBillingDataSubtitle')}
        </p>
      </div>
    )
  }

  const { balance, subscription, packages, recentLedger, recentUsage, topAgents } = overview
  const balanceColor = balance.balance < 0 ? 'text-red-400' : balance.balance < 100 ? 'text-amber-400' : 'text-green-400'
  const balanceLabel = balance.balance < 0 ? 'Negative' : balance.balance < 100 ? 'Low Balance' : 'Healthy'

  return (
    <div className="flex flex-col h-full">
      {/* Story header */}
      <div data-testid="panel-story-billing" className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">AI Workforce Billing</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track Workforce Credits, work completed, and labor value saved across your AI employees.
          </p>
        </div>
        <div className="flex gap-1">
          {(['overview', 'ledger', 'usage', 'buy'] as const).map(tab => (
            <Button
              key={tab}
              variant={selectedTab === tab ? 'default' : 'ghost'}
              size="xs"
              onClick={() => setSelectedTab(tab)}
              data-testid={`billing-tab-${tab}`}
            >
              {tab === 'buy' ? 'Buy Credits' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Test-mode safety banner */}
      {isStripeTestMode && (
        <div
          className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10 text-xs text-amber-200"
          data-testid="billing-testmode-banner"
        >
          <strong>Stripe test/mock mode active</strong> — purchases auto-fulfill instantly and no
          real cards are charged. Set <code>STRIPE_SECRET_KEY</code> +{' '}
          <code>STRIPE_WEBHOOK_SECRET</code> + <code>NEXT_PUBLIC_STRIPE_LIVE_MODE=true</code> to go live.
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedTab === 'overview' && (
          <>
            {/* Workforce Health Score — admin-facing trust surface */}
            <HealthBlock
              fuel={fuel}
              marginPercent={marginData?.marginPercent ?? null}
              ledgerVerified={balance.ledgerVerified}
              recentEventCount={recentUsage.length}
            />

            {/* Workforce Fuel Meter — frames credits as productivity fuel */}
            {fuel && (
              <WorkforceFuelMeter
                fuel={fuel}
                onTopUpClick={() => {
                  if (fuel.lowBalance || fuel.recommendedPackage) {
                    setShowLowBalance(true)
                  } else {
                    setSelectedTab('buy')
                  }
                }}
              />
            )}

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">{t('availableCredits')}</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${balanceColor}`}>
                  {formatCredits(balance.balance)}
                </p>
                <span className="text-xs text-muted-foreground">{balanceLabel}</span>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">{t('totalGranted')}</p>
                <p className="text-2xl font-bold font-mono mt-1 text-green-400">
                  {formatCredits(balance.granted)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">{t('totalUsed')}</p>
                <p className="text-2xl font-bold font-mono mt-1 text-red-400">
                  {formatCredits(balance.used)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">{t('ledgerStatus')}</p>
                <p className="text-2xl font-bold font-mono mt-1 text-green-400">
                  ✓ {balance.ledgerVerified ? t('verified') : t('mismatch')}
                </p>
              </div>
            </div>

            {/* Subscription Info */}
            {subscription && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">{t('currentPlan')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('planName')}</p>
                    <p className="text-sm font-medium">{subscription.plan_name || 'Custom'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('monthlyFee')}</p>
                    <p className="text-sm font-medium">{formatDollars(subscription.monthly_price_cents)}/mo</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('includedCredits')}</p>
                    <p className="text-sm font-medium">{formatCredits(subscription.included_credits)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('periodEnd')}</p>
                    <p className="text-sm font-medium">{new Date(subscription.current_period_end * 1000).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top AI Employees by Spend */}
            {topAgents.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4" data-testid="billing-top-agents">
                <h3 className="text-sm font-semibold mb-1">Top AI Employees by Workforce Credit Usage</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Story: where your AI workforce is doing the most work right now. High-spend
                  employees should map to the workflows that matter most to your business.
                </p>
                <div className="space-y-2">
                  {topAgents.map(a => (
                    <div key={a.agent_id || 'unknown'} className="flex items-center justify-between text-sm">
                      <Link
                        href={`/app/agents?focus=${encodeURIComponent(a.agent_name || '')}`}
                        data-testid={`billing-top-agent-link-${a.agent_id || 'unknown'}`}
                        className="text-foreground hover:underline"
                      >
                        {a.agent_name || 'Unknown AI Employee'}
                      </Link>
                      <div className="flex gap-4">
                        <Link
                          href={`/app/tasks/kanban?agent=${encodeURIComponent(a.agent_name || '')}`}
                          data-testid={`billing-top-agent-tasks-link-${a.agent_id || 'unknown'}`}
                          className="text-muted-foreground hover:text-primary hover:underline"
                        >
                          {a.task_count} tasks completed
                        </Link>
                        <span className="font-mono text-amber-400">{formatCredits(a.total_credits)} credits</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Usage / Billing Event Timeline */}
            {recentUsage.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4" data-testid="billing-usage-history">
                <h3 className="text-sm font-semibold mb-1">Recent Workforce Activity</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Story: every billable action your AI workforce has performed. Each row is one
                  unit of work completed with credits exchanged for time saved.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border/40">
                        <th className="py-1.5 text-left font-medium">When</th>
                        <th className="py-1.5 text-left font-medium">Event</th>
                        <th className="py-1.5 text-left font-medium">Provider / Model</th>
                        <th className="py-1.5 text-right font-medium">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentUsage.slice(0, 8).map((u, i) => (
                        <tr key={i} className="border-b border-border/20">
                          <td className="py-1.5 text-muted-foreground">
                            {new Date(u.created_at * 1000).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-1.5">{u.event_type || 'work'}</td>
                          <td className="py-1.5 text-muted-foreground">
                            {[u.provider, u.model].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="py-1.5 text-right font-mono text-amber-400">
                            {u.credits_charged}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Admin-only margin widget. Story: "is the business model healthy?" */}
            {isAdmin && marginData && (
              <div className="bg-card border border-border rounded-lg p-4" data-testid="billing-margin-widget">
                <h3 className="text-sm font-semibold mb-1">Workforce Margin (admin view)</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Story: of every dollar a customer spends on credits, how much covers wholesale
                  cost and how much is gross margin?
                </p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded border border-border/40 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Wholesale (last week)</p>
                    <p className="mt-1 font-mono text-foreground">
                      ${(marginData.wholesaleCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded border border-border/40 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Retail (last week)</p>
                    <p className="mt-1 font-mono text-foreground">
                      ${(marginData.retailCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded border border-border/40 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Margin</p>
                    <p className="mt-1 font-mono text-emerald-400">
                      {marginData.marginPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-reload toggle */}
            {autoreload && (
              <div className="bg-card border border-border rounded-lg p-4" data-testid="billing-autoreload">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">Never let the workforce stop</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Automatically top up with the recommended pack when your workforce fuel falls
                      below {autoreload.thresholdCredits} credits. Cap: ${Math.round(autoreload.maxPerMonthCents / 100)} / month.
                    </p>
                  </div>
                  <Button
                    size="xs"
                    variant={autoreload.enabled ? 'default' : 'outline'}
                    data-testid="billing-autoreload-toggle"
                    onClick={async () => {
                      const next = { ...autoreload, enabled: !autoreload.enabled }
                      setAutoreload(next)
                      await fetch('/api/billing/autoreload', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(next),
                      })
                    }}
                  >
                    {autoreload.enabled ? 'Enabled ✓' : 'Enable'}
                  </Button>
                </div>
              </div>
            )}

            {/* Customer explainer */}
            <div
              className="rounded-lg border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground"
              data-testid="billing-credits-explainer"
            >
              <p className="font-semibold text-foreground">What are AI Workforce Credits?</p>
              <p className="mt-1">
                Workforce Credits are the fuel that powers your AI employees. Each task an AI
                employee completes uses a small number of credits — roughly proportional to the
                time it would have taken a human to do the same work. We never charge zero for
                real work, and you only pay for what your workforce actually does.
              </p>
            </div>
          </>
        )}

        {selectedTab === 'ledger' && (
          <div className="space-y-2">
            {recentLedger.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{t('noLedgerEntries')}</p>
                <p className="text-xs mt-1">{t('noLedgerEntriesSubtitle')}</p>
              </div>
            ) : (
              recentLedger.map(entry => (
                <div key={entry.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${creditTypeColors[entry.type] || 'text-muted-foreground'}`}>
                      {creditTypeLabels[entry.type] || entry.type}
                    </span>
                    <span className="text-sm text-muted-foreground max-w-xs truncate">{entry.description}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`font-mono ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.amount >= 0 ? '+' : ''}{formatCredits(entry.amount)}
                    </span>
                    <span className="text-muted-foreground">→ {formatCredits(entry.balance_after)}</span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selectedTab === 'usage' && (
          <div className="space-y-2">
            {recentUsage.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{t('noUsageEvents')}</p>
                <p className="text-xs mt-1">{t('noUsageEventsSubtitle')}</p>
              </div>
            ) : (
              recentUsage.map(event => {
                const agent = agents.find(a => a.id === event.agent_id)
                return (
                  <div key={event.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-blue-400">{event.event_type}</span>
                      <span className="text-sm text-muted-foreground">
                        {agent ? agent.name : event.task_id ? `Task #${event.task_id}` : 'System'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-amber-400">-{formatCredits(event.credits_charged)}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(event.created_at)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {selectedTab === 'buy' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">{t('buyCredits')}</h3>
              <p className="text-xs text-muted-foreground">{t('buyCreditsSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {packages.map(pkg => (
                <div key={pkg.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-smooth">
                  <h4 className="text-sm font-semibold">{pkg.name}</h4>
                  <p className="text-2xl font-bold font-mono mt-2">
                    {formatDollars(pkg.price_cents)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatCredits(pkg.credits)} AI Workforce Credits
                    {pkg.bonus_credits > 0 && (
                      <span className="text-green-400 block">+ {formatCredits(pkg.bonus_credits)} bonus</span>
                    )}
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-3"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/billing/purchase-order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ packageId: pkg.id }),
                        })
                        const data = await res.json()
                        if (data?.checkoutUrl) {
                          window.location.href = data.checkoutUrl
                          return
                        }
                        if (data?.testMode || data?.fulfilled) {
                          // Mock mode: credits already granted server-side.
                          await fetchOverview()
                          return
                        }
                        if (data?.checkoutRequired) {
                          alert(`${pkg.name}: ${formatCredits(pkg.credits)} credits for ${formatDollars(pkg.price_cents)}. Redirect to Stripe required.`)
                        }
                      } catch {
                        alert('Failed to create purchase order')
                      }
                    }}
                  >
                    {t('buyNow')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLowBalance && fuel && (
        <LowBalanceModal
          fuel={fuel}
          onClose={() => {
            setShowLowBalance(false)
            setAutoDismissedLowBalance(true)
          }}
          onPurchase={async (packageId) => {
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
            // Mock/test mode — credits land instantly server-side.
            await fetchOverview()
            setShowLowBalance(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * Mini wrapper that delays the health computation until task data is loaded
 * (so the score doesn't flicker between "0 attention" and "N attention" when
 * the page first mounts).
 */
function HealthBlock(props: {
  fuel: { balance: number; daysRemaining: number } | null
  marginPercent: number | null
  ledgerVerified: boolean
  recentEventCount: number
}) {
  const inputs = useDerivedHealthInputs(props)
  return <WorkforceHealthScore inputs={inputs} />
}
