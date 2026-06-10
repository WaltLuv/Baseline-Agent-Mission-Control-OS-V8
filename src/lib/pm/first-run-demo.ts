/**
 * First-run demo provisioning — the default onboarding experience.
 *
 * Every new signup lands in a Property Management demo workspace that is
 * ALREADY RUNNING: live work orders, vendor dispatches, owner approvals
 * (pending + decided), replay history, proof/comms entries, and a named
 * AI workforce mid-operation. The goal is comprehension in the first 30
 * seconds — "this business is already running", not "configure your
 * workspace".
 *
 * This is onboarding/conversion wiring over EXISTING systems only:
 *   - installWorkforceTemplate('property-management') — 6 AI employees +
 *     12 starter workflows (Phase 5 installer, idempotent).
 *   - seedDemo() — 4 realistic maintenance scenarios → work_orders,
 *     owner_approvals, comms_log (dry-run proof), mission_replays
 *     (existing PM Demo Mode, idempotent).
 *   - A status/last_activity pass over the installed personas so the
 *     workforce reads as mid-operation instead of offline.
 *
 * PM is the default because it is the clearest demonstration of business
 * execution — not because Mission Control is limited to property
 * management. Best-effort: provisioning failures NEVER fail the signup.
 */

import { getDatabase } from '@/lib/db'
import { installWorkforceTemplate } from '@/lib/baseline-os/workforce-templates/install'
import { seedDemo } from '@/lib/pm/demo-seed'
import { logger } from '@/lib/logger'

/** Live "currently working on" lines for the 6 PM personas, keyed by the
 *  installer's content_hash fingerprint. Mirrors the seeded demo scenarios
 *  (Maple Court leak, Oak Ridge burst pipe, Pine Grove HVAC). */
const PERSONA_LIVE_STATE: Array<{ fingerprint: string; status: string; activity: string }> = [
  {
    fingerprint: 'property-management::marcus-doyle-maintenance-dispatch',
    status: 'busy',
    activity: 'Triaging maintenance intake — water leak at Maple Court 4B',
  },
  {
    fingerprint: 'property-management::vince-cardella-vendor-coordinator',
    status: 'busy',
    activity: 'Dispatching plumber to Oak Ridge 9C (burst pipe, emergency)',
  },
  {
    fingerprint: 'property-management::owen-whitfield-owner-relations',
    status: 'idle',
    activity: 'Owner approval sent for $640 leak repair — awaiting decision',
  },
  {
    fingerprint: 'property-management::tessa-reyes-tenant-relations',
    status: 'busy',
    activity: 'Updating tenant Jordan Reyes on repair ETA',
  },
  {
    fingerprint: 'property-management::rena-patel-leasing',
    status: 'idle',
    activity: 'Lease renewal cadence queued — 3 units in the 60/30/14 window',
  },
  {
    fingerprint: 'property-management::quinn-hartley-inspections',
    status: 'idle',
    activity: 'Quarterly inspection scheduling — next window Friday',
  },
]

export interface FirstRunDemoResult {
  workforce_installed: boolean
  demo_seeded: boolean
}

/**
 * Provision the PM demo workspace for a brand-new signup. Idempotent and
 * best-effort — every step is independently guarded so a partial failure
 * still leaves the user with as much of the live demo as possible.
 */
export async function provisionFirstRunDemo(
  workspaceId: number,
  actor: string,
): Promise<FirstRunDemoResult> {
  const result: FirstRunDemoResult = { workforce_installed: false, demo_seeded: false }

  // 1. AI workforce: 6 named PM employees + 12 starter workflows.
  try {
    const install = installWorkforceTemplate(workspaceId, 'property-management', actor)
    result.workforce_installed = install.status === 'installed' || install.status === 'already_installed'
  } catch (err) {
    logger.warn({ err, workspaceId }, 'first-run demo: workforce install failed')
  }

  // 2. Live operations: work orders, vendor matches, owner approvals,
  //    replay history, proof/comms entries (always dry-run — no real sends).
  try {
    await seedDemo(workspaceId, Date.now())
    result.demo_seeded = true
  } catch (err) {
    logger.warn({ err, workspaceId }, 'first-run demo: PM demo seed failed')
  }

  // 3. Bring the workforce to life: realistic status + "currently working on"
  //    lines that match the seeded scenarios (the installer defaults agents
  //    to offline with a numeric last_activity).
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const update = db.prepare(
      `UPDATE agents SET status = ?, last_activity = ?, last_seen = ?, updated_at = ?
       WHERE workspace_id = ? AND source = 'workforce-template:property-management' AND content_hash = ?`,
    )
    for (const p of PERSONA_LIVE_STATE) {
      update.run(p.status, p.activity, now, now, workspaceId, p.fingerprint)
    }
  } catch (err) {
    logger.warn({ err, workspaceId }, 'first-run demo: persona live-state pass failed')
  }

  return result
}
