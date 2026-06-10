/**
 * Graphify runtime brain — PI Agent context injection (Phase 4.5).
 *
 * Turns Graphify from a tool into the shared structural brain: given a task,
 * PI Agent queries the graph, expands to dependencies, locates the exact files,
 * scores confidence, and produces a context block to INJECT into a coding/
 * runtime agent (Hermes, Claude Code, etc.) BEFORE it touches the repo.
 *
 * Loop:  task → PI Agent → Graphify → relevant slice → Hermes → execute.
 *
 * Pure + deterministic so it's testable and can run inside any runtime path.
 */
import { queryGraph, getDependencies, type KnowledgeGraph, type GraphNode } from "./graph";
import type { ReplayEvent } from "@/lib/replay";

export interface GraphContext {
  query: string;
  /** Directly relevant nodes (ranked). */
  nodes: GraphNode[];
  /** Files the agent should open (relevant nodes + their direct dependencies). */
  files: string[];
  /** Dependency edges discovered for the relevant nodes. */
  dependencies: { file: string; importedBy: string[]; imports: string[] }[];
  /** 0–1 confidence that the located slice covers the task. */
  confidence: number;
  /** Ready-to-prepend prompt block for the executing agent. */
  promptBlock: string;
  /** Replay events to record (graph_query → file_touched). */
  replayEvents: ReplayEvent[];
}

/** PI Agent: build the structural context slice for a task. */
export function buildGraphContext(
  graph: KnowledgeGraph | null,
  task: string,
  now = 0,
): GraphContext {
  if (!graph || !task.trim()) {
    return {
      query: task,
      nodes: [],
      files: [],
      dependencies: [],
      confidence: 0,
      promptBlock: "",
      replayEvents: [],
    };
  }
  const nodes = queryGraph(graph, task);
  const dependencies = nodes.slice(0, 6).map((n) => {
    const d = getDependencies(graph, n.id);
    return { file: n.path, importedBy: d.importedBy, imports: d.imports };
  });
  // Files = relevant nodes + their direct imports (the slice the agent needs).
  const fileSet = new Set<string>();
  for (const n of nodes) fileSet.add(n.path);
  for (const d of dependencies) for (const imp of d.imports) fileSet.add(imp);
  const files = [...fileSet].slice(0, 20);

  // Confidence: strong when we found several well-matched nodes; 0 when none.
  const confidence =
    nodes.length === 0 ? 0 : Math.min(1, Math.round((nodes.length / 8) * 100) / 100);

  const promptBlock = nodes.length
    ? `## Graphify structural context (query: "${task}")\n` +
      `The codebase knowledge graph located these files — open ONLY these unless insufficient:\n` +
      files.map((f) => `- ${f}`).join("\n") +
      `\n(Confidence ${(confidence * 100).toFixed(0)}%. Do not scan the whole repo.)`
    : "";

  const replayEvents: ReplayEvent[] = nodes.length
    ? [
        {
          ts: now,
          kind: "tool_call",
          agent: "PI Agent",
          label: `Graphify query: ${task}`.slice(0, 80),
          detail: `${nodes.length} nodes`,
        },
        {
          ts: now,
          kind: "file_touched",
          agent: "PI Agent",
          label: `located ${files.length} files`,
          detail: files.slice(0, 6).join(", "),
        },
      ]
    : [];

  return { query: task, nodes, files, dependencies, confidence, promptBlock, replayEvents };
}

/** Convenience for runtime paths: fetch the graph then build context. Returns null context on failure (caller falls back to a normal scan). */
export async function fetchGraphContext(
  task: string,
  endpoint = "/__graphify",
): Promise<GraphContext | null> {
  try {
    const r = await fetch(endpoint);
    const j = (await r.json()) as { graph?: KnowledgeGraph };
    if (!j.graph) return null;
    return buildGraphContext(j.graph, task);
  } catch {
    return null;
  }
}
