import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import {
  workspaces as sampleWorkspaces,
  runs as sampleRuns,
  outputs as sampleOutputs,
  type Workspace,
} from "@/lib/mock-data";
import { ArrowLeft, AlertTriangle, FileText, Sparkles, Activity, FileOutput, Image as ImageIcon, ExternalLink, FolderOpen } from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";

function buildLiveWorkspaces(ld: any): Workspace[] {
  const projects = ld?.recentProjects;
  if (!Array.isArray(projects)) return [];
  return projects.map(
    (p: any): Workspace => ({
      id: String(p?.key ?? ""),
      name: String(p?.displayName ?? p?.key ?? "—"),
      path: String(p?.displayName ?? p?.key ?? "—"),
      claudeMdStatus: "needs review",
      lastRun: String(p?.lastActiveAgo ?? "—"),
      activeSkills: [],
      recentFiles: [],
      recentOutputs: [],
      memoryFreshness: 0,
      usageToday: 0,
      runs7d: Number(p?.sessions ?? 0) || 0,
      description: "",
      summary:
        "Per-workspace details aren't surfaced by the aggregator yet — only the high-level project signal is available.",
      memoryFiles: [],
      sessions: [],
      warnings: [],
    }),
  );
}

export const Route = createFileRoute("/workspaces/$id")({
  head: () => ({
    meta: [
      { title: "Workspace — Baseline Automations" },
      { name: "description", content: "Workspace details" },
    ],
  }),
  component: WorkspaceDetail,
  notFoundComponent: () => (
    <div className="text-sm">
      Workspace not found.{" "}
      <Link to="/workspaces" className="underline">
        Back
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="text-sm text-red-500">{error.message}</div>,
});

function WorkspaceDetail() {
  const ld = useLiveData();
  const isDemoData = ld?.isExample === true;
  const allWorkspaces = buildLiveWorkspaces(ld);
  const allRuns: any[] = [];
  const allOutputs: any[] = [];
  const { id } = Route.useParams();
  const ws = allWorkspaces.find((w) => w.id === id);

  if (!ws) {
    return (
      <div className="text-sm">
        Workspace not found.{" "}
        <Link to="/workspaces" className="underline">
          Back
        </Link>
      </div>
    );
  }

  const filteredRuns = allRuns.filter((r) => r.workspace === ws.name);
  const filteredOutputs = allOutputs.filter((o) => o.workspace === ws.name);

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2 inline-flex items-center gap-2">
        <span>Workspace</span>
        {isDemoData && (
          <span
            title="Sample data shipped with this repo. Run `bun run scripts/aggregate.ts` to populate with your real ~/.claude/ activity."
            className="px-1.5 py-0.5 rounded-full text-[9px] tracking-[0.18em] font-semibold"
            style={{
              background: "rgba(251, 191, 36, 0.14)",
              color: "#fbbf24",
              border: "1px solid rgba(251, 191, 36, 0.3)",
            }}
          >
            DEMO DATA
          </span>
        )}
      </div>
      <Link
        to="/workspaces"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-3 w-3" /> All workspaces
      </Link>
      <PageHeader
        title={ws.name}
        description={ws.path}
        actions={<StatusPill status={ws.claudeMdStatus} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Memory freshness" value={`${ws.memoryFreshness}%`} />
        <Card label="Last run" value={ws.lastRun} />
        <Card label="Runs (7d)" value={ws.runs7d.toString()} />
        <Card label="Usage today" value={`$${ws.usageToday.toFixed(2)}`} />
      </div>

      {ws.warnings.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-500 text-sm font-medium mb-2">
            <AlertTriangle className="h-4 w-4" /> Open issues
          </div>
          <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-5">
            {ws.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Memory files" icon={FileText}>
          <ul className="divide-y divide-border">
            {ws.memoryFiles.length === 0 ? (
              <li className="text-xs text-muted-foreground p-3">No memory files.</li>
            ) : (
              ws.memoryFiles.map((m) => (
                <li key={m.name} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-mono">{m.name}</span>
                  <span className="text-muted-foreground">
                    {m.size} · {m.updated}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Section>

        <Section title="Active skills" icon={Sparkles}>
          <ul className="divide-y divide-border">
            {ws.activeSkills.map((s) => (
              <li key={s} className="px-3 py-2 text-xs flex justify-between items-center">
                <span>{s}</span>
                <StatusPill status="active" />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Recent files changed" icon={FileText}>
          <ul className="divide-y divide-border">
            {ws.recentFiles.map((f) => (
              <li key={f.name} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-mono truncate">{f.name}</span>
                <span className="text-muted-foreground shrink-0">{f.changed}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Recent sessions" icon={Activity}>
          <ul className="divide-y divide-border">
            {filteredRuns.length === 0 ? (
              <li className="text-xs text-muted-foreground p-3">No sessions yet.</li>
            ) : (
              filteredRuns.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-mono">{r.id}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {r.duration} <StatusPill status={r.status} />
                  </span>
                </li>
              ))
            )}
          </ul>
        </Section>

        <Section title="Generated outputs" icon={FileOutput}>
          <ul className="divide-y divide-border">
            {filteredOutputs.length === 0 ? (
              <li className="text-xs text-muted-foreground p-3">No outputs.</li>
            ) : (
              filteredOutputs.map((o) => (
                <li key={o.name} className="px-3 py-2 text-xs">
                  <div className="font-medium truncate">{o.name}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {o.size} · {o.updated}
                  </div>
                </li>
              ))
            )}
          </ul>
        </Section>

        <Section title="Summary">
          <p className="p-3 text-xs text-muted-foreground leading-relaxed">{ws.summary}</p>
        </Section>
      </div>

      {/* Cross-system artifact aggregator — pulls every artifact the agents
          have produced (docs, generated images, code) so nothing gets lost.
          Unified timeline, click → preview / open. */}
      <div className="mt-6">
        <ArtifactsTimeline workspaceName={ws.name} workspaceId={ws.id} />
      </div>
    </div>
  );
}

interface UnifiedArtifact {
  id: string;
  kind: "document" | "image" | "video" | "chat";
  title: string;
  description?: string | null;
  thumbUrl?: string | null;
  openUrl: string;
  source: string;
  modified: number;
}

function ArtifactsTimeline({ workspaceName, workspaceId }: { workspaceName: string; workspaceId: string }) {
  const [artifacts, setArtifacts] = useState<UnifiedArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | UnifiedArtifact["kind"]>("all");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const items: UnifiedArtifact[] = [];
    // ── Hermes Documents ──────────────────────────────────────────────────
    try {
      const r = await fetch("/__hermes_documents");
      if (r.ok) {
        const j = await r.json() as { documents: Array<{ id: string; name: string; type: string; modified: number; description: string | null; title: string | null; }> };
        for (const d of j.documents ?? []) {
          const kind: UnifiedArtifact["kind"] = d.type === "image" ? "image" : "document";
          items.push({
            id: `doc:${d.id}`,
            kind,
            title: d.title || d.name,
            description: d.description ?? d.name,
            thumbUrl: d.type === "image" ? `/__hermes_documents/raw?id=${encodeURIComponent(d.id)}` : null,
            openUrl: `/documents`,
            source: "~/Hermes",
            modified: d.modified,
          });
        }
      }
    } catch { /* skip */ }
    // ── Higgsfield generations ─────────────────────────────────────────────
    try {
      const r = await fetch("/__higgsfield_generations");
      if (r.ok) {
        const j = await r.json() as { ok?: boolean; generations?: Array<{ id: string; display_name?: string; result_url?: string; created_at: number; job_set_type?: string; params?: { prompt?: string } }> };
        for (const g of (j.generations ?? []).slice(0, 12)) {
          const isVideo = /seedance|kling|video|wan|veo/.test(g.job_set_type ?? "");
          items.push({
            id: `hf:${g.id}`,
            kind: isVideo ? "video" : "image",
            title: g.display_name ?? "Higgsfield generation",
            description: g.params?.prompt ?? null,
            thumbUrl: g.result_url ?? null,
            openUrl: `/higgsfield`,
            source: "Higgsfield",
            modified: g.created_at * 1000,
          });
        }
      }
    } catch { /* skip */ }
    items.sort((a, b) => b.modified - a.modified);
    setArtifacts(items);
    setLoading(false);
  }

  const counts = artifacts.reduce((acc, a) => { acc[a.kind] = (acc[a.kind] ?? 0) + 1; acc.all = (acc.all ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const visible = filter === "all" ? artifacts : artifacts.filter((a) => a.kind === filter);

  return (
    <Section title={`Artifacts everywhere · ${artifacts.length} total`} icon={FolderOpen}>
      <div className="p-3">
        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
          Everything every agent has produced lands here so you can find it months later. Docs from <code className="text-foreground">~/Hermes</code>, images and video from Higgsfield, scoped to <strong>{workspaceName}</strong>.
        </p>
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {(["all", "document", "image", "video", "chat"] as const).map((k) => {
            const active = filter === k;
            const n = counts[k] ?? 0;
            return (
              <button
                key={k}
                onClick={() => setFilter(k as any)}
                className="px-2 py-1 rounded-md text-[10.5px] uppercase tracking-widest transition"
                style={{
                  background: active ? "rgba(167,139,250,0.18)" : "transparent",
                  border: `1px solid ${active ? "rgba(167,139,250,0.5)" : "var(--panel-border)"}`,
                  color: active ? "#a78bfa" : "var(--cream-mute)",
                }}
              >
                {k} <span style={{ opacity: 0.55 }}>({n})</span>
              </button>
            );
          })}
        </div>
        {loading && <div className="text-[11px] text-muted-foreground">Loading…</div>}
        {!loading && visible.length === 0 && (
          <div className="text-[11px] text-muted-foreground py-8 text-center">
            No artifacts yet. Save documents to <code>~/Hermes</code> or generate images in Higgsfield — they&apos;ll appear here.
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {visible.slice(0, 40).map((a) => (
            <Link
              key={a.id}
              to={a.openUrl}
              className="rounded-lg overflow-hidden flex flex-col group transition"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}
            >
              <div className="aspect-[5/3] flex items-center justify-center relative" style={{ background: "rgba(0,0,0,0.5)" }}>
                {a.thumbUrl ? (
                  a.kind === "video"
                    ? <video src={a.thumbUrl} className="w-full h-full object-cover" muted preload="metadata" />
                    : <img src={a.thumbUrl} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                ) : a.kind === "document" ? (
                  <FileText className="h-7 w-7" style={{ opacity: 0.35 }} />
                ) : (
                  <ImageIcon className="h-7 w-7" style={{ opacity: 0.35 }} />
                )}
                <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(0,0,0,0.65)", color: "#fff", backdropFilter: "blur(4px)" }}>
                  {a.kind}
                </span>
              </div>
              <div className="p-2.5 flex-1 flex flex-col gap-0.5">
                <div className="text-[11.5px] font-medium truncate" style={{ color: "#fff" }}>{a.title}</div>
                {a.description && <div className="text-[10px] line-clamp-2" style={{ color: "var(--cream-mute)" }}>{a.description}</div>}
                <div className="flex items-center justify-between mt-auto pt-1 text-[9.5px]" style={{ color: "var(--fg-dimmer)" }}>
                  <span>{a.source}</span>
                  <span>{new Date(a.modified).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />} {title}
      </div>
      {children}
    </div>
  );
}
