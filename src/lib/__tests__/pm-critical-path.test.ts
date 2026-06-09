/**
 * PM critical path (F1 comms + F2 live maintenance + F5 owner approval inbox).
 * Drives the libs against the real migrated (temp) DB; no creds in test env →
 * deterministic dry-run. Covers the full Customer-Zero maintenance demo flow.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { credsPresent, testConnection, sendMessage, listComms } from '@/lib/pm/comms'
import { triage, executeMaintenance, getWorkOrder } from '@/lib/pm/maintenance'
import { listPending, decide, getApproval } from '@/lib/pm/approvals'

const WS = 991 // isolate this test's workspace

describe('F1 comms — never fakes a send', () => {
  it('reports setup-needed + exact missing creds when none present', () => {
    const sms = credsPresent('sms')
    expect(sms.live).toBe(false)
    expect(sms.missing).toContain('TWILIO_ACCOUNT_SID')
    expect(testConnection('sms').ok).toBe(false)
  })
  it('logs a dry-run (not a fake send) when creds missing', async () => {
    const r = await sendMessage(WS, { channel: 'sms', to: '+15555550123', role: 'tenant', body: 'hi' }, 1)
    expect(r.status).toBe('dry_run')
    expect(r.live).toBe(false)
    expect(listComms(WS).length).toBeGreaterThan(0)
  })
  it('blocks on missing consent', async () => {
    const r = await sendMessage(WS, { channel: 'sms', to: 'x', role: 'tenant', body: 'hi', consent: false }, 2)
    expect(r.status).toBe('blocked')
  })
})

describe('F2 live maintenance execution', () => {
  it('triages urgency + category + estimate', () => {
    expect(triage('water leak under sink').urgency).toBe('high')
    expect(triage('water leak under sink').category).toBe('plumbing')
    expect(triage('cosmetic paint touch-up').urgency).toBe('low')
  })

  it('high-cost request creates work order + owner approval (gate before spend), dispatch held', async () => {
    const res = await executeMaintenance(WS, { request: 'major water leak flooding unit', property: 'Maple', unit: '4B', tenant: 'Jordan', costThreshold: 500 }, 10)
    expect(res.workOrder.status).toBe('awaiting_approval')
    expect(res.approvalId).toBeTruthy()
    expect(res.dispatch).toBeNull() // not dispatched until approved
    expect(res.replayId).toBeTruthy() // proof/replay created
    expect(res.liveComms).toBe(false) // honest dry-run env
  })

  it('low-cost request dispatches immediately (dry-run, honest)', async () => {
    const res = await executeMaintenance(WS, { request: 'replace a light bulb', property: 'Maple', unit: '2A', costThreshold: 500 }, 20)
    expect(res.approvalId).toBeNull()
    expect(res.dispatch?.status).toBe('dry_run_dispatch')
  })
})

describe('F5 owner approval inbox', () => {
  it('pending approval appears; approve triggers dispatch; audit recorded', async () => {
    const res = await executeMaintenance(WS, { request: 'burst pipe emergency', property: 'Oak', unit: '9C', costThreshold: 100 }, 30)
    const pending = listPending(WS)
    expect(pending.some((a) => a.id === res.approvalId)).toBe(true)
    const d = await decide(WS, res.approvalId!, 'approved', 'owner@x.com', 'ok go', 31)
    expect(d.ok).toBe(true)
    expect(d.dispatch?.status).toBe('dry_run_dispatch') // dispatched (dry-run, no creds)
    expect(getWorkOrder(WS, res.workOrder.id).status).toBe('dry_run_dispatch')
    expect(getApproval(WS, res.approvalId!)?.audit.some((a) => a.action === 'approved')).toBe(true)
  })

  it('deny blocks the work order', async () => {
    const res = await executeMaintenance(WS, { request: 'expensive HVAC replacement', property: 'Pine', unit: '1A', costThreshold: 100 }, 40)
    const d = await decide(WS, res.approvalId!, 'denied', 'owner@x.com', 'too costly', 41)
    expect(d.ok).toBe(true)
    expect(getWorkOrder(WS, res.workOrder.id).status).toBe('blocked')
  })

  it('double-decide is rejected', async () => {
    const res = await executeMaintenance(WS, { request: 'flood emergency', property: 'Elm', unit: '3C', costThreshold: 100 }, 50)
    await decide(WS, res.approvalId!, 'approved', 'o', '', 51)
    const again = await decide(WS, res.approvalId!, 'denied', 'o', '', 52)
    expect(again.ok).toBe(false)
  })
})

describe('panels + APIs wired', () => {
  const comms = readFileSync('src/components/panels/comms-connect-panel.tsx', 'utf8')
  const maint = readFileSync('src/components/panels/maintenance-panel.tsx', 'utf8')
  const appr = readFileSync('src/components/panels/owner-approvals-panel.tsx', 'utf8')
  it('comms panel renders status + dry-run-safe send + log', () => {
    expect(comms).toContain('data-testid="comms-connect-panel"')
    expect(comms).toContain('data-testid="comms-channels"')
    expect(comms).toContain('/api/comms')
  })
  it('maintenance panel runs + shows dispatch status + Agent Activity', () => {
    expect(maint).toContain('data-testid="maintenance-panel"')
    expect(maint).toContain('data-testid="maintenance-dispatch-status"')
    expect(maint).toContain('agentId="maintenance"')
  })
  it('owner-approvals inbox renders pending + approve/deny/info', () => {
    expect(appr).toContain('data-testid="owner-approvals-panel"')
    expect(appr).toContain('data-testid="approvals-pending"')
    expect(appr).toContain("decide(a.id, 'approved')")
    expect(appr).toContain("decide(a.id, 'denied')")
    expect(appr).toContain("decide(a.id, 'info_requested')")
  })
})
