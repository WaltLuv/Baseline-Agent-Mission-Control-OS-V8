/**
 * Goals page — track what matters, ship what counts.
 * Midnight Aubergine palette · gold/amber accents · dopamine-inducing.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  Trash2,
  Target,
  CheckCircle2,
  Circle,
  Flame,
  BookOpen,
  Heart,
  Briefcase,
  Palette,
  ChevronDown,
  Vault,
} from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/components/voice-input";
import { cn } from "@/lib/utils";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Baseline Automations" },
      { name: "description", content: "Track what matters. Ship what counts." },
    ],
  }),
  component: GoalsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "Work" | "Personal" | "Learning" | "Health" | "Creative";
type Priority = "High" | "Medium" | "Low";

interface Goal {
  id: string;
  title: string;
  category: Category;
  priority: Priority;
  done: boolean;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "claude-os.goals.v1";
const CATEGORIES: Category[] = ["Work", "Personal", "Learning", "Health", "Creative"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

const CATEGORY_META: Record<Category, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  Work:     { icon: Briefcase, color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  Personal: { icon: Heart,     color: "#F472B6", bg: "rgba(244,114,182,0.12)" },
  Learning: { icon: BookOpen,  color: "#34D399", bg: "rgba(52,211,153,0.12)" },
  Health:   { icon: Flame,     color: "#FB923C", bg: "rgba(251,146,60,0.12)" },
  Creative: { icon: Palette,   color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
};

const PRIORITY_META: Record<Priority, { color: string; dot: string }> = {
  High:   { color: "#EF4444", dot: "bg-red-400" },
  Medium: { color: "#F59E0B", dot: "bg-amber-400" },
  Low:    { color: "#6B7280", dot: "bg-gray-500" },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Goal[];
  } catch {
    return [];
  }
}

function saveGoals(goals: Goal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch {
    /* quota exceeded — ignore */
  }
}

// ─── Obsidian sync ────────────────────────────────────────────────────────────

async function syncToObsidian(goals: Goal[]) {
  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const content =
    `# 🎯 Goals — ${today.toLocaleString("default", { month: "long" })} ${today.getFullYear()}\n\n` +
    goals
      .map(
        (g) =>
          `- [${g.done ? "x" : " "}] ${g.title}  ${g.category ? `\`${g.category}\`` : ""}`,
      )
      .join("\n");
  // Mirror to both Obsidian (file vault) and Notion (cloud memory) in parallel.
  // Either can fail silently — the other still serves as a memory.
  await Promise.allSettled([
    fetch("/__obsidian_write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relativePath: `Baseline Automations/Goals/goals-${monthKey}.md`,
        content,
      }),
    }),
    fetch("/__notion_page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Goals — ${today.toLocaleString("default", { month: "long" })} ${today.getFullYear()}`,
        content,
      }),
    }).then((r) => r.ok ? null : null), // best-effort — fails if no root set
  ]);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: meta.color }}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {priority}
    </span>
  );
}

function CategoryPill({ category }: { category: Category }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: meta.color, background: meta.bg }}
    >
      <Icon className="h-3 w-3" />
      {category}
    </span>
  );
}

interface GoalCardProps {
  goal: Goal;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  obsidianConfigured: boolean;
}

