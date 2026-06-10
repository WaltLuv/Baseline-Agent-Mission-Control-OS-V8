/**
 * <AgentActivity /> — the platform-wide agent execution visualizer.
 *
 * ONE shared component used on every agent page so the user never feels like
 * they're talking to a ghost. Nine panels: Current Mission, Tool Activity,
 * Files Touched, Timeline, Skill Usage, Memory Activity, Proof Events, Approval
 * Gates, Live Metrics.
 *
 * TRUTH-FIRST: activity comes from the real tool-execution ledger via
 * /__agent_activity. When there's no live activity it shows an honest idle /
 * setup-needed state — it never fabricates tasks, tools, files, or numbers.
 */
import { useEffect, useMemo, useState } from "react";
import { OperatorCrest } from "@/components/graphify-awareness";
import {
  Activity,
  Wrench,
  FileText,
  Sparkles,
  Brain,
  ShieldCheck,
  Gauge,
  CheckCircle2,
  AlertCircle,
  Clock,
  CircleDot,
} from "lucide-react";

export type MissionStatus =
  | "idle"
  | "queued"
  | "planning"
  | "researching"
  | "executing"
  | "waiting"
  | "approval_required"
  | "completed"
  | "failed";

export const MISSION_STATES: MissionStatus[] = [
  "idle",
  "queued",
  "planning",
  "researching",
  "executing",
  "waiting",
  "approval_required",
  "completed",
  "failed",
];

const STATUS_STYLE: Record<MissionStatus, { label: string; color: string }> = {
  idle: { label: "Idle", color: "#64748b" },
  queued: { label: "Queued", color: "#a78bfa" },
  planning: { label: "Planning", color: "#38bdf8" },
  researching: { label: "Researching", color: "#22d3ee" },
  executing: { label: "Executing", color: "#f59e0b" },
  waiting: { label: "Waiting", color: "#fbbf24" },
  approval_required: { label: "Approval required", color: "#f87171" },
  completed: { label: "Completed", color: "#34d399" },
  failed: { label: "Failed", color: "#ef4444" },
};

const TIMELINE = [
  "Research",
  "Analysis",
  "Planning",
  "Tool Execution",
  "Output",
  "Approval",
  "Delivery",
] as const;

interface ActivityEvent {
  tool: string;
  verb: string;
  argv: string;
  ok: boolean | null;
  approved: boolean | null;
  refused: string | null;
  proof: string | null;
  durationMs: number | null;
  startedAt: string | null;
}

interface ApiResp {
  hasActivity: boolean;
  status: MissionStatus;
  events: ActivityEvent[];
  source: string;
}

function Panel({
  icon: Icon,
  title,
  children,
  testid,
}: {
  icon: typeof Activity;
  title: string;
  children: React.ReactNode;
  testid: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3" data-testid={testid}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/55">
        <Icon size={12} /> {title}
      </div>
      {children}
    </div>
  );
}

