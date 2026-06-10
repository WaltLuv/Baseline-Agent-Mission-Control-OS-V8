'use client'

/**
 * Paired Devices — Mission Control's view of Flight Deck desktop connectors.
 * Live, workspace-scoped data from /api/devices. Owners/admins can revoke.
 */
import { useCallback, useEffect, useState } from 'react'

interface Device {
  id: number
  device_id: string
  device_name: string | null
  platform: string | null
  app_version: string | null
  status: 'pending' | 'paired' | 'revoked' | 'expired'
  role: string
  permissions: string[]
  online: boolean
  last_seen_at: number | null
}
interface Summary {
  total: number
  paired: number
  online: number
  revoked: number
  latest_heartbeat: number | null
}

function ago(ts: number | null): string {
  if (!ts) return 'never'
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function PairedDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/devices', { cache: 'no-store' })
      const j = await r.json()
      setDevices(j.devices ?? [])
      setSummary(j.summary ?? null)
      setCanManage(!!j.can_manage)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const revoke = async (id: number) => {
    await fetch(`/api/devices/${id}/revoke`, { method: 'POST' })
    void load()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid="paired-devices">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Paired Devices</h2>
          <p className="text-[11px] text-muted-foreground">
            Flight Deck desktop connectors paired to this workspace.
          </p>
        </div>
        {summary && (
          <div className="flex gap-3 text-[11px]" data-testid="device-summary">
            <span className="text-emerald-400">{summary.online} online</span>
            <span className="text-muted-foreground">{summary.paired} paired</span>
            <span className="text-red-400">{summary.revoked} revoked</span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-[12px] text-muted-foreground/60">Loading devices…</p>
      ) : devices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground" data-testid="devices-empty">
          No devices paired yet. Install Flight Deck on a Mac, open it, and choose{' '}
          <b>Pair this device</b> — approve it here when the pairing code appears.
        </div>
      ) : (
        <div className="space-y-2" data-testid="devices-list">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-2.5" data-testid={`device-${d.id}`}>
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    d.status === 'revoked' ? 'bg-red-500' : d.online ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                  }`}
                />
                <div>
                  <div className="text-[13px] font-medium">{d.device_name || d.device_id.slice(0, 8)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {d.platform || 'unknown'} · {d.app_version || '—'} · role <b>{d.role}</b> ·{' '}
                    {d.status === 'revoked' ? 'revoked' : d.online ? 'online' : `last seen ${ago(d.last_seen_at)}`}
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted-foreground/70">{d.permissions.join(' · ') || 'no permissions'}</div>
                </div>
              </div>
              {canManage && d.status !== 'revoked' && (
                <button
                  onClick={() => revoke(d.id)}
                  data-testid={`revoke-${d.id}`}
                  className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-500/20"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <details className="mt-3 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer">How to pair a new device</summary>
        <ol className="ml-4 mt-1 list-decimal space-y-0.5">
          <li>Install Flight Deck on the Mac and open it.</li>
          <li>Click <b>Pair this device</b> — a pairing code appears.</li>
          <li>Here in Mission Control, approve the code (owner/admin only) and assign a role.</li>
          <li>The device begins heartbeating and shows as <span className="text-emerald-400">online</span>.</li>
        </ol>
      </details>
    </div>
  )
}
