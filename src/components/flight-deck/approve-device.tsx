'use client'

/**
 * Approve Device — the Mission Control approval screen for Flight Deck pairing.
 *
 * A user opens Flight Deck, clicks "Pair this device", and a pairing code
 * appears (Flight Deck also opens MC at /app/flight-deck?pair=CODE). Here an
 * owner/admin enters/confirms that code, picks a role + permissions, and
 * approves — moving the pending device into this workspace. Owner/admin only.
 */
import { useEffect, useState } from 'react'

const ROLES = [
  { id: 'owner', label: 'Owner — full control', },
  { id: 'admin', label: 'Admin — manage devices' },
  { id: 'operator', label: 'Operator — run local tasks' },
  { id: 'limited', label: 'Limited — read-only health' },
]

export function ApproveDevice({ onApproved }: { onApproved?: () => void }) {
  const [code, setCode] = useState('')
  const [role, setRole] = useState('operator')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Prefill from the ?pair=CODE link that Flight Deck opens.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('pair')
    if (p) setCode(p)
  }, [])

  const approve = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/devices/pairing/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairing_code: code.trim(), role }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ ok: false, msg: j.error === 'forbidden' ? 'Owner/admin role required.' : j.error || `HTTP ${res.status}` })
      } else {
        setResult({ ok: true, msg: `Approved “${j.device?.device_name || j.device?.device_id?.slice(0, 8)}” as ${j.device?.role}.` })
        setCode('')
        onApproved?.()
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'approve failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.05] p-4" data-testid="approve-device">
      <h3 className="text-sm font-semibold">Pair a new device</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Enter the pairing code shown in Flight Deck and choose what this device may do.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          data-testid="approve-device-code"
          className="w-full sm:w-40 rounded-md border border-white/[0.12] bg-black/40 px-3 py-2 font-mono text-sm uppercase tracking-widest"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          data-testid="approve-device-role"
          className="rounded-md border border-white/[0.12] bg-black/40 px-3 py-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <button
          onClick={approve}
          disabled={busy || !code.trim()}
          data-testid="approve-device-submit"
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#09090b] hover:bg-white/90 disabled:opacity-40"
        >
          {busy ? 'Approving…' : 'Approve device'}
        </button>
      </div>
      {result && (
        <div
          data-testid="approve-device-result"
          className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${
            result.ok
              ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200'
              : 'border-red-500/30 bg-red-500/[0.06] text-red-200'
          }`}
        >
          {result.msg}
        </div>
      )}
    </div>
  )
}
