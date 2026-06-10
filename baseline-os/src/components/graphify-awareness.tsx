/**
 * Graphify awareness — the structural-brain "nervous system" indicator that
 * appears across Baseline OS surfaces (Hermes, PI Agent, Knowledge OS, Agent
 * Factory, Maestro, Flight Deck). Makes Graphify feel like the OS brain, not a
 * separate tool. Reads /__graphify; honest "offline" when the graph isn't built.
 *
 * Also exports <OperatorCrest> — the shared, no-fake-art identity mark (initials
 * on a Mansa gold/indigo Sankoré crest) used by the agent identity system.
 */
import { useEffect, useState } from "react";
import { MANSA_PALETTE, MANSA_V2 } from "@/lib/mansa-musa";

interface GraphHealth { nodes: number; edges: number; generatedAt: number }

export function GraphifyAwareness({ context, compact = false }: { context?: string; compact?: boolean }) {
  const [g, setG] = useState<GraphHealth | null>(null);
  const [located, setLocated] = useState<number | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch("/__graphify")
      .then((r) => r.json())
      .then((j: { health?: GraphHealth }) => { if (!cancel && j.health) setG(j.health); })
      .catch(() => {});
    // If a context is given, ask the graph what it locates (structural context).
    if (context) {
      fetch(`/__graphify?q=${encodeURIComponent(context)}`)
        .then((r) => r.json())
        .then((j: { results?: unknown[] }) => { if (!cancel) setLocated(j.results?.length ?? 0); })
        .catch(() => {});
    }
    return () => { cancel = true; };
  }, [context]);

  const connected = !!g;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-1.5 text-[10px]"
      style={{ borderColor: MANSA_V2.glassBorder, background: MANSA_V2.glass }}
      data-testid="graphify-awareness"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-widest" style={{ color: connected ? MANSA_V2.hudCyan : MANSA_PALETTE.parchmentMute }}>
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: connected ? MANSA_V2.hudCyan : "#6b7280", boxShadow: connected ? `0 0 6px ${MANSA_V2.hudCyan}` : "none" }} />
        Graphify {connected ? "· brain connected" : "· offline (generate graph)"}
      </span>
      {connected && (
        <>
          <span className="text-white/55">{g!.nodes} nodes</span>
          <span className="text-white/55">{g!.edges} edges</span>
          {!compact && <span className="text-white/40">last sync {g!.generatedAt ? new Date(g!.generatedAt).toLocaleTimeString() : "—"}</span>}
          {context && located != null && <span style={{ color: MANSA_PALETTE.goldBright }}>{located} files located</span>}
          <span className="rounded px-1.5 py-0.5" style={{ background: "rgba(67,229,255,0.12)", color: MANSA_V2.hudCyan }}>structural context active</span>
        </>
      )}
    </div>
  );
}

/**
 * Shared agent identity header — drop-in for custom agent pages that don't use
 * <AgentActivity>. Gives every surface the same Baseline OS treatment: crest +
 * name + provider + live status + Graphify awareness. Slim Charles is exempt
 * (intentionally custom).
 */
export function AgentIdentityHeader({
  name,
  provider,
  status = "online",
  context,
}: {
  name: string;
  provider?: string;
  status?: string;
  context?: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: MANSA_V2.glassBorder, background: MANSA_V2.glass }}
      data-testid="agent-identity-header"
    >
      <OperatorCrest name={name} size={36} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        <div className="text-[10px] uppercase tracking-widest text-white/45">
          {provider ?? "Baseline OS"} · operator · {status}
        </div>
      </div>
      <div className="ml-auto">
        <GraphifyAwareness context={context} compact />
      </div>
    </div>
  );
}

/** Initials-based operator crest — the no-fake-art identity mark (Sankoré gold). */
export function OperatorCrest({ name, size = 40 }: { name: string; size?: number }) {
  const initials = (name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")) || "OP";
  return (
    <div
      aria-hidden
      data-testid="operator-crest"
      className="flex shrink-0 items-center justify-center rounded-xl font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.34,
        color: MANSA_PALETTE.night,
        background: `linear-gradient(135deg, ${MANSA_PALETTE.gold}, ${MANSA_PALETTE.goldBright})`,
        boxShadow: `0 0 0 1px ${MANSA_V2.glassBorder}, ${MANSA_V2.goldGlow}`,
      }}
    >
      {initials}
    </div>
  );
}
