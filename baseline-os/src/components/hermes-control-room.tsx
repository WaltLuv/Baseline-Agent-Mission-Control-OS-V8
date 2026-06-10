/**
 * HermesControlRoom — shared layout + 3 sub-views for Campaign #88:
 *   · Workspace  → typed buckets where Hermes drops outputs; click to preview
 *                  (real videos, audio, images, PDFs, text — inline)
 *   · Goal Mode  → autonomous long-runs (`hermes -z "<goal>"`); past runs
 *                  list + a live SSE-streamed launcher
 *   · MCP Room   → list / add / remove / test / login on Hermes MCP servers
 *
 * Each surface is its own route under /agents/hermes/{workspace,goal,mcp}
 * for cleaner navigation; this component is what they render.
 */

import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Folder, FileText, Image as ImageIcon, Video, Music, FileJson, Play,
  Plug, Plus, RefreshCw, Trash2, CheckCircle2, AlertCircle, X, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Shared layout — nav strip + sub-content ────────────────────────────
type SubRoute = "workspace" | "goal" | "mcp" | "studio";
const SUB_NAV: { id: SubRoute; href: string; label: string; tone: string }[] = [
  { id: "workspace", href: "/agents/hermes/workspace", label: "Workspace · Buckets", tone: "#FFD21E" },
  { id: "goal",      href: "/agents/hermes/goal",      label: "Goal Mode",           tone: "#10B981" },
  { id: "mcp",       href: "/agents/hermes/control",   label: "MCP Control Room",    tone: "#A78BFA" },
  { id: "studio",    href: "/agents/hermes/studio",    label: "Studio",              tone: "#F472B6" },
];

