'use client'

/**
 * Settings → Paths & Config. Read-only view of the env-driven configurable
 * paths and integration config presence. No path is hardcoded; each row shows
 * the env var that overrides it. Secrets are never displayed.
 */
import { useEffect, useState } from 'react'

interface PathRow { key: string; label: string; value: string; env: string }
interface IntegrationRow { key: string; label: string; configured: boolean; env: string }

export function PathsConfigSection() {
  const [paths, setPaths] = useState<PathRow[]>([])
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/config/paths', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setPaths(d.paths ?? []); setIntegrations(d.integrations ?? []) } })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded) return null

  return (
    <div className="space-y-3" data-testid="paths-config-section">
      <div>
        <h3 className="text-sm font-semibold">Paths &amp; Config</h3>
        <p className="text-xs text-muted-foreground">Every path is configurable via the listed env var — nothing is hardcoded to a machine.</p>
      </div>
      <div className="space-y-1.5">
        {paths.map((p) => (
          <div key={p.key} className="flex flex-col gap-0.5 rounded-md border border-border/40 p-2 text-xs" data-testid={`path-${p.key}`}>
            <div className="flex items-center justify-between"><span className="font-medium">{p.label}</span><code className="text-[10px] text-muted-foreground">{p.env}</code></div>
            <code className="text-[11px] text-muted-foreground break-all">{p.value}</code>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {integrations.map((i) => (
          <div key={i.key} className="flex items-center justify-between rounded-md border border-border/40 p-2 text-xs" data-testid={`integration-${i.key}`}>
            <span className="font-medium">{i.label}</span>
            <span className={i.configured ? 'text-emerald-400' : 'text-muted-foreground'}>{i.configured ? 'configured' : 'not configured'} · <code className="text-[10px]">{i.env}</code></span>
          </div>
        ))}
      </div>
    </div>
  )
}
