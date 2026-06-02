/**
 * Daily Brief — email-ready HTML renderer.
 *
 * Pure function: takes a DailyBriefPayload (Claude's Baseline OS payload
 * OR the Mission Control fallback) and returns the HTML body + plain-text
 * fallback Resend can ship. NO scheduled delivery in this pass — the
 * preview surface exposes the rendered email to the operator.
 *
 * Lane discipline: Mission Control owns the email template; Baseline OS
 * owns the payload that feeds it. We do not recompute any metric here.
 */

import type { DailyBriefPayload } from './types'

interface RenderArgs {
  payload: DailyBriefPayload
  workspaceName?: string
  recipientName?: string
  /** Absolute URL of the Mission Control instance — used for deep-link CTAs. */
  appBaseUrl: string
}

export interface RenderedEmail {
  subject: string
  preheader: string
  html: string
  text: string
}

export function renderDailyBriefEmail(args: RenderArgs): RenderedEmail {
  const { payload, recipientName, workspaceName, appBaseUrl } = args
  const subject = buildSubject(payload)
  const preheader = buildPreheader(payload)
  const text = buildText({ payload, recipientName, workspaceName, appBaseUrl })
  const html = buildHtml({ payload, recipientName, workspaceName, appBaseUrl })
  return { subject, preheader, html, text }
}

// ─────────────────────────────────────────────────────────────────
function buildSubject(p: DailyBriefPayload): string {
  if (p.empty_state) return 'Mission Control · install your workforce to start daily briefs'
  if (p.critical_banner) return `${p.critical_banner.headline} · Mission Control Daily Brief`
  if (p.by_the_numbers.tasks_handled === 0) return 'Quiet morning · Mission Control Daily Brief'
  const v = p.workforce_vertical ?? 'Your workforce'
  return `${v}: ${p.by_the_numbers.tasks_handled} ${p.by_the_numbers.tasks_handled === 1 ? 'task' : 'tasks'} handled · ${p.date_range.window === 'since-last-login' ? 'since your last visit' : 'overnight'}`
}

