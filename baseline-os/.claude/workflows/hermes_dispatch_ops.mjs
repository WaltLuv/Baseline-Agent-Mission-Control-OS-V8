#!/usr/bin/env node
/**
 * Workflow: hermes_dispatch_ops — Patterns 1 + 6 (Hermes stack).
 *
 * Front-desk → field-execution pipeline for property-management /
 * maintenance incidents.
 *
 *   Michael (intake)  → Tony (structurer) → Chris (executor) →
 *   Mike (field-verify, looped) → Gus (QC sign-off).
 */
import { loadManifest, findAgent, header, phase, planAgent, recordPlan, getArg } from './_lib/harness.mjs'

const incident = getArg()
const manifest = loadManifest('hermes_manifest.json')

header('Workflow · hermes_dispatch_ops  (Patterns: classify_and_act + loop_until_done)')
console.log(`  incident: "${incident}"`)
const plan = []

phase('Phase 1 — Michael classifies + extracts context', () => {
  const michael = findAgent(manifest, 'michael')
  plan.push({
    phase: 'classify',
    agent: michael.id,
    cmd: planAgent(michael,
      `Read this inbound incident, classify it as real_estate | maintenance | other, extract entities (property, tenant, urgency, photos referenced), and capture to Obsidian. Output: { route, context }. Incident: "${incident}"`,
      { expected_output: 'intake_classification.json' }),
  })
})

phase('Phase 2 — Tony structures into a formal task payload', () => {
  const tony = findAgent(manifest, 'tony')
  plan.push({
    phase: 'structure',
    agent: tony.id,
    cmd: planAgent(tony,
      `Convert the classified intake into a formal task_payload.json matching the Day-6 work-order schema. Include: property_id, work_order_type, priority, vendor_preference, photos_required, sla_hours.`,
      { expected_output: 'task_payload.json' }),
  })
})

phase('Phase 3 — Chris executes the work order', () => {
  const chris = findAgent(manifest, 'chris')
  plan.push({
    phase: 'execute',
    agent: chris.id,
    cmd: planAgent(chris,
      `Run the work order via day6-workorder-flow-script. Dispatch vendor, update WO status, record proof-of-work hash. Emit work_order_proof.json on completion.`,
      { expected_output: 'work_order_proof.json' }),
  })
})

phase('Phase 4 — Mike field-verifies (Loop Until Done)', () => {
  const mike = findAgent(manifest, 'mike')
  plan.push({
    phase: 'verify_loop',
    agent: mike.id,
    cmd: planAgent(mike,
      `Field-verify the executed work order against ground truth: geotag, before/after photos, vendor sign-off. If any check fails, return ADJUSTMENT_REQUIRED with a precise correction list and loop back to Chris. Max 5 iterations. Emit field_verification.json on PASS.`,
      { expected_output: 'field_verification.json' }),
  })
})

phase('Phase 5 — Gus signs off on QC + SLA', () => {
  const gus = findAgent(manifest, 'gus')
  plan.push({
    phase: 'qc_signoff',
    agent: gus.id,
    cmd: planAgent(gus,
      `Confirm the verified work order satisfies the SLA (hours, photo count, vendor rating). Emit qc_signoff.md with timestamps and the final sign-off line. Only sign-off after Mike's PASS.`,
      { expected_output: 'qc_signoff.md' }),
  })
})

console.log('\n' + '─'.repeat(60))
console.log('Plan recorded to execution/workflow-runs.jsonl')
recordPlan('hermes_dispatch_ops', plan)
