/**
 * Self-Driving Kanban 2.0 store (Baseline OS, general-purpose). localStorage-
 * backed; drives a card through the shared engine (planFloors → approval →
 * implement [safe draft] → self-check loop → shipped) and records a replayable
 * mission via the OS replay-store. Obsidian sync = sidecar best-effort/local.
 */
import {
  planFloors,
  selfCheck,
  nextStage,
  obsidianMarkdown,
  MAX_RETRIES,
  type DrivePlan,
} from "@/lib/kanban-drive";
import { recordMission } from "@/lib/replay-store";

export type Stage =
  | "Input"
  | "Awaiting_Approval"
  | "Implementation"
  | "Self_Check"
  | "Shipped_Gallery";

export interface KanbanCard {
  id: string;
  projectName: string;
  idea: string;
  stage: Stage;
  floor: number;
  plan: DrivePlan;
  approvalStatus: "pending" | "approved" | "reject" | "request_changes";
  approvedBy?: string;
  modelRouter: string;
  artifact: string;
  selfCheckerLogs: string;
  attempts: number;
  shippedPath?: string;
  obsidianPath?: string;
  replayId?: string;
  createdAt: number;
}

const KEY = "baseline-os.kanban2.v1";

/** General-purpose starter templates (Baseline OS — NOT PM-specific). */
export const OS_TEMPLATES = [
  {
    slug: "habit-widget",
    name: "Habit tracker widget",
    idea: "Build a responsive habit tracking widget with dark mode toggles",
  },
  {
    slug: "seo-blog",
    name: "SEO blog generator",
    idea: "Build an SEO blog post generator with outline + draft",
  },
  {
    slug: "dashboard",
    name: "Metrics dashboard",
    idea: "Build a metrics dashboard with charts and filters",
  },
  {
    slug: "landing",
    name: "Landing page",
    idea: "Build a marketing landing page with hero and CTA",
  },
] as const;

function read(): KanbanCard[] {
  if (typeof window === "undefined") return [];
  try {
    const j = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}
function write(list: KanbanCard[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  } catch {
    /* quota */
  }
}
let seq = 0;
function id(now: number): string {
  seq = (seq + 1) % 1e6;
  return `kan_${now.toString(36)}${seq.toString(36)}`;
}

export function listCards(): KanbanCard[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}
export function getCard(cid: string): KanbanCard | null {
  return read().find((c) => c.id === cid) ?? null;
}

/** /drive — create a card, run Floors 1-4 → Awaiting_Approval. */
export function drive(idea: string, graphFiles: string[] = [], now = Date.now()): KanbanCard {
  const plan = planFloors(idea, graphFiles);
  const card: KanbanCard = {
    id: id(now),
    projectName: idea.slice(0, 80),
    idea,
    stage: "Awaiting_Approval",
    floor: 4,
    plan,
    approvalStatus: "pending",
    modelRouter: "claude-code (draft mode)",
    artifact: "",
    selfCheckerLogs: "",
    attempts: 0,
    createdAt: now,
  };
  write([card, ...read()]);
  return card;
}

function save(card: KanbanCard): void {
  write([card, ...read().filter((c) => c.id !== card.id)]);
}

/** Approve / reject / request-changes. Only approve runs implementation. */
export function approve(
  cid: string,
  decision: "approve" | "reject" | "request_changes",
  by: string,
  now = Date.now(),
): KanbanCard | null {
  const card = getCard(cid);
  if (!card || card.stage !== "Awaiting_Approval") return card;
  if (decision !== "approve") {
    card.approvalStatus = decision;
    save(card);
    return card;
  }
  card.approvalStatus = "approved";
  card.approvedBy = by;
  card.stage = "Implementation";
  card.floor = 5;
  save(card);
  return implement(cid, now);
}

/** Implementation (safe draft) → self-check loop → ship. */
export function implement(cid: string, now = Date.now()): KanbanCard | null {
  const card = getCard(cid);
  if (!card) return null;
  card.artifact = `// DRAFT (safe mode)\n// ${card.idea}\nexport const spec = ${JSON.stringify(card.plan.payloadSpec, null, 2)}`;
  card.stage = "Self_Check";
  save(card);
  return selfCheckCard(cid, now);
}

export function selfCheckCard(cid: string, now = Date.now()): KanbanCard | null {
  const card = getCard(cid);
  if (!card) return null;
  const r = selfCheck(card.plan.payloadSpec, card.artifact);
  card.attempts += 1;
  card.selfCheckerLogs = r.logs;
  const target = nextStage("Self_Check", { checkPass: r.pass, attempts: card.attempts });
  if (target === "Implementation") {
    card.stage = "Implementation";
    save(card);
    return implement(cid, now);
  }
  return ship(cid, now);
}

export function ship(cid: string, now = Date.now()): KanbanCard | null {
  const card = getCard(cid);
  if (!card) return null;
  card.stage = "Shipped_Gallery";
  card.shippedPath = `gallery/${card.id}`;
  // Replay the whole mission (OS replay-store).
  try {
    const r = recordMission(`/drive: ${card.idea}`.slice(0, 80), card.idea, [
      ...card.plan.floors.map((f) => ({
        ts: now,
        kind: "agent_start" as const,
        agent: `Floor ${f.floor}`,
        label: f.name,
      })),
      { ts: now, kind: "approval" as const, label: `approved by ${card.approvedBy ?? "—"}` },
      { ts: now, kind: "tool_call" as const, agent: "Self-Checker", label: card.selfCheckerLogs },
      { ts: now, kind: "output" as const, label: "Shipped to gallery" },
    ]);
    card.replayId = r.id;
  } catch {
    /* replay optional */
  }
  // Obsidian memory (sidecar best-effort; local fallback handled server-side).
  const md = obsidianMarkdown({
    projectName: card.projectName,
    idea: card.idea,
    plan: card.plan,
    selfCheckLogs: card.selfCheckerLogs,
    artifact: card.artifact,
    replayId: card.replayId,
    modelRouter: card.modelRouter,
    approvedBy: card.approvedBy,
  });
  if (typeof window !== "undefined") {
    fetch("/__obsidian_write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        folder: "Baseline Automations/Kanban",
        name: `${card.id}.md`,
        content: md,
      }),
    })
      .then(() => {
        card.obsidianPath = `Baseline Automations/Kanban/${card.id}.md`;
        save(card);
      })
      .catch(() => {
        card.obsidianPath = "setup-needed: connect Obsidian vault";
        save(card);
      });
  }
  save(card);
  return card;
}
