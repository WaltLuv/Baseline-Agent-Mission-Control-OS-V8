/**
 * Journal page — daily writing, voice input, Obsidian sync.
 * Midnight Aubergine · lavender/purple accents · warm and intimate.
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Save, NotebookPen, Pencil, CalendarDays, Flame } from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/components/voice-input";
import { cn } from "@/lib/utils";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Baseline Automations" },
      { name: "description", content: "Your daily writing space." },
    ],
  }),
  component: JournalPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "claude-os.journal.v1";

// 31 prompts — one per day-of-month (1-indexed, day 0 → last item).
const DAILY_PROMPTS: string[] = [
  "What did you build today?",
  "What surprised you?",
  "What's weighing on you?",
  "Who inspired you recently?",
  "What are you most proud of this week?",
  "What's one thing you'd do differently today?",
  "What are you looking forward to?",
  "What did you learn something new about?",
  "What conversation is still in your head?",
  "What problem are you itching to solve?",
  "What is costing you the most energy right now?",
  "What tiny win deserves more credit?",
  "What would you tell your past self?",
  "What's the most honest thing you could write?",
  "What are you avoiding, and why?",
  "What made you laugh today?",
  "What idea kept nagging at you?",
  "What does success look like for you this month?",
  "What are you grateful for right now?",
  "What's the one thing that, if done, would make everything else easier?",
  "What did you create today — even something tiny?",
  "What fear is holding you back?",
  "What do you need to say out loud?",
  "What story are you telling yourself that might not be true?",
  "What does rest look like for you?",
  "What boundary do you need to set?",
  "What would make tomorrow exceptional?",
  "What did you observe today that you usually rush past?",
  "What's one small step you could take right now?",
  "What are you still figuring out?",
  "What does your future self thank you for?",
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

type JournalStore = Record<string, string>; // { "YYYY-MM-DD": "entry text" }

function loadJournal(): JournalStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as JournalStore;
  } catch {
    return {};
  }
}

function saveJournal(store: JournalStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota exceeded */
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getPastDays(n: number): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function computeStreak(store: JournalStore): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    if (store[key] && store[key].trim().length > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Obsidian sync ────────────────────────────────────────────────────────────

async function saveToVault(
  dateKey: string,
  content: string,
  prompt: string,
): Promise<void> {
  const d = new Date(dateKey + "T12:00:00");
  const header = `# 📔 Journal — ${formatDateLong(d)} ${d.getFullYear()}`;
  const body = [
    header,
    "",
    `> *"${prompt}"*`,
    "",
    content,
    "",
    "---",
    "*Written via Baseline Automations · Baseline Automations*",
  ].join("\n");

  // Mirror to both Obsidian and Notion (best-effort — either can no-op safely).
  const [obsidian, _notion] = await Promise.allSettled([
    fetch("/__obsidian_write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relativePath: `Baseline Automations/Journal/${dateKey}.md`,
        content: body,
      }),
    }),
    fetch("/__notion_page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Journal — ${formatDateLong(d)} ${d.getFullYear()}`,
        content: body,
      }),
    }),
  ]);
  // Obsidian is the primary; Notion is a bonus. Only throw if Obsidian fails.
  if (obsidian.status === "fulfilled" && !obsidian.value.ok) throw new Error("Obsidian write failed");
  if (obsidian.status === "rejected") throw new Error("Obsidian write failed");
}

// ─── Main page ────────────────────────────────────────────────────────────────

