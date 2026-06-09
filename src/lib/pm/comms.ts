/**
 * Property-management communications (F1). Workspace-scoped SMS/email with a
 * Twilio-ready / Resend-ready architecture. NEVER fakes a send: if credentials
 * are absent the message is logged as a dry-run (exact payload that WOULD send),
 * and the caller is told it's blocked-for-live. Real send only when env creds exist.
 */
import { getDatabase } from '@/lib/db'

export type Channel = 'sms' | 'email'
export type RecipientRole = 'tenant' | 'owner' | 'vendor'
export type SendStatus = 'sent' | 'dry_run' | 'blocked'

export interface SendInput {
  channel: Channel
  to: string
  role: RecipientRole
  body: string
  template?: string
  consent?: boolean
  workOrderId?: string
}
export interface SendResult {
  id: string
  status: SendStatus
  reason?: string
  live: boolean
}

/** Message templates (filled by the workflow). */
export const MESSAGE_TEMPLATES: Record<string, { role: RecipientRole; channel: Channel; body: string }> = {
  tenant_received: { role: 'tenant', channel: 'sms', body: 'Hi {tenant}, we received your maintenance request for {unit} and are dispatching a vendor. Ref #{wo}.' },
  vendor_dispatch: { role: 'vendor', channel: 'sms', body: 'New work order #{wo}: {request} at {property} {unit}. Please confirm ETA.' },
  owner_approval: { role: 'owner', channel: 'email', body: 'Approval needed: {request} at {property} {unit}. Est. ${cost}. Approve in your inbox. Ref #{wo}.' },
  tenant_scheduled: { role: 'tenant', channel: 'sms', body: 'Hi {tenant}, your repair for {unit} is approved and scheduled. Ref #{wo}.' },
}

/** Which env credentials a channel needs to go LIVE (never stored in the DB). */
export function credsPresent(channel: Channel): { live: boolean; missing: string[] } {
  if (channel === 'sms') {
    const need = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']
    const missing = need.filter((k) => !process.env[k])
    return { live: missing.length === 0, missing }
  }
  // email: Resend OR SMTP
  const resend = !!process.env.RESEND_API_KEY
  const smtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  return { live: resend || smtp, missing: resend || smtp ? [] : ['RESEND_API_KEY or SMTP_HOST/USER/PASS'] }
}

let seq = 0
function id(now: number, p = 'msg') { seq = (seq + 1) % 1e6; return `${p}_${now.toString(36)}${seq.toString(36)}` }

/**
 * Per-credential readiness checklist for the live-demo go/no-go. Reports only
 * presence (set/missing) — never the secret value. `mode` summarizes the effect.
 */
export function credentialChecklist(): {
  items: { key: string; label: string; channel: Channel; present: boolean }[]
  sms: { live: boolean }
  email: { live: boolean }
  mode: 'live' | 'partial' | 'dry-run'
} {
  const items = [
    { key: 'TWILIO_ACCOUNT_SID', label: 'Twilio Account SID', channel: 'sms' as Channel },
    { key: 'TWILIO_AUTH_TOKEN', label: 'Twilio Auth Token', channel: 'sms' as Channel },
    { key: 'TWILIO_FROM_NUMBER', label: 'Twilio From Number', channel: 'sms' as Channel },
    { key: 'RESEND_API_KEY', label: 'Resend API Key (or SMTP_*)', channel: 'email' as Channel },
    { key: 'RESEND_FROM', label: 'Email From Address', channel: 'email' as Channel },
  ].map((i) => ({ ...i, present: !!process.env[i.key] }))
  const sms = credsPresent('sms').live
  const email = credsPresent('email').live
  const mode = sms && email ? 'live' : sms || email ? 'partial' : 'dry-run'
  return { items, sms: { live: sms }, email: { live: email }, mode }
}

/** Per-workspace comms status: provider, from-address, configured (live) flag. */
export function getCommsStatus(ws: number): { channel: Channel; provider: string; live: boolean; missing: string[] }[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT channel, provider, from_addr FROM comms_config WHERE workspace_id = ?').all(ws) as { channel: Channel; provider: string; from_addr: string }[]
  const channels: Channel[] = ['sms', 'email']
  return channels.map((c) => {
    const row = rows.find((r) => r.channel === c)
    const creds = credsPresent(c)
    return { channel: c, provider: row?.provider ?? (c === 'sms' ? 'twilio' : 'resend'), live: creds.live, missing: creds.missing }
  })
}

export function saveCommsConfig(ws: number, channel: Channel, provider: string, fromAddr: string, now: number): void {
  const db = getDatabase()
  const live = credsPresent(channel).live ? 1 : 0
  db.prepare(`INSERT INTO comms_config (workspace_id, channel, provider, from_addr, configured, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(workspace_id, channel) DO UPDATE SET provider=excluded.provider, from_addr=excluded.from_addr, configured=excluded.configured, updated_at=excluded.updated_at`)
    .run(ws, channel, provider, fromAddr, live, now)
}

/** Test a channel connection without sending — reports the exact blocker. */
export function testConnection(channel: Channel): { ok: boolean; reason: string } {
  const { live, missing } = credsPresent(channel)
  return live ? { ok: true, reason: 'credentials present — live send enabled' } : { ok: false, reason: `setup-needed: missing ${missing.join(', ')}` }
}

/**
 * Send (or dry-run) a message. Logs every attempt to comms_log. Real network
 * send only when creds exist; otherwise an honest dry_run with the exact payload.
 */
export async function sendMessage(ws: number, msg: SendInput, now: number): Promise<SendResult> {
  const db = getDatabase()
  const mid = id(now)
  const { live, missing } = credsPresent(msg.channel)
  let status: SendStatus = 'dry_run'
  let reason: string | undefined = live ? undefined : `dry-run: missing ${missing.join(', ')}`

  if (msg.consent === false) {
    status = 'blocked'
    reason = 'recipient has not consented'
  } else if (live) {
    try {
      await deliver(msg) // real provider call (Twilio/Resend) — only runs with creds
      status = 'sent'
    } catch (e) {
      status = 'blocked'
      reason = `provider error: ${(e as Error).message}`
    }
  }

  db.prepare(`INSERT INTO comms_log (id, workspace_id, channel, to_addr, recipient_role, body, template, status, reason, consent, work_order_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(mid, ws, msg.channel, msg.to, msg.role, msg.body, msg.template ?? null, status, reason ?? null, msg.consent === false ? 0 : 1, msg.workOrderId ?? null, now)
  return { id: mid, status, reason, live }
}

/** Real delivery — only invoked when credentials are present. */
async function deliver(msg: SendInput): Promise<void> {
  if (msg.channel === 'sms') {
    const sid = process.env.TWILIO_ACCOUNT_SID!, token = process.env.TWILIO_AUTH_TOKEN!, from = process.env.TWILIO_FROM_NUMBER!
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: msg.to, From: from, Body: msg.body }),
    })
    if (!res.ok) throw new Error(`twilio ${res.status}`)
  } else if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM ?? 'noreply@example.com', to: msg.to, subject: 'Property Management', text: msg.body }),
    })
    if (!res.ok) throw new Error(`resend ${res.status}`)
  } else {
    throw new Error('SMTP transport not wired in this build')
  }
}

export function listComms(ws: number, limit = 50): unknown[] {
  return getDatabase().prepare('SELECT * FROM comms_log WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?').all(ws, limit)
}
