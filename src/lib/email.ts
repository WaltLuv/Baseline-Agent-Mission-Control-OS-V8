/**
 * Email provider abstraction.
 *
 * Order of preference at runtime:
 *   1. Resend (MC_RESEND_API_KEY)
 *   2. SMTP (MC_SMTP_HOST + MC_SMTP_USER + MC_SMTP_PASS)
 *   3. Setup-required stub — silently no-ops and logs a warning so dev/CI
 *      builds do not break.
 *
 * Callers should always treat email delivery as best-effort. Reset and invite
 * tokens are stored server-side regardless; surfacing the link to the operator
 * is the operator's job when no provider is configured.
 */

import { logger } from './logger'

export type EmailMessage = {
  to: string
  subject: string
  /** Plain-text body. HTML is auto-generated as a basic wrapper. */
  text: string
  /** Optional override for the from-address. */
  from?: string
}

export type EmailProviderStatus =
  | 'resend'
  | 'smtp'
  | 'setup_required'

export function getEmailProvider(): EmailProviderStatus {
  if (process.env.MC_RESEND_API_KEY) return 'resend'
  if (process.env.MC_SMTP_HOST && process.env.MC_SMTP_USER && process.env.MC_SMTP_PASS) return 'smtp'
  return 'setup_required'
}

function getFromAddress(): string {
  return process.env.MC_EMAIL_FROM || 'Baseline OS <noreply@mission.baselineautomations.com>'
}

async function sendViaResend(msg: EmailMessage): Promise<void> {
  const key = process.env.MC_RESEND_API_KEY!
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: msg.from || getFromAddress(),
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: `<pre style="font:14px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">${msg.text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</pre>`,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend send failed: ${res.status} ${body.slice(0, 200)}`)
  }
}

async function sendViaSmtp(msg: EmailMessage): Promise<void> {
  // Minimal SMTP send via nodemailer-style fetch fallback — most deployments
  // will use Resend. If nodemailer is later added as a dependency, swap this
  // block out. For now, log + warn.
  logger.warn({ to: msg.to, subject: msg.subject }, 'SMTP provider configured but inline send not implemented; install nodemailer to enable')
  throw new Error('SMTP send path not implemented in this build — use MC_RESEND_API_KEY')
}

export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean; provider: EmailProviderStatus; reason?: string }> {
  const provider = getEmailProvider()
  if (provider === 'setup_required') {
    logger.warn({ to: msg.to, subject: msg.subject }, 'Email provider not configured; message dropped')
    return { sent: false, provider, reason: 'No email provider configured. Set MC_RESEND_API_KEY or MC_SMTP_* to enable email delivery.' }
  }
  try {
    if (provider === 'resend') await sendViaResend(msg)
    else if (provider === 'smtp') await sendViaSmtp(msg)
    return { sent: true, provider }
  } catch (err) {
    logger.error({ err, to: msg.to, subject: msg.subject }, 'Email send failed')
    return { sent: false, provider, reason: err instanceof Error ? err.message : 'unknown' }
  }
}
