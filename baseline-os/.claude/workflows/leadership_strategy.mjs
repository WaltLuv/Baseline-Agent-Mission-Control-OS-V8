#!/usr/bin/env node
/**
 * Workflow: leadership_strategy — Patterns 2 + 5.
 *   Pattern 2: Fan Out and Synthesize.
 *   Pattern 5: Tournament.
 *
 * Sloane (Chief of Staff) fans out parallel sub-tasks to Vanessa
 * (Marketing), Rio (Design), and Dev (Data). Dev then runs a tournament
 * to grade Vanessa & Rio's proposals against historical metric trees.
 * Sloane synthesizes the winning outputs into a single Board Deck /
 * Weekly Review.
 */
import { loadManifest, findAgent, header, phase, planAgent, recordPlan, getArg } from './_lib/harness.mjs'

const goal = getArg()
const manifest = loadManifest()

header('Workflow · leadership_strategy  (Patterns: fan_out_and_synthesize + tournament)')
console.log(`  goal: "${goal}"`)
const plan = []

phase('Phase 1 — Sloane fans out parallel proposals', () => {
  for (const id of ['vanessa_holt', 'rio_aoyama', 'dev_iyer']) {
    const a = findAgent(manifest, id)
    plan.push({
      phase: 'fan_out',
      agent: a.id,
      cmd: planAgent(
        a,
        `For the goal: "${goal}", produce a strategic proposal from your domain (${a.domain}). Cite assumptions and what would change if churn / margin / brand-fit metrics fell 20%. Output: ${a.owns_outputs?.[0] ?? a.id + '_proposal.md'}.`,
        { expected_output: a.owns_outputs?.[0] },
      ),
    })
  }
})

phase('Phase 2 — Dev runs the tournament (grading)', () => {
  const dev = findAgent(manifest, 'dev_iyer')
  plan.push({
    phase: 'tournament_grade',
    agent: dev.id,
    cmd: planAgent(
      dev,
      `Grade Vanessa's proposal and Rio's proposal head-to-head against churn / cohort / activation metric trees. Output a ranked list with explicit numeric scores in tournament_rankings.md. The winner gets handed back to Sloane for synthesis.`,
      { expected_output: 'tournament_rankings.md' },
    ),
  })
})

phase('Phase 3 — Sloane synthesizes the winning proposal', () => {
  const sloane = findAgent(manifest, 'sloane_kim')
  plan.push({
    phase: 'synthesize',
    agent: sloane.id,
    cmd: planAgent(
      sloane,
      `Read tournament_rankings.md, take the winner, and synthesize a single cohesive Board Deck (board_deck.md) that includes: goal, chosen approach with reason, decision metrics, owner names + dates, fallback path. Cite the proposal files this synthesis derives from.`,
      { expected_output: 'board_deck.md' },
    ),
  })
})

console.log('\n' + '─'.repeat(60))
console.log('Plan recorded to execution/workflow-runs.jsonl')
recordPlan('leadership_strategy', plan)
