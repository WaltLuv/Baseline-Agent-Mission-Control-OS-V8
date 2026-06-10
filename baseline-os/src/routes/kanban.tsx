/**
 * Kanban — multi-agent execution board (Campaign #86).
 *
 * Backed by Hermes' real SQLite kanban (~/.hermes/kanban.db) via the
 * `/__kanban_*` middleware family. Hermes owns persistence + state
 * transitions; tasks assigned to non-Hermes agents (codex / gemini /
 * openclaw / claudeclaw / antigravity / ruflo / free-claude /
 * notebooklm / hermes-mcp) are picked up by our external dispatcher
 * loop (also in vite.config.ts) and run through the same backend the
 * chat UI uses (/__agent_run).
 *
 * Columns map 1:1 to Hermes' status enum:
 *   triage · todo · ready · running · blocked · done
 *
 * UX:
 *   · Auto-polls every 5s when visible
 *   · "+ Add" creates a triage task and auto-decomposes into child
 *     sub-tasks (the user's spec: "as soon as I click the add button,
 *     it needs to triage a task and split everything into multiple
 *     sub-tasks")
 *   · Click a card → detail drawer (Description / Parents / Children /
 *     Workspace Files / Run History) with Dispatch Now / Reassign /
 *     Archive / Block / Unblock actions
 *   · Columbus, OH local time live in the header
 *   · Search + assignee filter + "show archived" toggle
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive, Bot, ChevronRight, Clock, Loader2, Play, Plus, RefreshCw,
  Search, Sparkles, Users, X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban — Baseline Automations" },
      { name: "description", content: "Multi-agent execution board. Drop a prompt into triage, watch the orchestrator decompose and dispatch." },
    ],
  }),
  component: KanbanPage,
});

// ─── Types ────────────────────────────────────────────────────────────────
type TaskStatus = "triage" | "todo" | "ready" | "running" | "blocked" | "done" | "archived";
interface Task {
  id: string;
  title: string;
  body?: string | null;
  assignee?: string | null;
  status: TaskStatus;
  priority?: number;
  workspace_kind?: string;
  workspace_path?: string | null;
  created_by?: string;
  created_at?: number;
  started_at?: number | null;
  completed_at?: number | null;
  result?: string | null;
  skills?: string[];
}
interface Assignee {
  id: string;
  name: string;
  backend: "hermes" | "codex" | "gemini" | "claude-persona" | "notebooklm";
}
interface TaskDetail {
  task: Task;
  latest_summary?: string | null;
  parents?: { id: string; title?: string; status?: TaskStatus }[];
  children?: { id: string; title?: string; status?: TaskStatus }[];
  comments?: { author: string; body: string; created_at: number }[];
  events?: { kind: string; payload?: unknown; created_at: number; run_id?: string | null }[];
  runs?: { id: string; status?: string; started_at?: number; ended_at?: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────
const COLUMNS: { status: TaskStatus; label: string; tone: string; bg: string }[] = [
  { status: "triage",  label: "Triage",  tone: "#A78BFA", bg: "rgba(167,139,250,0.08)" },
  { status: "todo",    label: "To Do",   tone: "#94A3B8", bg: "rgba(148,163,184,0.08)" },
  { status: "ready",   label: "Ready",   tone: "#60A5FA", bg: "rgba(96,165,250,0.08)" },
  { status: "running", label: "Running", tone: "#F59E0B", bg: "rgba(245,158,11,0.08)" },
  { status: "blocked", label: "Blocked", tone: "#EF4444", bg: "rgba(239,68,68,0.08)" },
  { status: "done",    label: "Done",    tone: "#10B981", bg: "rgba(16,185,129,0.08)" },
];

// ─── Page ─────────────────────────────────────────────────────────────────
function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<{ hermes: Assignee[]; nonHermes: Assignee[] }>({ hermes: [], nonHermes: [] });
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [columbusTime, setColumbusTime] = useState(() => fmtColumbus(new Date()));

  // ── Columbus, OH local time clock (Eastern; America/New_York) ──
  useEffect(() => {
    const t = setInterval(() => setColumbusTime(fmtColumbus(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Initial load + auto-poll ──
  const loadTasks = useCallback(async () => {
    try {
      const url = new URL("/__kanban_tasks", window.location.origin);
      if (showArchived) url.searchParams.set("archived", "1");
      if (assigneeFilter) url.searchParams.set("assignee", assigneeFilter);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const r = await fetch(url.toString());
      const j = await r.json() as { tasks: Task[] };
      setTasks(j.tasks ?? []);
    } catch (e) {
      console.warn("[kanban] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [showArchived, q, assigneeFilter]);

  useEffect(() => {
    fetch("/__kanban_assignees").then((r) => r.json()).then(setAssignees).catch(() => { /* skip */ });
  }, []);
  useEffect(() => {
    void loadTasks();
    const i = setInterval(() => { if (!document.hidden) void loadTasks(); }, 5000);
    return () => clearInterval(i);
  }, [loadTasks]);

  // ── Bucket tasks by column (excluding archived unless toggled) ──
  const buckets = useMemo(() => {
    const out: Record<TaskStatus, Task[]> = {
      triage: [], todo: [], ready: [], running: [], blocked: [], done: [], archived: [],
    };
    for (const t of tasks) out[t.status]?.push(t);
    return out;
  }, [tasks]);

  // ── Find assignee display name (Hermes name, fallback to id) ──
  const assigneeMap = useMemo(() => {
    const m = new Map<string, Assignee>();
    for (const a of [...assignees.hermes, ...assignees.nonHermes]) m.set(a.id, a);
    return m;
  }, [assignees]);

  const totalProfiles = assignees.hermes.length + assignees.nonHermes.length;
  const visibleCount = tasks.length;

  async function dispatchPass() {
    try {
      const r = await fetch("/__kanban_dispatch_pass", { method: "POST" });
      const j = await r.json();
      if (j.ok) toast.success("Dispatch pass complete — refreshing");
      else toast.error(`Dispatch failed: ${(j.stderr ?? "").slice(0, 120)}`);
      void loadTasks();
    } catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* ─── Header ─── */}
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)" }}>
          <Sparkles size={16} style={{ color: "#A78BFA" }} />
        </div>
        <div className="flex flex-col leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">Kanban</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/65">multi-agent execution board</div>
        </div>
        <div className="ml-2 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <Clock size={11} style={{ color: "#F59E0B" }} />
          <span className="text-[10.5px] font-mono tabular-nums" style={{ color: "#fde047" }}>{columbusTime}</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">Columbus OH</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title / body…"
              className="w-44 md:w-56 pl-7 pr-2 py-1.5 rounded-lg text-[12px] bg-black/30 border border-white/10 focus:outline-none focus:border-white/25"
            />
          </div>
          {/* Assignee filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded-lg px-2.5 py-1.5 text-[12px] bg-black/30 border border-white/10 focus:outline-none focus:border-white/25"
            style={{ color: assigneeFilter ? "#fde047" : "rgba(255,255,255,0.8)" }}
          >
            <option value="">All assignees</option>
            <optgroup label="Hermes pantheon">
              {assignees.hermes.map((a) => (<option key={`h-${a.id}`} value={a.id}>{a.name}</option>))}
            </optgroup>
            <optgroup label="Other agents">
              {assignees.nonHermes.map((a) => (<option key={`n-${a.id}`} value={a.id}>{a.name}</option>))}
            </optgroup>
          </select>
          {/* Show archived toggle */}
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-[0.2em] border transition"
            style={{
              background: showArchived ? "rgba(167,139,250,0.18)" : "transparent",
              borderColor: showArchived ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.15)",
              color: showArchived ? "#A78BFA" : "rgba(255,255,255,0.65)",
            }}
          >
            <Archive size={10} className="inline mr-1" /> archived
          </button>
          {/* Dispatch pass */}
          <button
            type="button"
            onClick={() => void dispatchPass()}
            title="Run one Hermes dispatcher pass (promote ready / spawn workers)"
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition"
            style={{ background: "rgba(96,165,250,0.18)", border: "1px solid rgba(96,165,250,0.5)", color: "#60A5FA" }}
          >
            <Play size={11} className="inline mr-1" /> dispatch pass
          </button>
          {/* Add */}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold transition"
            style={{ background: "linear-gradient(135deg, #A78BFA, #7C3AED)", color: "#fff", boxShadow: "0 6px 18px -6px rgba(167,139,250,0.6)" }}
          >
            <Plus size={12} className="inline mr-1" /> Add task
          </button>
          {/* Reload */}
          <button onClick={() => void loadTasks()} className="p-2 rounded-lg hover:bg-white/5" title="Refresh">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* ─── Stats strip ─── */}
      <div className="flex items-center gap-4 px-4 py-2 shrink-0 border-b text-[10.5px] font-mono tabular-nums" style={{ borderColor: "var(--panel-border)", color: "rgba(255,255,255,0.55)" }}>
        <span><Users size={10} className="inline mr-1" />{totalProfiles} agent profiles</span>
        <span>·</span>
        <span>{visibleCount} task{visibleCount === 1 ? "" : "s"} visible</span>
        {COLUMNS.map((c) => (
          <span key={c.status} style={{ color: c.tone }}>
            · {c.label.toLowerCase()} {buckets[c.status].length}
          </span>
        ))}
      </div>

      {/* ─── Board ─── */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden flex gap-3 p-3" style={{ background: "rgba(0,0,0,0.18)" }}>
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            tone={col.tone}
            bg={col.bg}
            label={col.label}
            tasks={buckets[col.status]}
            assigneeMap={assigneeMap}
            onCardClick={(id) => setDetailId(id)}
          />
        ))}
        {showArchived && (
          <Column
            tone="#6B7280"
            bg="rgba(107,114,128,0.06)"
            label="Archived"
            tasks={buckets.archived}
            assigneeMap={assigneeMap}
            onCardClick={(id) => setDetailId(id)}
          />
        )}
      </div>

      {/* ─── Add modal ─── */}
      {addOpen && (
        <AddTaskModal
          assignees={assignees}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); void loadTasks(); }}
        />
      )}

      {/* ─── Detail drawer ─── */}
      {detailId && (
        <TaskDetailDrawer
          id={detailId}
          assignees={assignees}
          onClose={() => setDetailId(null)}
          onChanged={() => void loadTasks()}
        />
      )}
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────
function Column({ label, tone, bg, tasks, assigneeMap, onCardClick }: {
  label: string; tone: string; bg: string; tasks: Task[];
  assigneeMap: Map<string, Assignee>; onCardClick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border shrink-0 w-[300px] h-full" style={{ background: bg, borderColor: `${tone}33` }}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0" style={{ borderColor: `${tone}22` }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: tone }} />
        <span className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: tone }}>{label}</span>
        <span className="text-[10.5px] font-mono opacity-50 ml-auto">{tasks.length}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {tasks.length === 0 ? (
          <div className="text-center text-[10.5px] text-muted-foreground/40 py-6 italic">empty</div>
        ) : (
          tasks.map((t) => (
            <Card key={t.id} task={t} assignee={t.assignee ? assigneeMap.get(t.assignee) : undefined} onClick={() => onCardClick(t.id)} tone={tone} />
          ))
        )}
      </div>
    </div>
  );
}

