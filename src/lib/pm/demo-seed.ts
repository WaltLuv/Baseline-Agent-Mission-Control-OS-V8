/**
 * Demo Mode (one-click) — seeds a realistic, populated property-management
 * workspace so a prospect understands the platform immediately: work orders,
 * a pending owner approval, decision history, communication log (dry-run), and
 * replay examples. Idempotent per workspace (clears prior demo rows first).
 * Honest: comms entries are dry-run unless real creds are present.
 */
import { getDatabase } from '@/lib/db'
import { executeMaintenance } from '@/lib/pm/maintenance'
import { decide } from '@/lib/pm/approvals'

export interface DemoScenario { request: string; property: string; unit: string; tenant: string; threshold: number }

export const DEMO_SCENARIOS: DemoScenario[] = [
  { request: 'Major water leak flooding the kitchen in unit 4B', property: 'Maple Court', unit: '4B', tenant: 'Jordan Reyes', threshold: 500 },   // → pending approval
  { request: 'Replace a burnt-out hallway light bulb', property: 'Maple Court', unit: '2A', tenant: 'Sam Cole', threshold: 500 },                 // → auto dispatch
  { request: 'Burst pipe emergency, water everywhere in 9C', property: 'Oak Ridge', unit: '9C', tenant: 'Priya Shah', threshold: 200 },           // → approve → dispatch
  { request: 'AC compressor failed, full HVAC replacement quoted', property: 'Pine Grove', unit: '1A', tenant: 'Lee Park', threshold: 200 },      // → deny
]

/** Wipe this workspace's demo rows so re-seeding is idempotent. */
export function clearDemo(ws: number): void {
  const db = getDatabase()
  for (const t of ['owner_approvals', 'work_orders', 'comms_log']) db.prepare(`DELETE FROM ${t} WHERE workspace_id = ?`).run(ws)
  db.prepare("DELETE FROM mission_replays WHERE workspace_id = ? AND trigger LIKE 'Maintenance:%'").run(ws)
}

export interface DemoResult { workOrders: number; pendingApprovals: number; decisions: number; messages: number; replays: number }

export async function seedDemo(ws: number, now: number): Promise<DemoResult> {
  clearDemo(ws)
  const db = getDatabase()
  let t = now
  // Map DemoScenario.threshold → executeMaintenance.costThreshold explicitly.
  // Demo seed NEVER hits live providers — forceDryRun guards every send.
  const run = (s: DemoScenario, extra: Record<string, unknown>, ts: number) =>
    executeMaintenance(ws, { request: s.request, property: s.property, unit: s.unit, tenant: s.tenant, costThreshold: s.threshold, forceDryRun: true, ...extra }, ts)
  const r0 = await run(DEMO_SCENARIOS[0], { tenantContact: '+15555550100', ownerContact: 'owner@maplecourt.example' }, (t += 1000))
  await run(DEMO_SCENARIOS[1], {}, (t += 1000))
  const r2 = await run(DEMO_SCENARIOS[2], { ownerContact: 'owner@oakridge.example' }, (t += 1000))
  if (r2.approvalId) await decide(ws, r2.approvalId, 'approved', 'owner@oakridge.example', 'Emergency — approved', (t += 100))
  const r3 = await run(DEMO_SCENARIOS[3], { ownerContact: 'owner@pinegrove.example' }, (t += 1000))
  if (r3.approvalId) await decide(ws, r3.approvalId, 'denied', 'owner@pinegrove.example', 'Get a second quote first', (t += 100))
  void r0
  const count = (sql: string) => (db.prepare(sql).get(ws) as { n: number }).n
  return {
    workOrders: count('SELECT COUNT(*) n FROM work_orders WHERE workspace_id = ?'),
    pendingApprovals: count("SELECT COUNT(*) n FROM owner_approvals WHERE workspace_id = ? AND status = 'pending'"),
    decisions: count("SELECT COUNT(*) n FROM owner_approvals WHERE workspace_id = ? AND status != 'pending'"),
    messages: count('SELECT COUNT(*) n FROM comms_log WHERE workspace_id = ?'),
    replays: count("SELECT COUNT(*) n FROM mission_replays WHERE workspace_id = ? AND trigger LIKE 'Maintenance:%'"),
  }
}

export function demoStatus(ws: number): DemoResult {
  const db = getDatabase()
  const count = (sql: string) => (db.prepare(sql).get(ws) as { n: number }).n
  return {
    workOrders: count('SELECT COUNT(*) n FROM work_orders WHERE workspace_id = ?'),
    pendingApprovals: count("SELECT COUNT(*) n FROM owner_approvals WHERE workspace_id = ? AND status = 'pending'"),
    decisions: count("SELECT COUNT(*) n FROM owner_approvals WHERE workspace_id = ? AND status != 'pending'"),
    messages: count('SELECT COUNT(*) n FROM comms_log WHERE workspace_id = ?'),
    replays: count("SELECT COUNT(*) n FROM mission_replays WHERE workspace_id = ? AND trigger LIKE 'Maintenance:%'"),
  }
}
