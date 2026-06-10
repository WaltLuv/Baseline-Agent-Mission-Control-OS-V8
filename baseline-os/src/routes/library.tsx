/**
 * Skills Library — 155+ shared skills available to every agent.
 *
 * Backed by /__skills_shared (reads ~/.claude-os/skills/SKILL_INDEX.json).
 * Search + category filter + click-to-view SKILL.md preview.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookMarked, Search, RefreshCw, Tag, Copy } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Skills Library — Baseline Automations" },
      { name: "description", content: "155+ shared skills accessible by every agent." },
    ],
  }),
  component: LibraryPage,
});

const TONE = "#fbbf24";

type Skill = {
  name: string;
  path: string;
  desc: string;
  cat?: string;
  tags?: string[];
};

function LibraryPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/__skills_shared");
      const j = await r.json() as { total: number; skills: Skill[]; note?: string };
      setSkills(j.skills || []);
      setTotal(j.total ?? (j.skills?.length ?? 0));
    } catch { setSkills([]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of skills) {
      const c = (s.cat || "uncategorized").toLowerCase();
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [skills]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return skills.filter((s) => {
      if (activeCat && (s.cat || "uncategorized").toLowerCase() !== activeCat) return false;
      if (!q) return true;
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.desc?.toLowerCase().includes(q)) return true;
      if (s.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [skills, filter, activeCat]);

  async function openSkill(s: Skill) {
    setSelected(s);
    setSkillContent(null);
    setContentLoading(true);
    try {
      const r = await fetch(`/__skills_shared?name=${encodeURIComponent(s.name)}`);
      const j = await r.json() as { content?: string; error?: string };
      setSkillContent(j.content ?? j.error ?? "(empty)");
    } catch { setSkillContent("(failed to load)"); }
    setContentLoading(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <BookMarked size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#fff8e7" }}>Skills Library</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            {loading ? "Loading…" : `${total} skills · shared across every agent`}
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }} title="Refresh">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left: categories */}
        <div className="flex flex-col border-r overflow-y-auto p-3 scroll" style={{ width: "min(220px, 22vw)", borderColor: "var(--panel-border)" }}>
          <div className="text-[9px] uppercase tracking-[0.18em] px-2 mb-2" style={{ color: "var(--cream-mute)" }}>Categories</div>
          <button
            onClick={() => setActiveCat(null)}
            className="text-left px-2 py-1.5 rounded-md text-[12px] transition mb-1"
            style={{
              background: activeCat === null ? `${TONE}18` : "transparent",
              border: `1px solid ${activeCat === null ? `${TONE}55` : "transparent"}`,
              color: activeCat === null ? "#fff" : "var(--fg-dim)",
            }}
          >
            All ({skills.length})
          </button>
          {categories.map(([c, n]) => {
            const active = activeCat === c;
            return (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className="text-left px-2 py-1.5 rounded-md text-[12px] transition mb-1 flex items-center justify-between"
                style={{
                  background: active ? `${TONE}18` : "transparent",
                  border: `1px solid ${active ? `${TONE}55` : "transparent"}`,
                  color: active ? "#fff" : "var(--fg-dim)",
                }}
              >
                <span className="truncate">{c}</span>
                <span className="text-[10px] ml-2" style={{ color: "var(--fg-dimmer)" }}>{n}</span>
              </button>
            );
          })}
        </div>

        {/* Middle: skill list */}
        <div className="flex flex-col border-r overflow-hidden" style={{ width: "min(380px, 36vw)", borderColor: "var(--panel-border)" }}>
          <div className="p-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)" }}>
              <Search size={12} style={{ color: "var(--fg-dimmer)" }} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search 155 skills by name, desc, or tag…"
                className="flex-1 bg-transparent outline-none text-[12px]"
                style={{ color: "var(--fg)" }}
              />
            </div>
            <div className="text-[10px] mt-2" style={{ color: "var(--fg-dimmer)" }}>{filtered.length} matches</div>
          </div>

          <div className="scroll flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.map((s) => {
              const active = selected?.name === s.name;
              return (
                <button
                  key={s.name}
                  onClick={() => openSkill(s)}
                  className="w-full p-2 rounded-md text-left transition"
                  style={{
                    background: active ? `${TONE}18` : "transparent",
                    border: `1px solid ${active ? `${TONE}55` : "transparent"}`,
                  }}
                >
                  <div className="text-[12px] font-mono font-semibold truncate" style={{ color: active ? TONE : "var(--fg)" }}>{s.name}</div>
                  {s.desc && <div className="text-[10.5px] mt-0.5 line-clamp-2" style={{ color: "var(--fg-dimmer)" }}>{s.desc}</div>}
                  {s.tags && s.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.tags.slice(0, 4).map((t) => (
                        <span key={t} className="text-[9px] px-1.5 py-[1px] rounded" style={{ background: "rgba(255,255,255,0.04)", color: "var(--fg-dimmer)" }}>{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: SKILL.md preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected && (
            <div className="flex-1 flex items-center justify-center text-center" style={{ color: "var(--fg-dimmer)" }}>
              <div>
                <BookMarked size={40} style={{ opacity: 0.2, margin: "0 auto 10px" }} />
                <div className="text-[13px]">Pick a skill on the left to view its SKILL.md.</div>
                <div className="text-[11px] mt-1">Every agent in this OS can reference these by name.</div>
              </div>
            </div>
          )}
          {selected && (
            <>
              <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-mono font-bold" style={{ color: TONE }}>{selected.name}</div>
                  <div className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>
                    <Tag size={9} className="inline mr-1" />
                    {selected.cat || "uncategorized"} · ~/.claude-os/skills/{selected.path}
                  </div>
                </div>
                <button onClick={() => navigator.clipboard.writeText(skillContent ?? "")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition" style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: TONE }}>
                  <Copy size={11} /> Copy
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-5 scroll">
                {contentLoading && <div className="text-[12px]" style={{ color: "var(--fg-dim)" }}>Loading SKILL.md…</div>}
                {skillContent && (
                  <pre className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--fg-dim)" }}>{skillContent}</pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
