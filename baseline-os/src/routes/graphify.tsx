import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, GitBranch, Boxes, FileCode } from "lucide-react";
import { MansaHeader } from "@/components/mansa-surface";
import { MANSA_V2 } from "@/lib/mansa-musa";
import {
  queryGraph,
  getDependencies,
  godNodes,
  type KnowledgeGraph,
  type GraphNode,
} from "@/lib/graphify/graph";

export const Route = createFileRoute("/graphify")({
  head: () => ({
    meta: [
      { title: "Graphify — Structural Brain · Baseline Automations" },
      {
        name: "description",
        content:
          "Codebase knowledge graph — the structural brain layer agents query before scanning the repo.",
      },
    ],
  }),
  component: GraphifyPage,
});

const TONE = "#22d3ee";

function GraphifyPage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [health, setHealth] = useState<{
    nodes: number;
    edges: number;
    generatedAt: number;
    godNodes: { id: string; inDegree: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GraphNode[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [importUrl, setImportUrl] = useState("");
  const [cloning, setCloning] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const cloneRepo = useCallback(async () => {
    if (!importUrl.trim() || cloning) return;
    setCloning(true);
    setImportMsg("Cloning + building graph…");
    try {
      const r = await fetch("/__graphify_clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setImportMsg(`Failed: ${j.error ?? "clone error"}`);
      } else {
        setGraph(j.graph);
        setHealth(j.health);
        setSelected(null);
        setResults([]);
        setImportMsg(
          `Mapped ${j.health.nodes} nodes / ${j.health.edges} edges from ${importUrl.trim()}`,
        );
      }
    } catch (e) {
      setImportMsg(`Error: ${(e as Error).message}`);
    }
    setCloning(false);
  }, [importUrl, cloning]);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/__graphify${refresh ? "?refresh=1" : ""}`);
      const j = await r.json();
      setGraph(j.graph);
      setHealth(j.health);
    } catch {
      setGraph(null);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const runQuery = useCallback(() => {
    if (!graph || !q.trim()) return;
    setResults(queryGraph(graph, q));
  }, [graph, q]);

  const kinds = useMemo(() => {
    if (!graph) return [] as string[];
    return ["all", ...Array.from(new Set(graph.nodes.map((n) => n.kind)))];
  }, [graph]);
  const explorer = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((n) => kindFilter === "all" || n.kind === kindFilter).slice(0, 200);
  }, [graph, kindFilter]);
  const deps = useMemo(
    () => (graph && selected ? getDependencies(graph, selected.id) : null),
    [graph, selected],
  );
  const gods = useMemo(() => (graph ? godNodes(graph, 8) : []), [graph]);

  return (
    <div className="min-h-screen bg-[#06080d] p-6 text-white" data-testid="graphify-page">
      <div className="mb-4 flex items-end justify-between">
        <MansaHeader
          title="Graphify · Structural Brain"
          subtitle="Brain layer #5 — the codebase knowledge graph agents query before scanning the repo."
          tone={MANSA_V2.surfaceTone.graphify}
        />
        <button
          onClick={() => {
            setBuilding(true);
            void load(true).finally(() => setBuilding(false));
          }}
          disabled={building}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
          data-testid="graphify-refresh"
        >
          <RefreshCw size={14} className={building ? "animate-spin" : ""} />{" "}
          {building ? "Rebuilding…" : "Regenerate graph"}
        </button>
      </div>

      {/* 1. Graph Dashboard (health) */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="graphify-dashboard">
        {[
          { label: "Nodes", value: health?.nodes ?? "—" },
          { label: "Edges", value: health?.edges ?? "—" },
          { label: "God nodes", value: gods.length },
          {
            label: "Last generated",
            value: health?.generatedAt ? new Date(health.generatedAt).toLocaleTimeString() : "—",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-2xl font-bold" style={{ color: TONE }}>
              {s.value}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/45">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Building graph…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 2/3. Query + Repo Import */}
          <div className="space-y-4">
            <div
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              data-testid="graphify-query"
            >
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/55">
                <Search size={12} /> Query graph
              </div>
              <div className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runQuery()}
                  placeholder="where is auth? routes for NotebookLM?"
                  className="flex-1 rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-xs outline-none"
                />
                <button
                  onClick={runQuery}
                  className="rounded-md px-3 text-xs font-semibold text-black"
                  style={{ background: TONE }}
                >
                  Ask
                </button>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px]">
                {results.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => setSelected(n)}
                      className="text-left text-cyan-300 hover:underline"
                    >
                      {n.path}
                    </button>{" "}
                    <span className="text-white/30">· {n.kind}</span>
                  </li>
                ))}
                {q && results.length === 0 && <li className="text-white/30">No matches.</li>}
              </ul>
            </div>

            <div
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              data-testid="graphify-import"
            >
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/55">
                <GitBranch size={12} /> Repo import
              </div>
              <div className="flex gap-2">
                <input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void cloneRepo()}
                  placeholder="https://github.com/owner/repo"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-xs outline-none"
                  data-testid="graphify-import-url"
                />
                <button
                  onClick={() => void cloneRepo()}
                  disabled={cloning}
                  className="rounded-md px-2.5 text-xs font-semibold text-black disabled:opacity-40"
                  style={{ background: TONE }}
                  data-testid="graphify-import-run"
                >
                  {cloning ? "…" : "Map"}
                </button>
              </div>
              {importMsg && (
                <p className="mt-1 text-[10px] text-cyan-300/80" data-testid="graphify-import-msg">
                  {importMsg}
                </p>
              )}
              <p className="mt-1 text-[10px] text-white/35">
                Clones the repo to a sandboxed temp dir (https-only, github/gitlab/bitbucket,
                shallow, secrets excluded), builds its graph, then deletes the clone.
              </p>
            </div>

            {/* God nodes / core modules */}
            <div
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              data-testid="graphify-godnodes"
            >
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/55">
                <Boxes size={12} /> Core modules (god nodes)
              </div>
              <ul className="space-y-0.5 text-[11px]">
                {gods.map((g) => (
                  <li key={g.node.id} className="flex justify-between">
                    <span className="truncate text-white/75">{g.node.path}</span>
                    <span className="text-white/40">{g.inDegree}↘</span>
                  </li>
                ))}
                {gods.length === 0 && (
                  <li className="text-white/30">No dependencies mapped yet.</li>
                )}
              </ul>
            </div>
          </div>

          {/* 4. Graph Explorer */}
          <div
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
            data-testid="graphify-explorer"
          >
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/55">
              <FileCode size={12} /> Explorer
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {kinds.map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className="rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: kindFilter === k ? `${TONE}22` : "rgba(255,255,255,0.05)",
                    color: kindFilter === k ? TONE : "rgba(255,255,255,0.5)",
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
            <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto text-[11px]">
              {explorer.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => setSelected(n)}
                    className={`w-full truncate text-left hover:text-cyan-300 ${selected?.id === n.id ? "text-cyan-400" : "text-white/70"}`}
                  >
                    {n.path}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 5. Dependency Viewer */}
          <div
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
            data-testid="graphify-deps"
          >
            <div className="mb-2 text-[11px] uppercase tracking-widest text-white/55">
              Dependencies
            </div>
            {!selected ? (
              <p className="text-[11px] text-white/30">
                Select a node to see what it imports + what depends on it.
              </p>
            ) : (
              <div className="space-y-3 text-[11px]">
                <div className="font-semibold text-cyan-300">{selected.path}</div>
                <div>
                  <div className="text-white/40">Imports ({deps?.imports.length ?? 0})</div>
                  <ul className="mt-0.5 space-y-0.5">
                    {(deps?.imports ?? []).slice(0, 20).map((d) => (
                      <li key={d} className="truncate text-white/65">
                        → {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-white/40">Imported by ({deps?.importedBy.length ?? 0})</div>
                  <ul className="mt-0.5 space-y-0.5">
                    {(deps?.importedBy ?? []).slice(0, 20).map((d) => (
                      <li key={d} className="truncate text-white/65">
                        ← {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