function JournalPage() {
  const [store, setStore] = useState<JournalStore>(() => loadJournal());
  const [activeDateKey, setActiveDateKey] = useState<string>(() => toDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const today = new Date();
  const todayKey = toDateKey(today);
  const activeDate = useMemo(() => new Date(activeDateKey + "T12:00:00"), [activeDateKey]);
  const isToday = activeDateKey === todayKey;

  // Prompt based on day of month (1–31)
  const prompt = DAILY_PROMPTS[(activeDate.getDate() - 1) % DAILY_PROMPTS.length];

  const currentText = store[activeDateKey] ?? "";
  const wordCount = currentText.trim() === "" ? 0 : currentText.trim().split(/\s+/).length;

  const streak = useMemo(() => computeStreak(store), [store]);
  const pastDays = useMemo(() => getPastDays(7), []);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 280)}px`;
  }, [currentText]);

  // Persist store whenever it changes
  useEffect(() => {
    saveJournal(store);
  }, [store]);

  // Debounced auto-save feedback (local only — just persists)
  const handleChange = useCallback(
    (text: string) => {
      setStore((prev) => ({ ...prev, [activeDateKey]: text }));
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        // Just a visual cue — already saved to localStorage above
        // (no toast here to avoid noise on every keystroke)
      }, 3000);
    },
    [activeDateKey],
  );

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      const newText = currentText ? `${currentText}\n${text}` : text;
      handleChange(newText);
      // Scroll textarea to bottom
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    },
    [currentText, handleChange],
  );

  const handleSaveToVault = useCallback(async () => {
    if (!currentText.trim()) {
      toast.error("Nothing to save — write something first.");
      return;
    }
    setSaving(true);
    try {
      await saveToVault(activeDateKey, currentText, prompt);
      toast.success("✓ Saved to Obsidian vault", { duration: 2500 });
    } catch {
      toast.error("Could not reach Obsidian. Is the bridge running?");
    } finally {
      setSaving(false);
    }
  }, [activeDateKey, currentText, prompt]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <h1 className="text-2xl font-bold tracking-tight">📔 Journal</h1>
              <p className="text-sm font-medium" style={{ color: "#A78BFA" }}>
                {isToday ? "Today · " : ""}{formatDateLong(activeDate)}
              </p>
            </div>

            {/* Streak badge */}
            {streak >= 2 && (
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(167,139,250,0.2), rgba(124,58,237,0.2))",
                  color: "#A78BFA",
                  border: "1px solid rgba(167,139,250,0.25)",
                }}
              >
                <Flame className="h-3.5 w-3.5" />
                {streak}-day streak
              </div>
            )}
          </div>

          {/* Daily prompt */}
          <div
            className="rounded-xl border px-4 py-3"
            style={{
              borderColor: "rgba(167,139,250,0.2)",
              background: "rgba(167,139,250,0.06)",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: "rgba(167,139,250,0.7)" }}>
              Today's Prompt
            </p>
            <p className="text-sm italic text-foreground/80">"{prompt}"</p>
          </div>

          {/* Editor card */}
          <div
            className="relative rounded-2xl border overflow-hidden"
            style={{
              borderColor: "rgba(167,139,250,0.15)",
              background: "rgba(255,255,255,0.025)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(167,139,250,0.05)",
            }}
          >
            {/* Editor top bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                <Pencil className="h-3 w-3" />
                <span>{isToday ? "Today's entry" : formatDateShort(activeDate)}</span>
              </div>
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                color="#A78BFA"
              />
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={currentText}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Begin writing… (or tap 🎤 to speak)"
              className={cn(
                "w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed",
                "placeholder:text-muted-foreground/25 text-foreground/90",
                "focus:outline-none",
                "transition-all duration-150",
              )}
              style={{ minHeight: 280 }}
              spellCheck
            />

            {/* Bottom bar */}
            <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5">
              <span className="text-[11px] text-muted-foreground/40">
                Auto-saved locally
              </span>
              <span
                className="text-[11px] font-medium tabular-nums"
                style={{ color: wordCount > 0 ? "rgba(167,139,250,0.7)" : "rgba(255,255,255,0.2)" }}
              >
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </span>
            </div>
          </div>

          {/* Save to vault button */}
          <button
            onClick={handleSaveToVault}
            disabled={saving || !currentText.trim()}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold",
              "transition-all duration-150 active:scale-[0.98]",
              currentText.trim() && !saving
                ? "hover:brightness-110"
                : "opacity-40 cursor-not-allowed",
            )}
            style={{
              background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(124,58,237,0.3))",
              border: "1px solid rgba(167,139,250,0.3)",
              color: "#A78BFA",
            }}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save to Obsidian Vault"}
          </button>
        </div>

        {/* Sidebar — past 7 days */}
        <aside className="lg:w-48 shrink-0 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            <CalendarDays className="h-3 w-3" />
            Recent entries
          </div>

          <div className="flex flex-row lg:flex-col gap-1.5 flex-wrap">
            {pastDays.map((day) => {
              const key = toDateKey(day);
              const hasEntry = !!(store[key]?.trim());
              const isActive = key === activeDateKey;
              const isCurrentDay = key === todayKey;

              return (
                <button
                  key={key}
                  onClick={() => setActiveDateKey(key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all duration-150",
                    isActive
                      ? "font-semibold"
                      : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-white/5",
                  )}
                  style={
                    isActive
                      ? {
                          background: "rgba(167,139,250,0.12)",
                          border: "1px solid rgba(167,139,250,0.25)",
                          color: "#A78BFA",
                        }
                      : { border: "1px solid transparent" }
                  }
                >
                  {/* Entry indicator dot */}
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full transition-colors",
                      hasEntry
                        ? "bg-emerald-400"
                        : "bg-white/10 border border-white/10",
                    )}
                  />
                  <span className="truncate">
                    {isCurrentDay ? "Today" : formatDateShort(day)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              Entry written
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
              <span className="h-1.5 w-1.5 rounded-full bg-white/10 border border-white/10 shrink-0" />
              No entry
            </div>
          </div>

          {/* Stats snapshot */}
          <div
            className="rounded-xl border p-3 space-y-2 mt-2"
            style={{
              borderColor: "rgba(167,139,250,0.12)",
              background: "rgba(167,139,250,0.04)",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "rgba(167,139,250,0.6)" }}>
              Stats
            </p>
            <Stat
              label="Entries"
              value={Object.values(store).filter((v) => v.trim()).length}
            />
            <Stat label="Streak" value={`${streak}d`} highlight={streak >= 3} />
            <Stat
              label="Today"
              value={store[todayKey]?.trim()
                ? `${(store[todayKey].trim().split(/\s+/).length)} w`
                : "–"}
            />
          </div>

          {/* Writing prompt CTA when empty */}
          {!store[todayKey]?.trim() && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-1.5">
              <NotebookPen className="h-5 w-5" style={{ color: "rgba(167,139,250,0.5)" }} />
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                You haven't written today. Even two sentences count.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground/50">{label}</span>
      <span
        className="text-[11px] font-semibold tabular-nums"
        style={{ color: highlight ? "#A78BFA" : "rgba(255,255,255,0.6)" }}
      >
        {value}
      </span>
    </div>
  );
}
