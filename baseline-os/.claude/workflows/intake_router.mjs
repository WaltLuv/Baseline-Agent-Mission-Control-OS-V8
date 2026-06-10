#!/usr/bin/env node
/**
 * Workflow: intake_router — Pattern 1 (Classify and Act).
 *
 * The Receptionist reads inbound text, captures it to Obsidian, and
 * routes to one of: Dispatcher (work orders), Account Manager (client
 * updates), Marco (sales), Pia (support). The Receptionist NEVER
 * executes the task itself — only classifies and routes.
 */
import { loadManifest, findAgent, header, phase, planAgent, recordPlan, getArg } from './_lib/harness.mjs'

const inbound = getArg()
const manifest = loadManifest()

header('Workflow · intake_router  (Pattern: classify_and_act)')
console.log(`  inbound: "${inbound}"`)

const plan = []

phase('Phase 1 — Receptionist classifies', () => {
  const receptionist = findAgent(manifest, 'receptionist')
  plan.push({
    phase: 'classify',
    agent: receptionist.id,
    cmd: planAgent(
      receptionist,
      `Classify this inbound message into exactly one of: work_order | client_update | sales | support. Also extract any context (sender, urgency, referenced asset). Output JSON: { "route": ..., "context": {...} }. Capture to Obsidian. Inbound: "${inbound}"`,
      { expected_output: 'intake_classification.json' },
    ),
  })
})

phase('Phase 2 — Downstream specialist executes (one of)', () => {
  const targets = ['dispatcher', 'account_manager', 'marco_deluca', 'pia_sandoval']
  for (const id of targets) {
    const a = findAgent(manifest, id)
    plan.push({
      phase: 'route_candidate',
      agent: a.id,
      cmd: planAgent(
        a,
        `If the Receptionist's classification routes to ${a.id}, take ownership of the inbound, ${
          a.id === 'dispatcher' ? 'generate a structured work order' :
          a.id === 'account_manager' ? 'draft a client status update' :
          a.id === 'marco_deluca' ? 'enqueue an outbound sales response' :
          'open a support ticket'
        }, and emit ${a.owns_outputs?.[0] ?? 'a deliverable.md'}. If the route does not match this agent, exit silently.`,
        { expected_output: a.owns_outputs?.[0] },
      ),
    })
  }
})

console.log('\n' + '─'.repeat(60))
console.log('Plan recorded to execution/workflow-runs.jsonl')
recordPlan('intake_router', plan)
