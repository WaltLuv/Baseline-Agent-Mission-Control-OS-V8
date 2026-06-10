/**
 * ClaudeAnt — Claude Platform CLI (`ant`) cockpit.
 *
 * Ported from agent-os-pack 6. Status pill + command console + quick actions.
 * Probes /__claude_ant for connection + version, runs read-oriented `ant`
 * subcommands via POST. Graceful "not installed" / "wrong ant" states.
 */
import { useEffect, useRef, useState } from "react";
import { Terminal, Loader2, Play, AlertTriangle, Boxes, Activity, Cpu, FolderUp, Code2 } from "lucide-react";

const ACCENT = "#d97757";

type Status = { connected: boolean; wrongAnt?: boolean; reason?: string; version?: string; bin?: string } | null;

const QUICK = [
  { label: "Auth status", cmd: "auth status" },
  { label: "Models", cmd: "models list" },
  { label: "Managed Agents", cmd: "beta:agents list" },
  { label: "Sessions", cmd: "beta:sessions list" },
  { label: "Files", cmd: "beta:files list" },
];

const FEATURES = [
  { icon: <Boxes size={18} />, t: "Managed Agents cockpit", d: "List every Claude Managed Agent, view its YAML config, and version-control it from one panel." },
  { icon: <Activity size={18} />, t: "Session & trace viewer", d: "Kick off an agent session, send it an event, then pull the full trace — every reasoning step and tool call, visualised." },
  { icon: <Cpu size={18} />, t: "Model explorer", d: "Browse every available Claude model and its capabilities, straight from the Platform — no docs tab needed." },
  { icon: <FolderUp size={18} />, t: "File vault", d: "Upload a folder of PDFs or data and use it across the Messages API and your agents." },
  { icon: <Code2 size={18} />, t: "Raw API console", d: "Run any Claude API endpoint as a command, reshape the response, pipe it anywhere." },
];

interface CmdOut { cmd: string; ok: boolean; stdout: string; stderr: string; parsed?: unknown; }