function Card({ task, assignee, onClick, tone }: { task: Task; assignee?: Assignee; onClick: () => void; tone: string }) {
  const isHermes = assignee?.backend === "hermes";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg p-2.5 transition-all border hover:-translate-y-px"
      style={{ background: "rgba(0,0,0,0.32)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="text-[12px] font-medium leading-snug" style={{ color: "#e5e7eb" }}>{task.title}</div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {task.assignee ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-[0.12em]"
            style={{
              background: isHermes ? "rgba(255,210,30,0.12)" : `${tone}18`,
              color: isHermes ? "#fde047" : tone,
              border: `1px solid ${isHermes ? "rgba(255,210,30,0.3)" : tone + "40"}`,
            }}
          >
            <Bot size={8} />
            {assignee?.name ?? task.assignee}
          </span>
        ) : (
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/45">unassigned</span>
        )}
        {(task.priority ?? 0) > 0 && (
          <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#FCA5A5" }}>P{task.priority}</span>
        )}
        <span className="ml-auto text-[9px] text-muted-foreground/35 font-mono">{task.id.replace(/^t_/, "")}</span>
      </div>
    </button>
  );
}

// ─── Add modal ───────────────────────────────────────────────────────────
function AddTaskModal({ assignees, onClose, onCreated }: { assignees: { hermes: Assignee[]; nonHermes: Assignee[] }; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState(0);
  const [autoDecompose, setAutoDecompose] = useState(true);
  const [workspace, setWorkspace] = useState<"scratch" | "worktree">("scratch");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const r = await fetch("/__kanban_create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim() || undefined,
          assignee: assignee || undefined,
          priority,
          workspace,
          autoDecompose,
        }),
      });
      const j = await r.json() as { task?: Task; children?: Task[] | null; error?: string };
      if (!r.ok || !j.task) {
        setResult(`error: ${j.error ?? r.statusText}`);
        setSubmitting(false);
        return;
      }
      const childCount = j.children?.length ?? 0;
      toast.success(`Triaged ${j.task.id}${childCount > 0 ? ` + ${childCount} sub-task${childCount === 1 ? "" : "s"}` : ""}`);
      onCreated();
    } catch (e) {
      setResult(`error: ${String(e)}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="rounded-xl border max-w-xl w-full p-5 space-y-3" style={{ background: "#0F1116", borderColor: "rgba(167,139,250,0.4)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: "#A78BFA" }} />
          <div className="text-[13px] font-semibold">New task</div>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-white/5"><X size={14} /></button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title…"
          autoFocus
          className="w-full px-3 py-2 rounded-lg text-[13px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Body / instructions (the agent reads this as the prompt)…"
          className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50 resize-y"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/65">Assignee</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50">
              <option value="">— unassigned (decompose first) —</option>
              <optgroup label="Hermes pantheon">
                {assignees.hermes.map((a) => (<option key={`h-${a.id}`} value={a.id}>{a.name}</option>))}
              </optgroup>
              <optgroup label="Other agents (external dispatcher)">
                {assignees.nonHermes.map((a) => (<option key={`n-${a.id}`} value={a.id}>{a.name}</option>))}
              </optgroup>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/65">Priority</span>
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} className="px-2.5 py-1.5 rounded-lg text-[12px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/65">Workspace</span>
            <select value={workspace} onChange={(e) => setWorkspace(e.target.value as "scratch" | "worktree")} className="px-2.5 py-1.5 rounded-lg text-[12px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50">
              <option value="scratch">scratch (default)</option>
              <option value="worktree">worktree (git isolated)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-1">
            <input type="checkbox" checked={autoDecompose} onChange={(e) => setAutoDecompose(e.target.checked)} />
            <span className="text-[11px]">auto-decompose (split into sub-tasks)</span>
          </label>
        </div>
        {result && (<div className="text-[11px] font-mono p-2 rounded bg-red-500/10 text-red-300">{result}</div>)}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] border border-white/10 hover:bg-white/5">Cancel</button>
          <button
            onClick={() => void submit()}
            disabled={!title.trim() || submitting}
            className="ml-auto px-4 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #A78BFA, #7C3AED)", color: "#fff" }}
          >
            {submitting ? <><Loader2 size={11} className="inline mr-1 animate-spin" /> creating…</> : "▶ Triage + decompose"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────────────
type DetailTab = "description" | "parents" | "children" | "workspace" | "history";

function TaskDetailDrawer({ id, assignees, onClose, onChanged }: {
  id: string; assignees: { hermes: Assignee[]; nonHermes: Assignee[] }; onClose: () => void; onChanged: () => void;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [tab, setTab] = useState<DetailTab>("description");
  const [files, setFiles] = useState<{ name: string; size: number; mtime: number; isDir: boolean }[]>([]);
  const [filesDir, setFilesDir] = useState<string>("");
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/__kanban_show?id=${encodeURIComponent(id)}`);
    const j = await r.json() as TaskDetail | { error?: string };
    if ("error" in j) return;
    setDetail(j as TaskDetail);
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (tab !== "workspace") return;
    fetch(`/__kanban_workspace_files?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j: { dir: string; files: typeof files }) => { setFiles(j.files ?? []); setFilesDir(j.dir ?? ""); })
      .catch(() => { /* skip */ });
  }, [tab, id]);

  async function act(path: string, body: object, label: string) {
    setRunning(label);
    try {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.ok || r.ok) toast.success(`${label} ok`);
      else toast.error(`${label} failed: ${(j.stderr ?? j.error ?? "").slice(0, 120)}`);
      onChanged();
      void load();
    } catch (e) { toast.error(String(e)); }
    setRunning(null);
  }

  if (!detail) return null;
  const task = detail.task;
  const assigneeMap = new Map([...assignees.hermes, ...assignees.nonHermes].map((a) => [a.id, a] as const));
  const assignee = task.assignee ? assigneeMap.get(task.assignee) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />
      <div className="relative w-full max-w-[560px] h-full flex flex-col border-l overflow-hidden" style={{ background: "#0E1116", borderColor: "rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9.5px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">{task.id}</span>
                <span className="text-[9.5px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded font-mono"
                  style={{ background: `${COLUMNS.find((c) => c.status === task.status)?.tone}22`, color: COLUMNS.find((c) => c.status === task.status)?.tone }}>
                  {task.status}
                </span>
                {assignee && (
                  <span className="text-[9.5px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: "rgba(255,210,30,0.12)", color: "#fde047" }}>
                    <Bot size={9} className="inline mr-1" />{assignee.name}
                  </span>
                )}
              </div>
              <h2 className="text-[15px] font-semibold leading-snug">{task.title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5"><X size={14} /></button>
          </div>
          {/* Action bar */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              onClick={() => void act("/__kanban_dispatch_now", { id: task.id }, "dispatch")}
              disabled={running !== null || !task.assignee}
              title={!task.assignee ? "Assign someone first" : "Run this task now"}
              className="px-2.5 py-1 rounded text-[10.5px] font-semibold border transition disabled:opacity-40"
              style={{ background: "rgba(96,165,250,0.15)", borderColor: "rgba(96,165,250,0.45)", color: "#60A5FA" }}
            >
              <Play size={9} className="inline mr-1" />{running === "dispatch" ? "running…" : "Dispatch now"}
            </button>
            <AssignDropdown assignees={assignees} onAssign={(profile) => void act("/__kanban_assign", { id: task.id, profile }, "reassign")} />
            {task.status !== "blocked" ? (
              <button onClick={() => void act("/__kanban_block", { ids: [task.id] }, "block")} className="px-2.5 py-1 rounded text-[10.5px] border" style={{ borderColor: "rgba(239,68,68,0.4)", color: "#FCA5A5" }}>Block</button>
            ) : (
              <button onClick={() => void act("/__kanban_unblock", { ids: [task.id] }, "unblock")} className="px-2.5 py-1 rounded text-[10.5px] border" style={{ borderColor: "rgba(96,165,250,0.4)", color: "#60A5FA" }}>Unblock</button>
            )}
            {task.status !== "done" && (
              <button onClick={() => void act("/__kanban_complete", { ids: [task.id] }, "complete")} className="px-2.5 py-1 rounded text-[10.5px] border" style={{ borderColor: "rgba(16,185,129,0.4)", color: "#10B981" }}>Mark done</button>
            )}
            <button onClick={() => void act("/__kanban_archive", { ids: [task.id] }, "archive")} className="px-2.5 py-1 rounded text-[10.5px] border ml-auto" style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
              <Archive size={9} className="inline mr-1" />Archive
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {(["description", "parents", "children", "workspace", "history"] as DetailTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2 text-[10.5px] uppercase tracking-[0.22em] border-b-2 transition"
              style={{
                borderBottomColor: tab === t ? "#A78BFA" : "transparent",
                color: tab === t ? "#fde047" : "rgba(255,255,255,0.55)",
              }}
            >
              {t === "history" ? "Run history" : t === "workspace" ? "Workspace files" : t}
            </button>
          ))}
        </div>
        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {tab === "description" && (
            <div className="space-y-3 text-[13px] leading-relaxed">
              <Field label="Body">{task.body ? <pre className="whitespace-pre-wrap font-sans">{task.body}</pre> : <span className="opacity-50 italic">(none)</span>}</Field>
              <Field label="Workspace">{task.workspace_kind ?? "scratch"}{task.workspace_path ? ` · ${task.workspace_path}` : ""}</Field>
              {task.skills && task.skills.length > 0 && <Field label="Skills">{task.skills.join(", ")}</Field>}
              {task.created_at && <Field label="Created">{new Date(task.created_at * 1000).toLocaleString()}</Field>}
              {task.completed_at && <Field label="Completed">{new Date(task.completed_at * 1000).toLocaleString()}</Field>}
              {detail.latest_summary && (
                <Field label="Latest summary"><pre className="whitespace-pre-wrap font-mono text-[11.5px]">{detail.latest_summary}</pre></Field>
              )}
              {detail.comments && detail.comments.length > 0 && (
                <Field label="Comments">
                  <div className="space-y-2">
                    {detail.comments.map((c, i) => (
                      <div key={i} className="rounded border border-white/10 p-2 bg-black/20">
                        <div className="text-[9.5px] font-mono uppercase tracking-[0.18em] mb-1 opacity-60">{c.author} · {new Date(c.created_at * 1000).toLocaleString()}</div>
                        <pre className="whitespace-pre-wrap text-[11.5px] font-mono">{c.body}</pre>
                      </div>
                    ))}
                  </div>
                </Field>
              )}
            </div>
          )}
          {tab === "parents" && <LinkedList items={detail.parents ?? []} emptyLabel="No parent tasks." />}
          {tab === "children" && <LinkedList items={detail.children ?? []} emptyLabel="No sub-tasks yet. Use 'Decompose' to split this into children." />}
          {tab === "workspace" && (
            <div className="space-y-2 text-[12px]">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/65 font-mono">{filesDir || "(no workspace dir yet)"}</div>
              {files.length === 0 ? (
                <div className="text-[12px] italic opacity-50">No files yet. Worker hasn't produced files here.</div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {files.map((f) => (
                    <li key={f.name} className="flex items-center gap-2 py-1.5">
                      <span className="font-mono text-[12px]">{f.isDir ? "📁" : "📄"} {f.name}</span>
                      {!f.isDir && <span className="text-[10px] opacity-50 ml-auto">{(f.size / 1024).toFixed(1)} KB</span>}
                      <span className="text-[10px] opacity-40 font-mono">{new Date(f.mtime).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {tab === "history" && (
            <div className="space-y-2">
              {(detail.events ?? []).length === 0 ? (
                <div className="italic opacity-50 text-[12px]">No events.</div>
              ) : (
                (detail.events ?? []).slice().reverse().map((ev, i) => (
                  <div key={i} className="rounded border border-white/10 p-2 bg-black/20">
                    <div className="flex items-center gap-2 text-[9.5px] font-mono uppercase tracking-[0.18em] opacity-65">
                      <span style={{ color: "#A78BFA" }}>{ev.kind}</span>
                      <span className="ml-auto">{new Date(ev.created_at * 1000).toLocaleString()}</span>
                    </div>
                    {ev.payload != null && <pre className="text-[10.5px] font-mono mt-1 whitespace-pre-wrap opacity-75">{JSON.stringify(ev.payload, null, 2).slice(0, 800)}</pre>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper bits ─────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/65 mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
function LinkedList({ items, emptyLabel }: { items: { id: string; title?: string; status?: TaskStatus }[]; emptyLabel: string }) {
  if (items.length === 0) return <div className="italic opacity-50 text-[12px]">{emptyLabel}</div>;
  return (
    <ul className="space-y-1.5">
      {items.map((p) => (
        <li key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-white/10 bg-black/20 text-[12px]">
          <span className="font-mono opacity-60 text-[10px]">{p.id}</span>
          {p.status && <span className="px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-[0.15em]" style={{ background: `${COLUMNS.find((c) => c.status === p.status)?.tone ?? "#888"}22`, color: COLUMNS.find((c) => c.status === p.status)?.tone ?? "#888" }}>{p.status}</span>}
          <span className="truncate">{p.title ?? "(untitled)"}</span>
          <ChevronRight size={11} className="opacity-40 ml-auto" />
        </li>
      ))}
    </ul>
  );
}
function AssignDropdown({ assignees, onAssign }: { assignees: { hermes: Assignee[]; nonHermes: Assignee[] }; onAssign: (id: string) => void }) {
  return (
    <select
      defaultValue=""
      onChange={(e) => { if (e.target.value) { onAssign(e.target.value); e.target.value = ""; } }}
      className="px-2 py-1 rounded text-[10.5px] bg-black/40 border border-white/15"
      style={{ color: "rgba(255,255,255,0.7)" }}
    >
      <option value="">Reassign…</option>
      <optgroup label="Hermes">
        {assignees.hermes.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
      </optgroup>
      <optgroup label="Other agents">
        {assignees.nonHermes.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
      </optgroup>
      <option value="none">— unassign —</option>
    </select>
  );
}

// ─── Columbus, OH local time formatter ──────────────────────────────────
function fmtColumbus(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
