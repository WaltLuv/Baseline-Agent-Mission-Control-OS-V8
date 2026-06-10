/**
 * Video Studio — creative workspace (Google Flow + Higgsfield + HeyGen +
 * HyperFrames + NotebookLM + Claude Code Studio).
 *
 * 4-pane production environment, NOT a render dashboard:
 *   Left   — project/asset rail + upload dropzone (images/video/audio/docs)
 *   Center — preview/workspace canvas (real inline preview via sidecar)
 *   Right  — AI chat/context panel (acts on the selected asset; real /__agent_run)
 *   Bottom — timeline/workflow rail (Upload → Storyboard → … → Export)
 *   + Proof drawer (inputs, prompts, providers, outputs, setup blockers)
 *
 * Uploads write to the shared Universal Asset Library root (the same folder
 * /__video_workspace scans + Asset Library reads) with a lineage/proof record.
 * Generation/render is marked setup-needed when the provider isn't configured —
 * no fake render-ready state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentActivity } from "@/components/agent-activity";
import { CREATIVE_PIPELINES, getPipeline, orchestrationFor } from "@/lib/creative-os";
import {
  Upload,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Sparkles,
  Mic,
  PanelRightOpen,
  Clapperboard,
  ListChecks,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

const TONE = "#fde047";

type Kind = "image" | "video" | "audio" | "document" | "other";
interface Asset {
  name: string;
  size: number;
  mtime: number;
  kind: Kind;
  path: string;
}
interface ChatMsg {
  role: "user" | "ai" | "system";
  text: string;
}
interface ProofEvent {
  ts: number;
  kind: "upload" | "prompt" | "output" | "blocker";
  label: string;
}

function kindOf(name: string): Kind {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  if (/^(png|jpe?g|webp|gif|svg)$/.test(e)) return "image";
  if (/^(mp4|webm|mov)$/.test(e)) return "video";
  if (/^(mp3|wav|ogg|m4a)$/.test(e)) return "audio";
  if (/^(pdf|txt|md|markdown|json|csv)$/.test(e)) return "document";
  return "other";
}
const KIND_ICON = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  other: FileText,
};

const STAGES = ["Upload", "Storyboard", "Scenes", "Render", "Captions", "Proof", "Export"] as const;
const FILTERS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "document", label: "Docs" },
];

// AI actions that operate on the selected asset/context (real planning output
// via /__agent_run; render/generate is honest setup-needed).
const ACTIONS = [
  { id: "describe", label: "Describe asset", stage: "Storyboard" },
  { id: "summarize", label: "Summarize doc", stage: "Storyboard" },
  { id: "storyboard", label: "Storyboard", stage: "Storyboard" },
  { id: "scenes", label: "Generate scenes", stage: "Scenes" },
  { id: "script", label: "Voiceover script", stage: "Scenes" },
  { id: "captions", label: "Captions", stage: "Captions" },
  { id: "thumbnail", label: "Thumbnail prompt", stage: "Render" },
  { id: "proof", label: "Proof package", stage: "Proof" },
] as const;

export function VideoStudioWorkspace() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [root, setRoot] = useState<string>("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<(typeof STAGES)[number]>("Upload");
  const [proof, setProof] = useState<ProofEvent[]>([]);
  const [proofOpen, setProofOpen] = useState(false);
  const [docText, setDocText] = useState<string | null>(null);
  const [provider, setProvider] = useState("HyperFrames (HTML→MP4)");
  const [requireApproval, setRequireApproval] = useState(true);
  const [pipelineId, setPipelineId] = useState("");
  const activePipeline = pipelineId ? getPipeline(pipelineId) : null;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const addProof = (kind: ProofEvent["kind"], label: string) =>
    setProof((p) => [...p, { ts: Date.now(), kind, label }]);

  const loadAssets = useCallback(async () => {
    try {
      const r = await fetch("/__video_workspace?bucket=video-studio", { cache: "no-store" });
      const j = (await r.json()) as {
        items?: { name: string; size: number; mtime: number }[];
        root?: string;
      };
      const rt = j.root ?? "";
      setRoot(rt);
      setAssets(
        (j.items ?? []).map((it) => ({ ...it, kind: kindOf(it.name), path: `${rt}/${it.name}` })),
      );
    } catch {
      /* honest empty */
    }
  }, []);
  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const ingest = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = reject;
          fr.readAsDataURL(file);
        });
        const r = await fetch("/__video_workspace_upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: file.name, base64 }),
        });
        const j = (await r.json()) as {
          ok?: boolean;
          asset?: { name: string; size: number; kind: Kind; path: string; mtime: number };
          error?: string;
        };
        if (j.ok && j.asset) {
          addProof(
            "upload",
            `Ingested ${j.asset.name} (${j.asset.kind}) → Universal Asset Library`,
          );
          await loadAssets();
          setSelected({ ...j.asset });
          setStage("Storyboard");
        } else {
          addProof("blocker", `Upload failed: ${j.error ?? "unknown"}`);
        }
      } catch (e) {
        addProof("blocker", `Upload error: ${(e as Error).message}`);
      }
      setUploading(false);
    },
    [loadAssets],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    for (const f of Array.from(e.dataTransfer.files)) void ingest(f);
  };

  // Preview the selected document's text inline.
  useEffect(() => {
    setDocText(null);
    if (selected?.kind === "document" && /\.(txt|md|markdown|json|csv)$/i.test(selected.name)) {
      fetch(`/__workspace_file?path=${encodeURIComponent(selected.path)}`)
        .then((r) => r.json())
        .then((j: { kind?: string; text?: string }) => {
          if (j.kind === "text") setDocText(j.text ?? "");
        })
        .catch(() => setDocText(null));
    }
  }, [selected]);

  const run = useCallback(
    async (prompt: string, stageHint?: (typeof STAGES)[number]) => {
      if (!prompt.trim() || busy) return;
      if (stageHint) setStage(stageHint);
      const ctx = selected
        ? `\n\n[Selected asset: ${selected.name} (${selected.kind}), in the Universal Asset Library]`
        : "";
      setChat((c) => [...c, { role: "user", text: prompt }]);
      addProof("prompt", prompt.slice(0, 80) + (selected ? ` · ctx:${selected.name}` : ""));
      setBusy(true);
      let out = "";
      try {
        const r = await fetch("/__agent_run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agent: "claudeclaw",
            messages: [{ role: "user", content: prompt + ctx }],
          }),
        });
        if (!r.body) throw new Error("no stream");
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        setChat((c) => [...c, { role: "ai", text: "" }]);
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const evt = JSON.parse(payload) as { delta?: string };
              if (evt.delta) {
                out += evt.delta;
                setChat((c) => {
                  const n = [...c];
                  n[n.length - 1] = { role: "ai", text: out };
                  return n;
                });
              }
            } catch {
              /* keepalive */
            }
          }
        }
        addProof("output", `${out.length} chars generated`);
      } catch (e) {
        const msg = `Agent unreachable — output is planning-only until a coding/runtime agent is connected. (${(e as Error).message})`;
        setChat((c) => [...c, { role: "system", text: msg }]);
        addProof("blocker", "Agent runtime not connected — generation is setup-needed");
      }
      setBusy(false);
    },
    [busy, selected],
  );

  const doAction = (a: (typeof ACTIONS)[number]) => {
    const target = selected ? `the selected asset "${selected.name}"` : "the project";
    const map: Record<string, string> = {
      describe: `Describe ${target} in detail for a creative brief.`,
      summarize: `Summarize ${target} into key points usable for a video script.`,
      storyboard: `Create a storyboard (numbered shots, each with visual + on-screen text + duration) based on ${target}.`,
      scenes: `Generate a scene list with shot descriptions and transitions from ${target}.`,
      script: `Write a voiceover script (timed, conversational) for ${target}.`,
      captions: `Write social captions + hashtags for a video made from ${target}.`,
      thumbnail: `Write an image-generation prompt for a high-CTR thumbnail for ${target}.`,
      proof: `Assemble a proof package outline (inputs, steps, outputs, approvals) for ${target}.`,
    };
    void run(map[a.id], a.stage as (typeof STAGES)[number]);
  };

  const micInput = () => {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        start: () => void;
        onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      };
    };
    const Ctor = w.webkitSpeechRecognition;
    if (!Ctor) {
      setChat((c) => [...c, { role: "system", text: "Voice input needs Chrome/Safari." }]);
      return;
    }
    const rec = new Ctor();
    rec.onresult = (e) => setInput(e.results[0][0].transcript);
    rec.start();
  };

  const filtered = filter === "all" ? assets : assets.filter((a) => a.kind === filter);

  return (
    <div
      className="flex h-[calc(100vh-56px)] flex-col bg-gradient-to-b from-[#07070b] to-black text-white"
      data-testid="video-studio-workspace"
    >
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        <Clapperboard size={16} style={{ color: TONE }} />
        <span className="text-[13px] font-bold">Video Studio · Creative Workspace</span>
        <span className="text-[10px] uppercase tracking-widest text-white/35" data-testid="vs-ual">
          Universal Asset Library
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setProofOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px]"
            data-testid="vs-proof-toggle"
          >
            <ListChecks size={12} /> Proof ({proof.length})
          </button>
        </div>
      </div>

      {/* Creative OS strip — Higgsfield-style pipeline picker + provider chain */}
      <div
        className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-1.5"
        data-testid="creative-os-pipelines"
      >
        <span className="text-[10px] uppercase tracking-widest text-white/40">
          Creative OS · Pipeline
        </span>
        <select
          value={pipelineId}
          onChange={(e) => {
            const id = e.target.value;
            setPipelineId(id);
            const p = CREATIVE_PIPELINES.find((x) => x.id === id);
            if (p) {
              setStage(p.stages[0] as (typeof STAGES)[number]);
              addProof(
                "prompt",
                `Pipeline: ${p.name} (${p.stages.length} stages, providers: ${p.providerChain.join("→")})`,
              );
            }
          }}
          className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white"
        >
          <option value="">Choose a pipeline…</option>
          {CREATIVE_PIPELINES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {activePipeline && (
          <span
            className="flex flex-wrap items-center gap-1 text-[10px] text-white/50"
            data-testid="creative-os-providers"
          >
            {orchestrationFor(activePipeline.id).map((r) => (
              <span key={r.intent} className="rounded bg-white/5 px-1.5 py-0.5">
                {r.intent}:{r.provider}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* LEFT — asset rail + upload */}
        <aside
          className="flex w-56 shrink-0 flex-col border-r border-white/10"
          data-testid="vs-asset-rail"
        >
          <div
            className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/55"
            data-testid="creative-os-sources"
          >
            Sources · chat · summarize · storyboard
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className="m-2 cursor-pointer rounded-xl border-2 border-dashed p-4 text-center text-[11px]"
            style={{
              borderColor: dragOver ? TONE : "rgba(255,255,255,0.15)",
              background: dragOver ? `${TONE}10` : "transparent",
            }}
            data-testid="vs-upload-dropzone"
          >
            {uploading ? (
              <Loader2 size={16} className="mx-auto animate-spin" />
            ) : (
              <Upload size={16} className="mx-auto" style={{ color: TONE }} />
            )}
            <div className="mt-1 text-white/70">
              {uploading ? "Uploading…" : "Drop or click to upload"}
            </div>
            <div className="text-white/35">images · video · audio · PDF · docs</div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.csv"
              className="hidden"
              onChange={(e) => {
                for (const f of Array.from(e.target.files ?? [])) void ingest(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1 px-2 pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{
                  background: filter === f.id ? `${TONE}22` : "rgba(255,255,255,0.05)",
                  color: filter === f.id ? TONE : "rgba(255,255,255,0.5)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {filtered.length === 0 ? (
              <p className="mt-4 text-center text-[11px] text-white/30">
                No assets yet. Upload to begin.
              </p>
            ) : (
              filtered.map((a) => {
                const Icon = KIND_ICON[a.kind];
                const active = selected?.name === a.name;
                return (
                  <button
                    key={a.name}
                    onClick={() => setSelected(a)}
                    className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px]"
                    style={{
                      background: active ? `${TONE}18` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? `${TONE}55` : "transparent"}`,
                    }}
                    data-testid={`vs-asset-${a.kind}`}
                  >
                    <Icon size={12} style={{ color: TONE }} />
                    <span className="truncate">{a.name.replace(/^[a-z0-9]+-/, "")}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* CENTER — preview canvas */}
        <main className="flex min-w-0 flex-1 flex-col" data-testid="vs-canvas">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            {!selected ? (
              <div className="text-center text-white/30">
                <Clapperboard size={40} className="mx-auto mb-2" />
                <p className="text-sm">Select or upload an asset to preview it here.</p>
              </div>
            ) : selected.kind === "image" ? (
              <img
                src={`/__video_workspace_raw?path=${encodeURIComponent(selected.path)}`}
                alt={selected.name}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ) : selected.kind === "video" ? (
              <video
                src={`/__video_workspace_raw?path=${encodeURIComponent(selected.path)}`}
                controls
                className="max-h-full max-w-full rounded-lg bg-black"
              />
            ) : selected.kind === "audio" ? (
              <audio
                src={`/__video_workspace_raw?path=${encodeURIComponent(selected.path)}`}
                controls
                className="w-full max-w-md"
              />
            ) : selected.name.endsWith(".pdf") ? (
              <iframe
                src={`/__video_workspace_raw?path=${encodeURIComponent(selected.path)}`}
                title={selected.name}
                className="h-full w-full rounded-lg bg-white"
              />
            ) : (
              <pre className="h-full w-full overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-white/80">
                {docText ?? "Loading…"}
              </pre>
            )}
          </div>
        </main>

        {/* RIGHT — AI chat / context */}
        <aside
          className="flex w-80 shrink-0 flex-col border-l border-white/10"
          data-testid="vs-ai-panel"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/60">
            <Sparkles size={13} style={{ color: TONE }} /> AI workspace
          </div>
          <div className="border-b border-white/10 p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
              {selected
                ? `Context: ${selected.name.replace(/^[a-z0-9]+-/, "")}`
                : "No asset selected"}
            </div>
            <div className="flex flex-wrap gap-1">
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => doAction(a)}
                  disabled={busy}
                  className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] disabled:opacity-40 hover:bg-white/10"
                >
                  {a.label}
                </button>
              ))}
            </div>
            {/* Provider selection + approval gate + HyperEdit compose engine */}
            <div className="mt-2 space-y-1.5">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                data-testid="vs-provider"
                className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white"
              >
                {["HyperFrames (HTML→MP4)", "Higgsfield", "HeyGen", "Runway", "Pika"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <label
                className="flex items-center gap-2 text-[10px] text-white/60"
                data-testid="vs-approval-gate"
              >
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                />
                Require approval before render
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    addProof("upload", `Render approved · ${provider}`);
                    setStage("Render");
                  }}
                  disabled={!requireApproval}
                  className="flex-1 rounded-md px-2 py-1 text-[11px] font-semibold text-black disabled:opacity-40"
                  style={{ background: TONE }}
                  data-testid="vs-approve-render"
                >
                  Approve render
                </button>
                <a
                  href="/hyperedit"
                  className="rounded-md border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10"
                  data-testid="vs-hyperedit-link"
                >
                  Compose in HyperEdit ↗
                </a>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-[12px]">
            {chat.length === 0 ? (
              <p className="text-white/30">
                Ask the AI to describe an asset, build a storyboard, write a script, or assemble a
                proof package.
              </p>
            ) : (
              chat.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "ai"
                      ? "text-sky-200"
                      : m.role === "system"
                        ? "italic text-amber-300/80"
                        : "text-white"
                  }
                >
                  <span className="mr-1 text-[9px] uppercase tracking-wider text-white/40">
                    {m.role}
                  </span>
                  <span className="whitespace-pre-wrap">{m.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex items-end gap-1 border-t border-white/10 p-2">
            <button
              onClick={micInput}
              className="rounded-md border border-white/15 p-2"
              title="Voice input"
            >
              <Mic size={13} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              placeholder="Describe what to build…"
              className="flex-1 resize-none rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[12px] outline-none"
            />
            <button
              onClick={() => {
                void run(input);
                setInput("");
              }}
              disabled={busy || !input.trim()}
              className="rounded-md px-3 py-2 text-[12px] font-semibold text-black disabled:opacity-40"
              style={{ background: TONE }}
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
          {/* Agent Activity + Graphify structural awareness for creative actions */}
          <div className="border-t border-white/10 p-2">
            <AgentActivity
              agentId="video-studio"
              runtime="Claude Code Studio"
              provider={provider}
            />
          </div>
        </aside>
      </div>

      {/* BOTTOM — timeline / workflow rail */}
      <div
        className="flex items-center gap-1 border-t border-white/10 px-4 py-2"
        data-testid="vs-timeline"
      >
        {(activePipeline?.stages ?? (STAGES as readonly string[])).map((s, i, arr) => (
          <div key={s} className="flex items-center">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: stage === s ? `${TONE}22` : "rgba(255,255,255,0.05)",
                color: stage === s ? TONE : "rgba(255,255,255,0.4)",
                border: `1px solid ${stage === s ? `${TONE}55` : "transparent"}`,
              }}
            >
              {s}
            </span>
            {i < arr.length - 1 && <span className="mx-1 text-white/20">→</span>}
          </div>
        ))}
        <span className="ml-auto text-[10px] text-white/35">
          {assets.length} assets · render via Higgsfield/HyperFrames (setup-needed if unconfigured)
        </span>
      </div>

      {/* PROOF DRAWER */}
      {proofOpen && (
        <div
          className="absolute bottom-12 right-2 z-20 max-h-[50vh] w-80 overflow-y-auto rounded-xl border border-white/15 bg-[#0b0b10] p-3 shadow-2xl"
          data-testid="vs-proof-drawer"
        >
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/60">
            <PanelRightOpen size={13} /> Proof package
          </div>
          {proof.length === 0 ? (
            <p className="text-[11px] text-white/30">
              No events yet — uploads, prompts, outputs, and blockers are logged here.
            </p>
          ) : (
            proof
              .slice()
              .reverse()
              .map((p, i) => (
                <div key={i} className="mb-1 flex items-start gap-2 text-[11px]">
                  {p.kind === "blocker" ? (
                    <AlertCircle size={12} className="mt-0.5 text-red-400" />
                  ) : (
                    <CheckCircle2 size={12} className="mt-0.5 text-emerald-400" />
                  )}
                  <div>
                    <span className="text-white/40">{p.kind}</span> ·{" "}
                    <span className="text-white/75">{p.label}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}

export default VideoStudioWorkspace;
