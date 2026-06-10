#!/usr/bin/env node
/**
 * Workflow: final_audit — Pattern 3 (Adversarial Verification).
 *
 * Before any deliverable lands with a user or client, it MUST pass:
 *   1. Compliance Officer — adversarial check against llm-wiki + policy
 *      docs for legal / operational risk.
 *   2. CFO — adversarial check on pricing logic and margin guardrails.
 *
 * If either flags an issue, the deliverable is bounced back to the
 * originating agent for correction. The argument should be the path
 * (or short description) of the deliverable being audited.
 */
import { loadManifest, findAgent, header, phase, planAgent, recordPlan, getArg } from './_lib/harness.mjs'

const target = getArg()
const manifest = loadManifest()

header('Workflow · final_audit  (Pattern: adversarial_verification)')
console.log(`  target: "${target}"`)
const plan = []

phase('Phase 1 — Compliance Officer adversarial audit', () => {
  const co = findAgent(manifest, 'compliance_officer')
  plan.push({
    phase: 'compliance_audit',
    agent: co.id,
    cmd: planAgent(
      co,
      `Adversarially audit the deliverable at "${target}" against llm-wiki + policy docs. Look for: jurisdictional risk, missing disclosures, customer-data leakage, unauthorized claims, banned-concept references. Emit compliance_audit.md with verdict (PASS / BOUNCE) and per-line concerns. On BOUNCE, propose the minimum-cost fix.`,
      { expected_output: 'compliance_audit.md' },
    ),
  })
})

phase('Phase 2 — CFO adversarial audit', () => {
  const cfo = findAgent(manifest, 'cfo')
  plan.push({
    phase: 'financial_audit',
    agent: cfo.id,
    cmd: planAgent(
      cfo,
      `Adversarially audit pricing, margin, and credit-cost implications of "${target}". Confirm: no unit-economics violation, no discount stacking, no free-tier abuse vector, no missing Stripe metadata, no domain mismatch on success/cancel URLs. Emit financial_audit.md with verdict (PASS / BOUNCE) and per-line concerns.`,
      { expected_output: 'financial_audit.md' },
    ),
  })
})

phase('Phase 3 — Bounce or sign-off', () => {
  console.log('  If either audit returns BOUNCE → workflow halts and returns the deliverable to')
  console.log('  the originating agent for correction. Sign-off only on dual PASS.')
})

console.log('\n' + '─'.repeat(60))
console.log('Plan recorded to execution/workflow-runs.jsonl')
recordPlan('final_audit', plan)
