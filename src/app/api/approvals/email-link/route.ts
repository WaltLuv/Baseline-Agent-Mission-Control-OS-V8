/**
 * Email-action approval endpoint.
 *
 *   GET  /api/approvals/email-link?taskId=N&action=approve|reject&token=…
 *
 * One-click approval from an email link. Token is HMAC-signed with the
 * server's AUTH_SECRET and includes the task id + action + expiry, so
 * the link is single-action and tamper-resistant. Today the API call
 * itself is reachable but emails carrying these links are NOT scheduled
 * (per Walt: "do not send scheduled emails yet"); the link structure +
 * verification logic is the deliverable.
 *
 * The companion `signApprovalLink()` helper (below) builds the URL the
 * eventual email template will embed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getDatabase } from '@/lib/db'

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60 // links valid 7 days

function getSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.SHARE_SIGNING_SECRET
  if (!s) throw new Error('AUTH_SECRET missing')
  return s
}

export interface ApprovalLinkPayload {
  taskId: number
  action: 'approve' | 'reject'
  expiresAt: number
}

export function signApprovalLink(
  baseUrl: string,
  payload: ApprovalLinkPayload,
): string {
  const secret = getSecret()
  const body = `${payload.taskId}.${payload.action}.${payload.expiresAt}`
  const sig = createHmac('sha256', secret).update(body).digest('hex')
  const token = Buffer.from(`${body}.${sig}`).toString('base64url')
  return `${baseUrl.replace(/\/$/, '')}/api/approvals/email-link?token=${token}`
}

function verifyToken(token: string): ApprovalLinkPayload | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const parts = raw.split('.')
    if (parts.length !== 4) return null
    const [taskIdStr, action, expiresAtStr, sig] = parts
    if (action !== 'approve' && action !== 'reject') return null
    const body = `${taskIdStr}.${action}.${expiresAtStr}`
    const expected = createHmac('sha256', getSecret()).update(body).digest('hex')
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const expiresAt = Number(expiresAtStr)
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null
    return {
      taskId: Number(taskIdStr),
      action,
      expiresAt,
    }
  } catch {
    return null
  }
}

export function defaultApprovalLinkExpiry(): number {
  return Math.floor(Date.now() / 1000) + DEFAULT_TTL_SECONDS
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return htmlResponse(400, 'Missing token', 'The approval link is incomplete. Open Mission Control to approve manually.')
  }
  const payload = verifyToken(token)
  if (!payload) {
    return htmlResponse(
      403,
      'Invalid or expired link',
      'This approval link is no longer valid. Open the approval queue in Mission Control to act manually.',
    )
  }

  // Apply the action.
  try {
    const db = getDatabase()
    const task = db
      .prepare('SELECT id, title, status, workspace_id FROM tasks WHERE id = ?')
      .get(payload.taskId) as { id: number; title: string; status: string; workspace_id: number } | undefined
    if (!task) {
      return htmlResponse(404, 'Task not found', 'The task referenced in this link no longer exists.')
    }
    if (task.status === 'done' || task.status === 'completed' || task.status === 'closed') {
      return htmlResponse(
        200,
        'Already actioned',
        `"${escapeHtml(task.title)}" has already been resolved. Nothing to do.`,
      )
    }
    const newStatus = payload.action === 'approve' ? 'done' : 'cancelled'
    const now = Math.floor(Date.now() / 1000)
    db.prepare(
      `UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
    ).run(newStatus, payload.action === 'approve' ? now : null, now, payload.taskId)
    db.prepare(
      `INSERT INTO audit_log (action, actor, target_type, target_id, detail, workspace_id)
       VALUES (?, ?, 'task', ?, ?, ?)`,
    ).run(
      payload.action === 'approve' ? 'task.email_approve' : 'task.email_reject',
      'email-link',
      payload.taskId,
      JSON.stringify({ via: 'email-link', expires_at: payload.expiresAt }),
      task.workspace_id,
    )
    return htmlResponse(
      200,
      payload.action === 'approve' ? 'Approved' : 'Rejected',
      `"${escapeHtml(task.title)}" was ${payload.action === 'approve' ? 'approved' : 'rejected'} from your email. Open Mission Control to see the full audit trail.`,
    )
  } catch (e) {
    return htmlResponse(
      500,
      'Could not apply action',
      `Something went wrong while applying your decision: ${escapeHtml(String(e))}.`,
    )
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function htmlResponse(status: number, title: string, body: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0b0b12;color:#e5e7eb">
<div style="max-width:520px;margin:80px auto;padding:32px;background:#0f0f17;border:1px solid rgba(255,255,255,0.08);border-radius:14px">
<p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#a5b4fc">Mission Control · Approval link</p>
<h1 style="margin:8px 0 12px;font-size:22px;color:#fff">${escapeHtml(title)}</h1>
<p style="margin:0;color:#cbd5e1;line-height:1.55">${body}</p>
<p style="margin:24px 0 0"><a href="/app/approvals" style="display:inline-block;padding:10px 16px;background:#fff;color:#0b0b12;text-decoration:none;border-radius:8px;font-weight:600">Open approval queue →</a></p>
</div></body></html>`
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export const dynamic = 'force-dynamic'
