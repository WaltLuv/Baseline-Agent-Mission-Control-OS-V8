#!/usr/bin/env node
/**
 * Workflow: production_engine — Patterns 4 + 6.
 *   Pattern 4: Generate and Filter.
 *   Pattern 6: Loop Until Done.
 *
 * For marketing / UI tasks: Vanessa or Rio generates N variations; Dev
 * filters down to the top 3 on metric-tree fit.
 * For engineering tasks: Mason writes the code, then loops through
 * bug triage + code review until zero defects, before handing back.
 *
 * The workflow argument is a brief; if it starts with "code:" the
 * engineering loop runs; otherwise the marketing/UI generate+filter
 * runs (default: marketing).
 */
import { loadManifest, findAgent, header, phase, planAgent, recordPlan, getArg } from './_lib/harness.mjs'

const brief = getArg()
const manifest = loadManifest()
const isCode = /^code:/i.test(brief)
const cleanBrief = brief.replace(/^code:\s*/i, '')

header(`Workflow · production_engine  (Patterns: ${isCode ? 'loop_until_done' : 'generate_and_filter'})`)
console.log(`  brief: "${cleanBrief}"`)
const plan = []

if (!isCode) {
  phase('Phase 1 — Generator produces N variations', () => {
    // Default the generator to Vanessa unless the brief mentions UI.
    const generatorId = /\b(ui|design|screen|mockup|flow)\b/i.test(cleanBrief) ? 'rio_aoyama' : 'vanessa_holt'
    const gen = findAgent(manifest, generatorId)
    plan.push({
      phase: 'generate',
      agent: gen.id,
      cmd: planAgent(
        gen,
        `Produce 10 distinct variations for this brief, each a single block with a one-line rationale: "${cleanBrief}". Output: ${gen.owns_outputs?.[0] ?? gen.id + '_variations.md'}.`,
        { expected_output: gen.owns_outputs?.[0] },
      ),
    })
  })

  phase('Phase 2 — Dev filters to the top 3 on metric trees', () => {
    const dev = findAgent(manifest, 'dev_iyer')
    plan.push({
      phase: 'filter',
      agent: dev.id,
      cmd: planAgent(
        dev,
        `Read the variations file from Phase 1, score each against the historical metric trees (CTR, churn, activation, brand-fit), and emit the top 3 to data_filter_result.md with explicit numeric scores. Drop any that violate guardrails.`,
        { expected_output: 'data_filter_result.md' },
      ),
    })
  })
} else {
  phase('Phase 1 — Mason writes the change', () => {
    const mason = findAgent(manifest, 'mason_park')
    plan.push({
      phase: 'execute',
      agent: mason.id,
      cmd: planAgent(
        mason,
        `Implement the following engineering task. Write the code, run tests, run lint. Output a list of files changed and the verification commands. Task: "${cleanBrief}".`,
        { expected_output: 'code_review.md (after loop)' },
      ),
    })
  })

  phase('Phase 2 — Loop Until Done (bug triage + code review)', () => {
    const mason = findAgent(manifest, 'mason_park')
    plan.push({
      phase: 'loop_until_done',
      agent: mason.id,
      cmd: planAgent(
        mason,
        `Verify Phase 1: run the project's typecheck, lint, and test commands. If any fails, fix and rerun. Max iterations 5. Exit when zero defects. Emit final code_review.md with: files changed, commands run, exit codes, remaining warnings, sign-off.`,
        { expected_output: 'code_review.md' },
      ),
    })
  })
}

console.log('\n' + '─'.repeat(60))
console.log('Plan recorded to execution/workflow-runs.jsonl')
recordPlan('production_engine', plan)
