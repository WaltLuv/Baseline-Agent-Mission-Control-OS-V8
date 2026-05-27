'use client'

import { useState, useEffect, useCallback } from 'react'
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
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex gap-1">
          {(['overview', 'ledger', 'usage', 'buy'] as const).map(tab => (
            <Button
              key={tab}
              variant={selectedTab === tab ? 'default' : 'ghost'}
              size="xs"
              onClick={() => setSelectedTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedTab === 'overview' && (
          <>
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

            {/* Top Agents by Spend */}
            {topAgents.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">{t('topAgentsBySpend')}</h3>
                <div className="space-y-2">
                  {topAgents.map(a => (
                    <div key={a.agent_id || 'unknown'} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{a.agent_name || 'Unknown Agent'}</span>
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">{a.task_count} tasks</span>
                        <span className="font-mono text-amber-400">{formatCredits(a.total_credits)} credits</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
