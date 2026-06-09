'use client'

/**
 * Comms Connect (F1) — first-class SMS/email connection for PM workflows.
 * Shows live-vs-setup-needed per channel with the exact missing credentials,
 * a Test Connection button, a dry-run-safe Send Test, message templates, and
 * the communication log. Never fakes a send.
 */
import { useCallback, useEffect, useState } from 'react'

interface ChannelStatus { channel: string; provider: string; live: boolean; missing: string[] }
interface LogRow { id: string; channel: string; to_addr: string; recipient_role: string; status: string; reason?: string; body: string; created_at: number }

export function CommsConnectPanel() {
  const [channels, setChannels] = useState<ChannelStatus[]>([])
  const [creds, setCreds] = useState<{ items: { key: string; label: string; present: boolean }[]; mode: string } | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [to, setTo] = useState('')
  const [body, setBody] = useState('Test message from your AI property team.')
  const [channel, setChannel] = useState('sms')
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const j = await (await fetch('/api/comms', { cache: 'no-store' })).json(); setChannels(j.channels ?? []); setLog(j.log ?? []) } catch { /* empty */ }
    try { const d = await (await fetch('/api/demo/seed', { cache: 'no-store' })).json(); setCreds(d.credentials ?? null) } catch { /* empty */ }
  }, [])
  useEffect(() => { void load() }, [load])

  const test = async (ch: string) => {
    const j = await (await fetch('/api/comms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', channel: ch }) })).json()
    setMsg(`${ch}: ${j.reason}`)
  }
  const send = async () => {
    if (!to || !body) return
    const j = await (await fetch('/api/comms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', channel, to, body, role: 'tenant' }) })).json()
    setMsg(j.result ? `${j.result.status}${j.result.reason ? ' — ' + j.result.reason : ''}` : (j.error ?? 'error'))
    await load()
  }

  return (
    <div className="m-4 space-y-4" data-testid="comms-connect-panel">
      <div>
        <h1 className="text-base font-semibold">Communications</h1>
        <p className="text-xs text-muted-foreground">Connect SMS + email for tenant / owner / vendor messaging. No message is faked — when a credential is missing, sends run as a logged dry-run.</p>
      </div>

      {creds && (
        <div className="rounded-xl border border-border bg-card p-3" data-testid="comms-credentials">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Live-demo credential checklist</span>
            <span className={`rounded px-2 py-0.5 text-[10px] uppercase ${creds.mode === 'live' ? 'bg-emerald-500/20 text-emerald-400' : creds.mode === 'partial' ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'}`} data-testid="comms-mode">{creds.mode}</span>
          </div>
          <ul className="space-y-0.5 text-[11px]">
            {creds.items.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <span className={c.present ? 'text-emerald-400' : 'text-amber-400'}>{c.present ? '✓ valid' : '• missing'}</span>
                <span className="text-foreground/75">{c.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-muted-foreground/70">No secret values are shown. {creds.mode === 'dry-run' ? 'All sends dry-run until credentials are added.' : creds.mode === 'partial' ? 'One channel live; the other dry-runs.' : 'Live send enabled on both channels.'}</p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2" data-testid="comms-channels">
        {channels.map((c) => (
          <div key={c.channel} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium uppercase">{c.channel} · {c.provider}</span>
              <span className={`rounded px-2 py-0.5 text-[10px] uppercase ${c.live ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`} data-testid={`comms-status-${c.channel}`}>
                {c.live ? 'live' : 'setup-needed'}
              </span>
            </div>
            {!c.live && <p className="mt-1 text-[11px] text-amber-400/80">Missing: {c.missing.join(', ')} — sends will dry-run until set.</p>}
            <button onClick={() => void test(c.channel)} className="mt-2 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary" data-testid={`comms-test-${c.channel}`}>Test connection</button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-3" data-testid="comms-send">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Send test (dry-run safe)</div>
        <div className="flex flex-wrap gap-2">
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs"><option value="sms">SMS</option><option value="email">Email</option></select>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={channel === 'sms' ? '+1…' : 'name@email'} className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" data-testid="comms-to" />
          <button onClick={() => void send()} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Send</button>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
        {msg && <p className="mt-1 text-[11px] text-primary" data-testid="comms-msg">{msg}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-3" data-testid="comms-log">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Communication log</div>
        {log.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No messages yet.</p> : (
          <ul className="space-y-0.5 text-[11px]">
            {log.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <span className={`rounded px-1.5 text-[9px] uppercase ${l.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' : l.status === 'dry_run' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{l.status}</span>
                <span className="text-muted-foreground">{l.channel}→{l.recipient_role}</span>
                <span className="truncate text-foreground/75">{l.body}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default CommsConnectPanel