function GoalCard({ goal, onToggle, onDelete, obsidianConfigured }: GoalCardProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all duration-200",
        "hover:border-white/10",
        goal.done
          ? "border-white/5 bg-white/[0.02] opacity-60"
          : "border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.055]",
      )}
      style={{
        boxShadow: goal.done
          ? "none"
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(goal.id)}
        className="shrink-0 transition-transform duration-150 active:scale-90"
        aria-label={goal.done ? "Mark incomplete" : "Mark complete"}
      >
        {goal.done ? (
          <CheckCircle2 className="h-5 w-5" style={{ color: "#F59E0B" }} />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-amber-400 transition-colors" />
        )}
      </button>

      {/* Title */}
      <span
        className={cn(
          "flex-1 text-sm font-medium leading-snug transition-all",
          goal.done ? "line-through text-muted-foreground/50" : "text-foreground/90",
        )}
      >
        {goal.title}
      </span>

      {/* Metadata */}
      <div className="flex items-center gap-2 shrink-0">
        {obsidianConfigured && goal.done && (
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-emerald-400/80 bg-emerald-400/10 rounded-full px-2 py-0.5">
            <Vault className="h-2.5 w-2.5" />
            Saved to vault
          </span>
        )}
        <CategoryPill category={goal.category} />
        <PriorityBadge priority={goal.priority} />
      </div>

      {/* Delete — appears on hover */}
      <button
        onClick={() => onDelete(goal.id)}
        className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
        aria-label="Delete goal"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals());
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Work");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [filter, setFilter] = useState<Category | "All">("All");
  const [obsidianConfigured, setObsidianConfigured] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect Obsidian availability once
  useEffect(() => {
    fetch("/__obsidian_write", { method: "OPTIONS" })
      .then((r) => setObsidianConfigured(r.ok))
      .catch(() => setObsidianConfigured(false));
  }, []);

  // Persist + sync on every goals change
  useEffect(() => {
    saveGoals(goals);
    if (obsidianConfigured && goals.length > 0) {
      syncToObsidian(goals)
        .then(() => toast.success("✓ Saved to vault", { duration: 2000 }))
        .catch(() => {/* silent */});
    }
  }, [goals, obsidianConfigured]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addGoal = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const next: Goal = {
      id: crypto.randomUUID(),
      title: trimmed,
      category,
      priority,
      done: false,
      createdAt: new Date().toISOString(),
    };
    setGoals((prev) => [next, ...prev]);
    setTitle("");
    inputRef.current?.focus();
  }, [title, category, priority]);

  const toggleGoal = useCallback((id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, done: !g.done } : g)),
    );
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setTitle((prev) => (prev ? `${prev} ${text}` : text));
    inputRef.current?.focus();
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonthGoals = goals.filter((g) => g.createdAt >= monthStart);
  const completedThisMonth = thisMonthGoals.filter((g) => g.done).length;
  const totalThisMonth = thisMonthGoals.length;
  const progressPct = totalThisMonth === 0 ? 0 : Math.round((completedThisMonth / totalThisMonth) * 100);

  const filtered = filter === "All" ? goals : goals.filter((g) => g.category === filter);
  const open = filtered.filter((g) => !g.done);
  const done = filtered.filter((g) => g.done);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          🎯 Goals
        </h1>
        <p className="text-sm text-muted-foreground">
          Track what matters. Ship what counts.
        </p>
      </div>

      {/* Progress bar */}
      {totalThisMonth > 0 && (
        <div
          className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground/70">
              This month's progress
            </span>
            <span className="font-semibold tabular-nums" style={{ color: "#F59E0B" }}>
              {completedThisMonth} / {totalThisMonth} goals
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #F59E0B, #D97757)",
                boxShadow: "0 0 8px rgba(245,158,11,0.5)",
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/60">
            {progressPct}% complete
          </p>
        </div>
      )}

      {/* Add goal form */}
      <div
        className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4 space-y-3"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          New Goal
        </p>

        {/* Title input row */}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGoal()}
            placeholder="What's your next goal?"
            className={cn(
              "flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-muted-foreground/40",
              "focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20",
              "transition-all duration-150",
            )}
          />
          <VoiceInput
            onTranscript={handleVoiceTranscript}
            color="#F59E0B"
          />
        </div>

        {/* Category + Priority + Add */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category select */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={cn(
                "appearance-none rounded-lg border border-white/10 bg-white/5 pl-3 pr-7 py-1.5 text-xs font-medium",
                "focus:outline-none focus:border-amber-500/40",
                "transition-colors cursor-pointer",
              )}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          </div>

          {/* Priority select */}
          <div className="relative">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={cn(
                "appearance-none rounded-lg border border-white/10 bg-white/5 pl-3 pr-7 py-1.5 text-xs font-medium",
                "focus:outline-none focus:border-amber-500/40",
                "transition-colors cursor-pointer",
              )}
              style={{ color: PRIORITY_META[priority].color }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p} Priority</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          </div>

          <div className="flex-1" />

          <button
            onClick={addGoal}
            disabled={!title.trim()}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold",
              "transition-all duration-150 active:scale-95",
              title.trim()
                ? "text-black hover:brightness-110"
                : "opacity-40 cursor-not-allowed text-black/60",
            )}
            style={{
              background: title.trim()
                ? "linear-gradient(135deg, #F59E0B, #D97757)"
                : "rgba(245,158,11,0.3)",
            }}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        {(["All", ...CATEGORIES] as (Category | "All")[]).map((tab) => {
          const active = filter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150",
                active
                  ? "text-black"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
              style={
                active
                  ? { background: "linear-gradient(135deg, #F59E0B, #D97757)" }
                  : {}
              }
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Goal list */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {/* Open goals */}
          {open.length > 0 && (
            <div className="space-y-2">
              {open.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onToggle={toggleGoal}
                  onDelete={deleteGoal}
                  obsidianConfigured={obsidianConfigured}
                />
              ))}
            </div>
          )}

          {/* Completed goals */}
          {done.length > 0 && (
            <div className="space-y-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                Completed · {done.length}
              </p>
              {done.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onToggle={toggleGoal}
                  onDelete={deleteGoal}
                  obsidianConfigured={obsidianConfigured}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,87,0.2))" }}
      >
        <Target className="h-7 w-7" style={{ color: "#F59E0B" }} />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground/80">No goals yet</p>
        <p className="max-w-xs text-sm text-muted-foreground/60">
          Every great ship started with a plan. Add your first goal and start building momentum.
        </p>
      </div>
    </div>
  );
}
