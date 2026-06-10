/**
 * Understand-Anything — Turn any repo into a structured knowledge brief.
 *
 * Paste a repo URL or local path → returns: overview, architecture,
 * entry points, important files, suggested first read, and 3 questions to ask.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GitBranch, ExternalLink, Sparkles, RefreshCw, Copy, BookOpen } from "lucide-react";

export const Route = createFileRoute("/understand")({
  head: () => ({
    meta: [
      { title: "Understand Anything — Baseline Automations" },
      { name: "description", content: "Turn any codebase into a structured knowledge brief." },
    ],
  }),
  component: UnderstandPage,
});

const TONE = "#fda4af";

type HistoryItem = { id: string; prompt: string; result: string; ts: number };

function UnderstandPage() {
  const [target, setTarget] = useState("");
  const [depth, setDepth] = useState<"overview" | "deep">("overview");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  async function loadHistory() {
    try {
      const r = await fetch("/__studio_history?kind=understand");
      const j = await r.json() as { items: HistoryItem[] };
      setHistory(j.items || []);
    } catch { /* skip */ }
  }
  useEffect(() => { loadHistory(); }, []);

  // Parse a github URL into { owner, repo }. Accepts:
  //   github.com/<owner>/<repo>(.git)?
  //   https://github.com/<owner>/<repo>
  //   git@github.com:<owner>/<repo>.git
  function parseGithub(t: string): { owner: string; repo: string } | null {
    const m = t
      .replace(/\.git$/, "")
      .match(/(?:github\.com[/:]|^)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[/?#]|$)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
  }

  // Fetch README + key surface info from a github repo so the AI has REAL
  // content to analyze. CORS is open on raw.githubusercontent.com + the
  // public REST API, so this works directly from the browser.
  async function gatherContext(target: string): Promise<string> {
    const gh = parseGithub(target);
    if (!gh) {
      // Local path? Tell the model and give what we have.
      return `Target: ${target}\n(No README content fetched — target was not a recognizable GitHub URL.)`;
    }
    const tries = [
      `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/HEAD/README.md`,
      `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/main/README.md`,
      `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/master/README.md`,
    ];
    let readme = "";
    for (const url of tries) {
      try {
        const r = await fetch(url);
        if (r.ok) { readme = await r.text(); break; }
      } catch { /* try next */ }
    }
    // Top-level layout via the public contents API (no auth needed for public repos)
    let topLevel = "";
    try {
      const r = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents`);
      if (r.ok) {
        const items = await r.json() as Array<{ name: string; type: string; size?: number }>;
        topLevel = items.slice(0, 60).map((i) => `${i.type === "dir" ? "📁" : "  "} ${i.name}`).join("\n");
      }
    } catch { /* skip */ }
    // Repo metadata
    let meta: any = null;
    try {
      const r = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`);
      if (r.ok) meta = await r.json();
    } catch { /* skip */ }

    const blocks: string[] = [`Target: github.com/${gh.owner}/${gh.repo}`];
    if (meta) blocks.push(
      `Description: ${meta.description ?? "(none)"}`,
      `Primary language: ${meta.language ?? "?"} · Stars ${meta.stargazers_count ?? 0} · Forks ${meta.forks_count ?? 0}`,
      `Topics: ${(meta.topics ?? []).join(", ") || "—"}`,
    );
    if (topLevel) blocks.push(`Top-level layout:\n${topLevel}`);
    if (readme) blocks.push(`README.md (first 6000 chars):\n${readme.slice(0, 6000)}`);
    if (!readme && !topLevel && !meta) blocks.push(`(Could not fetch any data — repo private or rate-limited.)`);
    return blocks.join("\n\n");
  }

  function buildPrompt(context: string, t: string) {
    const intro = depth === "deep"
      ? `Perform a DEEP architectural analysis of the codebase below.`
      : `Produce a one-page OVERVIEW briefing of the codebase below.`;
    return `${intro}

You have been given the README + top-level layout + repo metadata for: "${t}"

═══════════════════════════════════════════════════════════
${context}
═══════════════════════════════════════════════════════════

Now deliver the following sections (markdown, with clear headings):

### 1. What it is
One-paragraph plain-English summary of the project, in the voice of a senior engineer briefing a new hire. Use what you actually read above — do not hedge or say "I can't browse."

### 2. Architecture
Top-level layers, the data flow between them, and the key boundary lines. Mention frameworks/languages explicitly. Cite specific files from the layout when possible.

### 3. Entry points
The 3–5 files a new engineer should open first, in order. For each: one sentence on why.

### 4. The 5 most important files
Bulleted. For each: path + one-sentence reason it's load-bearing.

### 5. Three questions a new contributor should ask
Sharp, specific questions a thoughtful new hire would raise after reading the README.

${depth === "deep" ? "### 6. Hidden costs / footguns\nFootguns, sharp edges, undocumented invariants — what would bite you?" : ""}

Be opinionated and specific. No filler. Do NOT begin with "I'm ready to help" or any creative-writing framing.`;
  }

  async function analyze() {
    if (!target.trim() || analyzing) return;
    setAnalyzing(true);
    setResult("Fetching README + top-level layout from GitHub…");
    let out = "";
    try {
      // Step 1: pull real repo context so the AI can analyze actual content
      // instead of guessing from a URL it can't browse.
      const context = await gatherContext(target);
      setResult("Streaming analysis…\n\n");
      // Step 2: route to openclaw (technical / code-analysis system prompt).
      // max_tokens kept modest so it fits even on a low OpenRouter balance —
      // the server auto-falls-back to local Gemma 4 on 402.
      const r = await fetch("/__ai_chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: "openclaw",
          messages: [{ role: "user", content: buildPrompt(context, target) }],
          max_tokens: 1800,
        }),
      });
      if (!r.body) throw new Error("no body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as { delta?: string; type?: string };
            const d = evt.delta ?? "";
            if (d) { out += d; setResult(out); }
          } catch { /* skip non-JSON keepalives */ }
        }
      }
    } catch (e) { setResult(`Error: ${String(e)}`); }
    setAnalyzing(false);

    if (out && !out.startsWith("Error:")) {
      try {
        await fetch("/__studio_history", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "understand", prompt: target, result: out }),
        });
        loadHistory();
      } catch { /* skip */ }
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "auto" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <BookOpen size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#ffe4e6" }}>Understand Anything</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            Any codebase → structured knowledge brief
          </div>
        </div>
        <a href="https://understand-anything.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] transition" style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: "#ffe4e6" }}>
          <ExternalLink size={12} /> Live demo
        </a>
      </header>

      <div className="flex-1 p-6 space-y-5 max-w-5xl">
        <div className="panel p-5 space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch size={14} style={{ color: TONE }} />
            <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Target</h3>
          </div>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="github.com/anthropics/anthropic-sdk-python  or  /Users/me/code/myrepo"
            className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
          />

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(["overview", "deep"] as const).map((d) => {
                const active = depth === d;
                return (
                  <button key={d} onClick={() => setDepth(d)} className="px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-widest transition" style={{ background: active ? `${TONE}22` : "transparent", border: `1px solid ${active ? TONE : "var(--panel-border)"}`, color: active ? "#fff" : "var(--fg-dim)" }}>
                    {d}
                  </button>
                );
              })}
            </div>
            <button onClick={analyze} disabled={!target.trim() || analyzing} className="px-4 h-[36px] rounded-lg flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-40" style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}>
              {analyzing ? <><RefreshCw size={14} className="animate-spin" /> Analyzing…</> : <><Sparkles size={14} /> Analyze</>}
            </button>
          </div>
        </div>

        {result && (
          <div className="panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Briefing</h3>
              <button onClick={() => navigator.clipboard.writeText(result)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>
                <Copy size={11} /> Copy
              </button>
            </div>
            <pre className="text-[12.5px] leading-relaxed whitespace-pre-wrap p-4 rounded-lg" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono',monospace" }}>{result}</pre>
          </div>
        )}

        {history.length > 0 && (
          <div className="panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Recent Briefs</h3>
              <span className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>{history.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {history.slice(0, 8).map((h) => (
                <button key={h.id} onClick={() => { setTarget(h.prompt); setResult(h.result); }} className="p-3 rounded-lg text-left transition hover:scale-[1.01]" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: TONE }}>{new Date(h.ts).toLocaleString()}</div>
                  <div className="text-[12px] font-mono truncate mb-1" style={{ color: "var(--fg)" }}>{h.prompt}</div>
                  <div className="text-[11px] line-clamp-2" style={{ color: "var(--fg-dimmer)" }}>{h.result.slice(0, 200)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
