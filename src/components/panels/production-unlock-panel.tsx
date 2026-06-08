'use client'

/**
 * Production Unlock Center — shows every external system required to unlock
 * full production functionality, with live status merged from
 * /api/credentials/catalog. No fake-ready states: an item with no saved
 * credential renders as "Missing"; the readiness meter only counts truly
 * connected items.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { UNLOCK_ITEMS, unlockItemsByImpact, type ProductionImpact, type UnlockItem } from '@/lib/production-unlock'

type SavedStatus = 'connected' | 'pending' | 'error' | 'revoked'

interface ProviderSaved {
  status?: SavedStatus
  last_verified_at?: string | null
  last_error?: string | null
}

type ProviderState = Record<string, ProviderSaved | null>

type UnlockStatus = 'connected' | 'partial' | 'error' | 'missing' | 'unknown'

// Items where ANY backing provider connected is enough to unlock.
const ANY_OF = new Set(['realtime_voice', 'notebooklm'])

function aggregateStatus(item: UnlockItem, state: ProviderState | null): { status: UnlockStatus; lastVerified?: string | null; lastError?: string | null } {
  if (!state) return { status: 'unknown' }
  const saveds = item.providerIds.map((pid) => state[pid] || null)
  const known = saveds.filter(Boolean) as ProviderSaved[]
  if (known.some((s) => s.status === 'error')) {
    return { status: 'error', lastError: known.find((s) => s.status === 'error')?.last_error }
  }
  const connected = known.filter((s) => s.status === 'connected')
  const needed = ANY_OF.has(item.id) ? 1 : item.providerIds.length
  const lastVerified = connected.map((s) => s.last_verified_at).filter(Boolean).sort().slice(-1)[0] || null
  if (connected.length >= needed) return { status: 'connected', lastVerified }
  if (connected.length > 0 || known.some((s) => s.status === 'pending')) return { status: 'partial', lastVerified }
  return { status: 'missing' }
}

const STATUS_STYLE: Record<UnlockStatus, { label: string; cls: string }> = {
  connected: { label: 'Connected', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  partial: { label: 'Partial', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  error: { label: 'Error', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  missing: { label: 'Missing', cls: 'bg-muted text-muted-foreground border-border' },
  unknown: { label: 'Status unknown', cls: 'bg-muted text-muted-foreground border-border' },
}

const IMPACT_STYLE: Record<ProductionImpact, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  low: 'bg-muted text-muted-foreground border-border',
}

export function ProductionUnlockPanel() {
  const [state, setState] = useState<ProviderState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    fetch('/api/credentials/catalog')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        const next: ProviderState = {}
        for (const p of data.providers || []) next[p.id] = p.saved || null
        setState(next)
        setLoadError(null)
      })
      .catch((e) => {
        setState(null)
        setLoadError(e?.message || 'Could not load credential status. Sign in to view live status.')
      })
  }, [])

  useEffect(() => { load() }, [load])

  const items = useMemo(() => unlockItemsByImpact(), [])
  const statuses = useMemo(() => items.map((it) => ({ it, ...aggregateStatus(it, state) })), [items, state])
  const connectedCount = statuses.filter((s) => s.status === 'connected').length
  const readiness = Math.round((connectedCount / items.length) * 100)

  const runTest = useCallback(async (item: UnlockItem) => {
    setTesting(item.id)
    setTestResult((r) => ({ ...r, [item.id]: '' }))
    try {
      // Test the first backing provider that supports a probe.
      const providerId = item.providerIds[0]
      const res = await fetch(`/api/credentials/${providerId}/test`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setTestResult((r) => ({ ...r, [item.id]: res.ok ? (data.ok ? '✓ Connection OK' : (data.message || 'Probe ran')) : (data.error || `HTTP ${res.status}`) }))
      load()
    } catch (e) {
      setTestResult((r) => ({ ...r, [item.id]: (e as Error)?.message || 'Test failed' }))
    } finally {
      setTesting(null)
    }
  }, [load])

  return (
    <div className="p-4 space-y-4" data-testid="production-unlock">
      {/* Header + readiness meter */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h1 className="text-lg font-semibold text-foreground">Production Unlock Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every external system required to unlock full production functionality. Each card shows
          status, required env vars, where it&apos;s used, what it unlocks, setup steps, a test button,
          last-verified time, and production-readiness impact. No fake-ready states.
        </p>
        <div className="mt-3 flex items-center gap-3" data-testid="readiness-meter">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${readiness}%` }} />
          </div>
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {connectedCount}/{items.length} unlocked · {readiness}% production-ready
          </span>
        </div>
        {loadError && (
          <p className="mt-2 text-xs text-amber-400" data-testid="unlock-load-error">{loadError}</p>
        )}
      </div>

      {/* Unlock cards */}
      <div className="grid gap-3 lg:grid-cols-2">
        {statuses.map(({ it, status, lastVerified, lastError }) => {
          const ss = STATUS_STYLE[status]
          return (
            <div key={it.id} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3" data-testid={`unlock-card-${it.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{it.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{it.whereUsed}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ss.cls}`} data-testid={`unlock-status-${it.id}`}>{ss.label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${IMPACT_STYLE[it.impact]}`} title="Production impact">{it.impact} impact</span>
                </div>
              </div>

              {it.featuresUnlocked.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-1">Unlocks</p>
                  <ul className="text-xs text-foreground/90 list-disc list-inside space-y-0.5">
                    {it.featuresUnlocked.slice(0, 4).map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
              )}

              {it.requiredEnvVars.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-1">Required env vars</p>
                  <div className="flex flex-wrap gap-1">
                    {it.requiredEnvVars.map((v) => (
                      <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/80 font-mono">{v}</code>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">{it.setupInstructions}</p>

              <div className="text-[10px] text-muted-foreground/70">
                {lastVerified ? <>Last verified: {new Date(lastVerified).toLocaleString()}</> : <>Last verified: never</>}
                {lastError && <span className="text-red-400 ml-2">· {lastError}</span>}
                {testResult[it.id] && <span className="ml-2 text-foreground/80">· {testResult[it.id]}</span>}
              </div>

              <div className="flex items-center gap-2 mt-auto pt-1">
                <a
                  href="/app/credentials"
                  className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted text-foreground"
                  data-testid={`unlock-setup-${it.id}`}
                >
                  Set up in Credentials
                </a>
                {it.setupUrl && (
                  <a href={it.setupUrl} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted text-muted-foreground">
                    Provider site ↗
                  </a>
                )}
                {it.testConnectionSupported && (
                  <button
                    onClick={() => runTest(it)}
                    disabled={testing === it.id}
                    className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted text-foreground disabled:opacity-50"
                    data-testid={`unlock-test-${it.id}`}
                  >
                    {testing === it.id ? 'Testing…' : 'Test connection'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ProductionUnlockPanel
// Re-exported for discoverability in tests.
export { UNLOCK_ITEMS }
