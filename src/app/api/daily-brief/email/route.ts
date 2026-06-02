import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { aggregateDailyBrief } from '@/lib/daily-brief/aggregator'
import { renderDailyBriefEmail } from '@/lib/daily-brief/email'
import type { DailyBriefPayload, DailyBriefWindow } from '@/lib/daily-brief/types'

/**
 * GET /api/daily-brief/email?window=...&format=html|text|json
 *
 * Returns the email-ready rendering of today's Daily Brief. NO send.
 * The customer-facing surface is a preview-only modal; scheduled
 * delivery is a future pass.
 *
 * Lane discipline: Mission Control owns the email template; the
 * underlying payload is fetched from the same /api/daily-brief
 * endpoint that proxies Baseline OS (or runs the MC fallback).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const workspaceId = auth.user.workspace_id ?? 1
  const userId = auth.user.id ?? 0

  const url = new URL(request.url)
  const windowParam = (url.searchParams.get('window') ?? 'since-yesterday') as DailyBriefWindow
  const window: DailyBriefWindow =
    windowParam === 'since-last-login' ? 'since-last-login' : 'since-yesterday'
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase()

  // Pull the payload through the same /api/daily-brief logic so Baseline OS
  // proxying stays a single concern. We call the aggregator directly here
  // because importing the route handler from another route is awkward in
  // app-router; the proxy path is owned by the consumer route. Future:
  // factor a shared service.
  let payload: DailyBriefPayload
  const baselineOsUrl = process.env.BASELINE_OS_DAILY_BRIEF_URL
  if (baselineOsUrl) {
    try {
      const r = await fetch(
        `${baselineOsUrl}?workspace_id=${workspaceId}&user_id=${userId}&window=${window}`,
        { cache: 'no-store' },
      )
      if (r.ok) {
        payload = (await r.json()) as DailyBriefPayload
      } else {
        payload = aggregateDailyBrief({ workspaceId, userId, window })
      }
    } catch {
      payload = aggregateDailyBrief({ workspaceId, userId, window })
    }
  } else {
    payload = aggregateDailyBrief({ workspaceId, userId, window })
  }

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get('origin') ||
    `${url.protocol}//${url.host}`

  const rendered = renderDailyBriefEmail({
    payload,
    workspaceName: undefined,
    recipientName: auth.user.username,
    appBaseUrl,
  })

  if (format === 'html') {
    return new NextResponse(rendered.html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  if (format === 'text') {
    return new NextResponse(rendered.text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return NextResponse.json({
    subject: rendered.subject,
    preheader: rendered.preheader,
    html: rendered.html,
    text: rendered.text,
    source: payload.source,
  })
}

export const dynamic = 'force-dynamic'
