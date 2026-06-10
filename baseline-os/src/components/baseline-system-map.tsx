/**
 * Baseline OS — home overview "Structural Brain + System Map" block, in the
 * Mansa Musa V2 HUD language (gold hairline glass, Sankoré crest, knowledge-
 * network motif). Surfaces Graphify prominently + a What's-Installed map so the
 * operator sees the whole owned system at a glance. Visual + discovery only.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MansaSurface } from "@/components/mansa-surface";
import { MaliGeometry } from "@/components/mansa-musa-motif";
import { MANSA_V2, MANSA_PALETTE } from "@/lib/mansa-musa";

const SYSTEM = [
  { name: "Graphify", to: "/graphify", note: "Structural brain", kind: "core" },
  { name: "Knowledge OS", to: "/memory", note: "Brain layers", kind: "core" },
  { name: "NotebookLM", to: "/notebook", note: "Synthesis", kind: "ext" },
  { name: "Obsidian", to: "/notebook", note: "Operator vault", kind: "ext" },
  { name: "Notion", to: "/notion", note: "Business", kind: "ext" },
  { name: "Pinecone", to: "/pinecone", note: "Vector memory", kind: "ext" },
  { name: "PI Agent", to: "/agents/ruflo", note: "Memory orchestrator", kind: "core" },
  { name: "Hermes", to: "/agents/hermes", note: "Execution operator", kind: "core" },
  { name: "Maestro", to: "/maestro", note: "Orchestration HQ", kind: "core" },
  { name: "Agent Factory", to: "/personas", note: "Build agents", kind: "core" },
  { name: "Video Studio", to: "/video-studio", note: "Creative OS", kind: "core" },
  { name: "HyperEdit", to: "/hyperedit", note: "Compose engine", kind: "core" },
  { name: "Higgsfield", to: "/higgsfield", note: "Generative media", kind: "ext" },
  { name: "Creative OS", to: "/agents/claude-code-studio", note: "Pipelines", kind: "core" },
  { name: "Workforce Replay", to: "/replay", note: "Screen-recording", kind: "core" },
  { name: "Self-Driving Kanban", to: "/kanban-gallery", note: "Drive → ship", kind: "core" },
  { name: "Flight Deck", to: "/flight-deck", note: "Control tower", kind: "core" },
  { name: "Slim Charles", to: "/agents/slim-charles", note: "Voice / Oracle", kind: "core" },
] as const;

export function BaselineSystemMap() {
  const [graph, setGraph] = useState<{ nodes: number; edges: number; generatedAt: number } | null>(
    null,
  );
  useEffect(() => {
    let cancel = false;
    fetch("/__graphify")
      .then((r) => r.json())
      .then((j: { health?: { nodes: number; edges: number; generatedAt: number } }) => {
        if (!cancel && j.health) setGraph(j.health);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <section className="mb-12" data-testid="baseline-system-map">
      {/* Premium Mansa Musa hero band — the page leads with the empire identity. */}
      <div
        className="relative mb-5 overflow-hidden rounded-2xl border p-7"
        style={{
          borderColor: MANSA_V2.glassBorder,
          background: `radial-gradient(120% 140% at 0% 0%, ${MANSA_PALETTE.gold}1f, transparent 55%), linear-gradient(135deg, rgba(10,9,22,0.9), rgba(20,16,8,0.85))`,
        }}
        data-testid="mansa-hero"
      >
        <div aria-hidden className="absolute -right-6 -top-6 opacity-[0.18]">
          <MaliGeometry size={180} />
        </div>
        <div className="relative">
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em]" style={{ color: MANSA_PALETTE.gold }}>
            Baseline · AI Workforce Operating System
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: MANSA_PALETTE.parchment }}>
            Baseline OS · Command Center
          </h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: MANSA_PALETTE.parchmentMute }}>
            Your owned AI operating system. Structural brain, workforce, and creative stack —
            governed from one bridge between you and every agent.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest" style={{ color: MANSA_V2.hudCyan }}>
            <span className="rounded-full border px-2.5 py-1" style={{ borderColor: MANSA_V2.glassBorder }}>Structural brain</span>
            <span className="rounded-full border px-2.5 py-1" style={{ borderColor: MANSA_V2.glassBorder }}>Workforce</span>
            <span className="rounded-full border px-2.5 py-1" style={{ borderColor: MANSA_V2.glassBorder }}>Operator-owned</span>
          </div>
        </div>
      </div>

      {/* Structural Brain — Graphify, front and center */}
      <MansaSurface tone={MANSA_V2.hudCyan} className="mb-4" testid="home-graphify-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MaliGeometry size={40} />
            <div>
              <div className="text-sm font-bold" style={{ color: MANSA_PALETTE.parchment }}>
                Graphify · Structural Brain (layer #5)
              </div>
              <div className="text-[11px] text-white/55">
                The codebase knowledge graph your agents query before scanning the repo.
              </div>
              <div className="mt-1 text-[11px] text-white/70">
                {graph ? (
                  <>
                    Brain online · <span style={{ color: MANSA_V2.hudCyan }}>{graph.nodes}</span>{" "}
                    nodes / <span style={{ color: MANSA_V2.hudCyan }}>{graph.edges}</span> edges ·
                    last built{" "}
                    {graph.generatedAt ? new Date(graph.generatedAt).toLocaleTimeString() : "—"}
                  </>
                ) : (
                  "Generating graph…"
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              to="/graphify"
              data-testid="home-graphify-open"
              className="rounded-lg px-3 py-1.5 text-center text-xs font-semibold text-black"
              style={{ background: MANSA_PALETTE.gold }}
            >
              Open Graphify
            </Link>
            <Link
              to="/graphify"
              className="rounded-lg border px-3 py-1.5 text-center text-xs"
              style={{ borderColor: MANSA_V2.glassBorder, color: MANSA_PALETTE.parchment }}
            >
              Query the brain
            </Link>
          </div>
        </div>
      </MansaSurface>

      {/* System Map — What's installed */}
      <MansaSurface testid="home-system-map">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-white/55">
          System map · what's installed
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {SYSTEM.map((s) => (
            <Link
              key={s.name}
              to={s.to}
              data-testid={`sysmap-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              className="group rounded-lg border bg-black/20 p-2.5 transition-colors hover:bg-white/5"
              style={{ borderColor: MANSA_V2.glassBorder }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-white/85">{s.name}</span>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: s.kind === "core" ? "#34d399" : MANSA_PALETTE.gold,
                    boxShadow: `0 0 6px ${s.kind === "core" ? "#34d399" : MANSA_PALETTE.gold}`,
                  }}
                />
              </div>
              <div className="text-[10px] text-white/45">{s.note}</div>
              <div className="mt-1 text-[10px]" style={{ color: MANSA_V2.hudCyan }}>
                {s.kind === "core" ? "Ready · open ↗" : "Open · connect if needed ↗"}
              </div>
            </Link>
          ))}
        </div>
      </MansaSurface>
    </section>
  );
}
