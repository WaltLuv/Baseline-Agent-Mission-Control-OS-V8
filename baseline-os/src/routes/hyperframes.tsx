/**
 * HyperFrames runtime page.
 *
 * Walt: "If HyperFrames has no route, create the route. This is required
 * because Video Studio / Hermes Video Agent depends on it."
 *
 * The page is a credential + CLI readout — there is no embedded studio in
 * this slice. Walt's "no fake connected state" rule is enforced: every
 * status pill comes from a real probe (Anthropic credential + hyperframes
 * CLI on PATH). Setup instructions surface when either is missing.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Film, Sparkles } from "lucide-react";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";

export const Route = createFileRoute("/hyperframes")({
  head: () => ({
    meta: [
      { title: "HyperFrames — Baseline Automations" },
      { name: "description", content: "HyperFrames credential + CLI status. Required for Video Studio renders." },
    ],
  }),
  component: HyperFramesPage,
});

const TONE = "#8b5cf6"; // violet

type CliStatus = { ok: boolean; bin: string; found: string | null; version: string | null };

function HyperFramesPage() {
  const [cli, setCli] = useState<CliStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch("/__runtime_cli_status?bin=hyperframes", { cache: "no-store" });
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
    <div className="flex flex-col gap-5 h-full p-6" style={{ minHeight: "calc(100vh - 56px)" }} data-testid="hyperframes-page">
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
            <Film size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: `${TONE}cc` }}>
              Video Studio · Render engine
            </div>
            <h1 className="text-2xl font-semibold mt-1" style={{ color: "#e9d5ff" }}>
              HyperFrames
            </h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
              HyperFrames is the render backend for Video Studio + the Hermes Video Agent. This page reports whether your HyperFrames credential is saved and whether the <code>hyperframes</code> CLI is on PATH. Both must be present before any render call will succeed.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            data-testid="hyperframes-refresh"
            className="text-[11px] font-semibold rounded-md border px-3 py-1.5 transition-opacity hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: `${TONE}1a`, borderColor: `${TONE}55`, color: TONE }}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <RuntimeCredentialStatus providerIds={["hyperframes"]} />

      <section
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
        data-testid="hyperframes-cli-status"
      >
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold mb-3">
          HyperFrames CLI install
        </h3>

        {error && <div className="text-[12px] text-red-300/85 mb-3">Probe failed: {error}</div>}
        {!cli && !error && <div className="text-[12px] text-zinc-500">Loading…</div>}

        {cli && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-zinc-100">hyperframes binary</div>
              <div className="text-[11px] text-zinc-500 font-mono truncate">
                {cli.found ?? "not found on PATH or in ~/.local/bin, ~/.bun/bin, /opt/homebrew/bin, /usr/local/bin"}
              </div>
              {cli.version && (
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5" data-testid="hyperframes-cli-version">
                  {cli.version}
                </div>
              )}
            </div>
            {cliConnected ? (
              <span
                className="text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 inline-flex items-center gap-1.5"
                style={{ background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.45)", color: "#34d399" }}
              >
                <CheckCircle2 size={12} />
                Installed
              </span>
            ) : (
              <span
                className="text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 inline-flex items-center gap-1.5"
                style={{ background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.45)", color: "#fca5a5" }}
              >
                <AlertCircle size={12} />
                Not installed
              </span>
            )}
          </div>
        )}
      </section>

      {(!cliConnected || error) && (
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: `${TONE}40`, background: `${TONE}0a` }}
          data-testid="hyperframes-setup"
        >
          <h3 className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-2" style={{ color: `${TONE}cc` }}>
            <Sparkles size={12} className="inline mr-1" />
            Setup
          </h3>
          <ol className="text-[13px] text-zinc-300 space-y-2 list-decimal list-inside">
            <li>
              Save a <strong>HyperFrames API key</strong> in{" "}
              <Link to="/settings/api-keys" className="underline" style={{ color: TONE }}>
                /settings/api-keys
              </Link>
              .
            </li>
            <li>
              Install the HyperFrames CLI:
              <pre className="mt-1 text-[11px] font-mono bg-black/40 border border-zinc-800 rounded p-2 overflow-x-auto">npm install -g hyperframes</pre>
            </li>
            <li>
              Run <code className="text-[11px] bg-black/40 px-1 rounded">hyperframes --version</code> to confirm install, then hit Refresh above.
            </li>
          </ol>
          <a
            href="https://hyperframes.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: TONE }}
          >
            HyperFrames docs <ExternalLink size={12} />
          </a>
        </section>
      )}
    </div>
  );
}
