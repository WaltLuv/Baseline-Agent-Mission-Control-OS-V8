/**
 * Claude Code agent page.
 *
 * Walt: "Do not skip Claude Code because it lives on the home dashboard.
 * If Claude Code is a major runtime, it needs credential status."
 *
 * This is the dedicated /agents/claude-code route. It surfaces:
 *   · Anthropic credential status (Connected / Missing / Needs Setup / Error)
 *   · Claude CLI install status from the real PATH probe — never faked
 *   · Currently configured model + override path
 *   · Deep links to /settings/api-keys for the credential, and to the
 *     setup-source pages for the CLI when it's not installed
 *
 * No new daemon, no new state file — this page is purely a read of what
 * already exists on the host plus the credential catalogue.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Sparkles,
  Clapperboard,
} from "lucide-react";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";
import { AgentIdentityHeader } from "@/components/graphify-awareness";
import { VIDEO_TEAM } from "@/lib/claude-code-studio";

export const Route = createFileRoute("/agents/claude-code")({
  head: () => ({
    meta: [
      { title: "Claude Code — Baseline Automations" },
      {
        name: "description",
        content: "Anthropic credential + Claude CLI install status for the Claude Code runtime.",
      },
    ],
  }),
  component: ClaudeCodePage,
});

const TONE = "#d97706"; // orange — matches the existing Claude Code color in CLAUDE.md

type CliStatus = { ok: boolean; bin: string; found: string | null; version: string | null };

const SETUP_URL = "https://docs.anthropic.com/en/docs/claude-code";

function ClaudeCodePage() {
  const [cli, setCli] = useState<CliStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch("/__runtime_cli_status?bin=claude", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCli(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "probe failed");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const cliConnected = !!cli?.ok;
  const cliVersion = cli?.version ?? null;
  const cliPath = cli?.found ?? null;

  return (
    <div
      className="flex flex-col gap-5 h-full p-6"
      style={{ minHeight: "calc(100vh - 56px)" }}
      data-testid="claude-code-page"
    >
      <AgentIdentityHeader name="Claude Code" provider="Anthropic runtime" context="claude code sessions" />
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
            <Terminal size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: `${TONE}cc` }}>
              Anthropic · Claude Code CLI
            </div>
            <h1 className="text-2xl font-semibold mt-1" style={{ color: "#fed7aa" }}>
              Claude Code
            </h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
              The Anthropic coding agent. This page reports whether the workspace has an Anthropic
              credential saved and whether the <code>claude</code> CLI is actually on PATH — both
              are required before Claude Code can run real sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            data-testid="claude-code-refresh"
            className="text-[11px] font-semibold rounded-md border px-3 py-1.5 transition-opacity hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: `${TONE}1a`, borderColor: `${TONE}55`, color: TONE }}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {/* Credential card */}
      <RuntimeCredentialStatus
        providerIds={["anthropic", "claude_code"]}
        model="(reads from Claude CLI config)"
      />

      {/* CLI status card */}
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="claude-code-cli-status"
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold">
            Claude CLI install
          </h3>
          {!cli && !error && <span className="text-[11px] text-zinc-500">Loading…</span>}
        </div>

        {error && <div className="text-[12px] text-red-300/85 mb-3">Probe failed: {error}</div>}

        {cli && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-zinc-100">claude binary</div>
                <div className="text-[11px] text-zinc-500 font-mono truncate">
                  {cliPath ??
                    "not found on PATH or in ~/.local/bin, ~/.bun/bin, /opt/homebrew/bin, /usr/local/bin"}
                </div>
                {cliVersion && (
                  <div
                    className="text-[11px] text-zinc-400 font-mono mt-0.5"
                    data-testid="claude-code-cli-version"
                  >
                    {cliVersion}
                  </div>
                )}
              </div>
              {cliConnected ? (
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 inline-flex items-center gap-1.5"
                  style={{
                    background: "rgba(16,185,129,0.10)",
                    borderColor: "rgba(16,185,129,0.45)",
                    color: "#34d399",
                  }}
                >
                  <CheckCircle2 size={12} />
                  Installed
                </span>
              ) : (
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 inline-flex items-center gap-1.5"
                  style={{
                    background: "rgba(239,68,68,0.10)",
                    borderColor: "rgba(239,68,68,0.45)",
                    color: "#fca5a5",
                  }}
                >
                  <AlertCircle size={12} />
                  Not installed
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Specialized Agents — Claude Code Studio / Video Editing Team */}
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: `${TONE}40`, background: `${TONE}0a` }}
        data-testid="claude-code-specialized-agents"
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3
            className="text-[11px] uppercase tracking-[0.22em] font-semibold"
            style={{ color: `${TONE}cc` }}
          >
            <Clapperboard size={12} className="inline mr-1" />
            Specialized Agents · Video Editing Team
          </h3>
          <Link
            to="/agents/claude-code-studio"
            data-testid="claude-code-open-studio"
            className="text-[11px] font-semibold rounded-md border px-3 py-1.5 hover:opacity-90 inline-flex items-center gap-1.5"
            style={{ background: `${TONE}1a`, borderColor: `${TONE}55`, color: TONE }}
          >
            Open Claude Code Studio →
          </Link>
        </div>
        <p className="text-[12px] text-zinc-400 mb-3">
          A creative production team — script, storyboard, render, and publish — inside Claude Code
          Studio. MiniMax is one provider here, not the whole studio.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {VIDEO_TEAM.map((p) => (
            <div
              key={p.slug}
              data-testid={`cc-team-${p.slug}`}
              className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2"
            >
              <div className="text-[12px] font-semibold text-zinc-100">{p.name}</div>
              <div className="text-[10px] text-zinc-500">{p.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Setup instructions — only when something is missing */}
      {(!cliConnected || error) && (
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: `${TONE}40`, background: `${TONE}0a` }}
          data-testid="claude-code-setup"
        >
          <h3
            className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-2"
            style={{ color: `${TONE}cc` }}
          >
            <Sparkles size={12} className="inline mr-1" />
            Setup
          </h3>
          <ol className="text-[13px] text-zinc-300 space-y-2 list-decimal list-inside">
            <li>
              Save an <strong>Anthropic API key</strong> in{" "}
              <Link to="/settings/api-keys" className="underline" style={{ color: TONE }}>
                /settings/api-keys
              </Link>
              .
            </li>
            <li>
              Install the Claude Code CLI from Anthropic&apos;s docs:
              <pre className="mt-1 text-[11px] font-mono bg-black/40 border border-zinc-800 rounded p-2 overflow-x-auto">
                curl -fsSL https://claude.ai/install.sh | bash
              </pre>
            </li>
            <li>
              Run <code className="text-[11px] bg-black/40 px-1 rounded">claude --version</code> to
              confirm install, then hit Refresh above.
            </li>
          </ol>
          <a
            href={SETUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: TONE }}
          >
            Claude Code docs <ExternalLink size={12} />
          </a>
        </section>
      )}

      {/* Quick-link out */}
      <p className="text-[11px] text-zinc-500">
        Looking for the home dashboard summary? Open{" "}
        <Link to="/" className="underline hover:text-zinc-300">
          the dashboard
        </Link>
        . Need to manage workspaces / sessions? Run{" "}
        <code className="text-zinc-300 font-mono">claude</code> in any project directory.
      </p>
    </div>
  );
}
