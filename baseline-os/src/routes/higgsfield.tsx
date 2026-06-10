/**
 * Higgsfield Control Center — native Baseline OS module.
 *
 * Higgsfield is a first-class PROVIDER inside Claude Code Studio's shared
 * creative core. This page is the advanced control center for that provider:
 * 10 tabs + an Agent Orchestration panel. It reads/writes the SHARED core
 * (assets/jobs/proof in claude-code-studio.ts) — no duplicate library/queue.
 *
 * TRUTH-FIRST: live probes only. Generate is disabled unless ready. No fake
 * media, no fake ready states, no fake render success.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  LayoutGrid,
  Wand2,
  History,
  Images,
  Cpu,
  Boxes,
  UserCircle2,
  Camera,
  CreditCard,
  Settings2,
  Network,
} from "lucide-react";
import {
  HIGGSFIELD_TABS,
  HIGGSFIELD_SKILLS,
  HIGGSFIELD_DASHBOARD_URL,
  deriveHiggsfieldStatus,
  higgsfieldCanGenerate,
  HIGGSFIELD_STATUS_LABEL,
  HIGGSFIELD_APPROVAL_POLICY,
  type HiggsfieldTabId,
  type HiggsfieldStatus,
} from "@/lib/higgsfield-control";
import {
  normalizeStudioHistory,
  filterAssetsByProvider,
  createOrchestrationJob,
  type CreativeAsset,
  type CreativeJob,
} from "@/lib/claude-code-studio";
import {
  ORCHESTRATION_AGENTS,
  ORCHESTRATION_WORKFLOWS,
  deriveAgentConnState,
  agentIsReady,
  AGENT_CONN_LABEL,
  HIGGSFIELD_ORCHESTRATION_SOURCE,
  type AgentConnState,
} from "@/lib/creative-orchestration";

export const Route = createFileRoute("/higgsfield")({
  head: () => ({
    meta: [
      { title: "Higgsfield Control Center — Baseline Automations" },
      {
        name: "description",
        content:
          "Higgsfield provider control center inside Claude Code Studio — generate, Soul ID, photoshoot, marketplace cards, agent orchestration.",
      },
    ],
  }),
  component: HiggsfieldPage,
});

const TONE = "#f0abfc";
const PROVIDER = "higgsfield";

interface Account {
  ok: boolean;
  email?: string;
  credits?: number;
  subscription_plan_type?: string;
  error?: string;
}
interface Model {
  display_name: string;
  job_set_type: string;
  type: string;
}
interface Transaction {
  display_name: string;
  credits: number;
  action: string;
  created_at: string;
}

const TAB_ICON: Record<HiggsfieldTabId, React.ComponentType<{ size?: number }>> = {
  "control-center": LayoutGrid,
  create: Wand2,
  generations: History,
  assets: Images,
  supercomputer: Cpu,
  skills: Boxes,
  "soul-id": UserCircle2,
  "product-photoshoot": Camera,
  "marketplace-cards": CreditCard,
  setup: Settings2,
};

function HiggsfieldPage() {
  const [tab, setTab] = useState<HiggsfieldTabId>("control-center");
  const [account, setAccount] = useState<Account | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [statusApiReachable, setStatusApiReachable] = useState(false);
  const [credsPresent, setCredsPresent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // agent connection signals (orchestration)
  const [agentStates, setAgentStates] = useState<Record<string, AgentConnState>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, st, env, mi, mv, t, hist] = await Promise.all([
        fetch("/__higgsfield_account")
          .then((r) => r.json())
          .catch(() => ({ ok: false })),
        fetch("/__higgsfield_status")
          .then((r) => r.json())
          .catch(() => ({})),
        fetch("/__env_status")
          .then((r) => r.json())
          .catch(() => ({ keys: [] })),
        fetch("/__higgsfield_models?type=image")
          .then((r) => r.json())
          .catch(() => ({})),
        fetch("/__higgsfield_models?type=video")
          .then((r) => r.json())
          .catch(() => ({})),
        fetch("/__higgsfield_transactions?size=30")
          .then((r) => r.json())
          .catch(() => ({})),
        fetch("/__studio_history")
          .then((r) => r.json())
          .catch(() => ({})),
      ]);
      setAccount(a);
      setStatusApiReachable(!!(st?.ok ?? st?.reachable ?? a?.ok));
      const envKeys: Array<{ name: string; present: boolean }> = env?.keys ?? [];
      setCredsPresent(envKeys.some((k) => k.name === "HIGGSFIELD_API_KEY_ID" && k.present));
      setModels([...((mi?.ok ? mi.models : []) ?? []), ...((mv?.ok ? mv.models : []) ?? [])]);
      setTransactions(t?.ok ? (t.transactions ?? []) : []);
      const raw = Array.isArray(hist)
        ? hist
        : (hist?.items ?? hist?.history ?? hist?.records ?? []);
      setAssets(normalizeStudioHistory(raw, PROVIDER));
    } catch (e) {
      setError(e instanceof Error ? e.message : "probe failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Probe orchestration agents honestly.
  const probeAgents = useCallback(async () => {
    const envRes = await fetch("/__env_status")
      .then((r) => r.json())
      .catch(() => ({ keys: [] }));
    const credRes = await fetch("/__credentials")
      .then((r) => r.json())
      .catch(() => ({ providers: [] }));
    const envSet = new Set(
      (envRes?.keys ?? [])
        .filter((k: { present: boolean }) => k.present)
        .map((k: { name: string }) => k.name),
    );
    const credSet = new Set(
      (credRes?.providers ?? [])
        .filter((p: { saved?: unknown }) => p.saved)
        .map((p: { id: string }) => p.id),
    );
    const out: Record<string, AgentConnState> = {};
    await Promise.all(
      ORCHESTRATION_AGENTS.map(async (agent) => {
        let statusOk: boolean | undefined;
        let cliFound: boolean | undefined;
        let probed = false;
        if (agent.statusEndpoint) {
          probed = true;
          statusOk = await fetch(agent.statusEndpoint)
            .then((r) => r.ok)
            .catch(() => false);
        }
        if (agent.cliBin) {
          probed = true;
          cliFound = await fetch(`/__runtime_cli_status?bin=${agent.cliBin}`)
            .then((r) => r.json())
            .then((j) => !!j.ok)
            .catch(() => false);
        }
        const credentialPresent =
          (agent.credentialId ? credSet.has(agent.credentialId) : false) ||
          (agent.envVar ? envSet.has(agent.envVar) : false);
        out[agent.id] = deriveAgentConnState(agent, {
          statusOk,
          cliFound,
          credentialPresent,
          probed,
        });
      }),
    );
    setAgentStates(out);
  }, []);

  useEffect(() => {
    void loadAll();
    void probeAgents();
  }, [loadAll, probeAgents]);

  const status: HiggsfieldStatus = useMemo(
    () =>
      deriveHiggsfieldStatus({
        apiReachable: statusApiReachable,
        credentialsPresent: credsPresent,
        accountOk: !!account?.ok,
        error: !!error,
      }),
    [statusApiReachable, credsPresent, account, error],
  );
  const ready = higgsfieldCanGenerate(status);
  const higgsfieldAssets = useMemo(() => filterAssetsByProvider(assets, PROVIDER), [assets]);

  return (
    <div
      className="flex flex-col gap-4 p-6"
      data-testid="higgsfield-page"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      {/* Header */}
      <header
        className="rounded-2xl border overflow-hidden p-5"
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
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: `${TONE}cc` }}>
              Claude Code Studio · Provider Control Center
            </div>
            <h1 className="text-2xl font-semibold mt-1" style={{ color: "#f5d0fe" }}>
              Higgsfield
            </h1>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl">
              The advanced control center for the Higgsfield provider. Assets, jobs, and proofs live
              in the shared Claude Code Studio core — this page is the Higgsfield-filtered view +
              provider-specific tools. Status is probed live.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className="text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5"
              data-testid="higgsfield-status"
              style={{
                background: ready ? "rgba(16,185,129,0.10)" : "rgba(245,158,11,0.10)",
                borderColor: ready ? "rgba(16,185,129,0.45)" : "rgba(245,158,11,0.45)",
                color: ready ? "#34d399" : "#fbbf24",
              }}
            >
              {HIGGSFIELD_STATUS_LABEL[status]}
            </span>
            <button
              type="button"
              onClick={() => {
                void loadAll();
                void probeAgents();
              }}
              disabled={loading}
              data-testid="higgsfield-refresh"
              className="text-[11px] font-semibold rounded-md border px-3 py-1.5 hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
              style={{ background: `${TONE}1a`, borderColor: `${TONE}55`, color: TONE }}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
          <Link
            to="/agents/claude-code-studio"
            data-testid="higgsfield-back-to-studio"
            className="inline-flex items-center gap-1 underline"
            style={{ color: TONE }}
          >
            <ArrowLeft size={11} /> Back to Claude Code Studio
          </Link>
          <span className="text-zinc-600">·</span>
          <Link
            to="/agents/claude-code-studio"
            data-testid="higgsfield-global-library"
            className="underline"
            style={{ color: TONE }}
          >
            View in global asset library
          </Link>
          <a
            href={HIGGSFIELD_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300"
          >
            External Higgsfield dashboard <ExternalLink size={11} />
          </a>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1.5" data-testid="higgsfield-tabs">
        {HIGGSFIELD_TABS.map((t) => {
          const Icon = TAB_ICON[t.id];
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              data-testid={`higgsfield-tab-${t.id}`}
              className={`text-[12px] font-medium rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 border transition-colors ${active ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
              style={
                active
                  ? { background: `${TONE}1f`, borderColor: `${TONE}55` }
                  : { background: "transparent", borderColor: "transparent" }
              }
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </nav>

      {error && <div className="text-[12px] text-red-300/85">Probe failed: {error}</div>}

      {/* Tab content */}
      <div className="min-h-[40vh]">
        {tab === "control-center" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="Account"
                value={
                  account?.ok ? (account.email ?? "connected") : HIGGSFIELD_STATUS_LABEL[status]
                }
              />
              <Stat
                label="Credits"
                value={account?.credits != null ? String(account.credits) : "—"}
              />
              <Stat label="Higgsfield assets" value={String(higgsfieldAssets.length)} />
            </div>
            <AgentOrchestrationPanel agentStates={agentStates} ready={ready} />
          </div>
        )}

        {tab === "create" && <CreateTab ready={ready} status={status} models={models} />}
        {tab === "generations" && (
          <AssetGrid
            assets={higgsfieldAssets}
            kindFilter="all"
            emptyHint="No Higgsfield generations yet."
          />
        )}
        {tab === "assets" && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500">
              Higgsfield-filtered view of the shared Studio asset library.{" "}
              <Link to="/agents/claude-code-studio" className="underline" style={{ color: TONE }}>
                Open the global library →
              </Link>
            </p>
            <AssetGrid
              assets={higgsfieldAssets}
              kindFilter="all"
              emptyHint="No generated Higgsfield media found yet. Generate or import assets to populate this gallery."
            />
          </div>
        )}
        {tab === "supercomputer" && (
          <SupercomputerTab
            account={account}
            models={models}
            transactions={transactions}
            assets={higgsfieldAssets}
            status={status}
          />
        )}
        {tab === "skills" && <SkillsTab />}
        {tab === "soul-id" && (
          <WorkflowTab
            title="Soul ID"
            approval="high"
            ready={ready}
            status={status}
            blurb="Train a Soul Character (identity-faithful model). Requires recorded consent. Training a likeness is a HIGH-approval action."
          />
        )}
        {tab === "product-photoshoot" && (
          <WorkflowTab
            title="Product Photoshoot"
            approval="medium"
            ready={ready}
            status={status}
            blurb="Brand-quality product images via product-photoshoot prompt enhancement."
          />
        )}
        {tab === "marketplace-cards" && (
          <WorkflowTab
            title="Marketplace Cards"
            approval="medium"
            ready={ready}
            status={status}
            blurb="Compliant marketplace listing image sets — main, secondary, and A+ modules."
          />
        )}
        {tab === "setup" && <SetupTab status={status} credsPresent={credsPresent} />}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-[15px] font-semibold text-zinc-100 mt-0.5 truncate">{value}</div>
    </div>
  );
}

function AgentOrchestrationPanel({
  agentStates,
  ready,
}: {
  agentStates: Record<string, AgentConnState>;
  ready: boolean;
}) {
  const leadOptions = ORCHESTRATION_AGENTS.filter((a) => a.canLead);
  const [lead, setLead] = useState("gemini");
  const [supporting, setSupporting] = useState<string[]>(["openclaw", "hermes"]);
  const [workflow, setWorkflow] = useState(ORCHESTRATION_WORKFLOWS[0].id);
  const [prompt, setPrompt] = useState("");
  const [job, setJob] = useState<CreativeJob | null>(null);

  const leadReady = agentIsReady(agentStates[lead] ?? "unavailable");
  function toggleSupport(id: string) {
    setSupporting((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function orchestrate() {
    const wf = ORCHESTRATION_WORKFLOWS.find((w) => w.id === workflow)!;
    // Writes a job into the SHARED Studio core (no isolated queue), tagged
    // provider=higgsfield + orchestration_source. Honest status (blocked_setup
    // if the lead agent isn't connected; awaiting_approval for medium/high).
    const created = createOrchestrationJob(
      {
        projectId: "studio-default",
        provider: PROVIDER,
        orchestrationSource: HIGGSFIELD_ORCHESTRATION_SOURCE,
        leadAgent: lead,
        supportingAgents: supporting,
        workflow: wf.id,
        prompt: prompt.trim(),
        approval: wf.approval,
        leadReady,
        approved: false,
      },
      Date.now(),
    );
    setJob(created);
  }

  return (
    <section
      className="rounded-xl border p-4"
      data-testid="higgsfield-agent-orchestration"
      style={{ borderColor: `${TONE}40`, background: `${TONE}0a` }}
    >
      <h3
        className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-3 inline-flex items-center gap-1.5"
        style={{ color: `${TONE}cc` }}
      >
        <Network size={12} /> Agent Orchestration
      </h3>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500">Lead</label>
          <select
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            data-testid="orch-lead-select"
            className="mt-1 w-full rounded-md bg-black/40 border border-zinc-800 px-2 py-1.5 text-[12px] text-zinc-200"
          >
            {leadOptions.map((a) => {
              const st = agentStates[a.id] ?? "unavailable";
              return (
                <option key={a.id} value={a.id} disabled={!agentIsReady(st)}>
                  {a.label} — {AGENT_CONN_LABEL[st]}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500">Workflow</label>
          <select
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            data-testid="orch-workflow-select"
            className="mt-1 w-full rounded-md bg-black/40 border border-zinc-800 px-2 py-1.5 text-[12px] text-zinc-200"
          >
            {ORCHESTRATION_WORKFLOWS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label} ({w.approval})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[10px] uppercase tracking-wider text-zinc-500">
          Supporting agents
        </label>
        <div className="mt-1 flex flex-wrap gap-1.5" data-testid="orch-supporting">
          {ORCHESTRATION_AGENTS.map((a) => {
            const st = agentStates[a.id] ?? "unavailable";
            const on = supporting.includes(a.id);
            const okState = agentIsReady(st);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleSupport(a.id)}
                data-testid={`orch-agent-${a.id}`}
                data-conn={st}
                className={`text-[11px] rounded-md border px-2 py-1 ${on ? "text-white" : "text-zinc-400"}`}
                style={{
                  borderColor: on ? `${TONE}66` : "#3f3f46",
                  background: on ? `${TONE}1f` : "transparent",
                }}
                title={AGENT_CONN_LABEL[st]}
              >
                {a.label}
                <span
                  className="ml-1.5 text-[9px]"
                  style={{ color: okState ? "#34d399" : "#fbbf24" }}
                >
                  ● {AGENT_CONN_LABEL[st]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        data-testid="orch-prompt"
        placeholder="A 4-shot product reveal for…"
        className="mt-3 w-full rounded-md bg-black/40 border border-zinc-800 px-3 py-2 text-[12px] text-zinc-200 min-h-[64px]"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={orchestrate}
          disabled={!prompt.trim()}
          data-testid="orch-run"
          className="text-[12px] font-semibold rounded-lg px-4 py-2 disabled:opacity-40"
          style={{ background: TONE, color: "#1e1b4b" }}
        >
          Orchestrate shoot
        </button>
        {!ready && (
          <span className="text-[11px] text-amber-300/80">
            Higgsfield setup required — outputs will queue as blocked until connected.
          </span>
        )}
      </div>

      {job && (
        <div
          className="mt-3 rounded-lg border border-zinc-800 bg-black/30 p-3 text-[11px]"
          data-testid="orch-result"
        >
          <div className="text-zinc-300">
            Shared creative job created → <span className="font-mono">{job.id}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-zinc-500">
            <span>
              provider: <span className="text-zinc-300">{job.provider}</span>
            </span>
            <span>
              source: <span className="text-zinc-300">{job.orchestrationSource}</span>
            </span>
            <span>
              lead: <span className="text-zinc-300">{job.leadAgent}</span>
            </span>
            <span>
              status:{" "}
              <span
                style={{
                  color:
                    job.status === "queued"
                      ? "#34d399"
                      : job.status === "failed"
                        ? "#fca5a5"
                        : "#fbbf24",
                }}
              >
                {job.status.replace(/_/g, " ")}
              </span>
            </span>
          </div>
          <div className="mt-1 text-zinc-500">
            Visible in{" "}
            <Link to="/agents/claude-code-studio" className="underline" style={{ color: TONE }}>
              Claude Code Studio
            </Link>
            ’s shared render queue.
          </div>
        </div>
      )}
    </section>
  );
}

function CreateTab({
  ready,
  status,
  models,
}: {
  ready: boolean;
  status: HiggsfieldStatus;
  models: Model[];
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3">
          Create / Generate
        </h3>
        <textarea
          placeholder="Describe the image or video…"
          disabled={!ready}
          className="w-full rounded-md bg-black/40 border border-zinc-800 px-3 py-2 text-[12px] text-zinc-200 min-h-[72px] disabled:opacity-50"
        />
        <div className="mt-3 flex items-center gap-2">
          <select
            disabled={!ready}
            className="rounded-md bg-black/40 border border-zinc-800 px-2 py-1.5 text-[12px] text-zinc-300 disabled:opacity-50"
            data-testid="create-model"
          >
            {models.length ? (
              models.map((m) => <option key={m.job_set_type}>{m.display_name}</option>)
            ) : (
              <option>Models load when connected</option>
            )}
          </select>
          <button
            type="button"
            disabled={!ready}
            data-testid="higgsfield-generate-btn"
            className="text-[12px] font-semibold rounded-lg px-4 py-2 disabled:opacity-40"
            style={{ background: TONE, color: "#1e1b4b" }}
          >
            Generate
          </button>
        </div>
        {!ready && (
          <p className="mt-2 text-[11px] text-amber-300/80">
            Generation disabled — {HIGGSFIELD_STATUS_LABEL[status]}. Connect Higgsfield in Setup /
            CLI.
          </p>
        )}
      </div>
    </div>
  );
}

function AssetGrid({
  assets,
  kindFilter,
  emptyHint,
}: {
  assets: CreativeAsset[];
  kindFilter: "all" | "image" | "video";
  emptyHint: string;
}) {
  const filtered = kindFilter === "all" ? assets : assets.filter((a) => a.kind === kindFilter);
  if (filtered.length === 0) {
    return (
      <div
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-[12px] text-zinc-500"
        data-testid="higgsfield-empty-gallery"
      >
        {emptyHint}
      </div>
    );
  }
  return (
    <div
      className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="higgsfield-gallery"
    >
      {filtered.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-zinc-800 bg-black/30 overflow-hidden"
          data-testid={`asset-${a.id}`}
        >
          <div className="aspect-square bg-zinc-900 flex items-center justify-center overflow-hidden">
            {a.url && a.kind === "image" ? (
              <img
                src={a.url}
                alt={a.prompt ?? ""}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : a.url && a.kind === "video" ? (
              <video src={a.url} className="w-full h-full object-cover" muted />
            ) : (
              <span className="text-[10px] text-zinc-600">no preview</span>
            )}
          </div>
          <div className="p-2">
            <div className="text-[10px] text-zinc-400 truncate">{a.prompt ?? a.model ?? a.id}</div>
            <div className="text-[9px] text-zinc-600 mt-0.5">
              {a.kind} · {a.model ?? "—"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SupercomputerTab({
  account,
  models,
  transactions,
  assets,
  status,
}: {
  account: Account | null;
  models: Model[];
  transactions: Transaction[];
  assets: CreativeAsset[];
  status: HiggsfieldStatus;
}) {
  return (
    <div className="space-y-4" data-testid="higgsfield-supercomputer">
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: `${TONE}40`, background: `${TONE}0a` }}
      >
        <h3 className="text-[13px] font-semibold" style={{ color: "#f5d0fe" }}>
          Higgsfield Supercomputer
        </h3>
        <p className="text-[11px] text-zinc-400 mt-1">
          The canonical Higgsfield workspace, native to Baseline OS. Account, model catalog,
          generations, and transactions in one view. Status: {HIGGSFIELD_STATUS_LABEL[status]}.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Account" value={account?.email ?? (account?.ok ? "connected" : "—")} />
        <Stat label="Credits" value={account?.credits != null ? String(account.credits) : "—"} />
        <Stat label="Models" value={String(models.length)} />
        <Stat label="Assets" value={String(assets.length)} />
      </div>
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
          Model catalog (live)
        </h4>
        {models.length === 0 ? (
          <p className="text-[11px] text-zinc-500">
            No models — connect Higgsfield to load the live catalog.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {models.slice(0, 24).map((m) => (
              <span
                key={m.job_set_type}
                className="text-[10px] rounded border border-zinc-800 bg-black/30 px-2 py-0.5 text-zinc-400"
              >
                {m.display_name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
          Recent generations
        </h4>
        <AssetGrid
          assets={assets}
          kindFilter="all"
          emptyHint="No generated Higgsfield media found yet. Generate or import assets to populate this gallery."
        />
      </div>
      {transactions.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Transactions</h4>
          <div className="space-y-1">
            {transactions.slice(0, 10).map((t, i) => (
              <div
                key={i}
                className="flex justify-between text-[11px] text-zinc-400 border-b border-zinc-800/60 py-1"
              >
                <span>{t.display_name}</span>
                <span>{t.credits} cr</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillsTab() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="higgsfield-skills">
      {HIGGSFIELD_SKILLS.map((s) => (
        <div
          key={s.slug}
          className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
          data-testid={`higgsfield-skill-${s.slug}`}
        >
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-zinc-100">{s.name}</div>
            <span
              className="text-[9px] uppercase tracking-wider rounded-full border px-1.5 py-0.5"
              style={{ borderColor: `${TONE}55`, color: TONE }}
            >
              {s.approval}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">{s.description}</p>
          <div className="mt-2 text-[10px] text-zinc-500">in: {s.inputs.join(", ")}</div>
          <div className="text-[10px] text-zinc-500">out: {s.outputs.join(", ")}</div>
          <div className="text-[10px] text-zinc-600 mt-1">
            creds: {s.requiredCredentials.join(", ")}
          </div>
          <div className="text-[9px] text-zinc-700 mt-1 font-mono truncate" title={s.sourceHash}>
            pinned {s.sourceHash.slice(0, 12)}…
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowTab({
  title,
  approval,
  ready,
  status,
  blurb,
}: {
  title: string;
  approval: string;
  ready: boolean;
  status: HiggsfieldStatus;
  blurb: string;
}) {
  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
      data-testid={`higgsfield-workflow-${title.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-zinc-100">{title}</h3>
        <span
          className="text-[9px] uppercase tracking-wider rounded-full border px-1.5 py-0.5"
          style={{ borderColor: `${TONE}55`, color: TONE }}
        >
          {approval} approval
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 mt-2">{blurb}</p>
      <textarea
        placeholder={`Describe the ${title.toLowerCase()} job…`}
        disabled={!ready}
        className="mt-3 w-full rounded-md bg-black/40 border border-zinc-800 px-3 py-2 text-[12px] text-zinc-200 min-h-[64px] disabled:opacity-50"
      />
      <button
        type="button"
        disabled={!ready}
        className="mt-2 text-[12px] font-semibold rounded-lg px-4 py-2 disabled:opacity-40"
        style={{ background: TONE, color: "#1e1b4b" }}
      >
        Run {title}
      </button>
      {!ready && (
        <p className="mt-2 text-[11px] text-amber-300/80">
          Disabled — {HIGGSFIELD_STATUS_LABEL[status]}. Outputs save to the shared Studio asset
          library when connected.
        </p>
      )}
    </div>
  );
}

function SetupTab({ status, credsPresent }: { status: HiggsfieldStatus; credsPresent: boolean }) {
  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3"
      data-testid="higgsfield-setup"
    >
      <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold">
        Setup / CLI
      </h3>
      <div className="text-[12px] text-zinc-400">
        Status:{" "}
        <span
          className="font-semibold"
          style={{ color: status === "ready" ? "#34d399" : "#fbbf24" }}
        >
          {HIGGSFIELD_STATUS_LABEL[status]}
        </span>
      </div>
      <ol className="text-[12px] text-zinc-300 space-y-2 list-decimal list-inside">
        <li>
          Save <strong>HIGGSFIELD_API_KEY_ID</strong> + <strong>HIGGSFIELD_API_KEY_SECRET</strong>{" "}
          in{" "}
          <Link to="/settings/api-keys" className="underline" style={{ color: TONE }}>
            API Keys
          </Link>
          .{" "}
          {credsPresent ? (
            <span className="text-emerald-400">(present)</span>
          ) : (
            <span className="text-amber-400">(missing)</span>
          )}
        </li>
        <li>
          Authenticate the Higgsfield CLI/MCP; this page probes{" "}
          <code className="text-[11px] bg-black/40 px-1 rounded">/__higgsfield_status</code> live.
        </li>
        <li>
          Unsupported CLI/API functions show{" "}
          <code className="text-[11px] bg-black/40 px-1 rounded">unsupported_by_cli</code> — never
          faked.
        </li>
      </ol>
      <a
        href={HIGGSFIELD_DASHBOARD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
        style={{ color: TONE }}
      >
        Higgsfield docs <ExternalLink size={12} />
      </a>
    </div>
  );
}
