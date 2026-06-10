/**
 * AgentWorkspace — reusable file browser pane.
 *
 * GET /__workspace?dir=<agent>           → file list (mtime sorted)
 * GET /__workspace_file?path=<abs-path>  → preview (text / image)
 *
 * NEW pulse badge on files < 5 minutes old.
 */

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, FileText, Image as ImageIcon, Film, Music, File as FileIcon, RefreshCw } from "lucide-react";

type FileItem = {
  name: string;
  path: string;
  size: number;
  mtime: number;
  kind: "text" | "image" | "video" | "audio" | "file";
  bucket: string;
};

type Preview =
  | { kind: "text"; text: string }
  | { kind: "image"; dataUrl: string }
  | { kind: "media"; note: string };

interface Props {
  agent: "hermes" | "openclaw" | "gemini" | "codex" | "studio";
  tone: string;
  emptyHint?: string;
}

const KIND_ICON = {
  text:  <FileText size={13} />,
  image: <ImageIcon size={13} />,
  video: <Film size={13} />,
  audio: <Music size={13} />,
  file:  <FileIcon size={13} />,
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function AgentWorkspace({ agent, tone, emptyHint }: Props) {
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/__workspace?dir=${agent}`);
      const j = await r.json() as { files: FileItem[] };
      setFiles(j.files || []);
    } catch { setFiles([]); }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [agent]);

  async function openFile(f: FileItem) {
    setSelected(f);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const r = await fetch(`/__workspace_file?path=${encodeURIComponent(f.path)}`);
      const j = await r.json() as Preview;
      setPreview(j);
    } catch { setPreview({ kind: "text", text: "(failed to load)" }); }
    setPreviewLoading(false);
  }

  const buckets = useMemo(() => {
    const m = new Map<string, FileItem[]>();
    for (const f of files ?? []) {
      const arr = m.get(f.bucket) ?? [];
      arr.push(f);
      m.set(f.bucket, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [files]);

  return (
    <div className="flex-1 flex" style={{ minHeight: 0 }}>
      {/* Left: file list */}
      <div className="flex flex-col overflow-hidden border-r" style={{ width: "min(380px, 40vw)", borderColor: "var(--panel-border)" }}>
        <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
          <div className="flex items-center gap-2">
            <FolderOpen size={14} style={{ color: tone }} />
            <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Workspace</span>
            <span className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>{files?.length ?? "…"} files</span>
          </div>
          <button onClick={load} disabled={loading} className="p-1.5 rounded-md transition disabled:opacity-50" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </header>
        <div className="scroll flex-1 overflow-y-auto p-2">
          {!files && (
            <div className="text-[12px] p-3" style={{ color: "var(--fg-dim)" }}>Loading…</div>
          )}
          {files && files.length === 0 && (
            <div className="text-center p-8" style={{ color: "var(--fg-dimmer)" }}>
              <FolderOpen size={32} style={{ opacity: 0.25, margin: "0 auto 10px" }} />
              <div className="text-[12px]">{emptyHint ?? "No files yet."}</div>
            </div>
          )}
          {buckets.map(([bucket, list]) => (
            <div key={bucket} className="mb-3">
              <div className="text-[9px] uppercase tracking-[0.18em] px-2 py-1" style={{ color: "var(--fg-dimmer)" }}>{bucket}</div>
              {list.map((f) => {
                const isNew = Date.now() - f.mtime < 5 * 60 * 1000;
                const isActive = selected?.path === f.path;
                return (
                  <button key={f.path} onClick={() => openFile(f)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition" style={{ background: isActive ? `${tone}18` : "transparent", border: `1px solid ${isActive ? `${tone}55` : "transparent"}`, color: isActive ? "#fff" : "var(--fg-dim)" }}>
                    <span style={{ color: isActive ? tone : "var(--fg-dimmer)" }}>{KIND_ICON[f.kind]}</span>
                    <span className="flex-1 truncate text-[12px]">{f.name}</span>
                    {isNew && <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-[1px] rounded-full animate-pulse" style={{ background: "#ec489966", color: "#fbcfe8" }}>NEW</span>}
                    <span className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{fmtBytes(f.size)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right: preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected && (
          <div className="flex-1 flex items-center justify-center text-center" style={{ color: "var(--fg-dimmer)" }}>
            <div>
              <FolderOpen size={40} style={{ opacity: 0.2, margin: "0 auto 10px" }} />
              <div className="text-[13px]">Pick a file on the left to preview.</div>
            </div>
          </div>
        )}
        {selected && (
          <>
            <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
              <div className="min-w-0">
                <div className="text-[12px] font-mono truncate" style={{ color: "#fff" }}>{selected.name}</div>
                <div className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{selected.bucket} · {fmtBytes(selected.size)} · {fmtAgo(selected.mtime)}</div>
              </div>
            </header>
            <div className="flex-1 overflow-auto p-4 scroll">
              {previewLoading && <div className="text-[12px]" style={{ color: "var(--fg-dim)" }}>Loading preview…</div>}
              {preview?.kind === "text" && (
                <pre className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--fg-dim)" }}>{preview.text}</pre>
              )}
              {preview?.kind === "image" && (
                <img src={preview.dataUrl} alt={selected.name} className="max-w-full rounded-lg" />
              )}
              {preview?.kind === "media" && (
                <div className="text-[12px]" style={{ color: "var(--fg-dim)" }}>{preview.note}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
