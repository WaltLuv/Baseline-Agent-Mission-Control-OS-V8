/**
 * Notion — second memory brain alongside Obsidian.
 *
 * Backed by /__notion_status, /__notion_search, /__notion_page, /__notion_root.
 * The integration must be SHARED with target pages via the Notion UI first.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  FileText,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Pin,
  Plus,
  Copy,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/notion")({
  head: () => ({
    meta: [
      { title: "Notion — Baseline Automations" },
      { name: "description", content: "Notion memory brain — pages, databases, and quick-create." },
    ],
  }),
  component: NotionPage,
});

const TONE = "#f0f0f0"; // Notion's signature near-white
const ACCENT = "#bdb5ad";

interface SearchResult {
  object: "page" | "database";
  id: string;
  url?: string;
  title: string;
  parent?: { type: string; page_id?: string; workspace?: boolean };
  last_edited_time?: string;
  created_time?: string;
}

interface Status {
  ok: boolean;
  integration?: { name: string; type: string; id: string };
  rootPageId?: string | null;
  error?: string;
}

function extractTitle(item: { object: string; properties?: Record<string, { type?: string; title?: { plain_text?: string }[] }>; title?: { plain_text?: string }[] }): string {
  if (item.object === "page" && item.properties) {
    for (const v of Object.values(item.properties)) {
      if (v?.type === "title" && v.title) {
        return v.title.map((t) => t.plain_text ?? "").join("") || "(untitled)";
      }
    }
  }
  if (item.object === "database" && item.title) {
    return item.title.map((t) => t.plain_text ?? "").join("") || "(untitled database)";
  }
  return "(untitled)";
}

function NotionPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "page" | "database">("all");
  const [creatingTitle, setCreatingTitle] = useState("");
  const [creatingBody, setCreatingBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/__notion_status");
      const j = await r.json() as Status;
      setStatus(j);
    } catch (e) { setStatus({ ok: false, error: String(e) }); }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/__notion_search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: query || undefined,
          filter: filter !== "all" ? { value: filter } : undefined,
        }),
      });
      const j = await r.json() as { results?: SearchResult[] & { object: string; properties?: object; title?: object[] }[] };
      type RawItem = { object: string; properties?: Record<string, { type?: string; title?: { plain_text?: string }[] }>; title?: { plain_text?: string }[]; id: string; url?: string; parent?: SearchResult["parent"]; last_edited_time?: string; created_time?: string };
      const results = (j.results as unknown as RawItem[] | undefined ?? []).map((r) => ({
        object: r.object as "page" | "database",
        id: r.id,
        url: r.url,
        title: extractTitle(r),
        parent: r.parent,
        last_edited_time: r.last_edited_time,
        created_time: r.created_time,
      }));
      setItems(results);
    } catch { setItems([]); }
    setLoading(false);
  }, [query, filter]);

  useEffect(() => { loadStatus(); loadItems(); }, [loadStatus, loadItems]);

  const filtered = useMemo(() => items, [items]);
  const root = items.find((i) => i.id.replace(/-/g, "") === (status?.rootPageId ?? "").replace(/-/g, ""));

  async function setRoot(id: string) {
    try {
      const r = await fetch("/__notion_root", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rootPageId: id }),
      });
      if (r.ok) loadStatus();
    } catch { /* skip */ }
  }

  async function createPage() {
    if (!creatingTitle.trim() || creating) return;
    setCreating(true);
    setCreateResult(null);
    try {
      const r = await fetch("/__notion_page", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: creatingTitle, content: creatingBody }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; page?: { id?: string; url?: string } };
      if (r.ok && j.ok) {
        setCreateResult({ ok: true, msg: `Created → ${j.page?.url ?? j.page?.id ?? ""}` });
        setCreatingTitle("");
        setCreatingBody("");
        loadItems();
      } else {
        setCreateResult({ ok: false, msg: j.error ?? `Error ${r.status}` });
      }
    } catch (e) { setCreateResult({ ok: false, msg: String(e) }); }
    setCreating(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden", background: "#0d0d0f" }}>
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: "#15151a", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "#ffffff", color: "#000" }}>
          <span style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 16 }}>N</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#fff" }}>Notion · Second Brain</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
            {status?.ok
              ? <>Integration: <span style={{ color: ACCENT }}>{status.integration?.name}</span> · {items.length} items shared</>
              : "Not connected"}
          </div>
        </div>
        {status?.ok && <CheckCircle2 size={14} style={{ color: "#10B981" }} />}
        {status && !status.ok && <XCircle size={14} style={{ color: "#ef4444" }} />}
        <button onClick={() => { loadStatus(); loadItems(); }} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left: explorer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter bar */}
          <div className="p-4 shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Search size={13} style={{ color: "rgba(255,255,255,0.45)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") loadItems(); }}
                  placeholder="Search pages, databases…"
                  className="flex-1 bg-transparent outline-none text-[13px]"
                  style={{ color: "#fff" }}
                />
              </div>
              {(["all", "page", "database"] as const).map((f) => {
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); }}
                    className="px-3 py-2 rounded-lg text-[11px] uppercase tracking-widest transition"
                    style={{
                      background: active ? ACCENT + "22" : "transparent",
                      border: `1px solid ${active ? ACCENT + "55" : "rgba(255,255,255,0.08)"}`,
                      color: active ? "#fff" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {f}
                  </button>
                );
              })}
              <button onClick={loadItems} className="px-3 py-2 rounded-lg text-[11px]" style={{ background: ACCENT + "22", border: `1px solid ${ACCENT}55`, color: "#fff" }}>
                Search
              </button>
            </div>
            {status?.rootPageId && root && (
              <div className="mt-3 flex items-center gap-2 text-[11px] p-2 rounded" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: "#86efac" }}>
                <Pin size={11} /> Baseline Automations root: <span className="font-mono">{root.title}</span>
              </div>
            )}
            {status && !status.ok && (
              <div className="mt-3 flex items-start gap-2 text-[11px] p-2 rounded" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                <AlertCircle size={11} className="shrink-0 mt-0.5" /> {status.error}
              </div>
            )}
          </div>

          {/* Results grid */}
          <div className="flex-1 overflow-y-auto scroll p-4">
            {!loading && filtered.length === 0 && (
              <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.45)" }}>
                <Database size={36} style={{ opacity: 0.25, margin: "0 auto 12px" }} />
                <div className="text-[13px] mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>No pages found</div>
                <div className="text-[11px]">Share pages with the integration via Notion → Share → Add connections.</div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((item) => {
                const isRoot = status?.rootPageId?.replace(/-/g, "") === item.id.replace(/-/g, "");
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg transition"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${isRoot ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.07)"}`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-2" style={{ color: item.object === "database" ? "#fbbf24" : ACCENT }}>
                      {item.object === "database" ? <Database size={10} /> : <FileText size={10} />}
                      {item.object}
                    </div>
                    <div className="text-[13px] font-medium mb-2 line-clamp-2" style={{ color: "#fff" }}>{item.title}</div>
                    <div className="text-[10px] mb-3 font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{item.id.slice(0, 8)}…</div>
                    <div className="flex items-center gap-1.5">
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] transition" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}>
                          <ExternalLink size={10} /> Open
                        </a>
                      )}
                      <button
                        onClick={() => navigator.clipboard.writeText(item.id)}
                        className="p-1.5 rounded transition"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                        title="Copy page ID"
                      >
                        <Copy size={10} />
                      </button>
                      {item.object === "page" && !isRoot && (
                        <button
                          onClick={() => setRoot(item.id)}
                          className="flex items-center gap-1 py-1.5 px-2 rounded text-[11px] transition"
                          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#86efac" }}
                          title="Set as Baseline Automations root"
                        >
                          <Pin size={10} /> Root
                        </button>
                      )}
                      {isRoot && (
                        <span className="flex items-center gap-1 py-1.5 px-2 rounded text-[11px]" style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.45)", color: "#86efac" }}>
                          <CheckCircle2 size={10} /> Active
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: quick-create + sync controls */}
        <aside className="flex flex-col overflow-y-auto border-l p-4 space-y-4 scroll" style={{ width: "min(380px, 36vw)", borderColor: "rgba(255,255,255,0.06)", background: "#101015" }}>
          <div className="panel p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              <Plus size={13} style={{ color: ACCENT }} />
              <h3 className="text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>Quick create</h3>
            </div>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              Creates a new page under the Baseline Automations root (pick one in the explorer).
            </p>
            <input
              value={creatingTitle}
              onChange={(e) => setCreatingTitle(e.target.value)}
              placeholder="Title"
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
            />
            <textarea
              value={creatingBody}
              onChange={(e) => setCreatingBody(e.target.value)}
              rows={6}
              placeholder="Body (one paragraph per line)…"
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
            />
            <button
              onClick={createPage}
              disabled={!creatingTitle.trim() || creating || !status?.rootPageId}
              className="w-full py-2 rounded-full text-[12.5px] font-medium transition disabled:opacity-40"
              style={{ background: "#fff", color: "#0b0b0d" }}
            >
              {creating ? "Creating…" : "Create page"}
            </button>
            {createResult && (
              <div className="flex items-start gap-1.5 text-[11px] p-2 rounded" style={{ background: createResult.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${createResult.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`, color: createResult.ok ? "#86efac" : "#fca5a5" }}>
                {createResult.ok ? <CheckCircle2 size={11} className="shrink-0 mt-0.5" /> : <AlertCircle size={11} className="shrink-0 mt-0.5" />}
                <span className="break-all">{createResult.msg}</span>
              </div>
            )}
            {!status?.rootPageId && (
              <p className="text-[10.5px]" style={{ color: "#fbbf24" }}>
                ⚠ Pick an Baseline Automations root in the explorer first — that's where new pages are created.
              </p>
            )}
          </div>

          <div className="panel p-4 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>How it works</h3>
            <ol className="text-[11.5px] space-y-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
              <li>1. In Notion, open the page you want the OS to read/write.</li>
              <li>2. Click <strong>Share</strong> → <strong>Add connections</strong> → pick <span style={{ color: ACCENT }}>{status?.integration?.name ?? "your integration"}</span>.</li>
              <li>3. Reload here — the page will appear in the grid.</li>
              <li>4. Click <strong>Pin</strong> on the page to set it as Baseline Automations root.</li>
              <li>5. Goals + Journal + agents can now write here.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
