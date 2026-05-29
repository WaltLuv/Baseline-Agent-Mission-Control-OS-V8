'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * RuntimeValidationPanel — live status of every runtime Mission Control
 * is configured to supervise (Hermes, OpenClaw/OpenCode, Claude Code,
 * Codex).
 *
 * Pulls from `/api/agent-runtimes`. Surfaces, per runtime:
 *   - Installed? Version detected?
 *   - Running? Authenticated?
 *   - Last heartbeat (from /api/agents — latest agent matching framework)
 *   - Current task (latest in_progress)
 *   - Status pill (green / amber / red)
 *
 * This panel is read-only. Installation, restart, and config remain in
 * the existing Agent Runtimes admin surface — the validation panel
 * exists for launch readiness ("will my workforce show up?").
 */

interface RuntimeStatus {
  id: 'openclaw' | 'hermes' | 'claude' | 'codex' | 'opencode'
  name: string
  description: string
  installed: boolean
  version: string | null
  running: boolean
  authRequired: boolean
  authenticated: boolean
}

interface AgentRow {
  id: number
  name: string
  framework?: string | null
  status?: string | null
  last_seen?: string | number | null
}

interface RuntimeAggregate extends RuntimeStatus {
  liveAgents: number
  lastHeartbeat: number | null
  band: 'healthy' | 'attention' | 'critical' | 'absent'
  bandReason: string
}

function bandFromRuntime(r: RuntimeStatus, agents: AgentRow[]): RuntimeAggregate {
  const matching = agents.filter((a) => (a.framework || '').toLowerCase() === r.id)
  const lastSeenTs = matching
    .map((a) => (typeof a.last_seen === 'number' ? a.last_seen : a.last_seen ? Date.parse(String(a.last_seen)) : 0))
    .reduce((acc, v) => (v > acc ? v : acc), 0)

  let band: RuntimeAggregate['band'] = 'absent'
  let bandReason = 'Runtime not installed yet'
  if (r.installed) {
    if (!r.running) {
      band = 'attention'
      bandReason = 'Installed but not currently running'
    } else if (r.authRequired && !r.authenticated) {
      band = 'attention'
      bandReason = 'Running but credentials missing'
    } else if (matching.length === 0) {
      band = 'attention'
      bandReason = 'Running with no registered agents yet'
    } else {
      const ageMin = lastSeenTs ? Math.round((Date.now() - lastSeenTs) / 60_000) : Number.POSITIVE_INFINITY
      if (ageMin > 30) {
        band = 'critical'
        bandReason = `Last agent heartbeat ${ageMin} min ago`
      } else {
        band = 'healthy'
        bandReason = `${matching.length} agent${matching.length === 1 ? '' : 's'} active`
      }
    }
  }
  return { ...r, liveAgents: matching.length, lastHeartbeat: lastSeenTs || null, band, bandReason }
}

function StatusDot({ band }: { band: RuntimeAggregate['band'] }) {
  const map: Record<RuntimeAggregate['band'], string> = {
    healthy: 'bg-emerald-500',
    attention: 'bg-amber-500',
    critical: 'bg-rose-500',
    absent: 'bg-muted-foreground/40',
  }
  return <span className={`inline-block h-2 w-2 rounded-full ${map[band]}`} aria-hidden />
}

function formatLastSeen(ts: number | null): string {
  if (!ts) return '—'
  const ageSec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (ageSec < 60) return `${ageSec}s ago`
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`
  if (ageSec < 86_400) return `${Math.floor(ageSec / 3600)}h ago`
  return `${Math.floor(ageSec / 86_400)}d ago`
}

export function RuntimeValidationPanel() {
  const [runtimes, setRuntimes] = useState<RuntimeAggregate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const [rRes, aRes] = await Promise.all([
          fetch('/api/agent-runtimes'),
          fetch('/api/agents'),
        ])
        const rJson = rRes.ok ? await rRes.json() : { runtimes: [] }
        const aJson = aRes.ok ? await aRes.json() : { agents: [] }
        if (cancelled) return
        const list = (rJson.runtimes || []) as RuntimeStatus[]
        const agents = (aJson.agents || []) as AgentRow[]
        setRuntimes(list.map((r) => bandFromRuntime(r, agents)))
      } catch {
        if (!cancelled) setError('Could not load runtime status.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshTick])

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4" data-testid="runtime-validation-panel">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Production Readiness</div>
          <h1 className="text-2xl font-semibold">Runtime Validation</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Every runtime Mission Control is configured to supervise — Hermes, OpenClaw / OpenCode,
            Claude Code, Codex. Healthy bands mean the runtime is installed, running,
            authenticated, and producing live heartbeats.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          data-testid="runtime-validation-refresh"
          onClick={() => setRefreshTick((t) => t + 1)}
        >
          Refresh
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" data-testid="runtime-validation-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-muted-foreground" data-testid="runtime-validation-loading">
          Probing runtimes…
        </div>
      )}

      {!loading && runtimes.length === 0 && !error && (
        <div className="rounded-md border border-border bg-card/40 p-6 text-sm text-muted-foreground" data-testid="runtime-validation-empty">
          No runtimes detected on this host. Install one from the Agent Runtimes admin panel.
        </div>
      )}

      {!loading && runtimes.length > 0 && (
        <div className="grid gap-3" data-testid="runtime-validation-list">
          {runtimes.map((r) => (
            <article
              key={r.id}
              className="rounded-lg border border-border bg-card/40 p-4"
              data-testid={`runtime-row-${r.id}`}
              data-band={r.band}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot band={r.band} />
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {r.id}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">{r.description}</div>
                  <div className="text-xs text-foreground/80" data-testid={`runtime-band-reason-${r.id}`}>
                    {r.bandReason}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>
                    <dt className="uppercase tracking-wider">Installed</dt>
                    <dd className="text-foreground" data-testid={`runtime-installed-${r.id}`}>{r.installed ? 'yes' : 'no'}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wider">Running</dt>
                    <dd className="text-foreground" data-testid={`runtime-running-${r.id}`}>{r.running ? 'yes' : 'no'}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wider">Agents</dt>
                    <dd className="text-foreground" data-testid={`runtime-agents-${r.id}`}>{r.liveAgents}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wider">Heartbeat</dt>
                    <dd className="text-foreground" data-testid={`runtime-heartbeat-${r.id}`}>{formatLastSeen(r.lastHeartbeat)}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      )}

      <footer className="pt-2 text-xs text-muted-foreground">
        Validate end-to-end:{' '}
        <code className="rounded bg-muted px-1 py-0.5">./scripts/runtime-validate.sh --runtime &lt;id&gt; --base-url &lt;host&gt; …</code>
      </footer>
    </div>
  )
}

export default RuntimeValidationPanel
