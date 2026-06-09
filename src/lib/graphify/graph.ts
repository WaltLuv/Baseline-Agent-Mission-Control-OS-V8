/**
 * Graphify — the Structural Brain Layer (brain layer #5, alongside Obsidian /
 * Notion / Pinecone / NotebookLM). Pure, deterministic codebase-knowledge-graph
 * engine: build a graph of files / routes / APIs / components / libs and their
 * import dependencies, then query it so agents locate the exact files they need
 * BEFORE scanning the repository.
 *
 * Pure + repeatable: `buildGraph` is deterministic given the same inputs;
 * `repoHash` lets callers cache + detect staleness (no full rebuild per query).
 * No secrets are ever ingested — the sidecar/generator excludes .env, secrets,
 * node_modules, etc. before calling buildGraph.
 */
export type NodeKind =
  | "file"
  | "route"
  | "api"
  | "component"
  | "lib"
  | "workflow"
  | "skill"
  | "agent";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  path: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: "imports";
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: number;
  repoHash: string;
}

/** One scanned source file + the module paths it imports (already resolved to repo-relative ids). */
export interface FileInput {
  path: string;
  imports: string[];
}

/** Classify a repo-relative path into a structural node kind. */
export function classify(path: string): NodeKind {
  if (/\/api\/|\/route\.tsx?$|\bapi\b/.test(path)) return "api";
  if (/\/routes?\//.test(path) || /\/app\/.*\/page\.tsx?$/.test(path)) return "route";
  if (/\/components?\//.test(path)) return "component";
  if (/workflow/i.test(path)) return "workflow";
  if (/skill/i.test(path)) return "skill";
  if (/agent/i.test(path)) return "agent";
  if (/\/lib\//.test(path)) return "lib";
  return "file";
}

function labelOf(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Deterministically build a knowledge graph from scanned files. */
export function buildGraph(files: FileInput[], now: number, repoHash: string): KnowledgeGraph {
  const nodes: GraphNode[] = files.map((f) => ({
    id: f.path,
    label: labelOf(f.path),
    kind: classify(f.path),
    path: f.path,
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  for (const f of files) {
    for (const imp of f.imports) {
      if (ids.has(imp) && imp !== f.path) edges.push({ from: f.path, to: imp, kind: "imports" });
    }
  }
  return { nodes, edges, generatedAt: now, repoHash };
}

/** Rank nodes relevant to a natural-language question (keyword + kind hints). */
export function queryGraph(graph: KnowledgeGraph, question: string): GraphNode[] {
  const q = question.toLowerCase();
  const terms = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const kindHint: NodeKind | null = /route|page/.test(q)
    ? "route"
    : /api|endpoint/.test(q)
      ? "api"
      : /workflow/.test(q)
        ? "workflow"
        : /skill/.test(q)
          ? "skill"
          : /agent/.test(q)
            ? "agent"
            : null;
  const scored = graph.nodes.map((n) => {
    const hay = n.path.toLowerCase();
    let score = terms.reduce((s, t) => s + (hay.includes(t) ? 2 : 0), 0);
    if (kindHint && n.kind === kindHint) score += 1;
    return { n, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((s) => s.n);
}

/** Direct dependencies (imports) + reverse deps (imported-by) for a node. */
export function getDependencies(
  graph: KnowledgeGraph,
  nodeId: string,
): { imports: string[]; importedBy: string[] } {
  return {
    imports: graph.edges.filter((e) => e.from === nodeId).map((e) => e.to),
    importedBy: graph.edges.filter((e) => e.to === nodeId).map((e) => e.from),
  };
}

/** "God nodes" — the most-depended-on modules (highest in-degree). */
export function godNodes(graph: KnowledgeGraph, topN = 8): { node: GraphNode; inDegree: number }[] {
  const deg = new Map<string, number>();
  for (const e of graph.edges) deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  return graph.nodes
    .map((node) => ({ node, inDegree: deg.get(node.id) ?? 0 }))
    .filter((x) => x.inDegree > 0)
    .sort((a, b) => b.inDegree - a.inDegree)
    .slice(0, topN);
}

export function graphHealth(graph: KnowledgeGraph) {
  const kinds: Record<string, number> = {};
  for (const n of graph.nodes) kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    generatedAt: graph.generatedAt,
    repoHash: graph.repoHash,
    kinds,
    godNodes: godNodes(graph, 8),
  };
}

/** Stale when the repo hash no longer matches the graph's hash (cheap check; no rebuild). */
export function isStale(graph: KnowledgeGraph, currentRepoHash: string): boolean {
  return graph.repoHash !== currentRepoHash;
}

/** Paths that must NEVER be ingested into the graph (no secrets / heavy dirs). */
export const GRAPH_EXCLUDE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "graphify-out",
  ".env",
  "secrets",
  "credentials",
  ".cache",
  "logs",
];

export function isExcluded(path: string): boolean {
  return (
    GRAPH_EXCLUDE.some((x) => path.includes(x)) || /\.env(\.|$)|\.key$|\.pem$|token/i.test(path)
  );
}
