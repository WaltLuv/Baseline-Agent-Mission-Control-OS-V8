'use client'

import { useState, useEffect, useCallback } from 'react'
import { AgentAvatar } from '@/components/ui/agent-avatar'

// ── Types ──────────────────────────────────────────────────────────────

interface PersonaData {
  id: number
  name: string
  role: string
  status: 'offline' | 'idle' | 'busy' | 'error'
  missionStatement: string | null
  operatingStyle: {
    label: string
    icon: string
    description: string
  }
  summonPhrases: string[]
  modelPrefs: {
    primary: string | null
    fallback: string | null
  }
  assignedSkills: string[]
  trustScore: {
    score: number
    authFailures: number
    injectionAttempts: number
    rateLimitHits: number
    secretExposures: number
    successfulTasks: number
    failedTasks: number
    lastAnomalyAt: number | null
  }
  workload: number
  creditsUsed: {
    totalCents: number
    totalCredits: number
    eventCount: number
  }
  qualityTrend: {
    approvalRate: number | null
    totalReviews: number
    approvedReviews: number
    rejectedReviews: number
  }
  lastActivity: string | null
  lastSeen: number | null
  createdAt: number
  updatedAt: number
}

const statusColors: Record<string, string> = {
  offline: 'text-slate-500',
  idle: 'text-emerald-400',
  busy: 'text-amber-400',
  error: 'text-rose-400',
}

const statusBgColors: Record<string, string> = {
  offline: 'bg-slate-500',
  idle: 'bg-emerald-500',
  busy: 'bg-amber-500',
  error: 'bg-rose-500',
}

const trustColor = (score: number) => {
  if (score >= 0.9) return 'text-emerald-400'
  if (score >= 0.7) return 'text-amber-400'
  return 'text-rose-400'
}

