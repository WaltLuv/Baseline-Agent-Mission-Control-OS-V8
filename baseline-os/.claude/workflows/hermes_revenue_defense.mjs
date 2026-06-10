#!/usr/bin/env node
/**
 * Workflow: hermes_revenue_defense — Patterns 3 + 4 (Hermes stack).
 *
 * Pre-execution audit pipeline for contracts, pricing, renegotiations.
 *
 *   Don Draper (positioning) + Saul (objection-handling) each generate
 *   N variations → "Filter" keeps the strongest package → Beth + the
 *   Compliance Officer adversarially audit → CFO validates margins →
 *   only then does the package hit the client.
 *
 * Compliance Officer + CFO live in team_manifest.json; we cross-load.
 */
import { loadManifest, findAgent, header, phase, planAgent, recordPlan, getArg } from './_lib/harness.mjs'

const draftPath = getArg()
const hermes = loadManifest('hermes_manifest.json')
const team = loadManifest('team_manifest.json')

header('Workflow · hermes_revenue_defense  (Patterns: generate_and_filter + adversarial_verification)')
console.log(`  draft: "${draftPath}"`)
const plan = []

phase('Phase 1 — Don generates 5 positioning variants', () => {
  const don = findAgent(hermes, 'don_draper')
  plan.push({ phase: 'generate_positioning', agent: don.id, cmd: planAgent(don,
    `Generate 5 high-converting positioning copy variants for the contract / sales sequence at "${draftPath}". Each variant: headline, sub, three-bullet value frame. Output: positioning_variants.md.`,
    { expected_output: 'positioning_variants.md' }) })
})

phase('Phase 2 — Saul generates 5 aggressive close scripts', () => {
  const saul = findAgent(hermes, 'saul')
  plan.push({ phase: 'generate_close', agent: saul.id, cmd: planAgent(saul,
    `Generate 5 aggressive objection-handling close scripts for "${draftPath}". Each: trigger objection, response line, fallback offer. Output: close_scripts.md.`,
    { expected_output: 'close_scripts.md' }) })
})

phase('Phase 3 — Content filter picks the single strongest package', () => {
  console.log('  Filter rule: highest projected close rate × lowest concession exposure.')
  console.log('  Implementation: a downstream agent (e.g. Dev Iyer) reads both variant files')
  console.log('  and emits revenue_package.md. Wire when runtimes are registered.')
})

phase('Phase 4 — Beth + Compliance adversarially audit the package', () => {
  const beth = findAgent(hermes, 'beth')
  plan.push({ phase: 'revenue_defense_audit', agent: beth.id, cmd: planAgent(beth,
    `Adversarially stress-test revenue_package.md against owner concessions and historical renegotiation losses. Flag any clause that gives away >5% margin. Emit revenue_defense_audit.md with verdict PASS / BOUNCE.`,
    { expected_output: 'revenue_defense_audit.md' }) })

  const co = findAgent(team, 'compliance_officer')
  plan.push({ phase: 'compliance_audit', agent: co.id, cmd: planAgent(co,
    `Audit revenue_package.md for operational + legal risk: jurisdictional fit, disclosure completeness, regulatory exposure. Emit compliance_audit.md with PASS / BOUNCE.`,
    { expected_output: 'compliance_audit.md' }) })
})

phase('Phase 5 — CFO validates pricing margins', () => {
  const cfo = findAgent(team, 'cfo')
  plan.push({ phase: 'cfo_validate', agent: cfo.id, cmd: planAgent(cfo,
    `Validate every price and discount in revenue_package.md against unit-economics floor. Confirm: no Stripe domain mismatch, no missing metadata, no free-tier abuse vector. Emit cfo_validate.md with PASS / BOUNCE.`,
    { expected_output: 'cfo_validate.md' }) })
})

phase('Phase 6 — Release gate', () => {
  console.log('  Release only on triple PASS (Beth + Compliance + CFO). Single BOUNCE → halt + return.')
})

console.log('\n' + '─'.repeat(60))
console.log('Plan recorded to execution/workflow-runs.jsonl')
recordPlan('hermes_revenue_defense', plan)
