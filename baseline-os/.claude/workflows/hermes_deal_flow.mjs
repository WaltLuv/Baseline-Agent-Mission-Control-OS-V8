#!/usr/bin/env node
/**
 * Workflow: hermes_deal_flow — Patterns 2 + 5 (Hermes stack).
 *
 * Multi-million-dollar CRE deal analysis pipeline.
 *
 *   Walt initiates → Avon (territory map) + Stringer (capital stack)
 *   run in parallel → Lester (competitive intel) + Vito (reputational
 *   risk) grade them tournament-style → Rogers + Hobson synthesize the
 *   long-horizon institutional report.
 */
import { loadManifest, findAgent, header, phase, planAgent, recordPlan, getArg } from './_lib/harness.mjs'

const deal = getArg()
const manifest = loadManifest('hermes_manifest.json')

header('Workflow · hermes_deal_flow  (Patterns: fan_out_and_synthesize + tournament)')
console.log(`  deal: "${deal}"`)
const plan = []

phase('Phase 1 — Walt initiates the fan-out (handshake)', () => {
  console.log('  Walt → kick-off message recorded; downstream agents proceed in parallel.')
})

phase('Phase 2 — Avon + Stringer build parallel models', () => {
  for (const id of ['avon', 'stringer']) {
    const a = findAgent(manifest, id)
    plan.push({
      phase: 'fan_out',
      agent: a.id,
      cmd: planAgent(a,
        id === 'avon'
          ? `Run territory map calculations for the deal: "${deal}". Output: market_control_expansion.json — door count, route density, current market share, neighboring properties, expansion synergy score.`
          : `Run unit economics + capital stack for the deal: "${deal}". Output: capital_stack.json — debt service coverage, equity / debt split, breakeven occupancy, cap-rate sensitivity table.`,
        { expected_output: id === 'avon' ? 'market_control_expansion.json' : 'capital_stack.json' }),
    })
  }
})

phase('Phase 3 — Tournament: Lester + Vito grade head-to-head', () => {
  for (const id of ['lester_freamon', 'vito_corleone']) {
    const a = findAgent(manifest, id)
    plan.push({
      phase: 'tournament_grade',
      agent: a.id,
      cmd: planAgent(a,
        id === 'lester_freamon'
          ? `Inject competitive intelligence + money trails into Avon's and Stringer's reports. Trace seller, recent comparable transactions, lenders involved. Emit competitive_intel.md grading each report.`
          : `Evaluate reputational risks: counterparty history, neighborhood sentiment, brand-fit. Emit reputation_risk.md grading each report.`,
        { expected_output: id === 'lester_freamon' ? 'competitive_intel.md' : 'reputation_risk.md' }),
    })
  }
})

phase('Phase 4 — Rogers + Hobson synthesize the institutional report', () => {
  for (const id of ['john_rogers', 'mellody_hobson']) {
    const a = findAgent(manifest, id)
    plan.push({
      phase: 'synthesize',
      agent: a.id,
      cmd: planAgent(a,
        id === 'john_rogers'
          ? `Read all four upstream artifacts. Frame the deal on a long-horizon institutional timeline (10-yr+). Prioritize survival over 30-day optics. Emit long_horizon_view.md.`
          : `Translate Rogers's long-horizon view into a board-ready executive summary. Include: recommendation, key risks, decision boundaries, owner. Emit institutional_report.md.`,
        { expected_output: id === 'john_rogers' ? 'long_horizon_view.md' : 'institutional_report.md' }),
    })
  }
})

console.log('\n' + '─'.repeat(60))
console.log('Plan recorded to execution/workflow-runs.jsonl')
recordPlan('hermes_deal_flow', plan)