const trustBgBar = (score: number) => {
  if (score >= 0.9) return 'bg-emerald-500'
  if (score >= 0.7) return 'bg-amber-500'
  return 'bg-rose-500'
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatLastSeen(timestamp: number | null): string {
  if (!timestamp) return 'Never'
  const now = Date.now()
  const diffMs = now - (timestamp * 1000)
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(timestamp * 1000).toLocaleDateString()
}

function formatCredits(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// ── Component ──────────────────────────────────────────────────────────

export function AgentPersonaCard({ agentId, onClose }: { agentId: number | string; onClose?: () => void }) {
  const [persona, setPersona] = useState<PersonaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPersona = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const res = await fetch(`/api/agents/${agentId}/persona`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to load persona')
      }
      const json = await res.json()
      setPersona(json.persona)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchPersona()
  }, [fetchPersona])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-850 rounded-xl border border-gray-700/60 p-6 animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-700" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-gray-700 rounded" />
            <div className="h-3 w-24 bg-gray-700/60 rounded" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-3 w-full bg-gray-700/40 rounded" />
          <div className="h-3 w-5/6 bg-gray-700/40 rounded" />
        </div>
      </div>
    )
  }

  if (error || !persona) {
    return (
      <div className="bg-gray-900 rounded-xl border border-rose-500/30 p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-rose-400 font-medium">Failed to load persona</span>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
          )}
        </div>
        <p className="text-sm text-gray-400">{error}</p>
        <button
          onClick={fetchPersona}
          className="mt-4 text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  const ts = persona.trustScore
  const qt = persona.qualityTrend
  const cu = persona.creditsUsed
  const st = persona.summonPhrases
  const sk = persona.assignedSkills
  const mp = persona.modelPrefs

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-850 rounded-xl border border-gray-700/60 shadow-2xl overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="relative p-6 pb-4">
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-700/50 transition-all text-lg leading-none"
          >
            ×
          </button>
        )}

        <div className="flex items-start gap-4">
          <AgentAvatar name={persona.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">{persona.name}</h2>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full capitalize
                ${persona.status === 'idle' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : ''}
                ${persona.status === 'busy' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : ''}
                ${persona.status === 'error' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : ''}
                ${persona.status === 'offline' ? 'bg-slate-500/15 text-slate-400 border border-slate-500/30' : ''}
              `}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusBgColors[persona.status]}`} />
                {persona.status}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{persona.role}</p>
            <p className="text-xs text-gray-500 mt-1">
              Last active {formatLastSeen(persona.lastSeen)}
              {persona.lastActivity && <span className="ml-2 text-gray-400/70">· {persona.lastActivity}</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700/40" />

      {/* ── Stats Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-px bg-gray-700/30">
        {/* Trust Score */}
        <div className="bg-gray-900/90 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Trust</span>
            <span className={`text-lg font-bold tabular-nums ${trustColor(ts.score)}`}>{ts.score.toFixed(2)}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${trustBgBar(ts.score)}`}
              style={{ width: `${Math.min(ts.score * 100, 100)}%` }}
            />
          </div>
          {ts.successfulTasks > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {ts.successfulTasks} ✓ · {ts.failedTasks} ✗
            </p>
          )}
        </div>

        {/* Workload */}
        <div className="bg-gray-900/90 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Workload</span>
            <span className={`text-lg font-bold tabular-nums ${persona.workload > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
              {persona.workload}
            </span>
          </div>
          <p className="text-xs text-gray-500">in progress</p>
          {persona.workload >= 3 && (
            <p className="text-xs text-rose-400 mt-1 font-medium">Near capacity</p>
          )}
        </div>

        {/* Credits */}
        <div className="bg-gray-900/90 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Credits</span>
            <span className="text-lg font-bold tabular-nums text-cyan-400">{formatCredits(cu.totalCents)}</span>
          </div>
          <p className="text-xs text-gray-500">
            {cu.eventCount} event{cu.eventCount !== 1 ? 's' : ''}
          </p>
          {cu.totalCredits > 0 && (
            <p className="text-xs text-gray-400 tabular-nums mt-0.5">{cu.totalCredits} charged</p>
          )}
        </div>
      </div>

      {/* ── Quality Trend ────────────────────────────────────────── */}
      {qt.totalReviews > 0 && (
        <>
          <div className="border-t border-gray-700/40" />
          <div className="p-4 px-6 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Quality Trend</span>
                <span className={`text-sm font-semibold ${qt.approvalRate !== null && qt.approvalRate >= 80 ? 'text-emerald-400' : qt.approvalRate !== null && qt.approvalRate >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {qt.approvalRate !== null ? `${qt.approvalRate}%` : '—'} approved
                </span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-800 gap-px">
                {qt.approvalRate !== null && (
                  <>
                    <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${qt.approvalRate}%` }} />
                    {qt.rejectedReviews > 0 && (
                      <div className="bg-rose-500/70 transition-all duration-500" style={{ width: `${Math.round((qt.rejectedReviews / qt.totalReviews) * 100)}%` }} />
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{qt.totalReviews} reviews</p>
            </div>
          </div>
        </>
      )}

      {/* ── Mission & Style ──────────────────────────────────────── */}
      <div className="border-t border-gray-700/40" />
      <div className="p-4 px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mission Statement */}
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Mission</h3>
          {persona.missionStatement ? (
            <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">{persona.missionStatement}</p>
          ) : (
            <p className="text-sm text-gray-600 italic">No mission statement defined</p>
          )}
        </div>

        {/* Operating Style */}
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">
            Operating Style
          </h3>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{persona.operatingStyle.icon}</span>
            <span className="text-sm font-semibold text-white">{persona.operatingStyle.label}</span>
          </div>
          <p className="text-xs text-gray-400">{persona.operatingStyle.description}</p>
        </div>
      </div>

      {/* ── Summon Phrases ───────────────────────────────────────── */}
      {st.length > 0 && (
        <>
          <div className="border-t border-gray-700/40" />
          <div className="p-4 px-6">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Summon Phrases</h3>
            <div className="flex flex-wrap gap-2">
              {st.map((phrase, i) => (
                <code
                  key={i}
                  className="text-xs bg-gray-800/80 text-gray-300 px-2.5 py-1 rounded-md border border-gray-700/50 font-mono"
                >
                  {phrase}
                </code>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Model & Skills ───────────────────────────────────────── */}
      {(mp.primary || mp.fallback || sk.length > 0) && (
        <>
          <div className="border-t border-gray-700/40" />
          <div className="p-4 px-6">
            <div className="flex flex-wrap gap-4">
              {/* Model preferences */}
              {(mp.primary || mp.fallback) && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1.5">Model</h3>
                  <div className="flex flex-col gap-0.5">
                    {mp.primary && (
                      <span className="text-xs text-gray-300 font-mono">
                        Primary: <span className="text-cyan-300">{mp.primary}</span>
                      </span>
                    )}
                    {mp.fallback && (
                      <span className="text-xs text-gray-400 font-mono">
                        Fallback: <span className="text-gray-300">{mp.fallback}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Skills */}
              {sk.length > 0 && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1.5">
                    Skills ({sk.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {sk.slice(0, 8).map((skill, i) => (
                      <span
                        key={i}
                        className="text-xs bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-md border border-violet-500/20"
                      >
                        {skill}
                      </span>
                    ))}
                    {sk.length > 8 && (
                      <span className="text-xs text-gray-500">+{sk.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Trust Details (expandable indicators) ───────────────── */}
      {(ts.lastAnomalyAt || ts.rateLimitHits > 0 || ts.secretExposures > 0) && (
        <>
          <div className="border-t border-gray-700/40" />
          <div className="p-3 px-6 flex gap-4 text-xs">
            {ts.rateLimitHits > 0 && (
              <span className="text-amber-400/70">{ts.rateLimitHits} rate limit hits</span>
            )}
            {ts.secretExposures > 0 && (
              <span className="text-rose-400/70">{ts.secretExposures} secret exposure{ts.secretExposures > 1 ? 's' : ''}</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Inline Variant (compact, for embedding in grids) ───────────────────

export function AgentPersonaBadge({ agentId }: { agentId: number | string }) {
  const [persona, setPersona] = useState<PersonaData | null>(null)

  useEffect(() => {
    fetch(`/api/agents/${agentId}/persona`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.persona && setPersona(d.persona))
      .catch(() => {})
  }, [agentId])

  if (!persona) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gray-700 animate-pulse" />
        <div className="w-20 h-3 bg-gray-700/60 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      <AgentAvatar name={persona.name} size="sm" />
      <div className="min-w-0">
        <span className="text-sm font-medium text-white">{persona.name}</span>
        {persona.operatingStyle && (
          <span className="text-xs text-gray-500 ml-1">{persona.operatingStyle.icon} {persona.operatingStyle.label}</span>
        )}
      </div>
      <span className={`inline-flex items-center gap-1 text-xs ${trustColor(persona.trustScore.score)}`}>
        ◆ {persona.trustScore.score.toFixed(2)}
      </span>
    </div>
  )
}
