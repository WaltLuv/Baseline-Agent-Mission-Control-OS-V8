/**
 * VideoAgentStudio — Campaign #87.
 *
 * One shared Studio surface for 5 agent pages (openclaw, hermes, gemini,
 * claudeclaw, free-claude). Five tabs that wrap REAL working endpoints,
 * plus a "Video Agent" tab that orchestrates them via /__agent_run so
 * the user can describe a video in plain English and the agent
 * actually builds it.
 *
 * Tabs:
 *   · Image   → /__fal_image (FAL.ai Flux Schnell — real PNG URL)
 *   · Video   → /__higgsfield_generate { model, prompt, aspect } —
 *              real Higgsfield generation jobs
 *   · TTS     → /__tts { script } (ElevenLabs)
 *   · Agent   → /__agent_run { agent, messages }  — claude with full
 *              tool access (Read/Write/Edit/Bash/WebFetch) so the LLM
 *              can call the image/video/tts endpoints itself, save
 *              outputs to disk, and orchestrate a multi-step build
 *   · HyperEdit → live iframe of the local Remotion editor
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon, Video, Mic, Wand2, Film, Loader2, CheckCircle2,
  Sparkles, Download, ExternalLink, Copy,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "image" | "video" | "tts" | "agent" | "editor";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "image",  label: "Image",        icon: <ImageIcon size={13} /> },
  { id: "video", label: "Video",         icon: <Video size={13} /> },
  { id: "tts",   label: "Text → Speech", icon: <Mic size={13} /> },
  { id: "agent", label: "Video Agent",   icon: <Wand2 size={13} /> },
  { id: "editor", label: "HyperEdit",    icon: <Film size={13} /> },
];

// Real Higgsfield job_set_type ids — verified against `hf model list`
// 2026-05-30. Earlier list used "kling"/"soul"/"seedance" which don't
// exist as job types. The Video tab picker now uses the actual ids.
const VIDEO_MODELS = [
  "veo3_1",                 // Google Veo 3.1 — flagship video
  "veo3_1_lite",            // faster/cheaper Veo
  "seedance_2_0",           // motion-focused
  "kling2_6",               // Kling 2.6 narrative video
  "kling3_0",               // Kling 3.0
  "wan2_7",                 // Wan 2.7
  "marketing_studio_video", // ad-creative oriented
  "cinematic_studio_video", // cinematic narrative
  "soul_cast",              // Soul character continuity (video)
];
const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

interface Props {
  /** The agent id used for the "Video Agent" tab when it dispatches a
   *  multi-step build (passes the brief to /__agent_run as agent=X). */
  agentId: string;
  /** Display name for the studio header. */
  brand: string;
  /** Accent color (used for active-tab highlight + button gradients). */
  tone: string;
}

export function VideoAgentStudio({ agentId, brand, tone }: Props) {
  const [tab, setTab] = useState<Tab>("image");
  return (
    <section className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--panel-border)" }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${tone}22`, border: `1px solid ${tone}55` }}>
          <Sparkles size={14} style={{ color: tone }} />
        </div>
        <div className="flex flex-col leading-tight">
          <div className="text-[12.5px] font-semibold">{brand} · Studio</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/65">image · video · tts · video-agent · editor</div>
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] uppercase tracking-[0.2em] font-semibold border transition"
              style={{
                background: tab === t.id ? `${tone}22` : "transparent",
                borderColor: tab === t.id ? `${tone}55` : "rgba(255,255,255,0.12)",
                color: tab === t.id ? tone : "rgba(255,255,255,0.7)",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {tab === "image"  && <ImageTab tone={tone} />}
        {tab === "video"  && <VideoTab tone={tone} />}
        {tab === "tts"    && <TtsTab tone={tone} />}
        {tab === "agent"  && <VideoAgentTab agentId={agentId} brand={brand} tone={tone} />}
        {tab === "editor" && <EditorTab tone={tone} />}
      </div>
    </section>
  );
}