export function AgentActivity({
  agentId,
  runtime,
  provider,
  status: statusOverride,
}: {
  agentId: string;
  runtime?: string;
  provider?: string;
  status?: MissionStatus;
}) {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Structural awareness — the Graphify brain the agent consults before scanning.
  const [graph, setGraph] = useState<{
    nodes: number;
    edges: number;
    godNodes: { id: string }[];
  } | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch("/__graphify")
      .then((r) => r.json())
      .then((j: { health?: { nodes: number; edges: number; godNodes: { id: string }[] } }) => {
        if (!cancel && j.health) setGraph(j.health);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    fetch(`/__agent_activity?agent=${encodeURIComponent(agentId)}`)
      .then((r) => r.json())
      .then((j: ApiResp) => {
        if (!cancel) {
          setData(j);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancel) {
          setData(null);
          setLoaded(true);
        }
      });
    return () => {
      cancel = true;
    };
  }, [agentId]);

  const events = data?.events ?? [];
  const status: MissionStatus = statusOverride ?? data?.status ?? "idle";
  const ss = STATUS_STYLE[status];

  // Derive panels from REAL events only.
  // Coerce every event field to a string — the activity ledger can return argv
  // as an array/object/null, and `.match` on a non-string throws (crashed the page).
  const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const files = useMemo(
    () =>
      events
        .flatMap(
          (e) => s(e.argv).match(/[\w./~-]+\.(?:ts|tsx|js|jsx|md|json|png|jpg|mp4|pdf|txt)\b/g) ?? [],
        )
        .slice(0, 8),
    [events],
  );
  const skills = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .filter((e) => /skill|generate|soul|import|swarm|vision|voice/i.test(s(e.tool) + s(e.verb)))
            .map((e) => s(e.tool)),
        ),
      ).slice(0, 6),
    [events],
  );
  const memoryHits = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .filter((e) =>
              /pinecone|notion|notebook|obsidian|graphify|memory/i.test(s(e.tool) + s(e.argv)),
            )
            .map((e) => s(e.tool)),
        ),
      ),
    [events],
  );
  const approvals = events.filter((e) => e.approved !== null || e.refused);
  const proofs = events.filter((e) => e.proof || e.ok !== null);
  const activeStageIdx =
    status === "idle"
      ? -1
      : status === "completed"
        ? TIMELINE.length - 1
        : status === "executing"
          ? 3
          : status === "researching"
            ? 0
            : status === "planning"
              ? 2
              : status === "approval_required"
                ? 5
                : 1;

  const identityName = runtime ?? agentId;
  return (
    <div className="space-y-2">
      {/* Shared operator identity header — consistent crest + status on every
          agent page (the agent identity system + no-fake-art avatar). */}
      <div
        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
        data-testid="agent-identity-header"
      >
        <OperatorCrest name={identityName} size={36} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{identityName}</div>
          <div className="text-[10px] uppercase tracking-widest text-white/45">
            {provider ?? "Baseline OS"} · operator
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: ss.color }}>
          <CircleDot size={11} /> {ss.label}
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2" data-testid="agent-activity" data-agent={agentId}>
        {/* 1. Current Mission */}
        <Panel icon={Activity} title="Current mission" testid="aa-mission">
          <div className="flex items-center gap-2">
            <CircleDot size={12} style={{ color: ss.color }} />
            <span
              className="text-sm font-semibold"
              style={{ color: ss.color }}
              data-testid="aa-status"
            >
              {ss.label}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/55">
            {status === "idle"
              ? "No active mission. Dispatch a task or run a workflow — activity will appear here live."
              : `Agent ${agentId} is ${ss.label.toLowerCase()}.`}
          </p>
        </Panel>

        {/* 9. Live metrics (kept near the top for at-a-glance) */}
        <Panel icon={Gauge} title="Live metrics" testid="aa-metrics">
          <div className="grid grid-cols-2 gap-1 text-[11px] text-white/70">
            <div>
              Runtime: <span className="text-white/90">{runtime ?? "—"}</span>
            </div>
            <div>
              Provider: <span className="text-white/90">{provider ?? "—"}</span>
            </div>
            <div>
              Events: <span className="text-white/90">{events.length}</span>
            </div>
            <div>
              Last run:{" "}
              <span className="text-white/90">
                {events[0]?.durationMs != null ? `${events[0].durationMs}ms` : "—"}
              </span>
            </div>
            <div className="col-span-2 text-white/40">
              Tokens / cost: shown only when the runtime reports them (never estimated).
            </div>
          </div>
        </Panel>

        {/* 4. Timeline */}
        <Panel icon={Clock} title="Agent timeline" testid="aa-timeline">
          <div className="flex flex-wrap items-center gap-1">
            {TIMELINE.map((t, i) => (
              <span key={t} className="flex items-center">
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    background: i === activeStageIdx ? `${ss.color}22` : "rgba(255,255,255,0.05)",
                    color: i === activeStageIdx ? ss.color : "rgba(255,255,255,0.4)",
                  }}
                >
                  {t}
                </span>
                {i < TIMELINE.length - 1 && <span className="mx-0.5 text-white/20">›</span>}
              </span>
            ))}
          </div>
        </Panel>

        {/* 2. Tool activity */}
        <Panel icon={Wrench} title="Tool activity" testid="aa-tools">
          {events.length === 0 ? (
            <p className="text-[11px] text-white/35">No tool calls yet.</p>
          ) : (
            <ul className="space-y-0.5 text-[11px]">
              {events.slice(0, 6).map((e, i) => (
                <li key={i} className="flex items-center gap-1.5 text-white/70">
                  {e.ok === false ? (
                    <AlertCircle size={10} className="text-red-400" />
                  ) : (
                    <CheckCircle2 size={10} className="text-emerald-400" />
                  )}
                  <span className="text-white/90">{e.tool}</span>
                  <span className="text-white/40">{e.verb}</span>
                  {e.startedAt && (
                    <span className="ml-auto text-[9px] text-white/30">
                      {String(e.startedAt).slice(11, 19)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 3. Files touched */}
        <Panel icon={FileText} title="Files touched" testid="aa-files">
          {files.length === 0 ? (
            <p className="text-[11px] text-white/35">No files touched yet.</p>
          ) : (
            <ul className="space-y-0.5 text-[11px] text-white/70">
              {files.map((f, i) => (
                <li key={i} className="truncate font-mono">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 5. Skill usage */}
        <Panel icon={Sparkles} title="Skill usage" testid="aa-skills">
          {skills.length === 0 ? (
            <p className="text-[11px] text-white/35">No skills invoked yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {skills.map((s, i) => (
                <span
                  key={i}
                  className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </Panel>

        {/* 6. Memory activity */}
        <Panel icon={Brain} title="Memory activity" testid="aa-memory">
          {memoryHits.length === 0 ? (
            <p className="text-[11px] text-white/35">
              No memory-layer queries yet (Graphify · Pinecone · Notion · NotebookLM · Obsidian).
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {memoryHits.map((m, i) => (
                <span
                  key={i}
                  className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </Panel>

        {/* 7. Proof events */}
        <Panel icon={ShieldCheck} title="Proof events" testid="aa-proof">
          {proofs.length === 0 ? (
            <p className="text-[11px] text-white/35">No proof events yet.</p>
          ) : (
            <ul className="space-y-0.5 text-[11px] text-white/70">
              {proofs.slice(0, 5).map((e, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <CheckCircle2
                    size={10}
                    className={e.ok === false ? "text-red-400" : "text-emerald-400"}
                  />
                  <span className="truncate">
                    {e.proof
                      ? String(e.proof).slice(0, 60)
                      : `${e.tool} ${e.ok === false ? "failed" : "ok"}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 8. Approval gates */}
        <Panel icon={ShieldCheck} title="Approval gates" testid="aa-approvals">
          {approvals.length === 0 ? (
            <p className="text-[11px] text-white/35">No approval decisions yet.</p>
          ) : (
            <ul className="space-y-0.5 text-[11px]">
              {approvals.slice(0, 5).map((e, i) => (
                <li key={i} className="flex items-center gap-1.5 text-white/70">
                  {e.refused ? (
                    <AlertCircle size={10} className="text-red-400" />
                  ) : (
                    <CheckCircle2 size={10} className="text-emerald-400" />
                  )}
                  <span>
                    {e.refused ? `rejected — ${String(e.refused).slice(0, 40)}` : "auto-approved"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 10. Structural awareness (Graphify brain) */}
        <Panel icon={Brain} title="Structural awareness (Graphify)" testid="aa-structural">
          {!graph ? (
            <p className="text-[11px] text-white/35">
              Graphify brain not generated yet — agents fall back to repo scan.
            </p>
          ) : (
            <div className="text-[11px] text-white/70">
              <div>
                Graph brain connected · <span className="text-white/90">{graph.nodes}</span> nodes /{" "}
                <span className="text-white/90">{graph.edges}</span> edges
              </div>
              <div className="mt-0.5 text-white/40">
                Before coding, this agent queries the graph to locate exact files (graph-first).
                Core modules:
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {graph.godNodes.slice(0, 4).map((g) => (
                  <span
                    key={g.id}
                    className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/70"
                  >
                    {g.id.split("/").pop()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {!loaded && (
          <div className="col-span-full text-[10px] text-white/30">Loading live activity…</div>
        )}
      </div>
    </div>
  );
}

export default AgentActivity;
