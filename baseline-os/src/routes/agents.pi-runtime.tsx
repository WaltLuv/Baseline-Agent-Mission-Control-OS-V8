/**
 * Pi Coding Harness (Oh My Pi / omp) — Baseline OS surface.
 *
 * Walt's Phase F directive: surface OMP as a first-class runtime tab so
 * the operator can see install status, paths, providers, and modes
 * without leaving Baseline OS.
 *
 * IMPORTANT — naming hygiene: this route is the OMP coding harness. It
 * is NOT the PI Agent (Chief Memory Officer) — that lives on the
 * Knowledge OS / Obsidian page. Same "Pi" word, different concept. The
 * page makes this distinction explicit so users do not conflate the
 * runtime and the role.
 *
 * Data source: `/__omp_status` sidecar endpoint (loopback-only). Strictly
 * read-only — install is the user's responsibility, surfaced as
 * copy-paste install commands. No fake state: when the binary is absent,
 * the page says "not installed" — it never claims a phantom version.
 */

import { createFileRoute } from "@tanstack/react-router";
import { AgentIdentityHeader } from "@/components/graphify-awareness";
import { useCallback, useEffect, useState } from "react";
import {
  Terminal,
  Code2,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertTriangle,
  Boxes,
} from "lucide-react";

export const Route = createFileRoute("/agents/pi-runtime")({
  head: () => ({
    meta: [
      { title: "Pi Coding Harness (omp) — Baseline Automations" },
      {
        name: "description",
        content:
          "Oh My Pi (omp) open-source coding harness. 40+ providers, LSP, DAP, subagents, browser automation, session tree.",
      },
    ],
  }),
  component: PiRuntimePage,
});

const TONE = "#EAB308"; // amber — distinct from PI Agent's role color

interface OmpStatus {
  installed: boolean;
  binPath: string | null;
  version: string | null;
  paths: {
    configRoot: string;
    configRootExists: boolean;
    modelsYml: string;
    agentsMd: string;
    systemMd: string;
    skills: string;
    sessions: string;
    hindsight: string;
  };
  providers: Record<string, boolean>;
  supportedModes: string[];
  installCommands: Record<string, string>;
  needsSetup: boolean;
}