// ─── Image — FAL.ai Flux Schnell ────────────────────────────────────────
function ImageTab({ tone }: { tone: string }) {
  const [prompt, setPrompt] = useState("");
  const [working, setWorking] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  async function go() {
    if (!prompt.trim() || working) return;
    setWorking(true); setUrl(null);
    try {
      const r = await fetch("/__fal_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const j = await r.json();
      if (j.url) { setUrl(j.url); toast.success("image ready"); }
      else toast.error(j.error ?? `FAL ${r.status}`);
    } catch (e) { toast.error(String(e)); }
    setWorking(false);
  }
  return (
    <div className="space-y-3 max-w-3xl">
      <Tip>Real image generation via FAL.ai Flux Schnell. Returns a hosted URL within ~6 seconds.</Tip>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="A futuristic city skyline at dusk, cinematic editorial photograph, color graded teal and orange, shot on Arri Alexa…" className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-black/40 border border-white/10 focus:outline-none resize-y" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
      <GoBtn onClick={go} working={working} tone={tone} label="Generate image" />
      {url && (
        <figure className="rounded-xl border overflow-hidden bg-black" style={{ borderColor: `${tone}55` }}>
          <img src={url} alt="generated" className="w-full block" />
          <figcaption className="px-3 py-2 flex items-center gap-2 text-[11px] font-mono">
            <a href={url} target="_blank" rel="noreferrer" className="underline decoration-dotted opacity-70 hover:opacity-100 truncate flex-1">{url}</a>
            <a href={url} download className="px-2 py-1 rounded text-[9.5px] uppercase tracking-[0.18em] border border-white/15 hover:bg-white/5"><Download size={9} className="inline mr-1" />save</a>
          </figcaption>
        </figure>
      )}
    </div>
  );
}

// ─── Video — Higgsfield ─────────────────────────────────────────────────
function VideoTab({ tone }: { tone: string }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(VIDEO_MODELS[0]);
  const [aspect, setAspect] = useState("16:9");
  const [working, setWorking] = useState(false);
  const [jobs, setJobs] = useState<string[] | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  async function go() {
    if (!prompt.trim() || working) return;
    setWorking(true); setJobs(null); setRaw(null);
    try {
      const r = await fetch("/__higgsfield_generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: prompt.trim(), aspect }),
      });
      const j = await r.json();
      if (j.jobIds) { setJobs(j.jobIds); toast.success(`launched ${j.jobIds.length} job${j.jobIds.length === 1 ? "" : "s"}`); }
      else if (j.raw) { setRaw(j.raw); }
      else toast.error(j.error ?? `Higgsfield ${r.status}`);
    } catch (e) { toast.error(String(e)); }
    setWorking(false);
  }
  return (
    <div className="space-y-3 max-w-3xl">
      <Tip>Real Higgsfield generation jobs via the local CLI. Soul = portrait continuity; nano_banana_2 = fast image edits; seedance = motion; kling = cinematic; marketing_studio = ad creative.</Tip>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="A 6-second cinematic shot of a robot barista pouring espresso, shallow depth of field, warm tungsten lighting…" className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-black/40 border border-white/10 focus:outline-none resize-y" />
      <div className="flex flex-wrap gap-2">
        <select value={model} onChange={(e) => setModel(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] bg-black/40 border border-white/10">
          {VIDEO_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={aspect} onChange={(e) => setAspect(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] bg-black/40 border border-white/10">
          {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <GoBtn onClick={go} working={working} tone={tone} label="Generate" />
      </div>
      {jobs && (
        <div className="rounded-lg border p-3 text-[11.5px] font-mono space-y-1" style={{ borderColor: `${tone}55`, background: "rgba(0,0,0,0.35)" }}>
          <div className="text-[10px] uppercase tracking-[0.2em] opacity-65 mb-1">job ids</div>
          {jobs.map((id) => (<div key={id} className="flex items-center gap-2"><Loader2 size={10} className="animate-spin" /> {id}</div>))}
          <div className="text-[10px] opacity-60 mt-1.5">poll status at /higgsfield · jobs typically render in 30–120s</div>
        </div>
      )}
      {raw && <pre className="text-[10.5px] font-mono p-3 rounded bg-black/40 border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>{raw}</pre>}
    </div>
  );
}

// ─── TTS — ElevenLabs ───────────────────────────────────────────────────
function TtsTab({ tone }: { tone: string }) {
  const [script, setScript] = useState("");
  const [working, setWorking] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  async function go() {
    if (!script.trim() || working) return;
    setWorking(true); setAudio(null);
    try {
      const r = await fetch("/__tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.trim() }),
      });
      const j = await r.json();
      if (j.audio) { setAudio(j.audio); toast.success("audio ready"); }
      else toast.error(j.error ?? `TTS ${r.status}`);
    } catch (e) { toast.error(String(e)); }
    setWorking(false);
  }
  return (
    <div className="space-y-3 max-w-3xl">
      <Tip>ElevenLabs TTS. For dialogue, prefix each line with "Host A:" / "Host B:" — the endpoint auto-routes voices. Single-line input uses Voice A.</Tip>
      <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={6} placeholder="Host A: Welcome back to Operator OS Weekly.&#10;Host B: Today we're talking about turning Hermes goal mode into a video agent…" className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-black/40 border border-white/10 focus:outline-none resize-y font-sans" />
      <GoBtn onClick={go} working={working} tone={tone} label="Speak" />
      {audio && (
        <div className="rounded-xl border p-3 bg-black/30 space-y-2" style={{ borderColor: `${tone}55` }}>
          <audio src={audio} controls className="w-full" />
          <div className="flex items-center gap-2 text-[10.5px] font-mono">
            <a href={audio} target="_blank" rel="noreferrer" className="underline decoration-dotted opacity-70 truncate flex-1">{audio}</a>
            <a href={audio} download="tts.mp3" className="px-2 py-1 rounded text-[9.5px] uppercase tracking-[0.18em] border border-white/15 hover:bg-white/5"><Download size={9} className="inline mr-1" />save</a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Video Agent — orchestrated build ───────────────────────────────────
function VideoAgentTab({ agentId, brand, tone }: { agentId: string; brand: string; tone: string }) {
  const [brief, setBrief] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [log, setLog] = useState("");
  const [outputs, setOutputs] = useState<{ kind: string; url: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const SYSTEM = `You are the Video Agent for ${brand} in Baseline Automations. You orchestrate a multi-step video build by calling LOCAL endpoints with the WebFetch tool.

When given a brief, work in this order:
  1. Decompose into a shot list (3-5 shots, each with subject + style + camera + duration).
  2. For each shot, call POST http://localhost:8081/__higgsfield_generate
     body: { "model": "kling2_6", "prompt": "<full shot prompt>", "aspect": "16:9" }
     This returns { ok, jobIds } — the renders are real Higgsfield jobs.
  3. If still images are needed, call POST http://localhost:8081/__fal_image
     body: { "prompt": "<image prompt>" } — returns { url }.
  4. For voice-over, call POST http://localhost:8081/__tts
     body: { "script": "<final VO script>" } — returns { audio }.
  5. Save the final asset URLs to ~/Downloads/video-agent-<slug>.md as
     a one-page brief with embedded URLs + the timing plan.

Be terse in your own output. Run the calls, show the resulting URLs,
and end with the absolute path to the brief file. The user is reading
your stdout in a streaming chat panel — keep it readable.`;

  function harvestUrls(text: string): void {
    const urlRe = /(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|mp4|webm|mov|mp3|wav|m4a))/gi;
    const found = new Set(outputs.map((o) => o.url));
    const fresh: { kind: string; url: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(text)) !== null) {
      if (found.has(m[1])) continue;
      const ext = m[1].slice(m[1].lastIndexOf(".") + 1).toLowerCase();
      const kind = ["mp4", "webm", "mov"].includes(ext) ? "video"
        : ["mp3", "wav", "m4a"].includes(ext) ? "audio"
        : "image";
      fresh.push({ kind, url: m[1] });
      found.add(m[1]);
    }
    if (fresh.length > 0) setOutputs((prev) => [...prev, ...fresh]);
  }

  async function build() {
    if (!brief.trim() || streaming) return;
    setStreaming(true);
    setLog("");
    setOutputs([]);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r = await fetch("/__agent_run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agentId,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user",   content: brief.trim() },
          ],
        }),
        signal: ac.signal,
      });
      if (!r.body) throw new Error("no stream");
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const line of parts) {
          if (!line.startsWith("data:")) continue;
          try {
            const j = JSON.parse(line.slice(5).trim());
            if (j.delta) {
              setLog((p) => { const next = p + j.delta; harvestUrls(next); return next; });
            }
            if (j.tool?.status === "complete" && typeof j.tool.result === "string") {
              harvestUrls(j.tool.result);
            }
            if (j.done) {
              setStreaming(false);
              toast.success(j.exit === 0 ? "build complete" : `agent exited ${j.exit}`);
            }
          } catch { /* skip */ }
        }
      }
      setStreaming(false);
    } catch (e: any) {
      if (e?.name !== "AbortError") setLog((p) => p + `\n[error] ${String(e)}\n`);
      setStreaming(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-4 max-w-6xl">
      <div className="space-y-3">
        <Tip>One brief in → shot list, Higgsfield renders, TTS, and a saved brief file out. The agent uses WebFetch under the hood to call the local generation endpoints.</Tip>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} placeholder="30-second cinematic launch reel for an AI Workforce OS landing page. Three shots: data flowing through neural network, an operator at a glass desk, a finished dashboard reveal. Warm tungsten + cyan rim light. End with a logo wipe + 5-second VO 'Run your business while you sleep.'" className="w-full px-3 py-2 rounded-lg text-[13px] bg-black/40 border border-white/10 focus:outline-none resize-y font-sans" />
        <div className="flex gap-2">
          {!streaming ? (
            <button onClick={() => void build()} disabled={!brief.trim()} className="px-4 py-2 rounded-lg text-[12px] font-bold disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${tone}, ${tone}aa)`, color: "#fff", boxShadow: `0 6px 18px -6px ${tone}` }}>
              <Wand2 size={11} className="inline mr-1" /> Build video
            </button>
          ) : (
            <button onClick={() => abortRef.current?.abort()} className="px-4 py-2 rounded-lg text-[12px] font-bold" style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.5)", color: "#FCA5A5" }}>■ Stop</button>
          )}
        </div>
        <div className="rounded-xl border bg-black/45 p-3 min-h-[260px] max-h-[55vh] overflow-y-auto" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
            {streaming ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} style={{ color: tone }} />}
            {streaming ? "agent working…" : log ? "complete" : "ready"}
          </div>
          <pre className="font-mono text-[11px] whitespace-pre-wrap break-words leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>{log || "(no run yet — drop a brief above)"}</pre>
        </div>
      </div>
      <aside className="space-y-2">
        <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/75">Outputs harvested ({outputs.length})</div>
        {outputs.length === 0 ? (
          <div className="italic opacity-50 text-[11px]">URLs harvested from the agent's output appear here in real time.</div>
        ) : (
          <ul className="space-y-2">
            {outputs.map((o) => (
              <li key={o.url} className="rounded-lg border p-2 bg-black/30" style={{ borderColor: `${tone}44` }}>
                {o.kind === "image" && <img src={o.url} alt="" className="w-full rounded mb-1" />}
                {o.kind === "video" && <video src={o.url} controls className="w-full rounded mb-1" />}
                {o.kind === "audio" && <audio src={o.url} controls className="w-full mb-1" />}
                <div className="flex items-center gap-2 text-[9.5px] font-mono">
                  <span className="uppercase tracking-[0.18em] opacity-60">{o.kind}</span>
                  <a href={o.url} target="_blank" rel="noreferrer" className="ml-auto p-1 hover:bg-white/5 rounded"><ExternalLink size={10} /></a>
                  <button onClick={() => navigator.clipboard.writeText(o.url).then(() => toast.success("copied"))} className="p-1 hover:bg-white/5 rounded"><Copy size={10} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

// ─── HyperEdit — live iframe ────────────────────────────────────────────
function EditorTab({ tone }: { tone: string }) {
  const [port, setPort] = useState(6970);
  const [status, setStatus] = useState<"checking" | "live" | "dead">("checking");
  useEffect(() => {
    setStatus("checking");
    fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2500) })
      .then(() => setStatus("live"))
      .catch(() => setStatus("dead"));
  }, [port]);
  return (
    <div className="flex flex-col h-[68vh] gap-2">
      <div className="flex items-center gap-2">
        <Tip>Embedded HyperEdit (Remotion editor on localhost). If it's not live, `cd ~/code/hyperedit && npm run dev`.</Tip>
        <div className="ml-auto flex items-center gap-2 text-[10.5px] font-mono">
          <span>port</span>
          <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value) || 6970)} className="w-20 px-2 py-1 rounded bg-black/40 border border-white/10 focus:outline-none" />
          {status === "live" && <span className="text-emerald-400">● live</span>}
          {status === "dead" && <span className="text-red-400">● not running</span>}
          {status === "checking" && <Loader2 size={10} className="animate-spin opacity-60" />}
          <a href={`http://localhost:${port}/`} target="_blank" rel="noreferrer" className="px-2 py-1 rounded border border-white/10 text-[10px] uppercase tracking-[0.2em]" style={{ color: tone }}>open ↗</a>
        </div>
      </div>
      <div className="flex-1 rounded-xl border overflow-hidden bg-black" style={{ borderColor: `${tone}55` }}>
        {status === "live" ? (
          <iframe src={`http://localhost:${port}/`} title="HyperEdit" className="w-full h-full border-0" allow="clipboard-read; clipboard-write; camera; microphone" />
        ) : (
          <div className="h-full flex items-center justify-center text-[12px] opacity-60 italic">{status === "checking" ? "checking…" : "HyperEdit not running on that port — start it with `cd ~/code/hyperedit && npm run dev` (default port 6970)."}</div>
        )}
      </div>
    </div>
  );
}

// ─── shared bits ────────────────────────────────────────────────────────
function GoBtn({ onClick, working, tone, label }: { onClick: () => void; working: boolean; tone: string; label: string }) {
  return (
    <button onClick={onClick} disabled={working} className="px-4 py-2 rounded-lg text-[12px] font-bold disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${tone}, ${tone}aa)`, color: "#fff", boxShadow: `0 6px 18px -6px ${tone}` }}>
      {working ? <><Loader2 size={11} className="inline mr-1 animate-spin" /> working…</> : <>{label}</>}
    </button>
  );
}
function Tip({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-muted-foreground/75 leading-relaxed">{children}</div>;
}
