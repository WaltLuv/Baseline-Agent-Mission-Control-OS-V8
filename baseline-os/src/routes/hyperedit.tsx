/**
 * HyperEdit — Remotion-based video editor, embedded live.
 *
 * Iframes the actual editor dev server. The editor runs on 5174+ (NOT 5173 —
 * that port belongs to Baseline OS itself; defaulting there made the page
 * iframe the dashboard into itself / report a false "live"). Editor + FFmpeg
 * liveness is probed SERVER-SIDE via /__hyperedit_status (no browser CORS),
 * which also reports the detected editor port. Falls back to a setup card with
 * the start command if the editor isn't running.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Film,
  ExternalLink,
  RefreshCw,
  Copy,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";

export const Route = createFileRoute("/hyperedit")({
  head: () => ({
    meta: [
      { title: "HyperEdit — Baseline Automations" },
      { name: "description", content: "Remotion-based AI video editor — embedded live." },
    ],
  }),
  component: HyperEditPage,
});

const TONE = "#fde047";
// 5174, NOT 5173 — Baseline OS owns 5173. The hyperedit editor lands on the
// next free vite port; the server-side probe reports the actual one.
const DEFAULT_PORT = 5174;

function HyperEditPage() {
  const [port, setPort] = useState(DEFAULT_PORT);
  const [status, setStatus] = useState<"checking" | "live" | "down">("checking");
  const [ffmpegUp, setFfmpegUp] = useState<boolean | null>(null);
  const [startingFfmpeg, setStartingFfmpeg] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [brief, setBrief] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Probe editor + FFmpeg SERVER-SIDE via the sidecar. A direct browser
  // fetch to the editor port is cross-origin and always CORS-fails (false
  // "offline"); the sidecar probes from Node with no CORS and returns the
  // real editor port (5174+). The :3333 FFmpeg server handles every upload +
  // transcode — without it the upload widget looks clickable but POSTs fail.
  useEffect(() => {
    let cancel = false;
    setStatus("checking");
    fetch("/__hyperedit_status", { signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .then((j: { editor: boolean; ffmpeg: boolean; ports?: { editor?: number } }) => {
        if (cancel) return;
        setFfmpegUp(j.ffmpeg);
        setStatus(j.editor ? "live" : "down");
        if (j.editor && j.ports?.editor) setPort(j.ports.editor);
      })
      .catch(() => {
        if (cancel) return;
        setStatus("down");
        setFfmpegUp(false);
      });
    return () => {
      cancel = true;
    };
  }, [iframeKey]);

  // Auto-start the FFmpeg server when it's down and the editor is up.
  // One-shot, idempotent. Returns 409 if already running.
  const startFfmpeg = async (): Promise<void> => {
    if (startingFfmpeg) return;
    setStartingFfmpeg(true);
    try {
      const r = await fetch("/__hyperedit_ffmpeg_start", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; pid?: number; error?: string };
      if (j.ok) {
        setFfmpegUp(true);
      } else {
        console.warn("[hyperedit] ffmpeg start:", j.error);
      }
    } catch (e) {
      console.warn("[hyperedit] ffmpeg start failed:", e);
    }
    setStartingFfmpeg(false);
  };

  async function generate() {
    if (!brief.trim() || drafting) return;
    setDrafting(true);
    setResult(null);
    let out = "";
    try {
      // Route through the real agentic engine (/__agent_run + claudeclaw)
      // so the brief drafter can actually read repo files when relevant.
      const r = await fetch("/__agent_run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: "claudeclaw",
          messages: [
            {
              role: "user",
              content: `Write a complete Remotion v4 video Composition (TypeScript) for the HyperEdit editor at ~/code/hyperedit. Brief: "${brief}". Output: (1) the full <Composition> component file with imports + interpolate animations + timing notes (durationInFrames, fps, dimensions); (2) where to drop it in src/Root.tsx; (3) asset prompts for any images/clips. Idiomatic, editor-friendly.`,
            },
          ],
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
          // SSE format: `data: { delta, done, ... }` per line
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as { delta?: string };
            if (typeof evt.delta === "string" && evt.delta.length > 0) {
              out += evt.delta;
              setResult(out);
            }
          } catch {
            /* skip non-JSON keepalives */
          }
        }
      }
    } catch (e) {
      setResult(`Error: ${String(e)}`);
    }
    setDrafting(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-4 pt-3">
        <RuntimeCredentialStatus providerIds={["hyperedit"]} variant="inline" />
      </div>
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0 border-b"
        style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}
      >
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}
        >
          <Film size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#fffae6" }}>
            HyperEdit · Remotion editor
          </div>
          <div
            className="text-[10px] uppercase tracking-widest flex items-center gap-2"
            style={{ color: "var(--cream-mute)" }}
          >
            {status === "live" && (
              <>
                <CheckCircle2 size={10} style={{ color: "#10B981" }} /> editor :{port}
              </>
            )}
            {status === "down" && (
              <>
                <AlertCircle size={10} style={{ color: "#fbbf24" }} /> editor offline
              </>
            )}
            {status === "checking" && "Checking…"}
            <span>·</span>
            {ffmpegUp === true && (
              <>
                <CheckCircle2 size={10} style={{ color: "#10B981" }} /> ffmpeg :3333
              </>
            )}
            {ffmpegUp === false && (
              <>
                <AlertCircle size={10} style={{ color: "#ef4444" }} />
                <span style={{ color: "#fca5a5" }}>ffmpeg server down — uploads will fail</span>
                <button
                  type="button"
                  onClick={() => void startFfmpeg()}
                  disabled={startingFfmpeg}
                  className="ml-1 px-2 py-[3px] rounded text-[10px] font-semibold border disabled:opacity-50"
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    borderColor: "rgba(239,68,68,0.55)",
                    color: "#fca5a5",
                  }}
                >
                  {startingFfmpeg ? "starting…" : "start it"}
                </button>
              </>
            )}
            {ffmpegUp === null && <span>ffmpeg :3333 …</span>}
          </div>
        </div>
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(Number(e.target.value) || DEFAULT_PORT)}
          className="w-20 px-2 py-1 rounded text-[12px] outline-none"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid var(--panel-border)",
            color: "var(--fg)",
          }}
          title="Editor port"
        />
        <button
          onClick={() => setIframeKey((k) => k + 1)}
          className="p-2 rounded-lg"
          style={{
            background: "rgba(243,235,218,0.04)",
            border: "1px solid var(--panel-border)",
            color: "var(--fg-dim)",
          }}
        >
          <RefreshCw size={12} />
        </button>
        {status === "live" && (
          <a
            href={`http://localhost:${port}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] transition"
            style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: "#fffae6" }}
          >
            <ExternalLink size={12} /> Pop out
          </a>
        )}
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Main: live editor iframe */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {status === "live" && (
            <iframe
              key={iframeKey}
              src={`http://localhost:${port}`}
              className="flex-1 w-full"
              style={{ background: "#000", border: 0 }}
              title="HyperEdit"
              allow="camera; microphone; clipboard-read; clipboard-write"
            />
          )}
          {status !== "live" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
              <div className="panel p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} style={{ color: "#fbbf24" }} />
                  <h3
                    className="text-[12px] font-semibold uppercase tracking-widest"
                    style={{ color: "var(--cream-mute)" }}
                  >
                    Start the editor
                  </h3>
                </div>
                <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
                  The repo is already cloned at{" "}
                  <code style={{ color: TONE }}>~/code/hyperedit</code>. Run the dev server, then
                  the iframe above will go live.
                </p>
                {[
                  "cd ~/code/hyperedit",
                  "npx vite --port 5174   # 5173 is taken by Baseline OS",
                ].map((cmd, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--panel-border)",
                    }}
                  >
                    <pre className="flex-1 text-[11.5px] font-mono" style={{ color: "var(--fg)" }}>
                      {cmd}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(cmd)}
                      className="p-1"
                      style={{ color: "var(--fg-dim)" }}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Remotion component drafter (works whether editor is up or not) */}
        <aside
          className="flex flex-col overflow-y-auto border-l p-4 space-y-3 scroll"
          style={{ width: "min(380px, 36vw)", borderColor: "var(--panel-border)" }}
        >
          <div className="panel p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: TONE }} />
              <h3
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--cream-mute)" }}
              >
                Component drafter
              </h3>
            </div>
            <p className="text-[11.5px]" style={{ color: "var(--cream-mute)" }}>
              Brief the AI, get a complete Remotion v4 component ready to drop into{" "}
              <code style={{ color: TONE }}>src/Root.tsx</code>.
            </p>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="A 30-second product reveal: dark background, slow camera push-in, word-by-word text overlay, confetti finale on logo."
              className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-y"
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid var(--panel-border)",
                color: "var(--fg)",
              }}
            />
            <div className="flex justify-end gap-2">
              {result && (
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="px-3 h-[32px] rounded text-[11px] flex items-center gap-1.5"
                  style={{
                    background: "rgba(243,235,218,0.06)",
                    border: "1px solid var(--panel-border)",
                    color: "var(--fg-dim)",
                  }}
                >
                  <Copy size={11} /> Copy
                </button>
              )}
              <button
                onClick={generate}
                disabled={!brief.trim() || drafting}
                className="px-3 h-[32px] rounded text-[11.5px] font-semibold transition disabled:opacity-40"
                style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
              >
                {drafting ? "Drafting…" : "Draft component"}
              </button>
            </div>
            {result && (
              <pre
                className="scroll overflow-auto p-3 rounded-lg text-[10.5px] leading-relaxed whitespace-pre-wrap max-h-[400px]"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid var(--panel-border)",
                  color: "var(--fg-dim)",
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                {result}
              </pre>
            )}
          </div>

          <div
            className="panel p-4 space-y-1.5 text-[11.5px]"
            style={{ background: "rgba(0,0,0,0.25)", color: "var(--cream-dim)" }}
          >
            <h3
              className="text-[10px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--cream-mute)" }}
            >
              Workflow
            </h3>
            <ol className="space-y-0.5 list-decimal pl-4">
              <li>Brief the drafter ↑ → get a Composition</li>
              <li>
                Paste it into <code style={{ color: TONE }}>~/code/hyperedit/src/</code>
              </li>
              <li>
                Register in <code style={{ color: TONE }}>src/Root.tsx</code>
              </li>
              <li>The live editor (iframe ←) shows it instantly via Vite HMR</li>
              <li>Use the editor's Render button to export MP4</li>
            </ol>
          </div>

          <a
            href="https://github.com/WaltLuv/hyperedit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11.5px] self-start"
            style={{ color: TONE }}
          >
            <ExternalLink size={11} /> github.com/WaltLuv/hyperedit
          </a>
        </aside>
      </div>
    </div>
  );
}
