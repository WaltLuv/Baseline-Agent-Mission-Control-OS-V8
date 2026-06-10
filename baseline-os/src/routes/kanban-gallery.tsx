import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  drive,
  approve,
  listCards,
  OS_TEMPLATES,
  type KanbanCard,
  type Stage,
} from "@/lib/kanban-drive-store";

export const Route = createFileRoute("/kanban-gallery")({
  head: () => ({
    meta: [
      { title: "Self-Driving Kanban 2.0 — Baseline Automations" },
      {
        name: "description",
        content: "Idea → 5-floor plan → approval → build → self-check → shipped gallery.",
      },
    ],
  }),
  component: KanbanGalleryPage,
});

const STAGES: Stage[] = [
  "Input",
  "Awaiting_Approval",
  "Implementation",
  "Self_Check",
  "Shipped_Gallery",
];
const TONE = "#a78bfa";

function KanbanGalleryPage() {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [idea, setIdea] = useState("");
  const [sel, setSel] = useState<KanbanCard | null>(null);

  const load = useCallback(() => setCards(listCards()), []);
  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, [load]);

  const runDrive = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      let files: string[] = [];
      try {
        const r = await fetch(`/__graphify?q=${encodeURIComponent(text)}`);
        const j = await r.json();
        files = (j.results ?? []).map((n: { path: string }) => n.path).slice(0, 6);
      } catch {
        /* graph optional */
      }
      const c = drive(text, files);
      setIdea("");
      load();
      setSel(c);
    },
    [load],
  );

  const decide = (cid: string, d: "approve" | "reject" | "request_changes") => {
    const c = approve(cid, d, "walt");
    load();
    if (c) setSel(c);
  };

  const byStage = (s: Stage) => cards.filter((c) => c.stage === s);

  return (
    <div className="min-h-screen bg-[#08070d] p-6 text-white" data-testid="kanban-gallery-page">
      <div className="mb-3">
        <h1 className="text-lg font-bold">Self-Driving Kanban 2.0</h1>
        <p className="text-xs text-white/50">
          /drive an idea → 5-floor plan → approval → build (safe draft) → self-check → shipped
          gallery. Graph-first; replay on every card.
        </p>
      </div>

      <div className="flex gap-2" data-testid="kanban-drive">
        <input
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runDrive(idea)}
          placeholder='/drive "Build a responsive habit tracking widget with dark mode toggles"'
          className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
          data-testid="kanban-idea"
        />
        <button
          onClick={() => void runDrive(idea)}
          className="rounded-md px-4 py-2 text-sm font-semibold text-black"
          style={{ background: TONE }}
        >
          /drive
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1" data-testid="kanban-templates">
        {OS_TEMPLATES.map((t) => (
          <button
            key={t.slug}
            onClick={() => void runDrive(t.idea)}
            className="rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10"
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-5" data-testid="kanban-board">
        {STAGES.map((s) => (
          <div key={s} className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
            <div className="mb-1 text-[9px] uppercase tracking-widest text-white/45">
              {s.replace(/_/g, " ")} · {byStage(s).length}
            </div>
            {byStage(s).map((c) => (
              <button
                key={c.id}
                onClick={() => setSel(c)}
                className={`mb-1 w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] ${sel?.id === c.id ? "bg-violet-500/15 text-violet-200" : "bg-white/[0.03]"}`}
                data-testid={`kanban-card-${c.id}`}
              >
                {c.projectName}
              </button>
            ))}
          </div>
        ))}
      </div>

      {sel && (
        <div
          className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[12px]"
          data-testid="kanban-detail"
        >
          <div className="mb-1 font-semibold">
            {sel.projectName}{" "}
            <span className="text-white/45">
              · {sel.stage} · floor {sel.floor}
            </span>
          </div>
          <ol className="space-y-0.5">
            {sel.plan.floors.map((f) => (
              <li key={f.floor} className="text-white/70">
                Floor {f.floor} {f.name}: {f.output}
              </li>
            ))}
          </ol>
          {sel.stage === "Awaiting_Approval" && (
            <div className="mt-2 flex gap-2" data-testid="kanban-approval-gate">
              <button
                onClick={() => decide(sel.id, "approve")}
                className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold"
                data-testid="kanban-approve"
              >
                Approve
              </button>
              <button
                onClick={() => decide(sel.id, "reject")}
                className="rounded-md bg-red-600 px-3 py-1 text-[11px] font-semibold"
              >
                Reject
              </button>
              <button
                onClick={() => decide(sel.id, "request_changes")}
                className="rounded-md border border-white/15 px-3 py-1 text-[11px]"
              >
                Request changes
              </button>
            </div>
          )}
          {sel.selfCheckerLogs && (
            <div className="mt-2 text-white/70">
              Self-checker: {sel.selfCheckerLogs} (attempts {sel.attempts})
            </div>
          )}
          {sel.stage === "Shipped_Gallery" && (
            <div className="mt-2" data-testid="kanban-shipped">
              <div className="text-emerald-400">✓ Shipped · {sel.shippedPath}</div>
              <div className="text-white/45">
                Replay: {sel.replayId} · Obsidian: {sel.obsidianPath ?? "syncing…"}
              </div>
              <pre
                className="mt-1 max-h-48 overflow-auto rounded bg-black/30 p-2 text-[10px] text-white/70"
                data-testid="kanban-preview"
              >
                {sel.artifact}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
