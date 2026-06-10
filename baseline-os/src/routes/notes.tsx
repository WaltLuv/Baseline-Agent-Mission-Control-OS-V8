import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { StickyNote, Check } from "lucide-react";
import { durableGet, durableSet, lastSavedLabel } from "@/lib/state-integrity";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Baseline Automations" },
      {
        name: "description",
        content: "Durable local notes — survives navigation, refresh, and restart.",
      },
    ],
  }),
  component: NotesPage,
});

const NOTES_KEY = "claude-os.notes.v1";

function NotesPage() {
  const [text, setText] = useState("");
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read durable storage FIRST (never clobber on mount).
  useEffect(() => {
    const stored = durableGet(NOTES_KEY);
    if (stored != null) setText(stored);
    hydrated.current = true;
  }, []);

  // Debounced durable save — gated on hydration; never overwrites with empty
  // unless the user truly clears it (allowEmpty).
  useEffect(() => {
    if (!hydrated.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const res = durableSet(NOTES_KEY, text, { allowEmpty: true });
      if (res.ok) {
        setVerified(res.verified);
        setLastSaved(Date.now());
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text]);

  return (
    <div className="min-h-screen p-6 text-white" data-testid="notes-page">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <StickyNote size={18} /> Notes
        </h1>
        <span
          className="flex items-center gap-1 text-[11px] text-white/45"
          data-testid="notes-sync"
        >
          {verified && <Check size={12} className="text-emerald-400" />}
          Saved {lastSavedLabel(lastSaved)}
        </span>
      </div>
      <p className="mb-3 text-xs text-white/45">
        Durable local notes — persisted via the state-integrity layer (write → verify → audit).
        Survives tab navigation, refresh, and dev-server restart. Stays on this device.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Jot anything — it saves itself, verified, and won't get wiped by a reload."
        className="h-[60vh] w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-sm leading-relaxed outline-none focus:border-white/20"
        data-testid="notes-textarea"
      />
    </div>
  );
}
