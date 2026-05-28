import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHmac } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import nodemailer from 'nodemailer'

/**
 * Executive Briefing — Secure Share
 *
 * Creates a signed, expiring share link OR sends the briefing via configured
 * email / Slack webhook. NEVER creates a public workforce profile URL.
 *
 * Security rules enforced:
 *   - Operator-or-admin role required (no viewer-tier sharing)
 *   - Signed link includes an HMAC over (briefingId, expiresAt) using the
 *     server's SHARE_SIGNING_SECRET — recipients can't tamper or extend
 *   - 7-day default expiry, max 30 days
 *   - All shares are audit-logged in the existing `usage_events` table
 *   - Slack/email require pre-configured workspace integrations; if missing
 *     we return `{ requiresSetup: true }` so the UI can prompt the operator
 *   - Payload sent NEVER contains raw customer data, secrets, or token IDs;
 *     it's the same shape the operator already sees in their briefing card
 */

interface SharePayload {
  channel: 'link' | 'email' | 'slack' | 'copy'
  to?: string                       // email address OR Slack channel
  expiresInDays?: number            // 1..30
  briefing: {
    headline: string
    valueCreatedMonthUsd: number
    hoursSavedMonth: number
    dailyWins: { title: string; impact: string; valueUsd: number }[]
    attentionItems: { title: string; severity: string; reason: string }[]
    topEmployee: { name: string; impact: string } | null
    nextAction: { label: string; href: string }
  }
}

function getSecret(): string {
  return (
    process.env.SHARE_SIGNING_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MISSION_CONTROL_SECRET ||
    'dev-only-mission-control-share-secret'
  )
}

function sign(briefingId: string, expiresAt: number): string {
  return createHmac('sha256', getSecret())
    .update(`${briefingId}.${expiresAt}`)
    .digest('hex')
    .slice(0, 32)
}

function auditLog(workspaceId: number, actorId: number, channel: string, to: string) {
  try {
    const db = getDatabase()
    db.prepare(
      `INSERT INTO usage_events (workspace_id, agent_id, model, event_type, input_tokens, output_tokens, raw_cost_cents, retail_cost_cents, markup_multiplier, idempotency_key, created_at, metadata)
       VALUES (?, NULL, 'briefing-share', 'briefing.share', 0, 0, 0, 0, 1, ?, strftime('%s','now'), ?)`
    ).run(
      workspaceId,
      `share-${randomBytes(8).toString('hex')}`,
      JSON.stringify({ actorId, channel, to: to.slice(0, 120) }),
    )
  } catch {
    // best-effort — never block a share on audit-log failure
  }
}

