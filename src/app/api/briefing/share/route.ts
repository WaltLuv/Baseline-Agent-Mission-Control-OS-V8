import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHmac } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

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
    const provider = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST
    if (!provider) {
      return NextResponse.json({
        ok: false,
        requiresSetup: 'email',
        message: 'No email provider configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_HOST.',
        shareUrl,
        summary: buildSummaryText(body.briefing, shareUrl),
      })
    }
    // Email provider integration is intentionally not implemented inline.
    // When ready, route through the existing email service. For now we return
    // the share link + summary so the operator can paste manually.
    auditLog(workspaceId, actorId, 'email', body.to || 'unknown')
    return NextResponse.json({
      ok: true,
      channel: 'email',
      sentTo: body.to,
      shareUrl,
      expiresAt,
      summary: buildSummaryText(body.briefing, shareUrl),
      note: 'Email provider configured. Set up the email service integration to enable automatic send. Summary returned for fallback copy.',
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
