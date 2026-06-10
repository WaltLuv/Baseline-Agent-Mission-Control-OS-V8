/**
 * Agent Factory — say or type "build me X" and a LOCAL model writes a real,
 * self-contained app that runs live in the preview. Free + private: the build
 * runs on your own machine via Ollama (reuses the /__ollama_chat sidecar).
 *
 * Honest: if Ollama isn't running the build streams an error and we say so —
 * nothing is faked. Builds render directly from the generated HTML (iframe
 * srcDoc) and a per-browser gallery lets you replay anything you've made.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Hammer, Play } from "lucide-react";
import { VoiceInput } from "@/components/voice-input";
import { applyFactoryUpsert, type RosterAgent } from "@/lib/workforce-autogen";

const TONE = "#10B981";
const GALLERY_KEY = "agent-factory-builds";
const ORG_KEY = "baseline-os-org-chart";

// Phase 2 wiring: a successful Agent Factory build appears in the Org Chart
// immediately (idempotent upsert into the local roster). Returns true if a new
// org node was created.
function syncBuildToOrgChart(name: string): boolean {
  try {
    const roster: RosterAgent[] = JSON.parse(localStorage.getItem(ORG_KEY) || "[]");
    let n = 0;
    const newId = () => `org_${Date.now().toString(36)}${n++}`;
    const { roster: next, created } = applyFactoryUpsert(
      roster,
      { name, role: "Agent Factory build", runtime: "ollama" },
      newId,
    );
    localStorage.setItem(ORG_KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key: ORG_KEY }));
    return created;
  } catch {
    return false;
  }
}

const FACTORY_SYSTEM =
  "You are a world-class creative front-end developer. Output ONLY a single, " +
  "complete, self-contained HTML file — vanilla JS + HTML5 canvas where useful, " +
  "NO external libraries, no build step. It must be visually stunning, " +
  "full-window, dark background, smooth 60fps. Start your output with " +
  "<!DOCTYPE html> and output NOTHING else: no markdown fences, no explanation.";

function extractHtml(text: string): string {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  let h = fence ? fence[1] : text;
  const start = h.search(/<!DOCTYPE html|<html/i);
  if (start > 0) h = h.slice(start);
  const end = h.toLowerCase().lastIndexOf("</html>");
  if (end !== -1) h = h.slice(0, end + 7);
  return h.trim();
}

interface Build {
  id: number;
  prompt: string;
  html: string;
  ts: number;
}

function loadGallery(): Build[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}
function saveGallery(builds: Build[]): void {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(builds.slice(0, 60)));
  } catch {
    /* quota */
  }
}

export function AgentFactory({ model }: { model: string }) {
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [html, setHtml] = useState<string>("");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [orgMsg, setOrgMsg] = useState<string | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setBuilds(loadGallery());
  }, []);
  useEffect(() => {
    codeRef.current?.scrollTo({ top: codeRef.current.scrollHeight });
  }, [code]);

  const build = useCallback(
    async (p: string) => {
      const text = p.trim();
      if (!text || building) return;
      setBuilding(true);
      setError("");
      setCode("");
      setHtml("");
      let out = "";
      try {
        const r = await fetch("/__ollama_chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: FACTORY_SYSTEM },
              { role: "user", content: text },
            ],
          }),
        });
        if (!r.ok || !r.body) {
          setError(
            `local model not reachable (ollama ${r.status}). Is Ollama running? Try \`ollama serve\`.`,
          );
          setBuilding(false);
          return;
        }
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line) as { type?: string; delta?: string };
              if (evt.type === "delta" && evt.delta) {
                out += evt.delta;
                setCode(out);
              }
            } catch {
              /* skip */
            }
          }
        }
      } catch (e) {
        setError(`local model not reachable: ${String(e).slice(0, 140)}. Is Ollama running?`);
        setBuilding(false);
        return;
      }
      const doc = extractHtml(out);
      if (!doc || doc.length < 40) {
        setError("model did not return usable HTML — try rephrasing.");
        setBuilding(false);
        return;
      }
      setHtml(doc);
      const entry: Build = { id: Date.now(), prompt: text, html: doc, ts: Date.now() };
      const next = [entry, ...builds].slice(0, 60);
      setBuilds(next);
      saveGallery(next);
      // Phase 2: add the built agent/app to the private Org Chart.
      const agentName =
        text
          .replace(/^build me (a |an )?/i, "")
          .slice(0, 40)
          .trim() || `Build ${new Date().toLocaleDateString()}`;
      const created = syncBuildToOrgChart(agentName);
      setOrgMsg(created ? `“${agentName}” added to Org Chart` : `Org Chart updated`);
      setBuilding(false);
    },
    [building, model, builds],
  );

  return (
    <div className="space-y-4" data-testid="agent-factory">
      <p className="text-sm text-white/60">
        Say or type <em>“build me a snake game”</em> — a local model writes a real, working app.
        Free, private, on your machine.
      </p>

      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") build(prompt);
          }}
          placeholder="build me a colorful starfield…"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
          data-testid="factory-prompt"
        />
        <VoiceInput
          onTranscript={(t) => {
            setPrompt(t);
            build(t);
          }}
          color={TONE}
        />
        <button
          onClick={() => build(prompt)}
          disabled={building}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          style={{ backgroundColor: TONE }}
          data-testid="factory-build"
        >
          <Hammer size={15} /> {building ? "Building…" : "Build"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400" data-testid="factory-error">
          {error}
        </p>
      )}

      {orgMsg && (
        <p
          className="flex items-center gap-2 text-xs text-emerald-400"
          data-testid="factory-org-confirm"
        >
          ✓ {orgMsg} ·{" "}
          <a href="/org-chart" className="underline hover:text-emerald-300">
            Open Org Chart
          </a>
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <pre
          ref={codeRef}
          className="h-[420px] overflow-auto rounded-lg border border-white/10 bg-black/60 p-3 text-[11px] text-emerald-200 whitespace-pre-wrap"
          data-testid="factory-code"
        >
          {code || (building ? "Generating…" : "Code streams here as it builds.")}
        </pre>
        <div
          className="h-[420px] overflow-hidden rounded-lg border border-white/10 bg-white"
          data-testid="factory-preview"
        >
          {html ? (
            <iframe
              title="preview"
              srcDoc={html}
              className="h-full w-full"
              sandbox="allow-scripts allow-pointer-lock"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-black/40">
              <Play size={14} className="mr-1" /> Your build runs here.
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-white/70">Your builds</div>
        {builds.length === 0 ? (
          <p className="text-xs text-white/40" data-testid="factory-gallery-empty">
            Nothing built yet. Try “build me a neon galaxy”.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="factory-gallery">
            {builds.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setHtml(b.html);
                  setCode(b.html);
                }}
                className="rounded-lg border border-white/10 bg-black/30 p-2 text-left hover:border-emerald-500/40"
                data-testid={`build-${b.id}`}
              >
                <div className="truncate text-[12px] font-medium text-white/90">{b.prompt}</div>
                <div className="text-[10px] text-white/40">{new Date(b.ts).toLocaleString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
