/**
 * Mission Control — Campaign #89.
 *
 * Dynamic Workflow / Swarm engine UI. One plain-English mission in →
 * parent kanban task → Hermes decomposes → swarm round-robin assigns
 * → kanban dispatcher runs each child → judge agent verifies → final
 * verdict persisted to ~/.claude-os/workflows/<run_id>.json.
 *
 * Reuses the kanban execution engine (#86) and swarm dispatcher (#91);
 * this surface is the mission-input + run-list + verification view.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles, Send, Loader2, CheckCircle2, AlertCircle, Shield, RefreshCw,
  ListChecks, ChevronRight, Wand2, FileCheck2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mission-control")({
  head: () => ({
    meta: [
      { title: "Mission Control — Baseline Automations" },
      { name: "description", content: "Dynamic Workflow / Swarm engine. One mission in, a verified deliverable out." },
    ],
  }),
  component: MissionControlPage,
});

// 7 demo missions from the user's spec
const DEMO_MISSIONS = [
  "Audit the AI Workforce OS demo and make it work across property management, contractors, home services, sales teams, marketing teams, and local businesses.",
  "Build an AI employee team for a property management company.",
  "Build an AI employee team for a general contractor.",
  "Build an AI employee team for a cigar lounge / retail business.",
  "Build an AI employee team for a local service business.",
  "Audit this company's operations and recommend automations.",
  "Create a sales funnel, follow-up system, and fulfillment workflow.",
  "Inspect this repo and identify production blockers.",
];

const ALL_AGENTS = [
  { id: "claudeclaw", label: "ClaudeClaw",   tone: "#D97757" },
  { id: "gemini",     label: "Gemini",       tone: "#4F8EF7" },
  { id: "codex",      label: "Codex",        tone: "#22C55E" },
  { id: "ruflo",      label: "Ruflo",        tone: "#6366F1" },
  { id: "openclaw",   label: "OpenClaw",     tone: "#EF4444" },
  { id: "antigravity", label: "Antigravity", tone: "#3B82F6" },
  { id: "free-claude", label: "Coding Agent", tone: "#10B981" },
];

interface IndexRun {
  id: string;
  mission: string;
  status: string;
  created_at: number;
  parentTaskId: string;
  taskCount: number;
}
interface RunDetail {
  run: {
    id: string; mission: string; status: string; created_at: number;
    parentTaskId: string; agents: string[];
    children: { id: string; title?: string }[];
    assigned: { id: string; assignee: string }[];
    autoVerify: boolean;
    events: { kind: string; at: number; payload?: any }[];
    verification: null | { status: "pending" | "passed" | "failed"; verdict?: string; at?: number };
  };
  liveStatuses: Record<string, any>;
}

function MissionControlPage() {
  const [mission, setMission] = useState("");
  const [picked, setPicked] = useState<string[]>(["claudeclaw", "gemini", "codex", "ruflo"]);
  const [autoVerify, setAutoVerify] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [runs, setRuns] = useState<IndexRun[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      const r = await fetch("/__workflow_list");
      const j = await r.json() as { runs: IndexRun[] };
      setRuns(j.runs ?? []);
    } catch { setRuns([]); }
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/__workflow_show?id=${encodeURIComponent(id)}`);
      const j = await r.json() as RunDetail | { error?: string };
      if ("error" in j) return;
      setDetail(j as RunDetail);
    } catch { /* skip */ }
  }, []);
  useEffect(() => { void loadRuns(); }, [loadRuns]);
  useEffect(() => { if (openId) void loadDetail(openId); }, [openId, loadDetail]);
  // Poll the open run every 8s so you see kanban statuses change live
  useEffect(() => {
    if (!openId) return;
    const i = setInterval(() => { if (!document.hidden) void loadDetail(openId); }, 8000);
    return () => clearInterval(i);
  }, [openId, loadDetail]);

  async function launch() {
    if (!mission.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch("/__workflow_create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: mission.trim(), agents: picked, autoVerify }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(`launch failed: ${j.error ?? r.statusText}`); }
      else {
        toast.success(`Workflow ${j.runId} launched · ${j.assigned.length} sub-tasks`);
        setMission("");
        await loadRuns();
        setOpenId(j.runId);
      }
    } catch (e) { toast.error(String(e)); }
    setSubmitting(false);
  }

  async function verify(runId: string) {
    setVerifying(true);
    try {
      const r = await fetch("/__workflow_verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId }) });
      const j = await r.json();
      if (j.run) { setDetail((prev) => prev ? { ...prev, run: j.run } : prev); toast.success(`verdict: ${j.run.verification?.status?.toUpperCase()}`); }
      else toast.error(j.error ?? `verify failed (${r.status})`);
    } catch (e) { toast.error(String(e)); }
    setVerifying(false);
    void loadRuns();
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="px-5 py-3 shrink-0 border-b flex items-center gap-3" style={{ borderColor: "var(--panel-border)" }}>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.45)" }}>
          <Sparkles size={16} style={{ color: "#A78BFA" }} />
        </div>
        <div className="flex flex-col leading-tight">
          <div className="text-[13px] font-semibold">Mission Control · Dynamic Workflow</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/65">one mission → kanban decomposes → swarm runs → judge verifies</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/kanban" className="px-3 py-1.5 rounded-lg text-[10.5px] uppercase tracking-[0.22em] font-semibold border" style={{ borderColor: "rgba(96,165,250,0.5)", color: "#60A5FA" }}>
            <ListChecks size={11} className="inline mr-1" /> kanban board
          </Link>
          <button onClick={() => void loadRuns()} className="p-2 rounded-lg hover:bg-white/5"><RefreshCw size={12} /></button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden grid lg:grid-cols-[1fr_360px]">
        {/* Main pane */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Mission input */}
          <section
            className="rounded-xl border p-4 space-y-3"
            style={{
              background: "linear-gradient(120deg, rgba(167,139,250,0.16) 0%, rgba(99,102,241,0.10) 50%, rgba(7,29,28,0.6) 100%)",
              borderColor: "rgba(167,139,250,0.4)",
              boxShadow: "0 0 28px -8px rgba(167,139,250,0.4)",
            }}
          >
            <div className="flex items-center gap-2">
              <Wand2 size={14} style={{ color: "#A78BFA" }} />
              <div className="text-[12px] uppercase tracking-[0.22em] font-semibold" style={{ color: "#A78BFA" }}>New mission</div>
              <label className="ml-auto flex items-center gap-1.5 text-[11px]">
                <input type="checkbox" checked={autoVerify} onChange={(e) => setAutoVerify(e.target.checked)} />
                <Shield size={10} /> auto-verify with judge agent
              </label>
            </div>
            <textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={4} placeholder="Mission (plain English): e.g. 'Audit this repo and identify production blockers. Verify with judges before marking done.'" className="w-full px-3 py-2 rounded-lg text-[13px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50 resize-y font-sans" />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/70 mr-1">agent mix:</span>
              {ALL_AGENTS.map((a) => {
                const on = picked.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => setPicked((p) => p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id])} className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.16em] font-mono border transition" style={{ background: on ? `${a.tone}25` : "transparent", borderColor: on ? a.tone : "rgba(255,255,255,0.18)", color: on ? a.tone : "rgba(255,255,255,0.55)" }}>
                    {a.label}
                  </button>
                );
              })}
              <button onClick={() => void launch()} disabled={!mission.trim() || picked.length === 0 || submitting} className="ml-auto px-4 py-2 rounded-lg text-[12px] font-bold disabled:opacity-40" style={{ background: "linear-gradient(135deg, #A78BFA, #6366F1)", color: "#fff", boxShadow: "0 6px 18px -6px rgba(167,139,250,0.6)" }}>
                {submitting ? <><Loader2 size={11} className="inline mr-1 animate-spin" /> launching…</> : <><Send size={11} className="inline mr-1" /> Launch mission</>}
              </button>
            </div>
            <div>
              <details>
                <summary className="text-[10.5px] uppercase tracking-[0.22em] cursor-pointer opacity-70 hover:opacity-100">Demo missions ({DEMO_MISSIONS.length})</summary>
                <ul className="mt-2 space-y-1.5">
                  {DEMO_MISSIONS.map((m) => (
                    <li key={m}>
                      <button onClick={() => setMission(m)} className="text-left text-[11.5px] opacity-80 hover:opacity-100 hover:bg-white/5 rounded px-2 py-1 w-full">› {m}</button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </section>

          {/* Active mission detail */}
          {openId && detail && (
            <RunDetailCard
              detail={detail}
              onClose={() => { setOpenId(null); setDetail(null); }}
              onVerify={() => void verify(openId)}
              verifying={verifying}
            />
          )}
        </div>

        {/* Run list rail */}
        <aside className="border-l overflow-y-auto" style={{ borderColor: "var(--panel-border)" }}>
          <div className="px-4 py-3 border-b text-[10.5px] uppercase tracking-[0.22em] font-semibold sticky top-0" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg, rgba(0,0,0,0.4))", backdropFilter: "blur(8px)" }}>
            Workflow runs ({runs.length})
          </div>
          {runs.length === 0 ? (
            <div className="p-4 italic opacity-60 text-[11.5px]">No runs yet.</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {runs.map((r) => {
                const dt = new Date(r.created_at).toLocaleString();
                const open = openId === r.id;
                return (
                  <li key={r.id}>
                    <button onClick={() => setOpenId(r.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/3 flex flex-col gap-1" style={{ background: open ? "rgba(167,139,250,0.08)" : undefined }}>
                      <div className="flex items-center gap-1.5">
                        <StatusPill status={r.status} />
                        <span className="text-[9.5px] font-mono opacity-50">{r.id}</span>
                        <ChevronRight size={10} className="ml-auto opacity-40" />
                      </div>
                      <div className="text-[11.5px] line-clamp-2">{r.mission}</div>
                      <div className="text-[9.5px] font-mono opacity-50">{dt} · {r.taskCount} task{r.taskCount === 1 ? "" : "s"}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    running:       { color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
    needs_approval:{ color: "#FCA5A5", bg: "rgba(239,68,68,0.15)" },
    failed:        { color: "#FCA5A5", bg: "rgba(239,68,68,0.15)" },
    completed:     { color: "#10B981", bg: "rgba(16,185,129,0.15)" },
    queued:        { color: "#94A3B8", bg: "rgba(148,163,184,0.15)" },
  };
  const m = map[status] ?? { color: "#94A3B8", bg: "rgba(148,163,184,0.15)" };
  return <span className="text-[8.5px] uppercase tracking-[0.18em] font-mono px-1.5 py-0.5 rounded" style={{ color: m.color, background: m.bg }}>{status}</span>;
}

function RunDetailCard({ detail, onClose, onVerify, verifying }: { detail: RunDetail; onClose: () => void; onVerify: () => void; verifying: boolean }) {
  const r = detail.run;
  const liveByChild = useMemo(() => {
    const m: Record<string, any> = {};
    for (const c of r.children) m[c.id] = detail.liveStatuses[c.id];
    return m;
  }, [detail.liveStatuses, r.children]);
  const doneCount = Object.values(liveByChild).filter((t: any) => t?.status === "done").length;
  const total = r.children.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  return (
    <section className="rounded-xl border p-4 space-y-3" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.1)" }}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono opacity-60">{r.id}</span>
        <StatusPill status={r.status} />
        <span className="text-[10.5px] opacity-65 ml-1">· {new Date(r.created_at).toLocaleString()}</span>
        <Link to="/kanban" className="ml-auto text-[10.5px] uppercase tracking-[0.2em] underline decoration-dotted text-indigo-300 hover:text-indigo-200">view on kanban →</Link>
        <button onClick={onClose} className="text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded border border-white/10 hover:bg-white/5">close</button>
      </div>
      <h2 className="text-[14.5px] font-semibold leading-snug">{r.mission}</h2>
      <div>
        <div className="flex items-center gap-2 text-[10.5px] mb-1.5">
          <span className="opacity-65">Progress</span>
          <span className="font-mono">{doneCount} / {total} done</span>
          <span className="opacity-50">· {pct}%</span>
          <button onClick={onVerify} disabled={verifying || doneCount === 0} className="ml-auto px-3 py-1 rounded text-[10px] uppercase tracking-[0.22em] font-semibold border disabled:opacity-40" style={{ borderColor: "rgba(16,185,129,0.5)", color: "#10B981", background: "rgba(16,185,129,0.12)" }}>
            {verifying ? <><Loader2 size={10} className="inline mr-1 animate-spin" /> judging…</> : <><FileCheck2 size={10} className="inline mr-1" /> run judge</>}
          </button>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #10B981, #A78BFA)" }} />
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold opacity-65 mb-1.5">Tasks</div>
        <ul className="space-y-1">
          {r.children.map((c) => {
            const live = liveByChild[c.id];
            const status = live?.status ?? "?";
            const assignee = r.assigned.find((a) => a.id === c.id)?.assignee ?? live?.assignee ?? "—";
            const tone = ALL_AGENTS.find((a) => a.id === assignee)?.tone ?? "#fde047";
            return (
              <li key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-white/8 bg-black/25 text-[11.5px]">
                <span className="font-mono opacity-55 text-[10px]">{c.id}</span>
                <StatusPill status={status} />
                <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: tone }}>{assignee}</span>
                <span className="truncate ml-1 opacity-90">{c.title ?? live?.title ?? "(no title)"}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {r.verification && (
        <div className="rounded-lg border p-3" style={{ borderColor: r.verification.status === "passed" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)", background: r.verification.status === "passed" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            {r.verification.status === "passed" ? <CheckCircle2 size={12} style={{ color: "#10B981" }} /> : <AlertCircle size={12} style={{ color: "#FCA5A5" }} />}
            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: r.verification.status === "passed" ? "#10B981" : "#FCA5A5" }}>Judge verdict · {r.verification.status}</span>
            {r.verification.at && <span className="text-[9.5px] opacity-55 font-mono ml-auto">{new Date(r.verification.at).toLocaleString()}</span>}
          </div>
          <pre className="whitespace-pre-wrap text-[11.5px] font-mono leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>{r.verification.verdict ?? "(empty)"}</pre>
        </div>
      )}
    </section>
  );
}
