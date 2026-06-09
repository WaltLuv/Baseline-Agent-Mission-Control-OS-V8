/**
 * Graphify runtime injection (Mission Control) — server-side graph-first step.
 *
 * Closes the OS↔MC architectural mismatch: MC execution paths now consult the
 * Graphify knowledge graph and inject the located file slice BEFORE executing,
 * exactly like Baseline OS's /__agent_run. Reads the cached graph
 * (graphify-out/graph.json, built by /api/graphify). Non-fatal: if the graph is
 * absent, returns an empty context and the caller falls back to a normal run.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildGraphContext, type GraphContext } from '@/lib/graphify/context'
import type { KnowledgeGraph } from '@/lib/graphify/graph'

/** Build the graph-first context for a task (server-side, cache-backed). */
export async function prepareGraphContext(task: string): Promise<GraphContext> {
  if (!task || !task.trim()) return buildGraphContext(null, task)
  try {
    const raw = await readFile(join(process.cwd(), 'graphify-out', 'graph.json'), 'utf8')
    const graph = JSON.parse(raw) as KnowledgeGraph
    return buildGraphContext(graph, task, Date.now())
  } catch {
    return buildGraphContext(null, task)
  }
}

/** Prepend the located graph slice to a task prompt (graph-first prompt). */
export async function injectGraphFirst(prompt: string): Promise<{ prompt: string; ctx: GraphContext }> {
  const ctx = await prepareGraphContext(prompt)
  const enriched = ctx.promptBlock ? `${ctx.promptBlock}\n\n${prompt}` : prompt
  return { prompt: enriched, ctx }
}
