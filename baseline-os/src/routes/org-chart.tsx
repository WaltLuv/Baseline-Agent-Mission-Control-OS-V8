/**
 * AI Org Chart — Walt's PRIVATE agent hierarchy (Baseline OS only).
 *
 * This is the local/private org chart. It can include Walt-private agents such
 * as Slim Charles, PI Agent, Hermes, Don Draper, Phil Gaston, Lester Freeman,
 * the Claude Code Studio team, the Video Editing Team, and any personal
 * personas. Full CRUD: create / edit / re-role / re-department / assign manager
 * / assign skills, tools, memory access, runtime, permissions / archive+delete
 * with confirmation / categorize / view hierarchy + status + approval authority.
 *
 * Persistence is local-first (browser store on this machine) so it stays
 * private to the operator. Seeds once from the Hermes persona roster so the
 * existing roster appears immediately; everything is editable after that.
 *
 * (Baseline Mission Control runs the same module but workspace-scoped to each
 * customer — and never contains Slim Charles or any Walt-private agent.)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Network,
  Plus,
  Pencil,
  Archive,
  Trash2,
  ShieldAlert,
  X,
  GitBranch,
  Map as MapIcon,
  Workflow,
  Table2,
  Brain,
} from "lucide-react";
import { AgentActivity } from "@/components/agent-activity";
import {
  orgPlanFromDirective,
  planAdditions,
  GENERATABLE_DIRECTIVES,
  type RosterAgent,
} from "@/lib/workforce-autogen";
import { CONSOLE_DIRECTIVES } from "@/lib/workforce-console";
import { recordMission } from "@/lib/replay-store";

export const Route = createFileRoute("/org-chart")({
  head: () => ({
    meta: [
      { title: "AI Org Chart — Baseline OS" },
      {
        name: "description",
        content: "Walt's private AI agent hierarchy — create, organize, and manage every persona.",
      },
    ],
  }),
  component: OrgChartPage,
});

const TONE = "#8B5CF6";
const STORE_KEY = "baseline-os-org-chart";

const DEPARTMENTS = [
  "Leadership & Orchestration",
  "Creative Studio",
  "Video Team",
  "Intelligence",
  "Operations",
  "Engineering",
  "Personal",
] as const;

const APPROVAL = ["auto", "walt-approval", "walt-only"] as const;
type Approval = (typeof APPROVAL)[number];

interface OrgAgent {
  id: string;
  name: string;
  role: string;
  department: string;
  category: string;
  managerId: string | null;
  skills: string[];
  tools: string[];
  memoryAccess: string[];
  runtime: string;
  permissions: string[];
  approval: Approval;
  status: string;
  archived: boolean;
  sortOrder: number;
}

interface OrgNode extends OrgAgent {
  reports: OrgNode[];
}

function load(): OrgAgent[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}
function save(agents: OrgAgent[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(agents));
  } catch {
    /* quota */
  }
}

