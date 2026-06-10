/**
 * StudioToolbox — shared creative studio panel used by Hermes / OpenClaw / Gemini.
 *
 * Tools (default 4): image prompts, voice script, video script, X-Search.
 * Each generation streams from /__ai_chat (or a passed-in endpoint), auto-saves
 * to /__studio_history?kind=<kind+ns>, and shows a history grid at the bottom.
 *
 * Click any history tile → restores prompt + result.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Wand2, Image as ImageIcon, Mic, Video, Search, Sparkles, RefreshCw,
  Download, Copy, Trash2,
} from "lucide-react";

type ToolId = "image" | "voice" | "video" | "search";

interface Item {
  id: string;
  kind: string;
  prompt: string;
  result: string;
  ts: number;
}

interface Props {
  /** Namespace used for the storage key — e.g. "openclaw", "gemini", "hermes" */
  namespace: string;
  /** Agent name passed to /__ai_chat */
  agent: string;
  /** Accent colour (CSS) */
  tone: string;
  /** Friendly readable label for the title — "OpenClaw" / "Gemini" / "Hermes" */
  brand: string;
  /** Tools to include (default: all four) */
  tools?: ToolId[];
}

const TOOL_META: Record<ToolId, { label: string; icon: React.ReactNode; placeholder: string }> = {
  image:  { label: "Image",     icon: <ImageIcon size={14} />, placeholder: "A futuristic city skyline at dusk, neon highlights, cinematic…" },
  voice:  { label: "Voice",     icon: <Mic size={14} />,        placeholder: "Explain why AI agents will change software forever…" },
  video:  { label: "Video",     icon: <Video size={14} />,      placeholder: "A 90-second tutorial: how to set up your AI agent stack…" },
  search: { label: "X-Search",  icon: <Search size={14} />,     placeholder: "What's happening on AI Twitter today? Find emerging themes…" },
};

