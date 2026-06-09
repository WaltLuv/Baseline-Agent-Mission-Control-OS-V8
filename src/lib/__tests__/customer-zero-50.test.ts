/**
 * Customer Zero — 50 maintenance requests through the REAL pipeline.
 * Reports pass/approval/dispatch/proof/replay rates + failures. Not a mock.
 */
import { describe, it, expect } from 'vitest'
import { executeMaintenance } from '@/lib/pm/maintenance'
import { decide, getApproval } from '@/lib/pm/approvals'
import { getDatabase } from '@/lib/db'

const WS = 50050
const REQUESTS = [
  'Water leaking under the kitchen sink', 'No heat in the unit', 'Burst pipe flooding the bathroom',
  'Replace a burnt-out hallway light bulb', 'AC not cooling', 'Garbage disposal jammed',
  'Front door lock broken', 'Electrical outlet sparking', 'Toilet running constantly',
  'Cosmetic paint touch-up needed', 'Dishwasher not draining', 'Window won\'t close',
  'Gas smell reported near the furnace', 'Ceiling fan wobbling', 'Hot water heater leaking',
]

describe('Customer Zero — 50-request run', () => {
  it('runs 50 maintenance requests and reports real rates', async () => {
    let triaged = 0, approvalsCreated = 0, autoDispatched = 0, approved = 0, denied = 0, dispatched = 0, proofs = 0, replays = 0, failures = 0
    const byUrgency: Record<string, number> = {}
    for (let i = 0; i < 50; i++) {
      const req = REQUESTS[i % REQUESTS.length]
      // Unique high `now` base so this run's ids never collide with other test files.
      const base = 5_000_000_000 + i * 1000
      try {
        const res = await executeMaintenance(WS, { request: req, property: `Prop${i % 5}`, unit: `${i}A`, tenant: `Tenant${i}`, costThreshold: 400 }, base)
        triaged++
        if (res.replayId) replays++
        if (res.workOrder?.id) proofs++ // each WO is a proof package (work order + comms log + replay)
        byUrgency[res.workOrder?.urgency] = (byUrgency[res.workOrder?.urgency] ?? 0) + 1
        if (res.approvalId) {
          approvalsCreated++
          // Owner approves ~70%, denies ~30% deterministically by index.
          const decision = i % 10 < 7 ? 'approved' : 'denied'
          const d = await decide(WS, res.approvalId, decision as any, 'owner@demo', '', base + 500)
          if (decision === 'approved') { approved++; if (d.dispatch?.status?.includes('dispatch')) dispatched++ }
          else denied++
        } else if (res.dispatch?.status?.includes('dispatch')) {
          autoDispatched++; dispatched++
        }
      } catch { failures++ }
    }
    const db = getDatabase()
    const woCount = (db.prepare('SELECT COUNT(*) n FROM work_orders WHERE workspace_id = ?').get(WS) as any).n
    const aprCount = (db.prepare('SELECT COUNT(*) n FROM owner_approvals WHERE workspace_id = ?').get(WS) as any).n
    const replayCount = (db.prepare("SELECT COUNT(*) n FROM mission_replays WHERE workspace_id = ? AND trigger LIKE 'Maintenance:%'").get(WS) as any).n

    console.log('\n=== CUSTOMER ZERO · 50-REQUEST REPORT ===')
    console.log(`Triaged:            ${triaged}/50`)
    console.log(`Urgency mix:        ${JSON.stringify(byUrgency)}`)
    console.log(`Approvals created:  ${approvalsCreated} (est ≥ $400 threshold)`)
    console.log(`Auto-dispatched:    ${autoDispatched} (under threshold)`)
    console.log(`Owner approved:     ${approved}`)
    console.log(`Owner denied:       ${denied}`)
    console.log(`Total dispatched:   ${dispatched} (dry_run_dispatch — no live comms creds)`)
    console.log(`Work orders (DB):   ${woCount}`)
    console.log(`Approvals (DB):     ${aprCount}`)
    console.log(`Replays (DB):       ${replayCount}`)
    console.log(`Failures:           ${failures}`)
    console.log(`Pass rate:          ${(((50 - failures) / 50) * 100).toFixed(0)}%`)
    console.log('=========================================\n')

    expect(triaged).toBe(50)
    expect(failures).toBe(0)
    expect(woCount).toBe(50)
    expect(replayCount).toBe(50)
    expect(approved + denied).toBe(approvalsCreated)
  })
})
