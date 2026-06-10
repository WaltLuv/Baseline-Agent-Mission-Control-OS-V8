/**
 * Hermes MCP Loop — the Hermes MCP 8-step setup wizard.
 *
 *   Layer 1: The Brain    — Claude (planning)
 *           ↓ delegates
 *   Layer 2: The Bridge   — Hermes MCP (OAuth, this page)
 *           ↓ calls
 *   Layer 3: The Hands    — Hermes Agent (tools, your machine)
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, CheckCircle2, AlertCircle, Copy, ExternalLink, RefreshCw, Cpu } from "lucide-react";

export const Route = createFileRoute("/hermes-mcp-loop")({
  head: () => ({
    meta: [
      { title: "Hermes MCP Loop — Baseline Automations" },
      { name: "description", content: "Hermes MCP bridge — Claude → Hermes MCP → Hermes Agent." },
    ],
  }),
  component: HermesMcpLoopPage,
});

const TONE = "#fbbf24";

interface PluginStatus { installed: boolean; version?: string; path?: string; }
interface StepState { done: boolean; detail?: string; }

function HermesMcpLoopPage() {
  const [plugins, setPlugins] = useState<{ claude?: PluginStatus } | null>(null);
  const [hermesMcp, setHermesMcp] = useState<PluginStatus | null>(null);
  const [cloudflared, setCloudflared] = useState<PluginStatus | null>(null);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [gatewayLive, setGatewayLive] = useState(false);
  const [bridgeLive, setBridgeLive] = useState(false);
  const [oauth, setOauth] = useState<{ clientId?: string; clientSecret?: string }>({});
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<"up" | "down" | null>(null);
  const [runLog, setRunLog] = useState<string>("");

  async function runScript(which: "up" | "down") {
    if (running !== null) return;
    setRunning(which);
    setRunLog("");
    try {
      const r = await fetch(which === "up" ? "/__hermes_mcp_loop_up" : "/__hermes_mcp_loop_down", { method: "POST" });
      if (!r.body) { setRunLog("(no stream)"); setRunning(null); return; }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setRunLog((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) { setRunLog((prev) => prev + `\n[client error] ${String(e)}`); }
    setRunning(null);
    probe();
  }
  const runUp = () => runScript("up");
  const runDown = () => runScript("down");

  async function probe() {
    setLoading(true);
    try {
      // Status of the 3 CLI binaries we depend on
      const r = await fetch("/__hermes_mcp_loop_status");
      if (r.ok) {
        const j = await r.json() as { hermesMcp: PluginStatus; cloudflared: PluginStatus; gatewayLive: boolean; bridgeLive: boolean; tunnelUrl: string | null; oauthClientId: string | null; oauthClientSecret: string | null };
        setHermesMcp(j.hermesMcp);
        setCloudflared(j.cloudflared);
        setGatewayLive(j.gatewayLive);
        setBridgeLive(j.bridgeLive);
        setTunnelUrl(j.tunnelUrl);
        setOauth({ clientId: j.oauthClientId ?? undefined, clientSecret: j.oauthClientSecret ?? undefined });
      }
      const p = await fetch("/__plugin_status").then((r) => r.json());
      setPlugins(p);
    } catch { /* skip */ }
    setLoading(false);
  }

  useEffect(() => { probe(); const t = setInterval(probe, 8000); return () => clearInterval(t); }, []);

  const steps: { n: number; label: string; cmd: string; state: StepState; note?: string }[] = [
    {
      n: 1,
      label: "Install hermes-mcp",
      cmd: "pipx install hermes-mcp",
      state: { done: !!hermesMcp?.installed, detail: hermesMcp?.version },
    },
    {
      n: 2,
      label: "Mint OAuth credentials",
      cmd: "hermes-mcp mint-client",
      state: { done: !!oauth.clientId, detail: oauth.clientId ? `client: ${oauth.clientId}` : undefined },
    },
    {
      n: 3,
      label: "Install + run cloudflared tunnel",
      cmd: "brew install cloudflared && cloudflared tunnel --url http://127.0.0.1:8765",
      state: { done: !!tunnelUrl, detail: tunnelUrl ?? undefined },
    },
    {
      n: 4,
      label: "Export env vars + start Hermes proxy",
      cmd: "hermes login nous && hermes proxy start --port 8642",
      state: { done: gatewayLive },
      note: "Needs your Nous Portal login. Once logged in, the proxy runs on :8642 and the bridge can talk to it.",
    },
    {
      n: 5,
      label: "hermes-mcp doctor",
      cmd: "hermes-mcp doctor",
      state: { done: gatewayLive && !!tunnelUrl },
    },
    {
      n: 6,
      label: "Start the bridge",
      cmd: "hermes-mcp serve",
      state: { done: bridgeLive },
    },
    {
      n: 7,
      label: "Connect Claude Desktop",
      cmd: tunnelUrl ? `URL: ${tunnelUrl}/mcp\nClient ID: ${oauth.clientId ?? "<pending>"}\nClient Secret: ${oauth.clientSecret ?? "<pending>"}` : "Settings → Connectors → Add Custom Connector",
      state: { done: false },
      note: "Manual: open Claude Desktop → Settings → Connectors → Add Custom Connector → paste the 3 fields above.",
    },
    {
      n: 8,
      label: "Test the loop",
      cmd: `Use Hermes to schedule a daily cron job that emails me a summary of my inbox at 8am.`,
      state: { done: false },
      note: "Paste this exact prompt into Claude Desktop. If Claude executes the task (not just describes it), the loop is live.",
    },
  ];

  const completed = steps.filter((s) => s.state.done).length;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Crown size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#fef3c7" }}>Hermes MCP Loop</div>
          <div className="text-[10.5px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            {completed}/8 steps complete · Claude → Hermes MCP → Hermes Agent
          </div>
        </div>
        <button onClick={runUp} disabled={running !== null} className="px-3 py-1.5 rounded text-[11.5px] font-semibold transition disabled:opacity-50 flex items-center gap-1.5" style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }} title="One-shot: cloudflared + hermes login + proxy + bridge">
          {running === "up" ? <><RefreshCw size={11} className="animate-spin" /> Running…</> : <>▶ hermes-mcp-loop-up</>}
        </button>
        <button onClick={runDown} disabled={running !== null} className="px-3 py-1.5 rounded text-[11.5px] transition disabled:opacity-50" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }} title="Stop tunnel + proxy + bridge">
          {running === "down" ? "Stopping…" : "■ down"}
        </button>
        <button onClick={probe} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
          {/* Architecture diagram */}
          <div className="panel p-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3 text-center" style={{ background: "rgba(217,119,87,0.08)", border: "1px solid rgba(217,119,87,0.3)" }}>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#D97757" }}>Layer 1 · Brain</div>
                <div className="text-[13px] font-semibold" style={{ color: "#fff" }}>Claude</div>
                <div className="text-[10.5px] mt-1" style={{ color: "var(--cream-dim)" }}>plans + delegates</div>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: `${TONE}10`, border: `1px solid ${TONE}44` }}>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: TONE }}>Layer 2 · Bridge</div>
                <div className="text-[13px] font-semibold" style={{ color: "#fff" }}>Hermes MCP</div>
                <div className="text-[10.5px] mt-1" style={{ color: "var(--cream-dim)" }}>OAuth · tunnel</div>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,210,30,0.08)", border: "1px solid rgba(255,210,30,0.3)" }}>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#FFD21E" }}>Layer 3 · Hands</div>
                <div className="text-[13px] font-semibold" style={{ color: "#fff" }}>Hermes Agent</div>
                <div className="text-[10.5px] mt-1" style={{ color: "var(--cream-dim)" }}>tools · cron · email</div>
              </div>
            </div>
          </div>

          {/* 8 steps */}
          <div className="space-y-2">
            {steps.map((s) => (
              <div key={s.n} className="rounded-lg p-4 flex items-start gap-3" style={{ background: s.state.done ? "rgba(16,185,129,0.04)" : "rgba(0,0,0,0.25)", border: `1px solid ${s.state.done ? "rgba(16,185,129,0.3)" : "var(--panel-border)"}` }}>
                <div className="shrink-0 mt-0.5">
                  {s.state.done
                    ? <CheckCircle2 size={18} style={{ color: "#10B981" }} />
                    : <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold" style={{ background: `${TONE}22`, color: TONE, border: `1px solid ${TONE}55` }}>{s.n}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold" style={{ color: s.state.done ? "var(--cream-dim)" : "#fff" }}>{s.label}</span>
                    {s.state.detail && <span className="text-[10px] font-mono" style={{ color: TONE }}>{s.state.detail}</span>}
                  </div>
                  <pre className="text-[11px] font-mono p-2 rounded whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.4)", color: s.state.done ? "var(--fg-dim)" : TONE }}>{s.cmd}</pre>
                  {s.note && <div className="text-[10.5px] mt-1.5 italic" style={{ color: "var(--cream-mute)" }}>{s.note}</div>}
                </div>
                <button onClick={() => navigator.clipboard.writeText(s.cmd)} className="p-1.5 rounded transition shrink-0" style={{ color: "var(--fg-dim)" }} title="Copy">
                  <Copy size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right rail — credentials + Claude Desktop config */}
        <aside className="flex flex-col overflow-y-auto border-l p-4 space-y-3 scroll" style={{ width: "min(380px, 36vw)", borderColor: "var(--panel-border)" }}>
          {(running || runLog) && (
            <div className="panel p-4 space-y-2" style={{ background: "rgba(0,0,0,0.4)" }}>
              <div className="flex items-center gap-2">
                {running ? <RefreshCw size={12} className="animate-spin" style={{ color: TONE }} /> : <CheckCircle2 size={12} style={{ color: "#10B981" }} />}
                <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
                  {running === "up" ? "hermes-mcp-loop-up running…" : running === "down" ? "hermes-mcp-loop-down running…" : "Last run complete"}
                </h3>
              </div>
              <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-[260px] overflow-y-auto scroll" style={{ color: "var(--fg-dim)" }}>
                {runLog || "(starting…)"}
              </pre>
              <p className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>
                If <code style={{ color: TONE }}>hermes login</code> opens a browser, complete the OAuth there — the script auto-resumes once auth is detected.
              </p>
            </div>
          )}
          <div className="panel p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Cpu size={13} style={{ color: TONE }} />
              <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Current state</h3>
            </div>
            <div className="space-y-1.5 text-[11.5px]" style={{ color: "var(--cream-dim)" }}>
              <Row label="hermes-mcp" ok={!!hermesMcp?.installed} value={hermesMcp?.version} />
              <Row label="cloudflared" ok={!!cloudflared?.installed} value={cloudflared?.version} />
              <Row label="tunnel" ok={!!tunnelUrl} value={tunnelUrl?.replace("https://", "")} />
              <Row label="OAuth client" ok={!!oauth.clientId} value={oauth.clientId} />
              <Row label="hermes proxy (:8642)" ok={gatewayLive} />
              <Row label="hermes-mcp serve (:8765)" ok={bridgeLive} />
            </div>
          </div>

          {tunnelUrl && oauth.clientId && oauth.clientSecret && (
            <div className="panel p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ExternalLink size={13} style={{ color: TONE }} />
                <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Claude Desktop connector</h3>
              </div>
              <p className="text-[11px]" style={{ color: "var(--cream-mute)" }}>
                Claude Desktop → Settings → Connectors → Add Custom Connector. Paste:
              </p>
              <CopyRow label="URL"           value={`${tunnelUrl}/mcp`} />
              <CopyRow label="Client ID"     value={oauth.clientId} />
              <CopyRow label="Client Secret" value={oauth.clientSecret} />
            </div>
          )}

          <div className="panel p-4 space-y-2 text-[11.5px]" style={{ background: "rgba(0,0,0,0.25)", color: "var(--cream-dim)" }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Test prompt for Claude</h3>
            <pre className="text-[10.5px] font-mono p-2 rounded whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.4)", color: TONE }}>{`Use Hermes to schedule a daily cron job that emails me a summary of my inbox at 8am.`}</pre>
            <div className="text-[10.5px]">If Claude executes (not describes) the task → loop is live.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 size={11} style={{ color: "#10B981" }} /> : <AlertCircle size={11} style={{ color: "#fbbf24" }} />}
      <span className="flex-1">{label}</span>
      {value && <code className="text-[9.5px] font-mono" style={{ color: TONE }}>{value.length > 28 ? `${value.slice(0, 12)}…${value.slice(-12)}` : value}</code>}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="w-full text-left p-2 rounded transition" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)" }}>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
        {label}
        {copied ? <CheckCircle2 size={10} style={{ color: "#10B981" }} /> : <Copy size={10} style={{ color: "var(--fg-dimmer)" }} />}
      </div>
      <div className="text-[10.5px] font-mono break-all mt-0.5" style={{ color: TONE }}>{value}</div>
    </button>
  );
}