const PROMPT_BUILDER: Record<ToolId, (p: string) => string> = {
  image:  (p) => `Generate three rich DALL-E 3 / Midjourney prompts for: "${p}"\n\nFor each: subject, style, lighting, mood, composition, palette, lens & aspect ratio.`,
  voice:  (p) => `Write a natural TTS script (ElevenLabs ready) for: "${p}"\n\nInclude [pause] cues, [emphasis: word] markup, conversational rhythm, and est. duration.`,
  video:  (p) => `Write a complete video script for: "${p}"\n\nInclude: 15-second hook, timestamps, B-roll suggestions, on-screen text overlays, CTA, and 3 thumbnail concepts.`,
  search: (p) => `Act as a real-time X/Twitter search synthesizer. Topic: "${p}"\n\nProduce: (1) one-paragraph synthesis, (2) 5–8 source-style citations as bullets with attribution, (3) emerging-theme spotlight. Be specific and grounded.`,
};

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function StudioToolbox({ namespace, agent, tone, brand, tools = ["image", "voice", "video", "search"] }: Props) {
  const [tool, setTool] = useState<ToolId>(tools[0]);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<Item[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const storageKind = `${namespace}-${tool}`;

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch(`/__studio_history?kind=${storageKind}`);
      const j = await r.json() as { items: Item[] };
      setHistory(j.items || []);
    } catch { setHistory([]); }
    setHistoryLoading(false);
  }, [storageKind]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function generate() {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setResult(null);
    let out = "";

    // For the "image" tool we hit FAL.ai directly to produce a real image URL.
    // For the "voice" tool we hit /__tts (ElevenLabs) to produce real MP3 audio.
    // Everything else streams through the LLM via /__ai_chat.
    try {
      if (tool === "image") {
        const r = await fetch("/__fal_image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const j = await r.json() as { url?: string; error?: string };
        if (j.url) out = j.url;
        else throw new Error(j.error ?? `FAL ${r.status}`);
        setResult(out);
      } else if (tool === "voice") {
        // Send the user's prompt straight to ElevenLabs as the script.
        const r = await fetch("/__tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ script: prompt }),
        });
        const j = await r.json() as { audio?: string; error?: string };
        if (j.audio) out = j.audio;
        else throw new Error(j.error ?? `TTS ${r.status}`);
        setResult(out);
      } else {
        // Text-mode tools (video script, x-search) still stream from /__ai_chat
        const r = await fetch("/__ai_chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agent, prompt: PROMPT_BUILDER[tool](prompt) }),
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
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line) as { type?: string; delta?: string };
              if (evt.type === "delta" && evt.delta) {
                out += evt.delta;
                setResult(out);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      setResult(`Error: ${String(e)}`);
    }
    setGenerating(false);

    // Auto-save successful generations
    if (out && !out.startsWith("Error:")) {
      try {
        await fetch("/__studio_history", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: storageKind, prompt, result: out }),
        });
        loadHistory();
      } catch { /* skip */ }
    }
  }

  function restoreItem(item: Item) {
    setPrompt(item.prompt);
    setResult(item.result);
  }

  async function deleteItem(item: Item, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/__studio_history?kind=${storageKind}&id=${item.id}`, { method: "DELETE" });
      loadHistory();
    } catch { /* skip */ }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Generator panel */}
      <div className="panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wand2 size={16} style={{ color: tone }} />
          <h3 className="text-sm font-semibold">{brand} Creative Studio</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {tools.map((id) => {
            const meta = TOOL_META[id];
            const active = tool === id;
            return (
              <button
                key={id}
                onClick={() => { setTool(id); setResult(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition"
                style={{
                  background: active ? `${tone}22` : "transparent",
                  border: `1px solid ${active ? tone : "var(--panel-border)"}`,
                  color: active ? "#fff" : "var(--fg-dim)",
                }}
              >
                {meta.icon}{meta.label}
              </button>
            );
          })}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={TOOL_META[tool].placeholder}
          className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
        />

        <div className="flex justify-end gap-2">
          {result && (
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="px-3 h-[36px] rounded-lg text-[12px] flex items-center gap-1.5"
              style={{ background: "rgba(243,235,218,0.06)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}
            >
              <Copy size={12} /> Copy
            </button>
          )}
          <button
            onClick={generate}
            disabled={!prompt.trim() || generating}
            className="px-4 h-[36px] rounded-lg flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-40"
            style={{ background: `${tone}22`, border: `1px solid ${tone}55`, color: tone }}
          >
            {generating
              ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
              : <><Sparkles size={14} /> Generate</>}
          </button>
        </div>

        {result && (
          (() => {
            const isImageUrl = /^https?:\/\/.*\.(png|jpe?g|webp|gif)(\?|$)/i.test(result)
              || result.startsWith("data:image/")
              || /^https?:\/\/(.*fal\.media|.*fal-cdn).*$/i.test(result);
            const isAudio = result.startsWith("data:audio/")
              || /^https?:\/\/.*\.(mp3|wav|ogg)(\?|$)/i.test(result);
            const isVideo = result.startsWith("data:video/")
              || /^https?:\/\/.*\.(mp4|webm|mov)(\?|$)/i.test(result);

            if (isImageUrl) {
              return (
                <div className="rounded-lg overflow-hidden" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)" }}>
                  <img src={result} alt={prompt} className="w-full max-h-[500px] object-contain" />
                  <div className="p-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--fg-dim)" }}>
                    <a href={result} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: tone }}>Open full-size →</a>
                    <span className="ml-auto opacity-60">via FAL.ai · Flux Schnell</span>
                  </div>
                </div>
              );
            }
            if (isAudio) {
              return (
                <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)" }}>
                  <audio src={result} controls className="w-full" />
                  <div className="text-[10px] mt-1.5" style={{ color: "var(--fg-dimmer)" }}>via ElevenLabs · v2 multilingual</div>
                </div>
              );
            }
            if (isVideo) {
              return (
                <video src={result} controls className="w-full rounded-lg max-h-[500px]" style={{ background: "#000" }} />
              );
            }
            return (
              <pre
                className="scroll overflow-auto p-4 rounded-lg text-[12.5px] leading-relaxed whitespace-pre-wrap max-h-[400px]"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono',monospace" }}
              >
                {result}
              </pre>
            );
          })()
        )}
      </div>

      {/* History grid */}
      <div className="panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download size={14} style={{ color: tone }} />
            <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
              {TOOL_META[tool].label} History
            </h3>
            <span className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>{history.length}</span>
          </div>
          <button onClick={loadHistory} disabled={historyLoading} className="p-1.5 rounded-md transition disabled:opacity-50" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>
            <RefreshCw size={12} className={historyLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {history.length === 0 && (
          <div className="text-center py-6 text-[12px]" style={{ color: "var(--fg-dimmer)" }}>
            No saved generations yet. Run the generator above — outputs auto-save here.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {history.map((item) => {
            const isNew = Date.now() - item.ts < 5 * 60 * 1000;
            return (
              <button
                key={item.id}
                onClick={() => restoreItem(item)}
                className="group p-3 rounded-lg text-left relative transition hover:scale-[1.01]"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}
              >
                {isNew && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold uppercase tracking-widest px-1.5 py-[1px] rounded-full animate-pulse" style={{ background: "#ec489966", color: "#fbcfe8" }}>
                    NEW
                  </span>
                )}
                <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: tone }}>
                  {fmtAgo(item.ts)}
                </div>
                <div className="text-[12px] line-clamp-2 mb-1.5" style={{ color: "var(--fg)" }}>{item.prompt}</div>
                <div className="text-[11px] line-clamp-3" style={{ color: "var(--fg-dimmer)" }}>{item.result.slice(0, 220)}</div>
                <button
                  onClick={(e) => deleteItem(item, e)}
                  className="absolute bottom-2 right-2 p-1 rounded transition opacity-0 group-hover:opacity-100"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
                  title="Delete"
                >
                  <Trash2 size={10} />
                </button>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
