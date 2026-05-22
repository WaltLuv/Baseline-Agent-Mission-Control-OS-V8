'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { useSmartPoll } from '@/lib/use-smart-poll'

// ─── Types ──────────────────────────────────────────────────────────────

interface Prescription {
  id: string
  type: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  dollarImpact: number
  entityType?: string
  entityIds?: Array<number | string>
  icon: string
}

interface Summary24h {
  tasksCompleted: number
  tasksFailed: number
  tasksInProgress: number
  agentsActive: number
  agentsOffline: number
  qualityReviewsApproved: number
  qualityReviewsRejected: number
  webhooksSucceeded: number
  webhooksFailed: number
  creditsUsed: number
  alertsTriggered: number
  securityEvents: number
}

interface DailyOptimizationData {
  fleetHealthScore: number
  prescriptions: Prescription[]
  summary24h: Summary24h
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDollars(cents: number): string {
  return `$${cents.toFixed(2)}`
}

function healthColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-amber-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function healthBg(score: number): string {
  if (score >= 80) return 'bg-green-400'
  if (score >= 60) return 'bg-amber-400'
  if (score >= 40) return 'bg-orange-400'
  return 'bg-red-400'
}

function healthLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Healthy'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'At Risk'
  return 'Critical'
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-l-red-500 bg-red-500/5'
    case 'warning': return 'border-l-amber-500 bg-amber-500/5'
    case 'info': return 'border-l-blue-500 bg-blue-500/5'
    default: return 'border-l-gray-500 bg-gray-500/5'
  }
}

function severityBadge(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-400 border border-red-500/30'
    case 'warning': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    case 'info': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Component ──────────────────────────────────────────────────────────

export function DailyOptimizationPanel() {
  const t = useTranslations('daily')

  const [data, setData] = useState<DailyOptimizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/daily-optimization')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch optimization data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useSmartPoll(fetchData, 30000) // refresh every 30s

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader variant="inline" label="Loading fleet optimization data..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>
          Retry
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">No optimization data available.</p>
      </div>
    )
  }

  const { fleetHealthScore, prescriptions, summary24h } = data

  // ── Fleet Health Gauge ───────────────────────────────────────────────

  const healthColorClass = healthColor(fleetHealthScore)
  const healthBgClass = healthBg(fleetHealthScore)
  const circumference = 2 * Math.PI * 54
  const strokeDash = (fleetHealthScore / 100) * circumference

  // ── Summary cards ───────────────────────────────────────────────────

  const summaryCards = [
    { label: 'Tasks Completed', value: summary24h.tasksCompleted, icon: '✅', color: 'text-green-400' },
    { label: 'Tasks Failed', value: summary24h.tasksFailed, icon: '❌', color: summary24h.tasksFailed > 0 ? 'text-red-400' : 'text-muted-foreground' },
    { label: 'In Progress', value: summary24h.tasksInProgress, icon: '⏳', color: 'text-amber-400' },
    { label: 'Agents Active', value: summary24h.agentsActive, icon: '🤖', color: summary24h.agentsActive > 0 ? 'text-green-400' : 'text-muted-foreground' },
    { label: 'Agents Offline', value: summary24h.agentsOffline, icon: '⚫', color: summary24h.agentsOffline > 0 ? 'text-red-400' : 'text-muted-foreground' },
    { label: 'Credits Used', value: formatNumber(summary24h.creditsUsed), icon: '💳', color: 'text-purple-400' },
    { label: 'QA Approved', value: summary24h.qualityReviewsApproved, icon: '👍', color: 'text-green-400' },
    { label: 'QA Rejected', value: summary24h.qualityReviewsRejected, icon: '👎', color: summary24h.qualityReviewsRejected > 0 ? 'text-red-400' : 'text-muted-foreground' },
    { label: 'Webhooks OK', value: summary24h.webhooksSucceeded, icon: '🔗', color: 'text-green-400' },
    { label: 'Webhooks Failed', value: summary24h.webhooksFailed, icon: '⚠️', color: summary24h.webhooksFailed > 0 ? 'text-red-400' : 'text-muted-foreground' },
    { label: 'Alerts Triggered', value: summary24h.alertsTriggered, icon: '🔔', color: summary24h.alertsTriggered > 0 ? 'text-amber-400' : 'text-muted-foreground' },
    { label: 'Security Events', value: summary24h.securityEvents, icon: '🛡️', color: summary24h.securityEvents > 0 ? 'text-red-400' : 'text-muted-foreground' },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header + Health Gauge */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Daily Optimization</h2>
            <p className="text-sm text-muted-foreground">Fleet health & top prescriptions</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            ↻ Refresh
          </Button>
        </div>

        {/* Fleet Health Gauge */}
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="10"
                opacity="0.2"
              />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                className={healthBgClass}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={circumference - strokeDash}
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${healthColorClass}`}>
                {fleetHealthScore}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div>
            <div className={`text-xl font-semibold ${healthColorClass}`}>
              {healthLabel(fleetHealthScore)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} generated
            </div>
            {prescriptions.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {prescriptions.map(p => (
                  <span
                    key={p.id}
                    className={`text-xs px-1.5 py-0.5 rounded ${severityBadge(p.severity)}`}
                  >
                    {p.icon} {p.severity}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prescriptions */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Top Prescriptions ({prescriptions.length})
        </h3>
        {prescriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <span className="text-2xl mb-2">✨</span>
            <span className="text-sm">All systems nominal — no prescriptions needed.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {prescriptions.map(p => (
              <div
                key={p.id}
                className={`border-l-4 rounded-r-lg p-3 ${severityColor(p.severity)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-sm font-medium truncate">{p.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityBadge(p.severity)}`}>
                      {p.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ~{formatDollars(p.dollarImpact)} impact
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 24h Summary Cards */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          24h Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {summaryCards.map(card => (
            <div
              key={card.label}
              className="bg-card border border-border rounded-lg p-3 hover:border-border/80 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{card.icon}</span>
                <span className="text-xs text-muted-foreground truncate">{card.label}</span>
              </div>
              <div className={`text-lg font-semibold ${card.color}`}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
