'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useMissionControl, type ExecApprovalRequest } from '@/store'
import { useWebSocket } from '@/lib/websocket'
import { matchesGlobPattern } from '@/lib/exec-approval-utils'

type FilterTab = 'all' | 'pending' | 'resolved'
type PanelView = 'approvals' | 'allowlist'

const RISK_BORDER: Record<ExecApprovalRequest['risk'], string> = {
  low: 'border-l-green-500',
  medium: 'border-l-yellow-500',
  high: 'border-l-orange-500',
  critical: 'border-l-red-500',
}

const RISK_BADGE: Record<ExecApprovalRequest['risk'], { bg: string; text: string }> = {
  low: { bg: 'bg-green-500/20', text: 'text-green-400' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400' },
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ExecApprovalPanel() {
  const t = useTranslations('execApproval')
  const { execApprovals, updateExecApproval } = useMissionControl()
  const { sendMessage } = useWebSocket()
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [view, setView] = useState<PanelView>('approvals')

  const pendingCount = execApprovals.filter(a => a.status === 'pending').length

  // Mark expired approvals client-side
  const now = Date.now()
  const displayApprovals = useMemo(() => {
    const withExpiry = execApprovals.map(a => {
      if (a.status === 'pending' && a.expiresAt && a.expiresAt < now) {
        return { ...a, status: 'expired' as const }
      }
      return a
    })

    return withExpiry.filter(a => {
      if (filter === 'pending') return a.status === 'pending'
      if (filter === 'resolved') return a.status !== 'pending'
      return true
    })
  }, [execApprovals, filter, now])

  const handleAction = (id: string, decision: 'allow-once' | 'allow-always' | 'deny') => {
    const sent = sendMessage({
      type: 'req',
      method: 'exec.approval.resolve',
      id: `ea-${Date.now()}`,
      params: { id, decision },
    })

    if (!sent) {
      const action = decision === 'deny' ? 'deny' : decision === 'allow-always' ? 'always_allow' : 'approve'
      fetch('/api/exec-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      }).catch(() => {})
    }

    const newStatus = decision === 'deny' ? 'denied' : 'approved'
    updateExecApproval(id, { status: newStatus as ExecApprovalRequest['status'] })
  }

  return (
    <div className="m-4">
      {/* Story header — AI actions waiting on the operator */}
      <div data-testid="panel-story-exec-approval" className="mb-4 rounded-lg border border-border/60 bg-card/20 p-3">
        <h2 className="text-base font-semibold text-foreground">Approvals Inbox</h2>
        <p className="mt-0.5 text-xs text-muted-foreground max-w-2xl">
          Story: AI actions waiting on you before they go live — review the risk, the command, and the reasoning, then Allow Once / Always Allow / Deny. Use this to keep accountability on the high-stakes work.
        </p>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400 animate-pulse">
              {t('pendingBadge', { count: pendingCount })}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {t('realtimeLabel')}
        </span>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setView('approvals')}
          className={`px-3 py-1.5 text-sm transition-colors ${
            view === 'approvals'
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('viewApprovals')}
        </button>
        <button
          onClick={() => setView('allowlist')}
          className={`px-3 py-1.5 text-sm transition-colors ${
            view === 'allowlist'
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('viewAllowlist')}
        </button>
      </div>

      {view === 'approvals' ? (
        <>
          {/* Phase 4 Approval Engine supervision: surface tool_executions
              awaiting human approval here. This is the directive's mandated
              "Approval Queue" surface. Decisions are stored on the
              tool_executions row; Mission Control displays — Claude Code's
              Baseline OS owns decisioning. */}
          <ToolExecutionApprovalsSection />

          {/* Filter tabs */}
          <div className="flex gap-1 mb-4">
            {(['all', 'pending', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 text-xs rounded capitalize transition-colors ${
                  filter === tab
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`filter${tab.charAt(0).toUpperCase() + tab.slice(1)}` as 'filterAll' | 'filterPending' | 'filterResolved')}
              </button>
            ))}
          </div>

          {/* Approval list */}
          {displayApprovals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {filter === 'pending'
                ? t('noPendingApprovals')
                : t('noApprovals')}
            </div>
          ) : (
            <div className="space-y-3">
              {displayApprovals.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <AllowlistEditor execApprovals={execApprovals} />
      )}
    </div>
  )
}

type AllowlistState = Record<string, { pattern: string }[]>

function AllowlistEditor({ execApprovals }: { execApprovals: ExecApprovalRequest[] }) {
  const t = useTranslations('execApproval')
  const [agents, setAgents] = useState<AllowlistState>({})
  const [hash, setHash] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [newAgentId, setNewAgentId] = useState('')

  const loadAllowlist = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exec-approvals?action=allowlist')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setAgents(data.agents ?? {})
      setHash(data.hash ?? '')
      setDirty(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load allowlist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAllowlist() }, [loadAllowlist])

  const saveAllowlist = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/exec-approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents, hash }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setHash(data.hash ?? '')
      setDirty(false)
    } catch (err: any) {
      setError(err.message || 'Failed to save allowlist')
    } finally {
      setSaving(false)
    }
  }

  const addAgent = () => {
    const id = newAgentId.trim()
    if (!id || agents[id]) return
    setAgents(prev => ({ ...prev, [id]: [] }))
    setNewAgentId('')
    setDirty(true)
  }

  const addPattern = (agentId: string) => {
    setAgents(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), { pattern: '' }],
    }))
    setDirty(true)
  }

  const updatePattern = (agentId: string, index: number, value: string) => {
    setAgents(prev => ({
      ...prev,
      [agentId]: prev[agentId].map((p, i) => i === index ? { pattern: value } : p),
    }))
    setDirty(true)
  }

  const removePattern = (agentId: string, index: number) => {
    setAgents(prev => ({
      ...prev,
      [agentId]: prev[agentId].filter((_, i) => i !== index),
    }))
    setDirty(true)
  }

  const removeAgent = (agentId: string) => {
    setAgents(prev => {
      const next = { ...prev }
      delete next[agentId]
      return next
    })
    setDirty(true)
  }

  const recentCommands = useMemo(() => {
    return execApprovals
      .filter(a => a.command)
      .slice(0, 50)
      .map(a => ({ command: a.command!, agentName: a.agentName || a.sessionId }))
  }, [execApprovals])

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">{t('loadingAllowlist')}</div>
  }

  const agentIds = Object.keys(agents)

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newAgentId}
          onChange={(e) => setNewAgentId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAgent()}
          placeholder="Agent ID (e.g. claude, assistant)"
          className="flex-1 bg-secondary border border-border rounded px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <Button size="sm" variant="outline" onClick={addAgent} disabled={!newAgentId.trim()}>
          {t('addAgent')}
        </Button>
        <Button size="sm" onClick={saveAllowlist} disabled={!dirty || saving}>
          {saving ? t('saving') : t('save')}
        </Button>
        <Button size="sm" variant="outline" onClick={loadAllowlist} disabled={loading}>
          {t('reload')}
        </Button>
      </div>

      {agentIds.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {t('noAgentsConfigured')}
        </div>
      ) : (
        agentIds.map(agentId => (
          <AgentAllowlistCard
            key={agentId}
            agentId={agentId}
            patterns={agents[agentId]}
            recentCommands={recentCommands}
            onAddPattern={() => addPattern(agentId)}
            onUpdatePattern={(i, v) => updatePattern(agentId, i, v)}
            onRemovePattern={(i) => removePattern(agentId, i)}
            onRemoveAgent={() => removeAgent(agentId)}
          />
        ))
      )}
    </div>
  )
}

