/**
 * GET  /api/comms        → channel status (live vs setup-needed) + recent log.
 * POST /api/comms        → { action: 'test'|'send'|'save', ... } workspace-scoped.
 * Never fakes a send (see lib/pm/comms). operator+ to send/save.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getCommsStatus, listComms, sendMessage, saveCommsConfig, testConnection, type Channel } from '@/lib/pm/comms'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  return NextResponse.json({ channels: getCommsStatus(ws), log: listComms(ws) })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const b = await request.json().catch(() => null) as any
  const now = Date.now()
  if (b?.action === 'test') return NextResponse.json(testConnection((b.channel ?? 'sms') as Channel))
  if (b?.action === 'save') { saveCommsConfig(ws, b.channel, b.provider, b.fromAddr ?? '', now); return NextResponse.json({ ok: true, channels: getCommsStatus(ws) }) }
  if (b?.action === 'send') {
    if (!b.to || !b.body) return NextResponse.json({ error: 'to + body required' }, { status: 400 })
    const res = await sendMessage(ws, { channel: (b.channel ?? 'sms') as Channel, to: b.to, role: b.role ?? 'tenant', body: b.body, template: b.template, consent: b.consent }, now)
    return NextResponse.json({ ok: true, result: res })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