let idCounter = 0;
function newId(): string {
  idCounter = (idCounter + 1) % 100000;
  return `org_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function csv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildHierarchy(agents: OrgAgent[]): OrgNode[] {
  const byId = new Map<string, OrgNode>();
  agents.forEach((a) => byId.set(a.id, { ...a, reports: [] }));
  const roots: OrgNode[] = [];
  byId.forEach((node) => {
    if (node.managerId && byId.has(node.managerId)) byId.get(node.managerId)!.reports.push(node);
    else roots.push(node);
  });
  return roots;
}

interface PersonaSeed {
  id: string;
  name: string;
  job?: string;
  tools?: string[];
}

function OrgChartPage() {
  const [agents, setAgents] = useState<OrgAgent[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<OrgAgent | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Seed once from the private Hermes persona roster, then stay local + editable.
  useEffect(() => {
    const existing = load();
    if (existing.length) {
      setAgents(existing);
      setReady(true);
      return;
    }
    fetch("/__personas_overview")
      .then((r) => r.json())
      .then((j: { personas?: PersonaSeed[] }) => {
        const seeded: OrgAgent[] = (j.personas ?? []).map((p, i) => ({
          id: p.id || newId(),
          name: p.name,
          role: p.job ?? "",
          department: "Personal",
          category: "Persona",
          managerId: null,
          skills: [],
          tools: p.tools ?? [],
          memoryAccess: [],
          runtime: "hermes",
          permissions: [],
          approval: "walt-approval",
          status: "active",
          archived: false,
          sortOrder: i,
        }));
        save(seeded);
        setAgents(seeded);
      })
      .catch(() => setAgents([]))
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: OrgAgent[]) => {
    setAgents(next);
    save(next);
  }, []);

  const upsert = useCallback(
    (a: OrgAgent) => {
      const exists = agents.some((x) => x.id === a.id);
      persist(exists ? agents.map((x) => (x.id === a.id ? a : x)) : [...agents, a]);
      setEditing(null);
      setShowForm(false);
    },
    [agents, persist],
  );

  const remove = useCallback(
    (a: OrgAgent) => {
      if (
        !window.confirm(
          `Delete "${a.name}"? This permanently removes the agent from your org chart.`,
        )
      )
        return;
      persist(
        agents
          .filter((x) => x.id !== a.id)
          .map((x) => (x.managerId === a.id ? { ...x, managerId: null } : x)),
      );
    },
    [agents, persist],
  );

  const archive = useCallback(
    (a: OrgAgent) =>
      persist(agents.map((x) => (x.id === a.id ? { ...x, archived: !x.archived } : x))),
    [agents, persist],
  );

  // Phase 1: generate the private org chart from a workforce directive (idempotent).
  const [genSlug, setGenSlug] = useState<string>(GENERATABLE_DIRECTIVES[0]);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const generateFromWorkforce = useCallback(() => {
    const plan = orgPlanFromDirective(genSlug);
    const additions = planAdditions(agents as unknown as RosterAgent[], plan, newId);
    if (additions.length === 0) {
      setGenMsg("Org chart already up to date — no duplicate agents created.");
      return;
    }
    const full = additions.map((a, i) => ({
      id: a.id,
      name: String(a.name),
      role: String((a as Record<string, unknown>).role ?? ""),
      department: String((a as Record<string, unknown>).department ?? ""),
      category: String(a.category ?? ""),
      managerId: a.managerId,
      skills: ((a as Record<string, unknown>).skills as string[]) ?? [],
      tools: [],
      memoryAccess: ((a as Record<string, unknown>).memoryAccess as string[]) ?? [],
      runtime: String((a as Record<string, unknown>).runtime ?? "hermes"),
      permissions: [],
      approval: ((a as Record<string, unknown>).approval as Approval) ?? "auto",
      status: "active",
      archived: false,
      sortOrder: agents.length + i,
    })) as OrgAgent[];
    persist([...agents, ...full]);
    setGenMsg(`Org chart generated · ${additions.length} agents created from "${genSlug}"`);
    // Replay: org-chart generation is a replayable mission.
    try {
      const now = Date.now();
      recordMission(
        `Org chart generated: ${genSlug}`,
        `Workforce → org chart (${genSlug})`,
        [
          { ts: now, kind: "tool_call", agent: "Workforce Installer", label: `generate org from ${genSlug}` },
          ...full.map((a) => ({ ts: now, kind: "agent_start" as const, agent: a.name, label: `created in org chart` })),
          { ts: now, kind: "output" as const, label: `${additions.length} agents created` },
        ],
      );
    } catch {
      /* replay optional */
    }
  }, [genSlug, agents, persist]);

  const visible = useMemo(
    () => agents.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [agents],
  );
  const hierarchy = useMemo(() => buildHierarchy(visible), [visible]);
  const nameOf = (id: string | null) => agents.find((a) => a.id === id)?.name ?? "—";

  const [view, setView] = useState<"tree" | "map" | "execution" | "table">("tree");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visible.find((a) => a.id === selectedId) ?? null;

  // Workforce analytics — real counts from the roster.
  const analytics = useMemo(
    () => ({
      total: visible.length,
      active: visible.filter((a) => a.status === "active").length,
      idle: visible.filter((a) => a.status !== "active").length,
      approvalGated: visible.filter((a) => a.approval !== "auto").length,
      departments: new Set(visible.map((a) => a.department || "Unassigned")).size,
    }),
    [visible],
  );

  const VIEWS = [
    { id: "tree" as const, label: "Organization", icon: GitBranch },
    { id: "map" as const, label: "Workforce Map", icon: MapIcon },
    { id: "execution" as const, label: "Execution", icon: Workflow },
    { id: "table" as const, label: "Table (CRUD)", icon: Table2 },
  ];

  return (
    <div className="min-h-screen p-6 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={20} style={{ color: TONE }} />
          <div>
            <h1 className="text-lg font-bold">Workforce Command Layer</h1>
            <p className="text-xs text-white/50">
              Your private AI workforce — Slim Charles, PI Agent, Hermes, and every persona.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Phase 1: generate an org chart from a workforce directive (idempotent). */}
          <select
            value={genSlug}
            onChange={(e) => setGenSlug(e.target.value)}
            data-testid="org-generate-select"
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
          >
            {GENERATABLE_DIRECTIVES.map((id) => (
              <option key={id} value={id}>
                {CONSOLE_DIRECTIVES.find((d) => d.directiveId === id)?.label.split(":")[0] ?? id}
              </option>
            ))}
          </select>
          <button
            onClick={generateFromWorkforce}
            data-testid="org-generate"
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/5"
          >
            Generate workforce
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-black"
            style={{ backgroundColor: TONE }}
            data-testid="org-new"
          >
            <Plus size={15} /> New agent
          </button>
        </div>
      </div>
      {genMsg && (
        <p className="mb-3 text-xs text-emerald-400" data-testid="org-generate-confirm">
          ✓ {genMsg}
        </p>
      )}

      {/* Workforce analytics — real data */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="org-analytics">
        {[
          { label: "Agents", value: analytics.total },
          { label: "Active", value: analytics.active },
          { label: "Idle", value: analytics.idle },
          { label: "Approval-gated", value: analytics.approvalGated },
          { label: "Departments", value: analytics.departments },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-2xl font-bold" style={{ color: TONE }}>
              {s.value}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/45">{s.label}</div>
          </div>
        ))}
      </div>

      {/* View switcher */}
      <div className="mb-4 flex flex-wrap gap-1" data-testid="org-view-switcher">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            data-testid={`org-view-${v.id}`}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold"
            style={{
              background: view === v.id ? `${TONE}26` : "rgba(255,255,255,0.04)",
              color: view === v.id ? "#e9d5ff" : "rgba(255,255,255,0.5)",
            }}
          >
            <v.icon size={13} /> {v.label}
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="text-sm text-white/50">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-white/50" data-testid="org-empty">
          No agents yet. Add one to start your private org chart.
        </p>
      ) : (
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            {view === "table" && (
              <div className="space-y-2" data-testid="org-roster">
                {hierarchy.map((node) => (
                  <OrgRow
                    key={node.id}
                    node={node}
                    depth={0}
                    nameOf={nameOf}
                    onEdit={(a) => {
                      setEditing(a);
                      setShowForm(true);
                    }}
                    onArchive={archive}
                    onDelete={remove}
                  />
                ))}
              </div>
            )}
            {view === "tree" && (
              <OrgTree nodes={hierarchy} selectedId={selectedId} onSelect={setSelectedId} />
            )}
            {view === "map" && (
              <WorkforceMap agents={visible} selectedId={selectedId} onSelect={setSelectedId} />
            )}
            {view === "execution" && <ExecutionView nodes={hierarchy} />}
          </div>

          {/* Agent side panel + embedded Activity view */}
          {selected && (
            <AgentSidePanel
              agent={selected}
              managerName={nameOf(selected.managerId)}
              onClose={() => setSelectedId(null)}
              onEdit={(a) => {
                setEditing(a);
                setShowForm(true);
              }}
            />
          )}
        </div>
      )}

      {showForm && (
        <AgentForm
          agent={editing}
          agents={agents}
          onCancel={() => {
            setEditing(null);
            setShowForm(false);
          }}
          onSave={upsert}
        />
      )}
    </div>
  );
}

function OrgRow({
  node,
  depth,
  nameOf,
  onEdit,
  onArchive,
  onDelete,
}: {
  node: OrgNode;
  depth: number;
  nameOf: (id: string | null) => string;
  onEdit: (a: OrgAgent) => void;
  onArchive: (a: OrgAgent) => void;
  onDelete: (a: OrgAgent) => void;
}) {
  return (
    <>
      <div
        className="flex items-start justify-between rounded-lg border border-white/10 bg-black/30 p-3"
        style={{ marginLeft: depth * 20 }}
        data-testid={`org-agent-${node.id}`}
      >
        <div>
          <div className="text-sm font-semibold">
            {node.name} <span className="text-xs text-white/40">· {node.role || "no role"}</span>
            {node.approval !== "auto" && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-300">
                <ShieldAlert size={11} /> {node.approval}
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/40">
            {node.department || "Unassigned"} · reports to {nameOf(node.managerId)} · runtime{" "}
            {node.runtime || "—"} · {node.status}
          </div>
          <div className="text-[11px] text-white/30">
            skills: {node.skills.join(", ") || "—"} · tools: {node.tools.join(", ") || "—"} ·
            memory: {node.memoryAccess.join(", ") || "—"} · perms:{" "}
            {node.permissions.join(", ") || "—"}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onEdit(node)}
            className="rounded-md border border-white/10 p-1.5 hover:bg-white/5"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onArchive(node)}
            className="rounded-md border border-white/10 p-1.5 hover:bg-white/5"
            title="Archive"
          >
            <Archive size={13} />
          </button>
          <button
            onClick={() => onDelete(node)}
            className="rounded-md border border-red-500/40 p-1.5 text-red-400 hover:bg-red-500/10"
            title="Delete"
            data-testid={`org-delete-${node.id}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {node.reports.map((r) => (
        <OrgRow
          key={r.id}
          node={r}
          depth={depth + 1}
          nameOf={nameOf}
          onEdit={onEdit}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function AgentForm({
  agent,
  agents,
  onCancel,
  onSave,
}: {
  agent: OrgAgent | null;
  agents: OrgAgent[];
  onCancel: () => void;
  onSave: (a: OrgAgent) => void;
}) {
  const [f, setF] = useState<OrgAgent>(
    agent ?? {
      id: newId(),
      name: "",
      role: "",
      department: "",
      category: "",
      managerId: null,
      skills: [],
      tools: [],
      memoryAccess: [],
      runtime: "",
      permissions: [],
      approval: "walt-approval",
      status: "active",
      archived: false,
      sortOrder: agents.length,
    },
  );
  const set = (patch: Partial<OrgAgent>) => setF((p) => ({ ...p, ...patch }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      data-testid="org-form"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-white/10 bg-[#15131f] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{agent ? "Edit agent" : "New agent"}</h2>
          <button onClick={onCancel} className="rounded-md p-1 hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-2">
          <input
            value={f.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Name *"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
            data-testid="org-name"
          />
          <input
            value={f.role}
            onChange={(e) => set({ role: e.target.value })}
            placeholder="Title / role"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          <select
            value={f.department}
            onChange={(e) => set({ department: e.target.value })}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          >
            <option value="">Department…</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={f.managerId ?? ""}
            onChange={(e) => set({ managerId: e.target.value || null })}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          >
            <option value="">Manager…</option>
            {agents
              .filter((a) => a.id !== f.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
          <input
            value={f.category}
            onChange={(e) => set({ category: e.target.value })}
            placeholder="Category"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          <input
            value={f.runtime}
            onChange={(e) => set({ runtime: e.target.value })}
            placeholder="Runtime (e.g. hermes, claude-code)"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          <input
            defaultValue={f.skills.join(", ")}
            onBlur={(e) => set({ skills: csv(e.target.value) })}
            placeholder="Skills (comma-separated)"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          <input
            defaultValue={f.tools.join(", ")}
            onBlur={(e) => set({ tools: csv(e.target.value) })}
            placeholder="Tools (comma-separated)"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          <input
            defaultValue={f.memoryAccess.join(", ")}
            onBlur={(e) => set({ memoryAccess: csv(e.target.value) })}
            placeholder="Memory access (scopes)"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          <input
            defaultValue={f.permissions.join(", ")}
            onBlur={(e) => set({ permissions: csv(e.target.value) })}
            placeholder="Permissions"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          />
          <select
            value={f.approval}
            onChange={(e) => set({ approval: e.target.value as Approval })}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          >
            {APPROVAL.map((a) => (
              <option key={a} value={a}>
                approval authority: {a}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => f.name.trim() && onSave(f)}
            className="rounded-md px-4 py-2 text-sm font-semibold text-black"
            style={{ backgroundColor: TONE }}
            data-testid="org-save"
          >
            {agent ? "Update agent" : "Create agent"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border border-white/10 px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── V2 command views ────────────────────────────────────────────────
const APPROVAL_STYLE: Record<string, { label: string; color: string }> = {
  auto: { label: "Auto", color: "#34d399" },
  "walt-approval": { label: "Walt approval", color: "#fbbf24" },
  "walt-only": { label: "Walt only", color: "#f87171" },
};

function ApprovalBadge({ approval }: { approval: string }) {
  const s = APPROVAL_STYLE[approval] ?? APPROVAL_STYLE.auto;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{ background: `${s.color}22`, color: s.color }}
      data-testid="org-approval-badge"
    >
      <ShieldAlert size={9} /> {s.label}
    </span>
  );
}

function MemoryBadges({ layers }: { layers: string[] }) {
  if (!layers.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1" data-testid="org-memory-badges">
      {layers.slice(0, 5).map((m) => (
        <span
          key={m}
          className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1 py-0.5 text-[9px] text-white/60"
        >
          <Brain size={8} /> {m}
        </span>
      ))}
    </span>
  );
}

// ORGANIZATION VIEW — expandable hierarchy with manager relationships + badges.
function OrgTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: OrgNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5" data-testid="org-tree">
      {nodes.map((n) => (
        <OrgTreeNode key={n.id} node={n} depth={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function OrgTreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: OrgNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasReports = node.reports.length > 0;
  const active = selectedId === node.id;
  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginLeft: depth * 22 }}>
        {hasReports ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-white/40 hover:text-white"
            aria-label="toggle"
          >
            <GitBranch size={12} className={open ? "" : "opacity-50"} />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <button
          onClick={() => onSelect(node.id)}
          data-testid={`org-tree-node-${node.id}`}
          className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left"
          style={{
            borderColor: active ? "#8B5CF6" : "rgba(255,255,255,0.1)",
            background: active ? "rgba(139,92,246,0.12)" : "rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="truncate">{node.name}</span>
              <span className="text-[11px] text-white/40">{node.role || "no role"}</span>
              <ApprovalBadge approval={node.approval} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
              <span>{node.department || "Unassigned"}</span>
              <span>· {node.runtime || "—"}</span>
              <span>· {node.status}</span>
              <MemoryBadges layers={node.memoryAccess} />
            </div>
          </div>
          {hasReports && (
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-white/50">
              {node.reports.length} report{node.reports.length > 1 ? "s" : ""}
            </span>
          )}
        </button>
      </div>
      {open &&
        node.reports.map((r) => (
          <OrgTreeNode
            key={r.id}
            node={r}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

// WORKFORCE MAP — SVG nodes (by department) + manager edges.
function WorkforceMap({
  agents,
  selectedId,
  onSelect,
}: {
  agents: OrgAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const W = 760,
    rowH = 92;
  const byDept = useMemo(() => {
    const m = new Map<string, OrgAgent[]>();
    for (const a of agents) {
      const d = a.department || "Unassigned";
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(a);
    }
    return [...m.entries()];
  }, [agents]);
  const pos = new Map<string, { x: number; y: number }>();
  byDept.forEach(([, list], row) =>
    list.forEach((a, i) => {
      pos.set(a.id, { x: 70 + (i * (W - 120)) / Math.max(1, list.length), y: 50 + row * rowH });
    }),
  );
  const H = Math.max(220, byDept.length * rowH + 40);
  return (
    <div
      className="overflow-auto rounded-xl border border-white/10 bg-black/30 p-2"
      data-testid="org-map"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 240 }}>
        {/* edges: report → manager */}
        {agents.map((a) => {
          const p = pos.get(a.id);
          const mp = a.managerId ? pos.get(a.managerId) : null;
          if (!p || !mp) return null;
          return (
            <line
              key={`e-${a.id}`}
              x1={p.x}
              y1={p.y}
              x2={mp.x}
              y2={mp.y}
              stroke="rgba(139,92,246,0.35)"
              strokeWidth={1.5}
            />
          );
        })}
        {byDept.map(([dept], row) => (
          <text
            key={dept}
            x={8}
            y={50 + row * rowH - 22}
            fill="rgba(255,255,255,0.35)"
            fontSize={10}
            style={{ textTransform: "uppercase", letterSpacing: 1 }}
          >
            {dept}
          </text>
        ))}
        {agents.map((a) => {
          const p = pos.get(a.id);
          if (!p) return null;
          const active = selectedId === a.id;
          return (
            <g
              key={a.id}
              transform={`translate(${p.x},${p.y})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(a.id)}
              data-testid={`org-map-node-${a.id}`}
            >
              <circle
                r={active ? 13 : 10}
                fill={active ? "#8B5CF6" : "#1e1b2e"}
                stroke="#8B5CF6"
                strokeWidth={1.5}
              />
              <text y={28} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={9}>
                {a.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// EXECUTION VIEW — work flowing through the org (honest idle when none).
function ExecutionView({ nodes }: { nodes: OrgNode[] }) {
  // Build a representative chain from the hierarchy (lead → reports → approval → delivery).
  const lead = nodes[0];
  const chain = lead ? [lead.name, ...lead.reports.slice(0, 2).map((r) => r.name)] : [];
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-5" data-testid="org-execution">
      <div className="mb-3 text-[11px] uppercase tracking-widest text-white/55">
        Active execution flow
      </div>
      {chain.length === 0 ? (
        <p className="text-[12px] text-white/40">
          No active missions. When agents run, the live flow (lead → research → analysis → approval
          → delivery) animates here — sourced from the real activity ledger, never faked.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {[...chain, "Approval Gate", "Delivery"].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-[12px]">
                {step}
              </div>
              {i < arr.length - 1 && <span className="text-violet-400">↓</span>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] text-white/30">
        Flow is illustrative of the reporting chain; live per-mission execution streams from Agent
        Activity once a workflow runs.
      </p>
    </div>
  );
}

// AGENT SIDE PANEL — full profile + embedded live Agent Activity.
function AgentSidePanel({
  agent,
  managerName,
  onClose,
  onEdit,
}: {
  agent: OrgAgent;
  managerName: string;
  onClose: () => void;
  onEdit: (a: OrgAgent) => void;
}) {
  const rows: [string, string][] = [
    ["Role", agent.role || "—"],
    ["Department", agent.department || "—"],
    ["Manager", managerName],
    ["Runtime", agent.runtime || "—"],
    ["Status", agent.status],
    ["Skills", agent.skills.join(", ") || "—"],
    ["Tools", agent.tools.join(", ") || "—"],
    ["Memory access", agent.memoryAccess.join(", ") || "—"],
    ["Permissions", agent.permissions.join(", ") || "—"],
  ];
  return (
    <aside
      className="w-80 shrink-0 rounded-xl border border-white/10 bg-[#0b0b12] p-4"
      data-testid="org-agent-panel"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold">{agent.name}</div>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={15} />
        </button>
      </div>
      <div className="mb-3">
        <ApprovalBadge approval={agent.approval} />
      </div>
      <dl className="mb-3 space-y-1 text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-24 shrink-0 text-white/40">{k}</dt>
            <dd className="text-white/80">{v}</dd>
          </div>
        ))}
      </dl>
      <button
        onClick={() => onEdit(agent)}
        className="mb-3 w-full rounded-md border border-white/15 py-1.5 text-[12px] hover:bg-white/5"
      >
        Edit agent
      </button>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-white/45">Live activity</div>
      <AgentActivity agentId={agent.id} runtime={agent.runtime} provider={agent.runtime} />
    </aside>
  );
}