export function HermesControlRoomShell({ active, children }: { active: SubRoute; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
        <Link to="/agents/hermes" className="text-[10.5px] uppercase tracking-[0.22em] px-2.5 py-1 rounded-lg hover:bg-white/5" style={{ color: "rgba(255,255,255,0.55)" }}>
          ← Hermes
        </Link>
        <div className="flex gap-1.5">
          {SUB_NAV.map((s) => (
            <Link
              key={s.id}
              to={s.href}
              className="px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-[0.2em] font-semibold border transition"
              style={{
                background: s.id === active ? `${s.tone}22` : "transparent",
                borderColor: s.id === active ? `${s.tone}55` : "rgba(255,255,255,0.12)",
                color: s.id === active ? s.tone : "rgba(255,255,255,0.7)",
              }}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

// ─── Workspace — typed buckets + file preview ───────────────────────────
interface WorkspaceFile { name: string; path: string; size: number; mtime: number; isDir: boolean; ext: string }
interface Bucket { id: string; label: string; dir: string; files: WorkspaceFile[] }

export function HermesWorkspaceView() {
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [preview, setPreview] = useState<WorkspaceFile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/__hermes_workspace_buckets")
      .then((r) => r.json())
      .then((j: { buckets: Bucket[] }) => setBuckets(j.buckets ?? []))
      .catch(() => setBuckets([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  return (
    <HermesControlRoomShell active="workspace">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="text-[12px] uppercase tracking-[0.22em] font-semibold" style={{ color: "#FFD21E" }}>
            Workspace · Typed Buckets
          </div>
          <span className="text-[10.5px] text-muted-foreground/60">
            Every output Hermes produces — agent runs, sessions, memory, generated media — sorted by mtime, ready to preview.
          </span>
          <button onClick={load} className="ml-auto p-1.5 rounded hover:bg-white/5" title="Refresh">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {!buckets ? (
          <div className="text-[12px] opacity-60">loading…</div>
        ) : (
          buckets.map((b) => (
            <BucketBlock key={b.id} bucket={b} onPreview={setPreview} />
          ))
        )}
      </div>
      {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}
    </HermesControlRoomShell>
  );
}

function BucketBlock({ bucket, onPreview }: { bucket: Bucket; onPreview: (f: WorkspaceFile) => void }) {
  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "rgba(255,210,30,0.22)", background: "rgba(255,210,30,0.04)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Folder size={13} style={{ color: "#FFD21E" }} />
        <div className="text-[12.5px] font-semibold" style={{ color: "#fde047" }}>{bucket.label}</div>
        <span className="text-[10.5px] text-muted-foreground/60 font-mono ml-2">{bucket.files.length} file{bucket.files.length === 1 ? "" : "s"}</span>
        <span className="text-[9.5px] text-muted-foreground/45 font-mono ml-auto">{bucket.dir}</span>
      </div>
      {bucket.files.length === 0 ? (
        <div className="text-[11px] italic opacity-50">empty</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {bucket.files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => !f.isDir && onPreview(f)}
              disabled={f.isDir}
              className="text-left rounded-lg p-2.5 border transition hover:-translate-y-px disabled:opacity-60"
              style={{ background: "rgba(0,0,0,0.32)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <FileIcon ext={f.ext} isDir={f.isDir} />
                <span className="font-mono text-[11.5px] truncate flex-1">{f.name}</span>
                <span className="text-[9px] opacity-50 font-mono">{(f.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="text-[9.5px] opacity-45 font-mono">{new Date(f.mtime).toLocaleString()}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FileIcon({ ext, isDir }: { ext: string; isDir: boolean }) {
  if (isDir) return <Folder size={12} style={{ color: "#FFD21E" }} />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return <ImageIcon size={12} style={{ color: "#A78BFA" }} />;
  if (["mp4", "webm", "mov"].includes(ext)) return <Video size={12} style={{ color: "#F472B6" }} />;
  if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return <Music size={12} style={{ color: "#10B981" }} />;
  if (["json", "yaml", "yml", "jsonl"].includes(ext)) return <FileJson size={12} style={{ color: "#60A5FA" }} />;
  return <FileText size={12} style={{ color: "rgba(255,255,255,0.45)" }} />;
}

function FilePreviewModal({ file, onClose }: { file: WorkspaceFile; onClose: () => void }) {
  const url = `/__hermes_file?path=${encodeURIComponent(file.path)}`;
  const ext = file.ext;
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  const isVideo = ["mp4", "webm", "mov"].includes(ext);
  const isAudio = ["mp3", "wav", "m4a", "ogg"].includes(ext);
  const isPdf   = ext === "pdf";
  const isHtml  = ext === "html" || ext === "htm";
  const [textBody, setTextBody] = useState<string | null>(null);
  useEffect(() => {
    if (isImage || isVideo || isAudio || isPdf || isHtml) return;
    fetch(url).then((r) => r.text()).then((t) => setTextBody(t.slice(0, 80_000))).catch(() => setTextBody("(failed to load)"));
  }, [url, isImage, isVideo, isAudio, isPdf, isHtml]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="rounded-xl border max-w-5xl max-h-[92vh] w-full flex flex-col overflow-hidden" style={{ background: "#0F1116", borderColor: "rgba(255,210,30,0.4)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <FileIcon ext={file.ext} isDir={false} />
          <span className="font-mono text-[12px] truncate">{file.name}</span>
          <span className="text-[10px] opacity-50 ml-2">{(file.size / 1024).toFixed(1)} KB · {new Date(file.mtime).toLocaleString()}</span>
          <a href={url} download={file.name} className="ml-auto px-2 py-1 rounded text-[10px] uppercase tracking-[0.18em] border border-white/15 hover:bg-white/5">download</a>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5"><X size={14} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto bg-black">
          {isImage  && <img src={url} alt={file.name} className="max-w-full max-h-full mx-auto block" />}
          {isVideo  && <video src={url} controls className="max-w-full max-h-full mx-auto block" />}
          {isAudio  && <div className="p-8 flex justify-center"><audio src={url} controls className="w-full max-w-2xl" /></div>}
          {isPdf    && <iframe src={url} title={file.name} className="w-full h-[80vh]" />}
          {isHtml   && <iframe src={url} title={file.name} className="w-full h-[80vh] bg-white" sandbox="allow-same-origin" />}
          {!isImage && !isVideo && !isAudio && !isPdf && !isHtml && (
            <pre className="p-4 text-[11px] font-mono whitespace-pre-wrap break-words" style={{ color: "rgba(255,255,255,0.85)" }}>
              {textBody ?? "loading…"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Goal Mode — autonomous long-runs ──────────────────────────────────
export function HermesGoalView() {
  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");
  const [history, setHistory] = useState<WorkspaceFile[]>([]);
  const [historyDir, setHistoryDir] = useState("");
  const [model, setModel] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const refreshHistory = useCallback(() => {
    fetch("/__hermes_goal_history")
      .then((r) => r.json())
      .then((j: { dir: string; runs: WorkspaceFile[] }) => { setHistory(j.runs ?? []); setHistoryDir(j.dir ?? ""); })
      .catch(() => { /* skip */ });
  }, []);
  useEffect(() => refreshHistory(), [refreshHistory]);

  async function run() {
    if (!goal.trim() || running) return;
    setRunning(true);
    setLog("");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r = await fetch("/__hermes_goal_run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), model: model.trim() || undefined }),
        signal: ac.signal,
      });
      if (!r.body) { setLog("(no stream)"); setRunning(false); return; }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.startsWith("data:")) continue;
          try {
            const j = JSON.parse(raw.slice(5).trim());
            if (j.delta) setLog((p) => p + j.delta);
            if (j.done) { setRunning(false); toast.success(j.exit === 0 ? "Goal run completed" : `Run ended (exit ${j.exit})`); refreshHistory(); }
          } catch { /* skip */ }
        }
      }
      setRunning(false);
    } catch (e) {
      setLog((p) => p + `\n[error] ${String(e)}\n`);
      setRunning(false);
    }
  }
  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  return (
    <HermesControlRoomShell active="goal">
      <div className="p-5 grid lg:grid-cols-[2fr_1fr] gap-5">
        <div className="space-y-3">
          <div className="text-[12px] uppercase tracking-[0.22em] font-semibold" style={{ color: "#10B981" }}>
            Goal Mode · Autonomous Long-Run
          </div>
          <p className="text-[12px] text-muted-foreground/75 max-w-2xl leading-relaxed">
            Drop one plain-English goal. Hermes runs autonomously (no
            human-in-loop) until the goal is met or the 30-minute cap hits.
            Output streams here AND persists to{" "}
            <code className="text-foreground/80">~/.claude-os/goal-runs/</code> so you can
            replay it in the Workspace tab.
          </p>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={5}
            placeholder="Goal: e.g. Research the top 10 articles ranking for 'AI Baseline Automations', summarise each, and write a competitive brief to ~/Downloads/agent-os-brief.md."
            className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-black/40 border border-white/10 focus:outline-none focus:border-emerald-400/50 resize-y font-sans"
          />
          <div className="flex items-center gap-2">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model (optional, default = config)"
              className="px-2.5 py-1.5 rounded-lg text-[11.5px] bg-black/40 border border-white/10 focus:outline-none focus:border-emerald-400/50 w-72"
            />
            {!running ? (
              <button onClick={() => void run()} disabled={!goal.trim()} className="px-4 py-2 rounded-lg text-[12px] font-bold disabled:opacity-50" style={{ background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff" }}>
                <Play size={11} className="inline mr-1" /> Launch goal run
              </button>
            ) : (
              <button onClick={stop} className="px-4 py-2 rounded-lg text-[12px] font-bold" style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.5)", color: "#FCA5A5" }}>
                ■ Stop
              </button>
            )}
          </div>
          <div className="rounded-xl border bg-black/45 p-3 min-h-[300px] max-h-[60vh] overflow-y-auto" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
              {running ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} style={{ color: "#10B981" }} />}
              {running ? "streaming…" : log ? "completed" : "ready"}
            </div>
            <pre className="font-mono text-[11px] whitespace-pre-wrap break-words leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
              {log || "(no output yet — launch a goal above)"}
            </pre>
          </div>
        </div>
        <aside className="space-y-2">
          <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/75">Past goal runs</div>
          <div className="text-[9.5px] font-mono opacity-50">{historyDir}</div>
          {history.length === 0 ? (
            <div className="italic opacity-50 text-[11px]">No previous runs.</div>
          ) : (
            <ul className="space-y-1.5">
              {history.map((f) => (
                <li key={f.path} className="rounded-lg border p-2 bg-black/30" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="font-mono text-[10.5px] truncate">{f.name}</div>
                  <div className="text-[9px] opacity-50 font-mono">{(f.size / 1024).toFixed(1)} KB · {new Date(f.mtime).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </HermesControlRoomShell>
  );
}

// ─── MCP Control Room ──────────────────────────────────────────────────
interface McpServer { name: string; raw: string }

export function HermesMcpView() {
  const [servers, setServers] = useState<McpServer[] | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/__hermes_mcp_servers")
      .then((r) => r.json())
      .then((j: { servers: McpServer[]; raw: string }) => { setServers(j.servers ?? []); setRaw(j.raw ?? ""); })
      .catch(() => setServers([]));
  }, []);
  useEffect(() => load(), [load]);

  async function call(op: "remove" | "test" | "login", name: string) {
    setBusy(`${op}:${name}`);
    try {
      const r = await fetch(`/__hermes_mcp_${op}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const j = await r.json();
      if (j.ok) toast.success(`${op} ${name} ok`);
      else toast.error(`${op} ${name}: ${(j.stderr ?? "").slice(0, 100)}`);
    } catch (e) { toast.error(String(e)); }
    setBusy(null);
    load();
  }

  return (
    <HermesControlRoomShell active="mcp">
      <div className="p-5 grid lg:grid-cols-[2fr_1fr] gap-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-[12px] uppercase tracking-[0.22em] font-semibold" style={{ color: "#A78BFA" }}>
              MCP Control Room
            </div>
            <span className="text-[10.5px] text-muted-foreground/60">
              Servers connected to Hermes via the Model Context Protocol.
            </span>
            <button onClick={load} className="p-1 rounded hover:bg-white/5 ml-auto"><RefreshCw size={12} /></button>
            <button onClick={() => setAdding(true)} className="px-3 py-1.5 rounded-lg text-[10.5px] uppercase tracking-[0.22em] font-semibold border transition" style={{ borderColor: "rgba(167,139,250,0.55)", color: "#A78BFA", background: "rgba(167,139,250,0.1)" }}>
              <Plus size={10} className="inline mr-1" /> add server
            </button>
          </div>
          {servers === null ? (
            <div className="opacity-60 text-[12px]">loading…</div>
          ) : servers.length === 0 ? (
            <div className="rounded-xl border p-6 text-center text-[12px] opacity-65 italic" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              No MCP servers configured yet. Click <strong>add server</strong> to connect one
              (filesystem, GitHub, Notion, etc.).
            </div>
          ) : (
            <ul className="space-y-2">
              {servers.map((s) => (
                <li key={s.name} className="rounded-xl border p-3 bg-black/25 flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <Plug size={12} style={{ color: "#A78BFA" }} />
                  <div className="font-mono text-[12px]">{s.name}</div>
                  <div className="text-[10px] opacity-55 ml-1 truncate flex-1">{s.raw}</div>
                  <button onClick={() => void call("test",   s.name)} disabled={busy !== null} className="px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.18em] border border-white/10 hover:bg-white/5">{busy === `test:${s.name}` ? "…" : "test"}</button>
                  <button onClick={() => void call("login",  s.name)} disabled={busy !== null} className="px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.18em] border border-white/10 hover:bg-white/5">{busy === `login:${s.name}` ? "…" : "login"}</button>
                  <button onClick={() => void call("remove", s.name)} disabled={busy !== null} className="px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.18em] border border-red-400/30 text-red-300 hover:bg-red-500/10"><Trash2 size={9} className="inline mr-1" /> remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="space-y-2">
          <div className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/75">Raw CLI output</div>
          <pre className="font-mono text-[10.5px] p-3 rounded-lg border bg-black/40 whitespace-pre-wrap max-h-[60vh] overflow-y-auto" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            {raw || "(empty)"}
          </pre>
        </aside>
      </div>
      {adding && <AddMcpModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />}
    </HermesControlRoomShell>
  );
}

function AddMcpModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"url" | "command">("url");
  const [url, setUrl] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setErr(null);
    const body: any = { name: name.trim() };
    if (mode === "url") body.url = url.trim();
    else { body.command = command.trim(); body.args = args.split(/\s+/).filter(Boolean); }
    try {
      const r = await fetch("/__hermes_mcp_add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.ok) { toast.success(`Added ${name.trim()}`); onAdded(); }
      else { setErr(j.stderr ?? "add failed"); setSubmitting(false); }
    } catch (e) { setErr(String(e)); setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="rounded-xl border max-w-md w-full p-5 space-y-3" style={{ background: "#0F1116", borderColor: "rgba(167,139,250,0.45)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: "#A78BFA" }} />
          <div className="text-[13px] font-semibold">Add MCP server</div>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-white/5"><X size={14} /></button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Server name (e.g. filesystem)" autoFocus className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50" />
        <div className="flex gap-1.5">
          <button onClick={() => setMode("url")} className="flex-1 px-2.5 py-1.5 rounded-lg text-[10.5px] uppercase tracking-[0.2em] border" style={{ background: mode === "url" ? "rgba(167,139,250,0.18)" : "transparent", borderColor: mode === "url" ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.12)", color: mode === "url" ? "#A78BFA" : "rgba(255,255,255,0.7)" }}>URL endpoint</button>
          <button onClick={() => setMode("command")} className="flex-1 px-2.5 py-1.5 rounded-lg text-[10.5px] uppercase tracking-[0.2em] border" style={{ background: mode === "command" ? "rgba(167,139,250,0.18)" : "transparent", borderColor: mode === "command" ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.12)", color: mode === "command" ? "#A78BFA" : "rgba(255,255,255,0.7)" }}>Command (stdio)</button>
        </div>
        {mode === "url" ? (
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className="w-full px-3 py-2 rounded-lg text-[12px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50 font-mono" />
        ) : (
          <div className="space-y-2">
            <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="/Users/you/.local/bin/my-mcp" className="w-full px-3 py-2 rounded-lg text-[12px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50 font-mono" />
            <input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="args (space-separated)" className="w-full px-3 py-2 rounded-lg text-[12px] bg-black/40 border border-white/10 focus:outline-none focus:border-purple-400/50 font-mono" />
          </div>
        )}
        {err && <div className="text-[11px] font-mono p-2 rounded bg-red-500/10 text-red-300"><AlertCircle size={10} className="inline mr-1" />{err}</div>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] border border-white/10 hover:bg-white/5">Cancel</button>
          <button onClick={() => void submit()} disabled={!name.trim() || submitting} className="ml-auto px-4 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-50" style={{ background: "linear-gradient(135deg, #A78BFA, #7C3AED)", color: "#fff" }}>
            {submitting ? "adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