export function ClaudeAnt() {
  const [status, setStatus] = useState<Status>(null);
  const [cmd, setCmd] = useState("models list");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<CmdOut | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    fetch("/__claude_ant").then((r) => r.json()).then((s) => setStatus(s)).catch(() => setStatus({ connected: false }));
  }, []);

  async function runCmd(c?: string) {
    const command = c ?? cmd;
    if (!command.trim()) return;
    setBusy(true);
    setOut(null);
    try {
      const r = await fetch("/__claude_ant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: command }),
      });
      const j = (await r.json()) as CmdOut;
      setOut(j);
    } catch (e) {
      setOut({ cmd: command, ok: false, stdout: "", stderr: String(e) });
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.connected;
  loaded.current = status !== null;

  return (
    <div className="rounded-xl border p-5 space-y-5" style={{ background: "rgba(0,0,0,0.25)", borderColor: "var(--panel-border)" }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center w-9 h-9 rounded-xl" style={{ background: "rgba(217,119,87,0.18)", color: ACCENT }}><Terminal size={17} /></div>
          <div>
            <div className="text-sm font-medium" style={{ color: ACCENT }}>Ant · Claude Platform CLI</div>
            <div className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>Every Claude API endpoint + Managed Agents, from your dashboard</div>
          </div>
        </div>
        {loaded.current && (
          <div className="text-[11px] px-2.5 py-1 rounded-full border" style={{ borderColor: connected ? "rgba(52,211,153,.4)" : "var(--panel-border)", color: connected ? "#34d399" : "var(--fg-dim)" }}>
            {connected ? `● connected${status?.version ? " · " + status.version.split(/\s+/)[0] : ""}` : status?.wrongAnt ? "⚠ wrong 'ant' found" : "○ not connected"}
          </div>
        )}
      </div>

      {connected && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1.5 flex-1 rounded-xl px-3 py-2.5 border" style={{ background: "rgba(0,0,0,.3)", borderColor: "var(--panel-border)" }}>
              <span className="font-mono text-[13px]" style={{ color: "var(--fg-dimmer)" }}>ant</span>
              <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void runCmd(); }}
                className="flex-1 bg-transparent outline-none text-[13.5px] font-mono" style={{ color: "var(--fg)" }} placeholder="models" />
            </div>
            <button onClick={() => void runCmd()} disabled={busy || !cmd.trim()} className="px-4 h-[44px] rounded-xl flex items-center gap-2 text-sm transition disabled:opacity-40" style={{ background: `${ACCENT}24`, border: `1px solid ${ACCENT}55`, color: ACCENT }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}Run
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--fg-dimmer)" }}>Quick</span>
            {QUICK.map((q) => (
              <button key={q.cmd} onClick={() => void runCmd(q.cmd)} className="px-2.5 py-1 rounded-full border text-[11.5px] transition" style={{ borderColor: "var(--panel-border)", color: "var(--fg-dim)" }}>{q.label}</button>
            ))}
          </div>
          {out && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--panel-border)" }}>
              <div className="px-3 py-2 text-[11.5px] font-mono border-b flex items-center justify-between" style={{ borderColor: "var(--panel-border)", color: out.ok ? "#34d399" : "#f87171" }}>
                <span>$ ant {out.cmd}</span><span>{out.ok ? "ok" : "error"}</span>
              </div>
              <pre className="p-3 text-[12px] leading-relaxed overflow-auto font-mono" style={{ color: "var(--fg-dim)", maxHeight: 360 }}>
{out.parsed ? JSON.stringify(out.parsed, null, 2) : (out.stdout || out.stderr || "(no output)")}
              </pre>
            </div>
          )}
        </div>
      )}

      {loaded.current && !connected && (
        <div className="rounded-xl border p-5" style={{ borderColor: "rgba(217,119,87,.3)", background: "linear-gradient(160deg, rgba(217,119,87,.08), transparent)" }}>
          {status?.wrongAnt ? (
            <p className="text-[13.5px] flex items-start gap-2 mb-3"><AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" /><span>An <code>ant</code> was found but it looks like <b>Apache Ant</b> (the Java build tool), not the Claude Platform CLI. Install the real one below, or set <code>AGENTIC_OS_ANT_BIN</code> to its path.</span></p>
          ) : (
            <p className="text-[13.5px] mb-3" style={{ color: "var(--fg-dim)" }}>The <b>Claude Platform CLI</b> isn't connected yet. Once you install it and log in, this tab becomes a live cockpit for the entire Claude Platform.</p>
          )}
          <div className="text-[12px] font-mono rounded-lg p-3 space-y-1.5 mb-1" style={{ background: "rgba(0,0,0,.3)", color: "var(--fg-dim)" }}>
            <div><span style={{ color: "var(--fg-dimmer)" }}># 1. install (from platform.claude.com — brew / curl / go)</span></div>
            <div style={{ color: "#34d399" }}>brew install anthropics/tap/ant</div>
            <div><span style={{ color: "var(--fg-dimmer)" }}># 2. log in (browser OAuth, scoped to a workspace)</span></div>
            <div style={{ color: "#34d399" }}>ant auth login</div>
            <div><span style={{ color: "var(--fg-dimmer)" }}># then restart the dashboard — this tab goes live</span></div>
          </div>
          <p className="text-[11.5px] mt-2" style={{ color: "var(--fg-dimmer)" }}>Tip: not sure of the exact install command? Open Claude Code and ask — it knows <code>ant</code> via the built-in <code>/claude-api</code> skill.</p>
        </div>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--fg-dimmer)" }}>What this unlocks</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-xl border p-4" style={{ borderColor: "var(--panel-border)", background: "rgba(255,255,255,.02)" }}>
              <div className="grid place-items-center w-9 h-9 rounded-lg mb-2.5" style={{ background: "rgba(217,119,87,.14)", color: ACCENT }}>{f.icon}</div>
              <div className="text-[14px] font-medium mb-1">{f.t}</div>
              <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--fg-dim)" }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