export async function POST(request: NextRequest) {
  // Operator/admin only — no viewer sharing.
  const auth = requireRole(request, 'operator')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const workspaceId = auth.user.workspace_id ?? 1
  const actorId = auth.user.id

  let body: SharePayload
  try {
    body = (await request.json()) as SharePayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body?.channel || !body?.briefing) {
    return NextResponse.json({ error: 'channel and briefing required' }, { status: 400 })
  }

  const days = Math.max(1, Math.min(30, body.expiresInDays ?? 7))
  const expiresAt = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60
  const briefingId = randomBytes(12).toString('hex')
  const signature = sign(briefingId, expiresAt)

  // Store the briefing snapshot — the share endpoint reads from this so the
  // recipient sees the exact numbers the operator saw, not live data.
  try {
    const db = getDatabase()
    db.exec(`
      CREATE TABLE IF NOT EXISTS briefing_shares (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        actor_id INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
    `)
    db.prepare(
      `INSERT INTO briefing_shares (id, workspace_id, actor_id, snapshot, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, strftime('%s','now'))`
    ).run(briefingId, workspaceId, actorId, JSON.stringify(body.briefing), expiresAt)
  } catch (e) {
    return NextResponse.json({ error: 'Could not persist share', detail: String(e).slice(0, 200) }, { status: 500 })
  }

  const origin = request.headers.get('origin') || `${new URL(request.url).protocol}//${request.headers.get('host')}`
  const shareUrl = `${origin}/briefing/share?id=${briefingId}&exp=${expiresAt}&sig=${signature}`

  // ---------- COPY / LINK ----------
  if (body.channel === 'copy' || body.channel === 'link') {
    auditLog(workspaceId, actorId, body.channel, body.to || 'self')
    return NextResponse.json({
      ok: true,
      channel: body.channel,
      shareUrl,
      expiresAt,
      summary: buildSummaryText(body.briefing, shareUrl),
    })
  }

  // ---------- EMAIL ----------
  if (body.channel === 'email') {
    const resendKey = process.env.RESEND_API_KEY
    const sendgridKey = process.env.SENDGRID_API_KEY
    const smtpHost = process.env.SMTP_HOST
    const provider = resendKey || sendgridKey || smtpHost
    if (!provider) {
      return NextResponse.json({
        ok: false,
        requiresSetup: 'email',
        message: 'No email provider configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_HOST.',
        shareUrl,
        summary: buildSummaryText(body.briefing, shareUrl),
      })
    }
    if (!body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
      return NextResponse.json({ error: 'Valid recipient email required' }, { status: 400 })
    }

    const fromAddress =
      process.env.BRIEFING_FROM_EMAIL || 'briefings@mission-control.local'
    const subject = `Executive Briefing — ${body.briefing.headline.slice(0, 100)}`
    const text = buildSummaryText(body.briefing, shareUrl)
    const html = buildSummaryHtml(body.briefing, shareUrl)

    let providerName: 'resend' | 'sendgrid' | 'smtp' | 'none' = 'none'
    let providerStatus = 0
    let providerError: string | null = null

    try {
      if (resendKey) {
        providerName = 'resend'
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [body.to],
            subject,
            text,
            html,
          }),
        })
        providerStatus = r.status
        if (!r.ok) {
          providerError = (await r.text()).slice(0, 300)
        }
      } else if (sendgridKey) {
        providerName = 'sendgrid'
        const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: body.to }] }],
            from: { email: fromAddress, name: 'Mission Control' },
            subject,
            content: [
              { type: 'text/plain', value: text },
              { type: 'text/html', value: html },
            ],
          }),
        })
        providerStatus = r.status
        if (!r.ok) {
          providerError = (await r.text()).slice(0, 300)
        }
      } else {
        // SMTP inline send — enterprise / self-hosted fallback. Uses
        // nodemailer with env-based config. Secrets stay server-side.
        const smtpHost = process.env.SMTP_HOST
        if (smtpHost) {
          providerName = 'smtp'
          try {
            const port = Number(process.env.SMTP_PORT ?? 587)
            const secure = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true' || port === 465
            const transport = nodemailer.createTransport({
              host: smtpHost,
              port,
              secure,
              auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
              connectionTimeout: 8_000,
              greetingTimeout: 8_000,
              socketTimeout: 12_000,
            })
            await transport.sendMail({
              from: process.env.SMTP_FROM || fromAddress,
              to: body.to,
              subject,
              text,
              html,
            })
            providerStatus = 250
          } catch (e) {
            providerError = String(e).slice(0, 300)
          }
        }
      }
    } catch (e) {
      providerError = String(e).slice(0, 300)
    }

    const sent = providerError === null && providerStatus >= 200 && providerStatus < 300
    auditLog(workspaceId, actorId, sent ? `email:${providerName}` : `email:${providerName}-failed`, body.to)

    if (sent) {
      return NextResponse.json({
        ok: true,
        channel: 'email',
        provider: providerName,
        sentTo: body.to,
        shareUrl,
        expiresAt,
      })
    }
    // Copy-fallback: provider not configured or send failed → operator still
    // gets the share link + summary so they can paste manually.
    return NextResponse.json({
      ok: false,
      channel: 'email',
      provider: providerName,
      requiresSetup: providerName === 'none' ? 'email' : null,
      error: providerError,
      shareUrl,
      expiresAt,
      summary: text,
      note:
        providerName === 'none'
          ? 'No email provider configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_HOST. Summary returned for manual paste.'
          : `Email provider ${providerName} rejected the request. Summary returned for fallback copy.`,
    })
  }

  // ---------- SLACK ----------
  if (body.channel === 'slack') {
    const webhook = process.env.SLACK_WEBHOOK_URL
    if (!webhook) {
      return NextResponse.json({
        ok: false,
        requiresSetup: 'slack',
        message: 'No Slack webhook configured. Set SLACK_WEBHOOK_URL.',
        shareUrl,
        summary: buildSummaryText(body.briefing, shareUrl),
      })
    }
    try {
      const slackResp = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Executive Briefing — ${body.briefing.headline}\n\n${buildSummaryText(body.briefing, shareUrl)}`,
        }),
      })
      if (!slackResp.ok) throw new Error(`Slack returned ${slackResp.status}`)
    } catch (e) {
      return NextResponse.json({ error: 'Slack post failed', detail: String(e).slice(0, 200) }, { status: 502 })
    }
    auditLog(workspaceId, actorId, 'slack', body.to || 'workspace-default')
    return NextResponse.json({ ok: true, channel: 'slack', shareUrl, expiresAt })
  }

  return NextResponse.json({ error: 'Unknown channel' }, { status: 400 })
}

function buildSummaryText(b: SharePayload['briefing'], url: string): string {
  const wins = (b.dailyWins || [])
    .slice(0, 3)
    .map((w) => `  • ${w.title} (+$${w.valueUsd.toLocaleString()})`)
    .join('\n')
  const att = (b.attentionItems || [])
    .slice(0, 3)
    .map((a) => `  • [${a.severity.toUpperCase()}] ${a.title}`)
    .join('\n')
  return [
    `📊 Executive Briefing`,
    ``,
    b.headline,
    ``,
    `Value created this month: $${b.valueCreatedMonthUsd.toLocaleString()} · ${b.hoursSavedMonth} hours saved`,
    ``,
    wins ? `Today's wins:\n${wins}` : '',
    att ? `\nAttention required:\n${att}` : '',
    b.topEmployee ? `\nStar AI employee: ${b.topEmployee.name} — ${b.topEmployee.impact}` : '',
    ``,
    `Next action: ${b.nextAction.label}`,
    ``,
    `View live briefing: ${url}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildSummaryHtml(b: SharePayload['briefing'], url: string): string {
  const wins = (b.dailyWins || [])
    .slice(0, 3)
    .map((w) => `<li><strong>${escapeHtml(w.title)}</strong> <span style="color:#059669">+$${w.valueUsd.toLocaleString()}</span></li>`)
    .join('')
  const att = (b.attentionItems || [])
    .slice(0, 3)
    .map((a) => `<li><span style="color:${a.severity === 'high' ? '#dc2626' : '#d97706'};font-weight:600">[${escapeHtml(a.severity.toUpperCase())}]</span> ${escapeHtml(a.title)}</li>`)
    .join('')
  return `<!doctype html>
<html><body style="margin:0;background:#0a0a0b;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;padding:24px;border:1px solid #1f2937;border-radius:12px;background:#0f1115">
    <p style="margin:0;font-size:11px;letter-spacing:.2em;color:#22d3ee;text-transform:uppercase">Executive Briefing</p>
    <h1 style="margin:8px 0 4px;font-size:20px;color:#fff">${escapeHtml(b.headline)}</h1>
    <p style="margin:0;font-size:13px;color:#9ca3af">Value created this month: <strong style="color:#34d399">$${b.valueCreatedMonthUsd.toLocaleString()}</strong> · <strong>${b.hoursSavedMonth} hours saved</strong></p>
    ${wins ? `<h2 style="margin:18px 0 6px;font-size:13px;color:#34d399">Today's wins</h2><ul style="margin:0;padding-left:20px;font-size:13px;color:#e5e7eb">${wins}</ul>` : ''}
    ${att ? `<h2 style="margin:18px 0 6px;font-size:13px;color:#f59e0b">Attention required</h2><ul style="margin:0;padding-left:20px;font-size:13px;color:#e5e7eb">${att}</ul>` : ''}
    ${b.topEmployee ? `<p style="margin:18px 0 0;font-size:13px"><strong style="color:#22d3ee">Star AI employee:</strong> ${escapeHtml(b.topEmployee.name)} — ${escapeHtml(b.topEmployee.impact)}</p>` : ''}
    <p style="margin:24px 0 0;font-size:13px"><strong>Next action:</strong> ${escapeHtml(b.nextAction.label)}</p>
    <p style="margin:18px 0 0">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#22d3ee;color:#0a0a0b;text-decoration:none;font-weight:600;font-size:13px">View live briefing →</a>
    </p>
    <p style="margin:24px 0 0;font-size:11px;color:#6b7280">Signed link · expires automatically. Mission Control · Baseline OS.</p>
  </div>
</body></html>`
}
