/**
 * MiniMax runtime page.
 *
 * Walt: "If MiniMax has no route, create the route. No fake connected state."
 *
 * Same shape as the HyperFrames page: credential row + real CLI probe +
 * setup instructions when something is missing. The MiniMax credential
 * unlocks chat (MiniMax-M2.7) and TTS (speech-2.8-hd) via the MiniMax API.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Mic, Sparkles } from "lucide-react";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";

export const Route = createFileRoute("/minimax")({
  head: () => ({
    meta: [
      { title: "MiniMax — Baseline Automations" },
      {
        name: "description",
        content: "MiniMax credential + CLI status for chat and TTS workflows.",
      },
    ],
  }),
  component: MiniMaxPage,
});

const TONE = "#22d3ee"; // cyan

type CliStatus = { ok: boolean; bin: string; found: string | null; version: string | null };

const MODEL_OPTIONS = [
  { label: "MiniMax-M2.7", purpose: "Chat / agentic loops" },
  { label: "speech-2.8-hd", purpose: "Text-to-speech, high definition" },
];

function MiniMaxPage() {
  const [cli, setCli] = useState<CliStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch("/__runtime_cli_status?bin=minimax", { cache: "no-store" });
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

  return (
    <div
      className="flex flex-col gap-5 h-full p-6"
      style={{ minHeight: "calc(100vh - 56px)" }}
      data-testid="minimax-page"
    >
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
            <Mic size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: `${TONE}cc` }}>
              MiniMax · Chat + TTS
            </div>
            <h1 className="text-2xl font-semibold mt-1" style={{ color: "#a5f3fc" }}>
              MiniMax
            </h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
              MiniMax provides chat (MiniMax-M2.7) and text-to-speech (speech-2.8-hd) via a single
              API key. This page reports whether your MiniMax credential is saved and whether the{" "}
              <code>minimax</code> CLI is installed.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            data-testid="minimax-refresh"
            className="text-[11px] font-semibold rounded-md border px-3 py-1.5 transition-opacity hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: `${TONE}1a`, borderColor: `${TONE}55`, color: TONE }}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {/* MiniMax is now one provider inside Claude Code Studio. */}
      <Link
        to="/agents/claude-code-studio"
        data-testid="minimax-studio-banner"
        className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 hover:opacity-90"
        style={{ borderColor: `${TONE}40`, background: `${TONE}0a` }}
      >
        <span className="text-[12px] text-zinc-300">
          MiniMax is now a provider inside{" "}
          <strong style={{ color: "#a5f3fc" }}>Claude Code Studio</strong> — the unified creative
          operating system. This page remains your MiniMax credential status.
        </span>
        <span className="text-[11px] font-semibold shrink-0" style={{ color: TONE }}>
          Open Studio →
        </span>
      </Link>

      <RuntimeCredentialStatus providerIds={["minimax"]} />

      {/* Available models / capabilities */}
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="minimax-models"
      >
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3">
          Models &amp; capabilities
        </h3>
        <ul className="space-y-2">
          {MODEL_OPTIONS.map((m) => (
            <li
              key={m.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-zinc-100">{m.label}</div>
                <div className="text-[11px] text-zinc-500">{m.purpose}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
                API
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="minimax-cli-status"
      >
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3">
          MiniMax CLI install (optional)
        </h3>
        <p className="text-[12px] text-zinc-500 mb-3">
          The CLI is only required for the bundled{" "}
          <code className="bg-black/40 px-1 rounded">cli-anything-minimax</code> skill. API-only
          callers can ignore this row.
        </p>

        {error && <div className="text-[12px] text-red-300/85 mb-3">Probe failed: {error}</div>}
        {!cli && !error && <div className="text-[12px] text-zinc-500">Loading…</div>}

        {cli && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-zinc-100">minimax binary</div>
              <div className="text-[11px] text-zinc-500 font-mono truncate">
                {cli.found ?? "not found on PATH"}
              </div>
              {cli.version && (
                <div
                  className="text-[11px] text-zinc-400 font-mono mt-0.5"
                  data-testid="minimax-cli-version"
                >
                  {cli.version}
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
                  background: "rgba(113,113,122,0.10)",
                  borderColor: "rgba(113,113,122,0.30)",
                  color: "#a1a1aa",
                }}
              >
                <AlertCircle size={12} />
                Not installed
              </span>
            )}
          </div>
        )}
      </section>

      {!cli?.ok && (
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: `${TONE}40`, background: `${TONE}0a` }}
          data-testid="minimax-setup"
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
              Save a <strong>MiniMax API key</strong> in{" "}
              <Link to="/settings/api-keys" className="underline" style={{ color: TONE }}>
                /settings/api-keys
              </Link>
              .
            </li>
            <li>
              (Optional) install the CLI for skill-driven calls:
              <pre className="mt-1 text-[11px] font-mono bg-black/40 border border-zinc-800 rounded p-2 overflow-x-auto">
                npm install -g minimax-cli
              </pre>
            </li>
            <li>Hit Refresh above to re-probe after install.</li>
          </ol>
          <a
            href="https://api.minimax.chat"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: TONE }}
          >
            MiniMax docs <ExternalLink size={12} />
          </a>
        </section>
      )}
    </div>
  );
}
