/**
 * Claude Code Studio — the unified creative operating system.
 *
 * Walt (P0): "Claude Code Studio, NOT MiniMax Studio. MiniMax becomes one
 * provider. Claude Code Studio becomes the unified creative operating system."
 *
 * Control center: Video Editing Team, workflow pipeline, creative provider
 * matrix (honest states), render queue, proof/export manifest, approval gates,
 * publish checklist, setup-needed states. Truth-first — no fake ready states,
 * no fake renders. Providers that aren't connected show setup-needed and their
 * actions are disabled.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AgentIdentityHeader } from "@/components/graphify-awareness";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clapperboard,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileDown,
  ListChecks,
} from "lucide-react";
import {
  VIDEO_TEAM,
  STUDIO_WORKFLOWS,
  CREATIVE_PROVIDERS,
  STUDIO_APPROVAL_POLICY,
  deriveProviderState,
  canGenerate,
  evaluateApproval,
  initialJobStatus,
  buildProofManifest,
  PROVIDER_STATE_LABEL,
  type ProviderState,
  type RenderJob,
} from "@/lib/claude-code-studio";

export const Route = createFileRoute("/agents/claude-code-studio")({
  head: () => ({
    meta: [
      { title: "Claude Code Studio — Baseline Automations" },
      {
        name: "description",
        content:
          "Unified creative operating system: video editing team, provider matrix, render queue, proof manifests.",
      },
    ],
  }),
  component: ClaudeCodeStudioPage,
});

const TONE = "#d97706";

type CredsResp = { providers?: Array<{ id: string; saved?: { status?: string } | null }> };
type EnvResp = { keys?: Array<{ name: string; present: boolean }> };
type CliResp = { ok: boolean; found: string | null; version: string | null };

const STATE_COLOR: Record<ProviderState, { bg: string; bd: string; fg: string }> = {
  ready: { bg: "rgba(16,185,129,0.10)", bd: "rgba(16,185,129,0.45)", fg: "#34d399" },
  connected: { bg: "rgba(59,130,246,0.10)", bd: "rgba(59,130,246,0.45)", fg: "#60a5fa" },
  missing_credentials: { bg: "rgba(245,158,11,0.10)", bd: "rgba(245,158,11,0.45)", fg: "#fbbf24" },
  cli_missing: { bg: "rgba(245,158,11,0.10)", bd: "rgba(245,158,11,0.45)", fg: "#fbbf24" },
  setup_required: { bg: "rgba(113,113,122,0.10)", bd: "rgba(113,113,122,0.45)", fg: "#a1a1aa" },
  error: { bg: "rgba(239,68,68,0.10)", bd: "rgba(239,68,68,0.45)", fg: "#fca5a5" },
  unsupported: { bg: "rgba(113,113,122,0.10)", bd: "rgba(113,113,122,0.45)", fg: "#a1a1aa" },
};

function ClaudeCodeStudioPage() {
  const [creds, setCreds] = useState<CredsResp | null>(null);
  const [env, setEnv] = useState<EnvResp | null>(null);
  const [cli, setCli] = useState<Record<string, CliResp>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [projectCreated, setProjectCreated] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [c, e] = await Promise.all([
        fetch("/__credentials", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/__env_status", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setCreds(c);
      setEnv(e);
      // Probe CLI only for providers that declare a binary.
      const cliProviders = CREATIVE_PROVIDERS.filter((p) => p.cliBin);
      const results = await Promise.all(
        cliProviders.map((p) =>
          fetch(`/__runtime_cli_status?bin=${p.cliBin}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => [p.cliBin as string, j as CliResp] as const)
            .catch(() => [p.cliBin as string, { ok: false, found: null, version: null }] as const),
        ),
      );
      setCli(Object.fromEntries(results));
    } catch (err) {
      setError(err instanceof Error ? err.message : "probe failed");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Derive honest provider states.
  const providerStates = useMemo(() => {
    const credSet = new Set(
      (creds?.providers ?? [])
        .filter((p) => p.saved && p.saved.status !== "error")
        .map((p) => p.id),
    );
    const envSet = new Set((env?.keys ?? []).filter((k) => k.present).map((k) => k.name));
    const out: Record<string, ProviderState> = {};
    for (const p of CREATIVE_PROVIDERS) {
      out[p.id] = deriveProviderState(p, {
        credentialPresent: p.credentialId ? credSet.has(p.credentialId) : false,
        envPresent: p.envVar ? envSet.has(p.envVar) : false,
        cliFound: p.cliBin ? !!cli[p.cliBin]?.ok : undefined,
      });
    }
    return out;
  }, [creds, env, cli]);

  const readyCount = Object.values(providerStates).filter((s) => s === "ready").length;

  // Render queue preview — honest. Each workflow's job status is derived from
  // its owner persona's primary provider + the workflow's approval tier.
  // Nothing is ever "completed" here (no real provider call has run).
  const queue: RenderJob[] = useMemo(() => {
    if (!projectCreated) return [];
    return STUDIO_WORKFLOWS.map((wf) => {
      const owner = VIDEO_TEAM.find((p) => p.slug === wf.owner);
      const primaryToolId = owner?.tools[0];
      const prov = CREATIVE_PROVIDERS.find(
        (p) => p.id === primaryToolId || p.id.startsWith(primaryToolId ?? "~"),
      );
      const pState = prov ? providerStates[prov.id] : ("setup_required" as ProviderState);
      const status = initialJobStatus(pState, evaluateApproval(wf.approval));
      return {
        id: `job-${wf.slug}`,
        workflowSlug: wf.slug,
        providerId: prov?.id ?? "n/a",
        status,
        createdAt: 0,
        outputUri: null,
      };
    });
  }, [projectCreated, providerStates]);

  const manifest = useMemo(
    () =>
      buildProofManifest(
        { id: "studio-demo", title: "Untitled project", createdAt: 0 },
        queue,
        providerStates,
        0,
      ),
    [queue, providerStates],
  );

  return (
    <div
      className="flex flex-col gap-5 p-6"
      data-testid="claude-code-studio-page"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      <AgentIdentityHeader name="Creative OS Studio" provider="Claude Code · pipelines" context="creative os pipeline studio" />
      {/* Header */}
      <header
        className="rounded-2xl border overflow-hidden p-6"
        style={{
          borderColor: `${TONE}33`,
          background: `linear-gradient(135deg, ${TONE}14 0%, rgba(0,0,0,0.30) 100%)`,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
          >
            <Clapperboard size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: `${TONE}cc` }}>
              Claude Code · Specialized Agents
            </div>
            <h1 className="text-2xl font-semibold mt-1" style={{ color: "#fed7aa" }}>
              Claude Code Studio
            </h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
              The unified creative operating system — a video editing team, a production pipeline,
              and every creative provider in one control center. MiniMax is one provider here, not
              the whole studio. Provider state is probed live; nothing is faked.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            data-testid="studio-refresh"
            className="text-[11px] font-semibold rounded-md border px-3 py-1.5 hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: `${TONE}1a`, borderColor: `${TONE}55`, color: TONE }}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-400">
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">
            {VIDEO_TEAM.length} agents
          </span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">
            {STUDIO_WORKFLOWS.length} workflows
          </span>
          <span
            className="rounded-full border border-zinc-700 px-2 py-0.5"
            data-testid="studio-provider-count"
          >
            {CREATIVE_PROVIDERS.length} providers · {readyCount} ready
          </span>
        </div>
      </header>

      {error && <div className="text-[12px] text-red-300/85">Probe failed: {error}</div>}

      {/* Video Editing Team */}
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="studio-video-team"
      >
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3">
          Video Editing Team
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {VIDEO_TEAM.map((p) => (
            <div
              key={p.slug}
              data-testid={`studio-agent-${p.slug}`}
              className="rounded-lg border border-zinc-800 bg-black/30 p-3"
            >
              <div className="text-[13px] font-semibold text-zinc-100">{p.name}</div>
              <div
                className="text-[10px] uppercase tracking-wider mt-0.5"
                style={{ color: `${TONE}cc` }}
              >
                {p.role}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Provider matrix */}
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="studio-provider-matrix"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold">
            Creative provider matrix
          </h3>
          <Link to="/settings/api-keys" className="text-[11px] underline" style={{ color: TONE }}>
            Connect credentials →
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CREATIVE_PROVIDERS.map((p) => {
            const st = providerStates[p.id] ?? "setup_required";
            const c = STATE_COLOR[st];
            return (
              <div
                key={p.id}
                data-testid={`studio-provider-${p.id}`}
                data-state={st}
                className="rounded-lg border border-zinc-800 bg-black/30 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-zinc-100">{p.label}</div>
                  <span
                    className="text-[9px] uppercase tracking-wider font-semibold border rounded-full px-1.5 py-0.5"
                    style={{ background: c.bg, borderColor: c.bd, color: c.fg }}
                  >
                    {PROVIDER_STATE_LABEL[st]}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  {p.kind} · {p.capabilities.join(", ")}
                </div>
                {/* Higgsfield is a first-class provider with an advanced control
                    center — surface its deep-link actions on the card. */}
                {p.id === "higgsfield" && (
                  <div
                    className="mt-2 flex flex-wrap gap-1.5"
                    data-testid="studio-higgsfield-actions"
                  >
                    {[
                      { label: "Open Control Center", to: "/higgsfield" },
                      { label: "Generate", to: "/higgsfield" },
                      { label: "View Gallery", to: "/higgsfield" },
                      { label: "Manage Soul ID", to: "/higgsfield" },
                      { label: "Install Skills", to: "/higgsfield" },
                    ].map((a) => (
                      <Link
                        key={a.label}
                        to={a.to}
                        className="text-[10px] rounded border px-1.5 py-0.5"
                        style={{ borderColor: `${TONE}44`, color: TONE }}
                      >
                        {a.label}
                      </Link>
                    ))}
                  </div>
                )}
                {p.id !== "higgsfield" && !canGenerate(st) && (
                  <a
                    href={p.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[10px]"
                    style={{ color: TONE }}
                  >
                    Setup <ExternalLink size={10} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Workflow pipeline + create project */}
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="studio-workflows"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold">
            Production pipeline
          </h3>
          <button
            type="button"
            data-testid="studio-create-project"
            onClick={() => setProjectCreated(true)}
            className="text-[11px] font-semibold rounded-md border px-3 py-1.5 hover:opacity-90 inline-flex items-center gap-1.5"
            style={{ background: `${TONE}1a`, borderColor: `${TONE}55`, color: TONE }}
          >
            <Clapperboard size={12} /> Create new video project
          </button>
        </div>
        <div className="grid gap-1.5">
          {STUDIO_WORKFLOWS.map((wf, i) => (
            <div
              key={wf.slug}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black/20 px-3 py-2"
            >
              <span className="text-[10px] text-zinc-600 font-mono w-5">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-zinc-200">{wf.title}</div>
                <div className="text-[10px] text-zinc-500 truncate">{wf.description}</div>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">
                {wf.approval}
              </span>
              {!wf.wired && (
                <span className="text-[9px] uppercase tracking-wider text-amber-400/80">
                  setup-needed
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Render queue */}
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="studio-render-queue"
      >
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3 flex items-center gap-1.5">
          <ListChecks size={12} /> Render queue
        </h3>
        {queue.length === 0 ? (
          <p className="text-[12px] text-zinc-500">
            No jobs yet. Create a video project to populate the pipeline. Jobs only run when their
            provider is connected and (for medium/high actions) approved — nothing renders on a
            setup-needed provider.
          </p>
        ) : (
          <div className="grid gap-1.5">
            {queue.map((j) => (
              <div
                key={j.id}
                data-testid={`studio-job-${j.workflowSlug}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/20 px-3 py-1.5"
              >
                <span className="text-[11px] text-zinc-300 truncate">
                  {STUDIO_WORKFLOWS.find((w) => w.slug === j.workflowSlug)?.title}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">{j.providerId}</span>
                <span
                  className="text-[9px] uppercase tracking-wider"
                  style={{
                    color:
                      j.status === "queued"
                        ? "#34d399"
                        : j.status === "failed"
                          ? "#fca5a5"
                          : "#fbbf24",
                  }}
                >
                  {j.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Proof / export + approval */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section
          className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
          data-testid="studio-proof"
        >
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3 flex items-center gap-1.5">
            <FileDown size={12} /> Proof / export manifest
          </h3>
          <p className="text-[11px] text-zinc-500 mb-2">
            export-manifest.json — {manifest.entries.length} workflow entries ·{" "}
            {manifest.providers.length} providers
          </p>
          <pre className="text-[10px] font-mono bg-black/40 border border-zinc-800 rounded p-2 overflow-x-auto max-h-48 text-zinc-400">
            {JSON.stringify(
              {
                version: manifest.version,
                project: manifest.project,
                entries: manifest.entries.slice(0, 4),
                providers: manifest.providers.slice(0, 4),
              },
              null,
              2,
            )}
          </pre>
        </section>

        <section
          className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
          data-testid="studio-approval"
        >
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3 flex items-center gap-1.5">
            <ShieldCheck size={12} /> Approval policy
          </h3>
          <div className="space-y-2 text-[11px]">
            {(["low", "medium", "high", "blocked"] as const).map((tier) => (
              <div key={tier}>
                <span
                  className="uppercase tracking-wider font-semibold"
                  style={{
                    color: tier === "blocked" ? "#fca5a5" : tier === "high" ? "#fbbf24" : "#a1a1aa",
                  }}
                >
                  {tier}
                </span>
                <span className="text-zinc-500"> — {STUDIO_APPROVAL_POLICY[tier].join(", ")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="text-[11px] text-zinc-500">
        MiniMax users: the old MiniMax Studio is now a provider inside Claude Code Studio. The
        standalone{" "}
        <Link to="/minimax" className="underline hover:text-zinc-300">
          MiniMax credential page
        </Link>{" "}
        still works.
      </p>
    </div>
  );
}