function AgentAllowlistCard({
  agentId,
  patterns,
  recentCommands,
  onAddPattern,
  onUpdatePattern,
  onRemovePattern,
  onRemoveAgent,
}: {
  agentId: string
  patterns: { pattern: string }[]
  recentCommands: { command: string; agentName: string }[]
  onAddPattern: () => void
  onUpdatePattern: (index: number, value: string) => void
  onRemovePattern: (index: number) => void
  onRemoveAgent: () => void
}) {
  const t = useTranslations('execApproval')
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const previewMatches = useMemo(() => {
    if (previewIndex === null) return []
    const pat = patterns[previewIndex]?.pattern
    if (!pat) return []
    return recentCommands.filter(c => matchesGlobPattern(pat, c.command))
  }, [previewIndex, patterns, recentCommands])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">{agentId}</span>
          <span className="text-xs text-muted-foreground">
            {patterns.length} pattern{patterns.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAddPattern}>
            {t('addPattern')}
          </Button>
          <button
            onClick={onRemoveAgent}
            className="text-xs text-muted-foreground hover:text-red-400 transition-colors px-1"
            title="Remove agent"
          >
            x
          </button>
        </div>
      </div>

      {patterns.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          {t('noAllowlistPatterns')}
        </div>
      ) : (
        <div className="space-y-2">
          {patterns.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={entry.pattern}
                onChange={(e) => onUpdatePattern(index, e.target.value)}
                onFocus={() => setPreviewIndex(index)}
                onBlur={() => setPreviewIndex(null)}
                placeholder="e.g. git *, npm install *, ls"
                className="flex-1 font-mono bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                onClick={() => onRemovePattern(index)}
                className="text-xs text-muted-foreground hover:text-red-400 transition-colors px-1.5"
                title="Remove pattern"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pattern preview */}
      {previewIndex !== null && patterns[previewIndex]?.pattern && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="text-xs text-muted-foreground mb-1">
            {t('previewMatches', { count: previewMatches.length })}
          </div>
          {previewMatches.length > 0 && (
            <div className="space-y-1 max-h-24 overflow-auto">
              {previewMatches.slice(0, 5).map((m, i) => (
                <div key={i} className="text-xs font-mono text-green-400 truncate">
                  $ {m.command}
                </div>
              ))}
              {previewMatches.length > 5 && (
                <div className="text-xs text-muted-foreground">
                  {t('andMore', { count: previewMatches.length - 5 })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ApprovalCard({
  approval,
  onAction,
}: {
  approval: ExecApprovalRequest
  onAction: (id: string, decision: 'allow-once' | 'allow-always' | 'deny') => void
}) {
  const t = useTranslations('execApproval')
  const riskBorder = RISK_BORDER[approval.risk]
  const riskBadge = RISK_BADGE[approval.risk]
  const isPending = approval.status === 'pending'
  const isExpired = approval.status === 'expired'

  return (
    <div className={`rounded-lg border border-border bg-card p-4 border-l-4 ${riskBorder}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">
            {approval.agentName || approval.sessionId}
          </span>
          <span className="font-mono text-xs bg-secondary rounded px-1.5 py-0.5 text-muted-foreground">
            {approval.toolName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${riskBadge.bg} ${riskBadge.text}`}>
            {approval.risk}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(approval.createdAt)}
          </span>
        </div>
      </div>

      {/* Command block */}
      {approval.command && (
        <pre className="bg-secondary rounded p-2 text-xs font-mono overflow-auto max-h-20 text-foreground mb-2 border border-border">
          <code>$ {approval.command}</code>
        </pre>
      )}

      {/* Tool args */}
      {!approval.command && approval.toolArgs && Object.keys(approval.toolArgs).length > 0 && (
        <pre className="bg-secondary rounded p-2 text-xs font-mono overflow-auto max-h-32 text-foreground mb-2">
          {JSON.stringify(approval.toolArgs, null, 2)}
        </pre>
      )}

      {/* Metadata */}
      {(approval.cwd || approval.host || approval.resolvedPath) && (
        <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
          {approval.host && <div>Host: <span className="font-mono text-foreground">{approval.host}</span></div>}
          {approval.cwd && <div>CWD: <span className="font-mono text-foreground">{approval.cwd}</span></div>}
          {approval.resolvedPath && <div>Resolved: <span className="font-mono text-foreground">{approval.resolvedPath}</span></div>}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 mt-3">
        {isPending ? (
          <>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onAction(approval.id, 'allow-once')}
            >
              {t('allowOnce')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction(approval.id, 'allow-always')}
            >
              {t('alwaysAllow')}
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => onAction(approval.id, 'deny')}
            >
              {t('deny')}
            </Button>
          </>
        ) : isExpired ? (
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t('statusExpired')}
          </span>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              approval.status === 'approved'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {approval.status === 'approved' ? t('statusApproved') : t('statusDenied')}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Phase 4 — Approval Queue supervision for tool executions.
 *
 * Reads `/api/tool-executions?status=pending_approval` and renders a
 * compact row per pending CLI execution. Mission Control SUPERVISES;
 * Claude Code's Baseline OS Approval Engine owns the actual decisioning
 * once it ships. The Approve / Reject buttons here simply POST to the
 * existing approve/reject endpoints, which atomically transition the
 * row + audit + activity feed. When Baseline OS publishes its own
 * approval decision through the API, the row updates automatically via
 * the 12-second poll.
 */
function ToolExecutionApprovalsSection() {
  const [items, setItems] = useState<Array<{
    id: number
    cli_tool_id: string
    command_name: string
    command_args_redacted: string | null
    risk: 'low' | 'medium' | 'high' | 'blocked'
    approval_requested_by: string | null
    approval_requested_at: number | null
    requested_by: string
    task_id: number | null
    cost_estimate: number | null
    created_at: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tool-executions?status=pending_approval', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { items: typeof items }
      setItems(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 12_000)
    const tick = setInterval(() => setTick((x) => x + 1), 30_000)
    return () => {
      clearInterval(t)
      clearInterval(tick)
    }
  }, [load])

  async function act(id: number, kind: 'approve' | 'reject') {
    setBusy((p) => new Set(p).add(id))
    try {
      let body: string = '{}'
      if (kind === 'reject') {
        const reason = window.prompt('Reason for rejection (optional):') || ''
        if (reason) body = JSON.stringify({ reason })
      }
      const res = await fetch(`/api/tool-executions/${id}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : `${kind} failed`)
    } finally {
      setBusy((p) => {
        const next = new Set(p)
        next.delete(id)
        return next
      })
    }
  }

  // Hide the section entirely when there's nothing pending — keeps the
  // existing operator workflow uncluttered.
  if (loading) return null
  if (items.length === 0) return null

  void tick // re-render for relative-time refresh

  const riskTone: Record<string, string> = {
    high: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
    medium: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    low: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
    blocked: 'bg-red-700/30 text-red-200 border-red-500/40',
  }

  return (
    <div
      data-testid="tool-execution-approvals-section"
      className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Connected Tools — pending approval
          <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-300">
            {items.length}
          </span>
        </h3>
        <a
          href="/app/tool-executions"
          className="text-[11px] text-violet-300/85 hover:text-violet-200"
          data-testid="approval-queue-open-supervisor"
        >
          Open supervisor →
        </a>
      </div>
      {error && (
        <div className="mb-2 text-[11px] text-rose-300/85">{error}</div>
      )}
      <ul className="space-y-1.5">
        {items.map((e) => (
          <li
            key={e.id}
            data-testid={`approval-row-${e.id}`}
            className="rounded-md bg-background/60 border border-border/50 px-2.5 py-1.5 flex items-center gap-2 text-xs"
          >
            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono ${riskTone[e.risk] || riskTone.medium}`}>
              {e.risk}
            </span>
            <span className="font-mono text-foreground/85 truncate flex-1">
              {e.cli_tool_id} · {e.command_name}
            </span>
            {e.task_id && (
              <a
                href={`/app/tasks/${e.task_id}`}
                className="text-[11px] text-violet-300/80 hover:text-violet-200 font-mono"
                onClick={(ev) => ev.stopPropagation()}
              >
                task #{e.task_id}
              </a>
            )}
            <span className="text-[11px] text-muted-foreground/75 font-mono whitespace-nowrap">
              {e.approval_requested_by ?? e.requested_by} · {timeAgo((e.approval_requested_at ?? e.created_at) * 1000)}
            </span>
            <button
              type="button"
              data-testid={`approval-row-${e.id}-approve`}
              disabled={busy.has(e.id)}
              onClick={() => act(e.id, 'approve')}
              className="h-7 px-2.5 rounded-md bg-emerald-500/20 text-emerald-100 text-[11px] font-semibold border border-emerald-400/30 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              data-testid={`approval-row-${e.id}-reject`}
              disabled={busy.has(e.id)}
              onClick={() => act(e.id, 'reject')}
              className="h-7 px-2.5 rounded-md bg-rose-500/15 text-rose-100 text-[11px] font-semibold border border-rose-400/30 hover:bg-rose-500/25 disabled:opacity-50"
            >
              Reject
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

