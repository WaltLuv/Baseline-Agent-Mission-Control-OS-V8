/**
 * Dynamic Workflow Harness — shared library.
 *
 * Honest contract:
 *   - This harness DEFINES the routing plan for a workflow pattern and
 *     prints the per-phase agent assignments.
 *   - It does NOT fake agent execution. Where the underlying runtime is
 *     not yet connected, each agent step prints `[setup-needed: <agent>]`
 *     followed by the exact command an operator would run to connect it.
 *   - Real dispatch happens via the `mc` CLI (`mc agent spawn ...`) or
 *     direct Claude Code invocation. The harness emits a plan and a
 *     proposed command list; it never claims success without an actual
 *     run.
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKFLOW_DIR = resolve(HERE, '..')

const COLOR = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m',
}
const c = (k, s) => `${COLOR[k] || ''}${s}${COLOR.reset}`

export function loadManifest(name = 'team_manifest.json') {
  const p = join(WORKFLOW_DIR, name)
  if (!existsSync(p)) throw new Error(`manifest not found: ${p}`)
  return JSON.parse(readFileSync(p, 'utf8'))
}

export function findAgent(manifest, id) {
  const a = manifest.agents.find((x) => x.id === id)
  if (!a) throw new Error(`agent not in manifest: ${id}`)
  return a
}

export function header(title) {
  console.log(c('bold', title))
  console.log(c('gray', '─'.repeat(Math.max(60, title.length + 6))))
}

export function phase(label, body) {
  console.log(`\n${c('magenta', '▶ ' + label)}`)
  body()
}

/**
 * Print an honest plan for a single agent invocation. Returns the
 * proposed CLI command an operator could run today.
 */
export function planAgent(agent, prompt, opts = {}) {
  const runtimeReady = isRuntimeReady(agent)
  const tag = runtimeReady ? c('green', '● ready') : c('yellow', '⚑ setup-needed')
  const inputLine = prompt.length > 70 ? prompt.slice(0, 67) + '…' : prompt
  console.log(
    `  ${tag}  ${c('cyan', agent.name)}  ${c('dim', '(' + agent.primary_model + ')')}` +
      `\n    input    : ${c('dim', inputLine)}` +
      `\n    domain   : ${c('dim', agent.domain)}` +
      `\n    tools    : ${c('dim', agent.tools.join(', '))}`,
  )

  const cmd = `mc agent spawn --agent ${agent.id} --model ${agent.primary_model} --prompt "${escapeForCli(prompt)}"`
  if (runtimeReady) {
    console.log(`    dispatch : ${c('green', cmd)}`)
  } else {
    console.log(`    dispatch : ${c('yellow', cmd)}`)
    console.log(`    ${c('yellow', '[setup-needed]')} register ${agent.id} runtime first:`)
    console.log(`               mc runtime register --agent ${agent.id} --model ${agent.primary_model}`)
  }
  if (opts.expected_output) {
    console.log(`    output   : ${c('dim', opts.expected_output)}`)
  }
  return cmd
}

/**
 * For now, no runtime is wired by default. When `mc runtime list` later
 * exposes a query API, this becomes a real check. Until then, we don't
 * pretend. This keeps the no-fake-state rule intact.
 */
function isRuntimeReady(_agent) {
  return false
}

function escapeForCli(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function recordPlan(workflowName, plan) {
  const logDir = resolve(WORKFLOW_DIR, '..', '..', 'execution')
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
  const line = JSON.stringify({ ts: new Date().toISOString(), workflow: workflowName, plan }) + '\n'
  appendFileSync(join(logDir, 'workflow-runs.jsonl'), line)
}

export function getArg() {
  const a = process.argv.slice(2).join(' ').trim()
  if (!a) {
    console.error(c('red', 'usage: node <workflow>.mjs "<input prompt>"'))
    process.exit(64)
  }
  return a
}
