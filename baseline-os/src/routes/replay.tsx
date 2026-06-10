import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Play,
  FileText,
  Wrench,
  ShieldCheck,
  Sparkles,
  Flag,
  CheckCircle2,
  Brain,
} from "lucide-react";
import { listReplays, getReplay } from "@/lib/replay-store";
import type { MissionReplay, ReplayEventKind } from "@/lib/replay";

export const Route = createFileRoute("/replay")({
  head: () => ({
    meta: [
      { title: "Workforce Replay — Baseline Automations" },
      {
        name: "description",
        content:
          "Replay any mission like a screen recording: trigger → planning → agents → tools → files → approvals → outputs.",
      },
    ],
  }),
  component: ReplayPage,
});

const TONE = "#a78bfa";

const KIND_META: Record<ReplayEventKind, { label: string; icon: typeof Play; color: string }> = {
  trigger: { label: "Trigger", icon: Flag, color: "#a78bfa" },
  agent_start: { label: "Agent", icon: Sparkles, color: "#38bdf8" },
  tool_call: { label: "Tool", icon: Wrench, color: "#f59e0b" },
  skill_run: { label: "Skill", icon: Sparkles, color: "#22d3ee" },
  approval: { label: "Approval", icon: ShieldCheck, color: "#fbbf24" },
  file_touched: { label: "Files", icon: FileText, color: "#94a3b8" },
  output: { label: "Output", icon: CheckCircle2, color: "#34d399" },
  proof: { label: "Proof", icon: ShieldCheck, color: "#34d399" },
  error: { label: "Error", icon: Flag, color: "#ef4444" },
  complete: { label: "Complete", icon: CheckCircle2, color: "#34d399" },
};

function ReplayPage() {
  const [missions, setMissions] = useState<MissionReplay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState<number>(0);

  const load = () => setMissions(listReplays());
  useEffect(() => {
    load();
    const onStorage = () => load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const selected = useMemo(
    () => (selectedId ? getReplay(selectedId) : (missions[0] ?? null)),
    [selectedId, missions],
  );

  // "Play" the mission: step the playhead through events.
  useEffect(() => {
    if (!selected) return;
    setPlayhead(0);
    const t = setInterval(() => setPlayhead((p) => (p >= selected.events.length ? p : p + 1)), 600);
    return () => clearInterval(t);
  }, [selected]);

  return (
    <div className="min-h-screen bg-[#08070d] p-6 text-white" data-testid="replay-page">
      <div className="mb-4 flex items-center gap-2">
        <Play size={20} style={{ color: TONE }} />
        <div>
          <h1 className="text-lg font-bold">Workforce Replay</h1>
          <p className="text-xs text-white/50">
            Watch any mission like a screen recording — trigger → planning → agents → tools → files
            → approvals → outputs → completion.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* mission list */}
        <div
          className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
          data-testid="replay-list"
        >
          <div className="mb-2 text-[10px] uppercase tracking-widest text-white/55">
            Missions · {missions.length}
          </div>
          {missions.length === 0 ? (
            <p className="text-[11px] text-white/35">
              No missions recorded yet. Generate a workforce, build in Agent Factory, or run a
              Gemini Flow — each records a replay here.
            </p>
          ) : (
            <ul className="space-y-1">
              {missions.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-[11px] ${selected?.id === m.id ? "bg-violet-500/15 text-violet-200" : "bg-white/[0.03] text-white/70"}`}
                    data-testid={`replay-item-${m.id}`}
                  >
                    <div className="truncate font-medium">{m.trigger}</div>
                    <div className="text-[10px] text-white/35">
                      {m.events.length} events · {m.status}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* timeline player */}
        <div
          className="rounded-xl border border-white/10 bg-white/[0.02] p-3 lg:col-span-2"
          data-testid="replay-timeline"
        >
          {!selected ? (
            <p className="text-[11px] text-white/35">Select a mission to replay it.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">{selected.mission || selected.trigger}</div>
                <span className="text-[10px] text-white/40">
                  {playhead}/{selected.events.length}
                </span>
              </div>
              <ol className="space-y-1.5">
                {selected.events.map((e, i) => {
                  const meta = KIND_META[e.kind];
                  const Icon = meta.icon;
                  const played = i < playhead;
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[11px]"
                      style={{ opacity: played ? 1 : 0.35 }}
                      data-testid={`replay-event-${e.kind}`}
                    >
                      <Icon size={12} style={{ color: meta.color, marginTop: 2 }} />
                      <div>
                        <span
                          className="text-[9px] uppercase tracking-wider"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        {e.agent && <span className="ml-1 text-white/45">{e.agent}</span>}
                        <div className="text-white/80">{e.label}</div>
                        {e.detail && <div className="text-[10px] text-white/35">{e.detail}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {selected.agents.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-white/10 pt-2 text-[10px] text-white/50">
                  <Brain size={11} /> Participants:
                  {selected.agents.map((a) => (
                    <span key={a} className="rounded bg-white/5 px-1.5 py-0.5">
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
