/**
 * Flight Deck Command Bridge — one input that routes an operational command to
 * the right EXISTING system. The bridge between operator and workforce.
 *
 * Honest by construction: it shows the routing plan, runs read-only Graphify
 * lookups inline, renders live Agent Activity for Hermes, records a proof/replay
 * mission when applicable, shows setup-needed when the target runtime is missing,
 * and gates destructive/deploy/billing/external-message commands behind approval.
 * It NEVER claims to have executed something it only routed.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { routeCommand, type CommandRoute } from "@/lib/flight-deck-command";
import { recordMission } from "@/lib/replay-store";
import { AgentActivity } from "@/components/agent-activity";

interface RuntimeLite {
  id: string;
  status: string;
}

const GOLD = "#C9A227";
const CYAN = "#43E5FF";

const EXAMPLES = [
  "Open Graphify and locate auth files",
  "Check connected runtimes",
  "Ask Hermes to review today's work",
  "Run Customer Zero smoke",
  "Create a maintenance workflow proof package",
];

export function FlightDeckCommandBridge({ runtimes }: { runtimes: RuntimeLite[] }) {
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<CommandRoute | null>(null);
  const [graphHits, setGraphHits] = useState<string[] | null>(null);
  const [approved, setApproved] = useState(false);
  const [dispatched, setDispatched] = useState<string | null>(null);

  // Registry ids look like "hermes@host" — match on the runtime name prefix.
  const runtimeMissing =
    plan?.requiresRuntime != null &&
    !runtimes.some(
      (r) =>
        (r.id ?? "").split("@")[0] === plan.requiresRuntime &&
        r.status !== "offline" &&
        r.status !== "missing",
    );

  const submit = () => {
    const r = routeCommand(input);
    setPlan(r);
    setApproved(false);
    setDispatched(null);
    setGraphHits(null);
    if (r.usesGraphify && r.graphifyQuery) {
      fetch(`/__graphify?q=${encodeURIComponent(r.graphifyQuery)}`)
        .then((res) => res.json())
        .then((j: { results?: { path: string }[] }) =>
          setGraphHits((j.results ?? []).map((n) => n.path).slice(0, 8)),
        )
        .catch(() => setGraphHits([]));
    }
  };

  const dispatch = () => {
    if (!plan || runtimeMissing) return;
    if (plan.needsApproval && !approved) return; // gated
    if (plan.emitsProof) {
      try {
        recordMission(`Flight Deck: ${plan.command}`.slice(0, 80), plan.command, [
          { t: 0, kind: "plan", label: `Routed to ${plan.system}` },
          { t: 1, kind: "dispatch", label: plan.runtimeLabel },
        ]);
      } catch {
        /* replay optional */
      }
    }
    setDispatched(
      plan.route
        ? `Dispatched to ${plan.runtimeLabel}. Opening ${plan.route} to continue.`
        : `Routed to ${plan.runtimeLabel}. ${plan.system === "mission-control" ? "Start Mission Control to run it." : "Continue in that system."}`,
    );
  };

  return (
    <div
      className="mx-6 mb-3 rounded-xl border p-3"
      style={{ borderColor: `${GOLD}33`, background: "rgba(255,255,255,0.02)" }}
      data-testid="flight-deck-command-bridge"
    >
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: GOLD }}>
        ⌘ Command Bridge — type a command, dispatch to the workforce
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. Ask Hermes to review today's work…"
          data-testid="command-bridge-input"
          className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
        />
        <button
          onClick={submit}
          data-testid="command-bridge-route"
          className="rounded-md px-4 py-2 text-sm font-semibold text-black"
          style={{ background: GOLD }}
        >
          Route
        </button>
      </div>

      {!plan && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => { setInput(ex); }}
              className="rounded-full border px-2 py-0.5 text-[10px] text-white/55 hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {plan && (
        <div className="mt-3 space-y-2" data-testid="command-bridge-plan">
          {/* Routing */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/45">Routes to</span>
              <span className="rounded px-1.5 py-0.5 font-semibold" style={{ background: `${CYAN}1a`, color: CYAN }} data-testid="command-bridge-target">
                {plan.runtimeLabel}
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/55" style={{ background: "rgba(255,255,255,0.06)" }}>
                {plan.kind}
              </span>
              {plan.emitsProof && <span className="text-[10px]" style={{ color: GOLD }}>· emits proof/replay</span>}
            </div>
            <div className="mt-1 text-white/55">{plan.rationale}</div>
          </div>

          {/* Setup-needed (missing runtime) */}
          {runtimeMissing && (
            <div className="rounded-lg border p-2 text-[11px]" style={{ borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", color: "#fbbf24" }} data-testid="command-bridge-setup-needed">
              ⚠ {plan.requiresRuntime} runtime not connected — setup needed before this can run.
              {plan.route && <> Open <Link to={plan.route} className="underline">{plan.route}</Link> to connect it.</>}
            </div>
          )}

          {/* Graphify context (real read) */}
          {plan.usesGraphify && (
            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-[11px]" data-testid="command-bridge-graphify">
              <div className="mb-1 text-[10px] uppercase tracking-widest" style={{ color: CYAN }}>Graphify context</div>
              {graphHits == null ? (
                <span className="text-white/40">querying the structural brain…</span>
              ) : graphHits.length === 0 ? (
                <span className="text-white/40">No graph hits (generate the graph, or refine the query).</span>
              ) : (
                <ul className="space-y-0.5 font-mono text-[10px] text-white/70">
                  {graphHits.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Approval gate */}
          {plan.needsApproval && !runtimeMissing && (
            <label className="flex items-center gap-2 rounded-lg border p-2 text-[11px]" style={{ borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.07)", color: "#fca5a5" }} data-testid="command-bridge-approval">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} data-testid="command-bridge-approve" />
              Approve — this is a destructive / deploy / billing / external action.
            </label>
          )}

          {/* Dispatch */}
          {!dispatched ? (
            <button
              onClick={dispatch}
              disabled={runtimeMissing || (plan.needsApproval && !approved)}
              data-testid="command-bridge-dispatch"
              className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: CYAN, color: "#001018" }}
            >
              {plan.needsApproval && !approved ? "Approve to dispatch" : "Dispatch"}
            </button>
          ) : (
            <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-emerald-300" data-testid="command-bridge-dispatched">
              ✓ {dispatched}
              {plan.route && <> <Link to={plan.route} className="ml-1 underline">Open ↗</Link></>}
            </div>
          )}

          {/* Agent Activity (Hermes-routed) */}
          {plan.system === "hermes" && !runtimeMissing && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-2" data-testid="command-bridge-activity">
              <AgentActivity agentId="hermes" runtime="Hermes" provider="Hermes" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