function PiRuntimePage() {
  const [status, setStatus] = useState<OmpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/__omp_status", { cache: "no-store" });
      if (!res.ok) throw new Error(`probe failed (${res.status})`);
      const data = (await res.json()) as OmpStatus;
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "probe failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const copyCmd = useCallback(async (label: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard denied */
    }
  }, []);

  const providerCount = status
    ? Object.values(status.providers).filter(Boolean).length
    : 0;

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 56px)", overflow: "auto" }}
    >
      <div className="px-6 pt-4"><AgentIdentityHeader name="PI Runtime" provider="Ruflo · memory" context="PI runtime memory orchestration" /></div>
      <header className="px-6 pt-5 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${TONE}22`, color: TONE }}
            >
              <Code2 size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                Pi Coding Harness{" "}
                <span className="text-xs font-normal text-white/40">
                  (Oh My Pi · omp)
                </span>
              </h1>
              <p className="text-xs text-white/50">
                Open-source coding agent · 40+ providers · LSP · DAP · subagents · browser automation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-xs text-white/60 hover:text-white flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            refresh
          </button>
        </div>

        {/* Hard distinction callout — Walt's rule */}
        <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-medium text-amber-200">
              Oh My Pi ≠ PI Agent
            </p>
            <p className="text-amber-200/70">
              This is the <strong>coding harness</strong> — the{" "}
              <code className="bg-black/30 px-1 rounded">omp</code> CLI Walt
              uses for code work. <strong>PI Agent</strong> on the Knowledge OS
              page is the Chief Memory Officer — different role, different
              scope. Same word "Pi", on purpose.
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-3 rounded border border-red-500/30 bg-red-500/5 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Install status card */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Terminal size={14} />
            Runtime status
          </h2>
          {!status && !error && (
            <p className="text-xs text-white/40">probing…</p>
          )}
          {status && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <StatusRow
                label="Installed"
                value={
                  status.installed ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      yes
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1">
                      <XCircle size={12} />
                      not installed
                    </span>
                  )
                }
              />
              <StatusRow
                label="Version"
                value={
                  status.version ? (
                    <code className="text-white/80">{status.version}</code>
                  ) : (
                    <span className="text-white/40">—</span>
                  )
                }
              />
              <StatusRow
                label="Binary"
                value={
                  status.binPath ? (
                    <code className="text-white/60 truncate">
                      {status.binPath}
                    </code>
                  ) : (
                    <span className="text-white/40">— (not on PATH)</span>
                  )
                }
              />
              <StatusRow
                label="Config root"
                value={
                  status.paths.configRootExists ? (
                    <code className="text-white/60 truncate">
                      {status.paths.configRoot}
                    </code>
                  ) : (
                    <span className="text-white/40">
                      not created yet
                    </span>
                  )
                }
              />
            </div>
          )}
        </section>

        {/* Install commands — only shown when not installed */}
        {status && !status.installed && (
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Boxes size={14} />
              Install
            </h2>
            <p className="text-xs text-white/50 mb-3">
              Walt's preferred path is <code>bun</code>. The curl installer is
              the universal fallback.
            </p>
            <div className="space-y-2">
              {Object.entries(status.installCommands).map(([label, cmd]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 p-2 rounded border border-white/10 bg-black/30"
                >
                  <span className="text-[10px] uppercase text-white/40 w-12 shrink-0">
                    {label}
                  </span>
                  <code className="text-[11px] flex-1 overflow-x-auto whitespace-nowrap">
                    {cmd}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCmd(label, cmd)}
                    className="text-[10px] text-white/60 hover:text-white flex items-center gap-1"
                  >
                    <Copy size={11} />
                    {copied === label ? "copied" : "copy"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Config paths */}
        {status && (
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-medium mb-3">Where omp keeps state</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <PathRow label="models.yml" path={status.paths.modelsYml} />
              <PathRow label="AGENTS.md" path={status.paths.agentsMd} />
              <PathRow label="SYSTEM.md" path={status.paths.systemMd} />
              <PathRow label="skills/" path={status.paths.skills} />
              <PathRow label="sessions/" path={status.paths.sessions} />
              <PathRow label="hindsight/" path={status.paths.hindsight} />
            </div>
            <p className="text-[10px] text-white/40 mt-3">
              Paths are reported even when the files don't exist yet — that's
              the canonical location omp will write to once it's installed and
              first run.
            </p>
          </section>
        )}

        {/* Supported modes */}
        {status && (
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-medium mb-3">Supported modes</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {status.supportedModes.map((mode) => (
                <span
                  key={mode}
                  className="px-2 py-1 rounded border border-white/10 bg-white/5 text-white/70"
                >
                  {mode}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-3">
              Interactive (TUI), Print/JSON (scripts), RPC (stdio for non-Node
              hosts), and SDK (embed in Node apps). All four backed by the
              same engine.
            </p>
          </section>
        )}

        {/* Providers connected (presence/absence only — never values) */}
        {status && (
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <KeyRound size={14} />
              Providers connected{" "}
              <span className="text-xs text-white/40">
                ({providerCount}/{Object.keys(status.providers).length})
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {Object.entries(status.providers).map(([name, present]) => (
                <div
                  key={name}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    present
                      ? "border-green-500/30 bg-green-500/5 text-green-300"
                      : "border-white/10 bg-white/[0.02] text-white/40"
                  }`}
                >
                  {present ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  <span>{name}</span>
                </div>
              ))}
            </div>
            {providerCount === 0 && (
              <p className="text-[11px] text-amber-300/70 mt-3">
                No provider keys detected. omp needs at least one provider to
                answer prompts. Wire keys via Mission Control's Credentials
                Manager.
              </p>
            )}
          </section>
        )}

        {/* External resources */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium mb-3">Resources</h2>
          <div className="space-y-2 text-xs">
            <ResourceLink
              label="Oh My Pi docs"
              href="https://omp.sh"
              note="install, providers, tools, modes"
            />
            <ResourceLink
              label="Walt's fork: WaltLuv/oh-my-pi"
              href="https://github.com/WaltLuv/oh-my-pi"
              note="customizations + experimental work"
            />
            <ResourceLink
              label="Walt's reference: pi-vs-claude-code"
              href="https://github.com/WaltLuv/pi-vs-claude-code"
              note="multi-agent orchestration patterns"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="text-white/40 shrink-0">{label}</span>
      <div className="text-right truncate">{value}</div>
    </div>
  );
}

function PathRow({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-white/40 shrink-0 w-20">{label}</span>
      <code className="text-white/60 truncate text-[11px]">{path}</code>
    </div>
  );
}

function ResourceLink({
  label,
  href,
  note,
}: {
  label: string;
  href: string;
  note: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-2 rounded border border-white/10 bg-black/20 hover:bg-black/30 group"
    >
      <div>
        <div className="text-white/80 group-hover:text-white flex items-center gap-1.5">
          {label}
          <ExternalLink size={11} className="text-white/40" />
        </div>
        <div className="text-[10px] text-white/40">{note}</div>
      </div>
    </a>
  );
}
