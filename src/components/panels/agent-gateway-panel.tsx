'use client'

/**
 * AgentGatewayPanel — customer-facing UI for the FastMCP Agent Gateway.
 *
 * Backed by the proxy endpoints in `/api/agent-gateway/*`. Shows:
 *   - gateway health card (uptime, enabled agents, mc_connected, list of tools)
 *   - recent task list (status, agent, duration, cost)
 *   - log tail viewer for the selected task
 *
 * When the gateway is unreachable, renders an honest "Gateway unreachable"
 * card with the configured URL and a single-line operator action — no
 * empty-state ambiguity.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type HealthOk = {
  ok: true
  reachable: true
  gatewayUrl: string
  status: 'ok'
  name: string
  service: string
  uptime_seconds: number
  enabled_agents: string[]
  workspace_id: number
  data_dir: string
  mc_connected: boolean
}
type HealthUnreachable = {
  ok: false
  reachable: false
  error: string
  gatewayUrl: string
  hint?: string
}
type Health = HealthOk | HealthUnreachable

type Task = {
  id: string
  agent: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout' | string
  prompt?: string
  workdir?: string
  model?: string
  exit_code?: number | null
  started_at?: number
  finished_at?: number | null
  duration_ms?: number | null
  cost_usd?: number | null
}

const statusColor: Record<string, string> = {
  succeeded: 'border-green-500/30 bg-green-500/15 text-green-300',
  running: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
  queued: 'border-gray-500/30 bg-gray-500/15 text-gray-300',
  failed: 'border-red-500/30 bg-red-500/15 text-red-300',
  timeout: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
}

export function AgentGatewayPanel() {
  const [health, setHealth] = useState<Health | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [logsByTask, setLogsByTask] = useState<Record<string, { stdout: string; stderr: string; loading: boolean }>>({})

  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch('/api/agent-gateway/health', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok && !d?.reachable) {
        setHealth({ ok: false, reachable: false, error: d.error || `Gateway returned ${r.status}`, gatewayUrl: d.gatewayUrl || '?', hint: d.hint })
      } else {
        setHealth({ ok: true, reachable: true, ...d })
      }
    } catch (e) {
      setHealth({ ok: false, reachable: false, error: e instanceof Error ? e.message : 'unknown', gatewayUrl: '?' })
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true)
    try {
      const r = await fetch('/api/agent-gateway/tasks?limit=25', { cache: 'no-store' })
      if (r.status === 503) {
        // unreachable — health card already shows the reason
        setTasks([])
        return
      }
      if (r.status === 401 || r.status === 403) {
        setError('You need operator or admin role to see gateway tasks.')
        setTasks([])
        return
      }
      const d = await r.json()
      setTasks(Array.isArray(d.tasks) ? d.tasks : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks')
    } finally {
      setLoadingTasks(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    fetchTasks()
  }, [fetchHealth, fetchTasks])

  const refresh = () => {
    fetchHealth()
    fetchTasks()
  }

  const loadLogs = async (taskId: string) => {
    setLogsByTask((prev) => ({ ...prev, [taskId]: { stdout: '', stderr: '', loading: true } }))
    try {
      const [out, err] = await Promise.all([
        fetch(`/api/agent-gateway/logs/${taskId}?stream=stdout&tail_bytes=8192`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/agent-gateway/logs/${taskId}?stream=stderr&tail_bytes=8192`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      setLogsByTask((prev) => ({
        ...prev,
        [taskId]: {
          stdout: out?.content || '(no stdout)',
          stderr: err?.content || '(no stderr)',
          loading: false,
        },
      }))
    } catch {
      setLogsByTask((prev) => ({ ...prev, [taskId]: { stdout: '(failed to load)', stderr: '', loading: false } }))
    }
  }

  return (
    <div className="p-4 space-y-6" data-testid="agent-gateway-panel">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground" data-testid="agent-gateway-title">MCP Agent Gateway</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Shared tool bus for Claude / Codex / OpenCode / Hermes. Mission Control supervises; the gateway runs work.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} data-testid="agent-gateway-refresh-button">
          Refresh
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm" data-testid="agent-gateway-error">
          {error}
        </div>
      )}

      <section
        className={`rounded-lg border p-4 ${
          health?.reachable ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
        }`}
        data-testid="agent-gateway-health-card"
      >
        {!health && <div className="text-sm text-muted-foreground">Loading…</div>}
        {health && health.reachable && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-300" data-testid="gateway-status-ok">
                Gateway reachable
              </span>
              <span className="text-xs text-muted-foreground" data-testid="gateway-url">
                {health.gatewayUrl}
              </span>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Stat label="Name" value={health.name} testId="gateway-name" />
              <Stat label="Uptime" value={formatUptime(health.uptime_seconds)} testId="gateway-uptime" />
              <Stat label="MC link" value={health.mc_connected ? 'connected' : 'offline'} testId="gateway-mc-connected" />
              <Stat label="Agents enabled" value={String(health.enabled_agents?.length || 0)} testId="gateway-agent-count" />
            </dl>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-1 pt-2">
              {(health.enabled_agents || []).map((a) => (
                <span key={a} className="px-2 py-0.5 rounded-full border border-border bg-background" data-testid={`gateway-agent-pill-${a}`}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
        {health && !health.reachable && (
          <div className="space-y-2 text-sm">
            <div className="text-red-300 font-medium" data-testid="gateway-status-unreachable">Gateway unreachable</div>
            <div className="text-xs text-muted-foreground">
              <div>Target: <code className="font-mono">{health.gatewayUrl}</code></div>
              <div>Error: {health.error}</div>
              {health.hint && <div className="mt-1">{health.hint}</div>}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card" data-testid="agent-gateway-tasks-section">
        <header className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-between">
          <span>Recent tasks</span>
          <span className="font-mono text-[10px]">{tasks.length}</span>
        </header>
        {loadingTasks ? (
          <div className="p-4 text-sm text-muted-foreground">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground" data-testid="agent-gateway-no-tasks">
            No tasks yet. As Claude / Codex / OpenCode / Hermes route work through the gateway, it&apos;ll appear here with logs and cost.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((t) => {
              const isOpen = selectedTaskId === t.id
              const logs = logsByTask[t.id]
              return (
                <li key={t.id} data-testid={`gateway-task-row-${t.id}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex items-center justify-between px-4 py-2 text-sm cursor-pointer hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                    onClick={() => {
                      const next = isOpen ? null : t.id
                      setSelectedTaskId(next)
                      if (next && !logs) loadLogs(next)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        const next = isOpen ? null : t.id
                        setSelectedTaskId(next)
                        if (next && !logs) loadLogs(next)
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${statusColor[t.status] || 'border-border'}`} data-testid={`task-${t.id}-status`}>
                          {t.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{t.agent}</span>
                        <span className="text-xs font-mono text-muted-foreground">{t.id.slice(0, 16)}…</span>
                      </div>
                      {t.prompt && (
                        <div className="text-xs mt-1 truncate text-foreground/80" title={t.prompt}>
                          {t.prompt}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right ml-3">
                      {t.duration_ms ? `${(t.duration_ms / 1000).toFixed(1)}s` : ''}
                      {typeof t.cost_usd === 'number' ? ` · $${t.cost_usd.toFixed(3)}` : ''}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="bg-muted/30 px-4 py-3 text-xs font-mono space-y-3" data-testid={`task-${t.id}-logs`}>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">stdout</div>
                        <pre className="whitespace-pre-wrap break-words text-foreground/80 max-h-64 overflow-auto">
                          {logs?.loading ? '(loading…)' : logs?.stdout || '(no stdout)'}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">stderr</div>
                        <pre className="whitespace-pre-wrap break-words text-foreground/80 max-h-32 overflow-auto">
                          {logs?.loading ? '' : logs?.stderr || '(no stderr)'}
                        </pre>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground" data-testid={testId}>
        {value}
      </div>
    </div>
  )
}

function formatUptime(secs: number): string {
  if (!secs || secs < 0) return '—'
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
  return `${Math.floor(secs / 86400)}d`
}