function buildPreheader(p: DailyBriefPayload): string {
  return p.status_line + ' ' + p.headline
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function absUrl(base: string, path: string): string {
  if (!path) return base
  if (/^https?:/i.test(path)) return path
  if (path.startsWith('/')) return base.replace(/\/$/, '') + path
  return base.replace(/\/$/, '') + '/' + path
}

// ─────────────────────────────────────────────────────────────────
function buildText({ payload, recipientName, workspaceName, appBaseUrl }: RenderArgs): string {
  const lines: string[] = []
  lines.push(`Mission Control · Daily Brief`)
  if (workspaceName) lines.push(`Workspace: ${workspaceName}`)
  lines.push(`Window: ${payload.date_range.label}`)
  lines.push('')
  lines.push(recipientName ? `Hi ${recipientName.split(' ')[0]},` : 'Good morning,')
  lines.push('')
  if (payload.empty_state) {
    lines.push(payload.empty_state.headline)
    lines.push(payload.empty_state.detail)
    lines.push('')
    lines.push(`${payload.empty_state.cta_label} ${absUrl(appBaseUrl, payload.empty_state.cta_url)}`)
    return lines.join('\n')
  }
  if (payload.critical_banner) {
    lines.push(`⚠ ${payload.critical_banner.headline}`)
    lines.push(payload.critical_banner.detail)
    lines.push(`${payload.critical_banner.action_label} ${absUrl(appBaseUrl, payload.critical_banner.action_url)}`)
    lines.push('')
  }
  lines.push(payload.headline)
  lines.push('')
  lines.push(payload.narrative)
  lines.push('')
  lines.push('BY THE NUMBERS')
  const n = payload.by_the_numbers
  lines.push(`  Tasks handled        : ${n.tasks_handled}`)
  lines.push(`  Approvals requested  : ${n.approvals_requested}`)
  lines.push(`  Approvals granted    : ${n.approvals_granted}`)
  lines.push(`  Tool executions      : ${n.tool_executions}`)
  lines.push(`  Proofs delivered     : ${n.proofs_delivered}`)
  lines.push(`  Failed executions    : ${n.failed_executions}`)
  lines.push(`  Hours saved (est.)   : ${n.estimated_hours_saved}`)
  if (payload.attention.length > 0) {
    lines.push('')
    lines.push(`ATTENTION (${payload.attention.length})`)
    for (const a of payload.attention) {
      lines.push(`  · [${a.kind.toUpperCase()}] ${a.title}`)
      if (a.detail) lines.push(`    ${a.detail}`)
      lines.push(`    ${absUrl(appBaseUrl, a.url)}`)
    }
  }
  if (payload.proof_links.length > 0) {
    lines.push('')
    lines.push('PROOFS DELIVERED')
    for (const p of payload.proof_links) {
      lines.push(`  ✓ ${p.title}${p.proof_url ? ' — ' + p.proof_url : ''}`)
    }
  }
  lines.push('')
  lines.push(payload.status_line)
  lines.push('')
  lines.push(`Open Mission Control: ${absUrl(appBaseUrl, '/app/overview')}`)
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────
function buildHtml({ payload, recipientName, workspaceName, appBaseUrl }: RenderArgs): string {
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName.split(' ')[0])},` : 'Good morning,'
  const ws = workspaceName ? `<span style="color:#a5b4fc">${escapeHtml(workspaceName)}</span> · ` : ''

  const criticalBanner = payload.critical_banner
  const critical = criticalBanner
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:10px;background:#3f1d1d;border:1px solid rgba(244,63,94,0.35);margin:0 0 16px 0">
         <tr><td style="padding:12px 14px;color:#fecaca;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px">
           <strong style="color:#fee2e2;font-weight:600">${escapeHtml(criticalBanner.headline)}</strong><br/>
           <span style="color:#fda4af;font-size:13px">${escapeHtml(criticalBanner.detail)}</span><br/>
           <a href="${escapeHtml(absUrl(appBaseUrl, criticalBanner.action_url))}" style="color:#fecdd3;font-weight:600;text-decoration:underline">${escapeHtml(criticalBanner.action_label)}</a>
         </td></tr>
       </table>`
    : ''

  const empty = payload.empty_state
    ? `<p style="color:#cbd5e1;font-size:15px;line-height:1.5;margin:14px 0">${escapeHtml(payload.empty_state.headline)}<br/>
       <span style="color:#94a3b8;font-size:13px">${escapeHtml(payload.empty_state.detail)}</span></p>
       <p><a href="${escapeHtml(absUrl(appBaseUrl, payload.empty_state.cta_url))}"
            style="display:inline-block;background:#ffffff;color:#0b0b12;font-weight:600;text-decoration:none;padding:10px 16px;border-radius:8px">
            ${escapeHtml(payload.empty_state.cta_label)}</a></p>`
    : ''

  const n = payload.by_the_numbers
  const numberCells = [
    { label: 'Tasks handled', value: n.tasks_handled, tone: 'neutral' },
    { label: 'Approvals requested', value: n.approvals_requested, tone: 'neutral' },
    { label: 'Approvals granted', value: n.approvals_granted, tone: 'neutral' },
    { label: 'Tool executions', value: n.tool_executions, tone: 'neutral' },
    { label: 'Proofs delivered', value: n.proofs_delivered, tone: 'neutral' },
    { label: 'Failed executions', value: n.failed_executions, tone: n.failed_executions > 0 ? 'warn' : 'neutral' },
    { label: 'Hours saved (est.)', value: n.estimated_hours_saved, tone: 'positive' },
  ]
  const numbersTable = payload.empty_state
    ? ''
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 0 0">
         <tr>${numberCells
           .map(
             (c) => `
           <td valign="top" style="padding:0 6px 6px 0">
             <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px">
               <tr><td style="padding:10px 12px;font-family:Inter,Helvetica,Arial,sans-serif">
                 <div style="font-size:20px;font-weight:600;color:${c.tone === 'positive' ? '#a7f3d0' : c.tone === 'warn' ? '#fecdd3' : '#ffffff'}">${c.value}</div>
                 <div style="font-size:11px;color:#94a3b8;margin-top:2px">${c.label}</div>
               </td></tr>
             </table>
           </td>`,
           )
           .join('')}</tr>
       </table>`

  const attention = payload.attention.length === 0 || payload.empty_state
    ? ''
    : `<h3 style="font-size:13px;color:#fcd34d;text-transform:uppercase;letter-spacing:0.08em;margin:24px 0 8px;font-family:Inter,Helvetica,Arial,sans-serif">Attention</h3>
       ${payload.attention
         .map(
           (a) => `
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:8px">
           <tr>
             <td style="padding:12px 14px;font-family:Inter,Helvetica,Arial,sans-serif">
               <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:${a.kind === 'failed_execution' || a.kind === 'critical_workflow' ? '#fecdd3' : '#fcd34d'};font-weight:600">${a.kind.replace(/_/g, ' ')}</div>
               <div style="font-size:14px;color:#e5e7eb;font-weight:600;margin-top:4px">${escapeHtml(a.title)}</div>
               ${a.detail ? `<div style="font-size:12px;color:#94a3b8;margin-top:2px">${escapeHtml(a.detail)}</div>` : ''}
               <a href="${escapeHtml(absUrl(appBaseUrl, a.url))}" style="display:inline-block;margin-top:6px;font-size:12px;color:#c4b5fd;text-decoration:underline">Open →</a>
             </td>
           </tr>
         </table>`,
         )
         .join('')}`

  const proofs = payload.proof_links.length === 0 || payload.empty_state
    ? ''
    : `<h3 style="font-size:13px;color:#86efac;text-transform:uppercase;letter-spacing:0.08em;margin:24px 0 8px;font-family:Inter,Helvetica,Arial,sans-serif">Proofs delivered</h3>
       <ul style="padding-left:18px;margin:0;color:#cbd5e1;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px">
         ${payload.proof_links
           .map(
             (p) => `<li style="margin:4px 0">${escapeHtml(p.title)}${p.proof_url ? ` — <a href="${escapeHtml(p.proof_url)}" style="color:#c4b5fd">proof</a>` : ''}</li>`,
           )
           .join('')}
       </ul>`

  const statusColor = payload.attention.length === 0 ? '#a7f3d0' : '#fde68a'

  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(buildSubject(payload))}</title>
</head>
<body style="margin:0;padding:0;background:#0b0b12">
<span style="display:none;color:transparent;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">${escapeHtml(buildPreheader(payload))}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0b12">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#0f0f17;border:1px solid rgba(255,255,255,0.08);border-radius:14px">
      <tr><td style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.06);font-family:Inter,Helvetica,Arial,sans-serif">
        <div style="font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.1em;font-weight:600">Mission Control · Daily Brief</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${ws}${escapeHtml(payload.date_range.label)}</div>
      </td></tr>
      <tr><td style="padding:24px 28px;font-family:Inter,Helvetica,Arial,sans-serif;color:#e5e7eb">
        ${critical}
        <p style="margin:0 0 4px 0;font-size:14px;color:#94a3b8">${greeting}</p>
        <h1 style="margin:6px 0 12px 0;font-size:24px;line-height:1.25;color:#ffffff;font-weight:600">${escapeHtml(payload.headline)}</h1>
        ${payload.empty_state ? empty : `<p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.55">${escapeHtml(payload.narrative)}</p>`}
        ${numbersTable}
        ${attention}
        ${proofs}
        <p style="margin:24px 0 0 0;font-size:14px;color:${statusColor};font-weight:600">${escapeHtml(payload.status_line)}</p>
        <p style="margin:20px 0 0 0">
          <a href="${escapeHtml(absUrl(appBaseUrl, '/app/overview'))}" style="display:inline-block;background:#ffffff;color:#0b0b12;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Open Mission Control →</a>
        </p>
      </td></tr>
      <tr><td style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;color:#475569">
        Source: ${payload.source === 'baseline-os' ? 'Baseline OS' : 'Mission Control'} · generated ${escapeHtml(new Date(payload.generated_at).toUTCString())}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
