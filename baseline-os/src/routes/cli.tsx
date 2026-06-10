/**
 * CLI-Anything → Execution Tool Registry (Phase 3).
 *
 * Operator-grade view of the Tool Registry: every entry's risk level,
 * installed/enabled state, allowed runtimes, required secrets (named only,
 * never values), action surface, audit ledger, and Test/Schema/Enable buttons.
 *
 * Per directive: do not rebuild CLI-Anything. This page IS the upgraded view.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Terminal, RefreshCw, AlertCircle, CheckCircle2, Lock, Unlock, Play,
  Copy, ChevronRight, Activity, Sparkles, ShieldAlert, Power, Cpu,
  Search, ExternalLink, Package,
} from "lucide-react";

const TONE = "#67e8f9";

export const Route = createFileRoute("/cli")({
  head: () => ({
    meta: [
      { title: "Tool Registry — Baseline OS Phase 3" },
      { name: "description", content: "Execution Tool Registry — approved CLIs, risk-gated, audit-logged." },
    ],
  }),
  component: ToolRegistryPage,
});

type Risk = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";

interface ToolAction {
  verb: string;
  description: string;
  argv: string[];
  input_schema: Record<string, { type: string; required?: boolean; pattern?: string; max_length?: number }>;
  output_schema: Record<string, unknown>;
  risk_level?: Risk;
}

interface ToolEntry {
  id: string;
  cli_name: string;
  category: string;
  description: string;
  workspace_id: string;
  installed_status: "available" | "installed" | "broken";
  enabled_status: "enabled" | "disabled";
  allowed_runtimes: string[];
  required_secrets: string[];
  risk_level: Risk;
  approval_policy: string;
  supported_actions: ToolAction[];
  last_used_at: string | null;
  success_count: number;
  failure_count: number;
  average_runtime_ms: number;
}

interface ExecResult {
  ok: boolean;
  audit_id: string;
  tool_id: string;
  verb: string;
  argv_redacted: string[];
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  approved: boolean;
  refused_reason: string | null;
  task_id?: any;
}

const RISK_COLOR: Record<Risk, string> = {
  LOW:     "#10b981",
  MEDIUM:  "#fbbf24",
  HIGH:    "#f97316",
  BLOCKED: "#ef4444",
};

function fmtAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function ToolRegistryPage() {
  const [entries, setEntries] = useState<ToolEntry[]>([]);
  const [audit, setAudit] = useState<ExecResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, a] = await Promise.all([
        fetch("/api/tools").then((r) => r.json()),
        fetch("/api/tools/audit?limit=30").then((r) => r.json()),
      ]);
      setEntries(list.entries ?? []);
      setAudit(a.audit ?? []);
      if (!selected && list.entries?.length) setSelected(list.entries[0].id);
    } catch (e: any) { setError(String(e?.message ?? e)); }
    setLoading(false);
  }, [selected]);

  useEffect(() => { void load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const selectedEntry = useMemo(() => entries.find((e) => e.id === selected) ?? null, [entries, selected]);

  async function toggleEnable(entry: ToolEntry) {
    await fetch(`/api/tools/${encodeURIComponent(entry.id)}/${entry.enabled_status === "enabled" ? "disable" : "enable"}`, { method: "POST" });
    void load();
  }

  const counts = entries.reduce((acc, e) => ({
    total: acc.total + 1,
    installed: acc.installed + (e.installed_status === "installed" ? 1 : 0),
    enabled: acc.enabled + (e.enabled_status === "enabled" ? 1 : 0),
    runs: acc.runs + e.success_count + e.failure_count,
  }), { total: 0, installed: 0, enabled: 0, runs: 0 });

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 56px)" }}>
      {/* ── Section 1: Operator Tool Registry (Phase 3) ─────────────────── */}
      <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Terminal size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#e0f7fa" }}>Tool Registry</div>
          <div className="text-[10.5px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            Baseline OS · Phase 3 · {counts.total} entries · {counts.installed} installed · {counts.enabled} enabled · {counts.runs} total runs
          </div>
        </div>
        <a
          href="#cli-anything"
          className="px-3 py-1.5 rounded-lg text-[10.5px] uppercase tracking-widest"
          style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: "#e0f7fa" }}
          title="Jump to CLI-Anything catalog"
        >
          ↓ 67 harness catalog
        </a>
        <button onClick={() => void load()} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {error && (
        <div className="mx-4 mt-3 p-3 rounded text-[11.5px] flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left: registry list */}
        <div className="flex flex-col border-r overflow-hidden" style={{ width: "min(420px, 38vw)", borderColor: "var(--panel-border)" }}>
          <div className="px-3 py-2 shrink-0 border-b text-[10px] uppercase tracking-widest flex items-center justify-between" style={{ borderColor: "var(--panel-border)", color: "var(--cream-mute)" }}>
            <span>Registered tools</span>
            <span className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{entries.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll">
            {entries.length === 0 && !loading && (
              <div className="text-center py-12 text-[11.5px]" style={{ color: "var(--fg-dimmer)" }}>
                No tools registered. Run <code className="text-[10.5px]" style={{ color: TONE }}>mc tool seed</code>.
              </div>
            )}
            {entries.map((e) => {
              const active = selected === e.id;
              const riskColor = RISK_COLOR[e.risk_level];
              const installed = e.installed_status === "installed";
              return (
                <button key={e.id} onClick={() => setSelected(e.id)} className="w-full text-left p-3 rounded-lg transition flex items-center gap-3"
                  style={{ background: active ? `${TONE}18` : "rgba(0,0,0,0.25)", border: `1px solid ${active ? TONE : "var(--panel-border)"}` }}>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${riskColor}18`, border: `1px solid ${riskColor}55`, color: riskColor }}>
                    {e.risk_level === "BLOCKED" ? <ShieldAlert size={14} /> : <Terminal size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-mono font-bold truncate" style={{ color: "#fff" }}>{e.id}</div>
                    <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--fg-dimmer)" }}>
                      <span className="px-1.5 py-[1px] rounded font-bold uppercase tracking-widest text-[9px]" style={{ background: `${riskColor}22`, color: riskColor, border: `1px solid ${riskColor}44` }}>{e.risk_level}</span>
                      <span>·</span>
                      <span style={{ color: installed ? "#10b981" : "#f97316" }}>{e.installed_status}</span>
                      <span>·</span>
                      <span style={{ color: e.enabled_status === "enabled" ? "#10b981" : "#fbbf24" }}>{e.enabled_status}</span>
                      <span>·</span>
                      <span>{e.supported_actions.length} actions</span>
                    </div>
                  </div>
                  <ChevronRight size={12} style={{ color: "var(--fg-dimmer)" }} />
                </button>
              );
            })}
          </div>

          {/* Recent execution audit (bottom of left rail) */}
          <div className="border-t shrink-0 max-h-[180px] overflow-y-auto p-2 space-y-0.5" style={{ borderColor: "var(--panel-border)" }}>
            <div className="text-[9.5px] uppercase tracking-widest px-1.5 mb-1" style={{ color: "var(--cream-mute)" }}>Recent executions · {audit.length}</div>
            {audit.length === 0 && <div className="text-[10.5px] px-2" style={{ color: "var(--fg-dimmer)" }}>(none yet)</div>}
            {audit.slice(-15).reverse().map((a) => (
              <div key={a.audit_id} className="text-[10px] flex items-center gap-2 px-1.5 py-0.5">
                {a.ok ? <CheckCircle2 size={9} style={{ color: "#10b981" }} /> : a.approved ? <AlertCircle size={9} style={{ color: "#fbbf24" }} /> : <Lock size={9} style={{ color: "#ef4444" }} />}
                <span className="font-mono" style={{ color: TONE }}>{a.tool_id}.{a.verb}</span>
                <span style={{ color: "var(--fg-dimmer)" }}>{a.duration_ms}ms</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex-1 overflow-y-auto p-5 scroll">
          {!selectedEntry && (
            <div className="text-center py-20 text-[12px]" style={{ color: "var(--fg-dimmer)" }}>
              Pick a tool on the left to see actions + Test.
            </div>
          )}
          {selectedEntry && <ToolDetail entry={selectedEntry} onToggle={() => toggleEnable(selectedEntry)} onReload={load} />}
        </div>
      </div>
      </div>
      {/* ── Section 2: Original CLI-Anything Hub catalog (67 harnesses) ──── */}
      <CliAnythingCatalog />
    </div>
  );
}

function ToolDetail({ entry, onToggle, onReload }: { entry: ToolEntry; onToggle: () => void; onReload: () => void }) {
  const riskColor = RISK_COLOR[entry.risk_level];
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${riskColor}18`, border: `1px solid ${riskColor}55`, color: riskColor }}>
          {entry.risk_level === "BLOCKED" ? <ShieldAlert size={22} /> : <Terminal size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-mono font-bold truncate" style={{ color: "#fff" }}>{entry.id}</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: "var(--cream-mute)" }}>{entry.description}</div>
        </div>
        <button onClick={onToggle} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold" style={{ background: entry.enabled_status === "enabled" ? "rgba(16,185,129,0.12)" : "rgba(251,191,36,0.12)", border: `1px solid ${entry.enabled_status === "enabled" ? "rgba(16,185,129,0.5)" : "rgba(251,191,36,0.5)"}`, color: entry.enabled_status === "enabled" ? "#10b981" : "#fbbf24" }}>
          {entry.enabled_status === "enabled" ? <Unlock size={11} /> : <Lock size={11} />}
          {entry.enabled_status === "enabled" ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Risk" value={entry.risk_level} color={riskColor} />
        <KPI label="Status" value={entry.installed_status} color={entry.installed_status === "installed" ? "#10b981" : "#f97316"} />
        <KPI label="Runs" value={`${entry.success_count + entry.failure_count}`} color="#fff" />
        <KPI label="Avg" value={`${entry.average_runtime_ms}ms`} color="#fff" />
      </div>

      <div className="panel p-4 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Identity</h3>
        <div className="grid grid-cols-2 gap-2 text-[11.5px]">
          <KV label="cli_name" value={entry.cli_name} mono />
          <KV label="category" value={entry.category} />
          <KV label="workspace_id" value={entry.workspace_id} />
          <KV label="approval_policy" value={entry.approval_policy} />
          <KV label="last_used_at" value={entry.last_used_at ? fmtAgo(entry.last_used_at) : "never"} />
          <KV label="success / failure" value={`${entry.success_count} / ${entry.failure_count}`} />
        </div>
      </div>

      <div className="panel p-4 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Allowed runtimes</h3>
        <div className="flex flex-wrap gap-1.5">
          {entry.allowed_runtimes.map((r) => (
            <span key={r} className="text-[11px] font-mono px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--fg)", border: "1px solid var(--panel-border)" }}>{r}</span>
          ))}
        </div>
      </div>

      <div className="panel p-4 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--cream-mute)" }}>
          Required secrets
          <span className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>(env-var names only — values never logged)</span>
        </h3>
        {entry.required_secrets.length === 0 ? (
          <div className="text-[11.5px]" style={{ color: "var(--fg-dimmer)" }}>(none)</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {entry.required_secrets.map((s) => (
              <span key={s} className="text-[11px] font-mono px-2 py-1 rounded" style={{ background: "rgba(245,158,11,0.08)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.35)" }}>{s}</span>
            ))}
          </div>
        )}
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Actions · {entry.supported_actions.length}</h3>
        <div className="space-y-2">
          {entry.supported_actions.map((a) => (
            <ActionRow key={a.verb} entry={entry} action={a} onReload={onReload} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionRow({ entry, action, onReload }: { entry: ToolEntry; action: ToolAction; onReload: () => void }) {
  const risk = action.risk_level ?? entry.risk_level;
  const riskColor = RISK_COLOR[risk as Risk];
  const [args, setArgs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [showSchema, setShowSchema] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    try {
      const body: any = { verb: action.verb, args };
      // For non-LOW actions, accept any short token as the Phase 3 approval stub.
      if (risk !== "LOW") body.approval_token = "phase3-ui-test-token";
      const r = await fetch(`/api/tools/${encodeURIComponent(entry.id)}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json() as ExecResult;
      setResult(j);
      onReload();
    } catch (e: any) {
      setResult({ ok: false, audit_id: "", tool_id: entry.id, verb: action.verb, argv_redacted: [], exit_code: null, stdout: "", stderr: String(e?.message ?? e), duration_ms: 0, approved: false, refused_reason: String(e?.message ?? e) });
    }
    setRunning(false);
  }

  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-bold text-[12.5px]" style={{ color: "#fff" }}>{action.verb}</span>
        <span className="text-[9.5px] uppercase tracking-widest font-bold px-1.5 py-[1px] rounded" style={{ background: `${riskColor}22`, color: riskColor, border: `1px solid ${riskColor}55` }}>{risk}</span>
        <span className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>{action.description}</span>
        <button onClick={() => setShowSchema(!showSchema)} className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>{showSchema ? "Hide schema" : "Schema"}</button>
        <button onClick={run} disabled={running || entry.installed_status !== "installed"} className="text-[10.5px] px-2.5 py-1 rounded flex items-center gap-1 font-semibold disabled:opacity-40" style={{ background: `${riskColor}22`, border: `1px solid ${riskColor}55`, color: riskColor }}>
          {running ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />} Test
        </button>
      </div>

      {/* Args inputs */}
      {Object.keys(action.input_schema).length > 0 && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(action.input_schema).map(([name, spec]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="text-[10.5px] font-mono min-w-[80px]" style={{ color: "var(--cream-mute)" }}>{name}{spec.required ? "*" : ""}</span>
              <input value={args[name] ?? ""} onChange={(e) => setArgs((p) => ({ ...p, [name]: e.target.value }))}
                placeholder={`${spec.type}${spec.pattern ? ` /${spec.pattern}/` : ""}`}
                className="flex-1 px-2 py-1 rounded text-[11px] font-mono outline-none"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--panel-border)", color: "var(--fg)" }} />
            </div>
          ))}
        </div>
      )}

      {showSchema && (
        <pre className="mt-2 text-[10.5px] p-2 rounded overflow-auto" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--panel-border)", color: TONE, maxHeight: 200 }}>{JSON.stringify({ argv: action.argv, input_schema: action.input_schema, output_schema: action.output_schema }, null, 2)}</pre>
      )}

      {result && (
        <div className="mt-2 rounded p-2" style={{ background: result.ok ? "rgba(16,185,129,0.06)" : result.approved ? "rgba(251,191,36,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${result.ok ? "rgba(16,185,129,0.3)" : result.approved ? "rgba(251,191,36,0.3)" : "rgba(239,68,68,0.3)"}` }}>
          <div className="flex items-center gap-2 text-[10.5px]" style={{ color: "var(--fg-dim)" }}>
            {result.ok ? <CheckCircle2 size={10} style={{ color: "#10b981" }} /> : result.approved ? <AlertCircle size={10} style={{ color: "#fbbf24" }} /> : <Lock size={10} style={{ color: "#ef4444" }} />}
            <span style={{ color: result.ok ? "#10b981" : result.approved ? "#fbbf24" : "#ef4444" }}>
              {result.ok ? "ok" : result.approved ? `exit ${result.exit_code}` : "refused"}
            </span>
            <span>· {result.duration_ms}ms</span>
            <span>· audit {result.audit_id.slice(0, 14)}…</span>
            <button onClick={() => navigator.clipboard.writeText(result.audit_id)} className="ml-auto"><Copy size={10} style={{ color: "var(--fg-dimmer)" }} /></button>
          </div>
          {result.refused_reason && (
            <div className="text-[10.5px] mt-1" style={{ color: "#fca5a5" }}>{result.refused_reason}</div>
          )}
          {result.stdout && (
            <pre className="text-[10.5px] mt-2 p-2 rounded overflow-auto whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.4)", color: "var(--fg-dim)", maxHeight: 240 }}>{result.stdout.slice(0, 1500)}</pre>
          )}
          {result.stderr && (
            <pre className="text-[10.5px] mt-1 p-2 rounded overflow-auto whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.4)", color: "#fca5a5", maxHeight: 120 }}>{result.stderr.slice(0, 800)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--panel-border)" }}>
      <div className="text-[9.5px] uppercase tracking-[0.18em]" style={{ color: "var(--cream-mute)" }}>{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border p-2" style={{ borderColor: "var(--panel-border)", background: "rgba(0,0,0,0.2)" }}>
      <div className="text-[9.5px] uppercase tracking-[0.15em]" style={{ color: "var(--cream-mute)" }}>{label}</div>
      <div className={`text-[11.5px] ${mono ? "font-mono" : ""} truncate`} style={{ color: "var(--fg)" }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI-Anything Hub — the original 67-harness catalog browser.
// Restored alongside the Phase 3 Tool Registry (this is the section the
// pre-Phase-3 /cli page used to show; both surfaces now live on the same
// page). Hits /__cli_registry for the harness list and /__ai_chat for the
// streaming AI briefing.
// ─────────────────────────────────────────────────────────────────────────────

type HarnessTool = { name: string; path: string; hasSkill: boolean };

function CliAnythingCatalog() {
  const [tools, setTools] = useState<HarnessTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<HarnessTool | null>(null);
  const [filter, setFilter] = useState("");
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/__cli_registry");
      const j = await r.json() as { tools: HarnessTool[]; note?: string };
      setTools(j.tools || []);
      setNote(j.note ?? null);
    } catch {
      setTools([]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return tools;
    const q = filter.toLowerCase();
    return tools.filter((t) => t.name.toLowerCase().includes(q));
  }, [tools, filter]);

  async function explain(tool: HarnessTool) {
    setSelected(tool);
    setBrief(null);
    setBriefLoading(true);
    let out = "";
    try {
      const r = await fetch("/__ai_chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: "openclaw",
          prompt: `Write a 4-section briefing for the CLI-Anything harness "${tool.name}":\n\n1. What it does (one paragraph, plain English)\n2. Install: \`npx skills add HKUDS/CLI-Anything --skill ${tool.name} -g -y\`\n3. Top 3 common commands with example usage\n4. When an AI agent (Claude / OpenClaw / Hermes) would reach for this CLI vs. alternatives\n\nKeep it tight (under 350 words).`,
        }),
      });
      if (!r.body) throw new Error("no body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as { type?: string; delta?: string };
            if (evt.type === "delta" && evt.delta) { out += evt.delta; setBrief(out); }
          } catch { /* skip */ }
        }
      }
    } catch (e) { setBrief(`Error: ${String(e)}`); }
    setBriefLoading(false);
  }

  return (
    <div id="cli-anything" className="flex flex-col border-t" style={{ borderColor: `${TONE}28`, minHeight: "calc(100vh - 56px)" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Terminal size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#e0f7fa" }}>CLI-Anything Hub</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            {loading ? "Loading registry…" : `${tools.length} harnesses · agent-ready CLIs`}
          </div>
        </div>
        <a href="https://hkuds.github.io/CLI-Anything/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] transition" style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: "#e0f7fa" }}>
          <ExternalLink size={12} /> CLI-Hub
        </a>
        <button onClick={() => void load()} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }} title="Refresh">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left: tool list */}
        <div className="flex flex-col border-r overflow-hidden" style={{ width: "min(360px, 36vw)", borderColor: "var(--panel-border)" }}>
          <div className="p-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)" }}>
              <Search size={12} style={{ color: "var(--fg-dimmer)" }} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter harnesses…"
                className="flex-1 bg-transparent outline-none text-[12px]"
                style={{ color: "var(--fg)" }}
              />
            </div>
          </div>

          <div className="scroll flex-1 overflow-y-auto p-2 space-y-1">
            {note && (
              <div className="text-[11px] p-3 m-2 rounded" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                {note}
              </div>
            )}
            {filtered.map((t) => {
              const active = selected?.name === t.name;
              return (
                <button key={t.name} onClick={() => void explain(t)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition" style={{ background: active ? `${TONE}18` : "transparent", border: `1px solid ${active ? `${TONE}55` : "transparent"}`, color: active ? "#fff" : "var(--fg-dim)" }}>
                  <Package size={11} style={{ color: active ? TONE : "var(--fg-dimmer)" }} />
                  <span className="flex-1 truncate text-[12px] font-mono">{t.name}</span>
                  {t.hasSkill && <span className="text-[8px] uppercase tracking-widest px-1.5 py-[1px] rounded" style={{ background: `${TONE}18`, color: TONE }}>skill</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: briefing pane */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected && (
            <div className="flex-1 flex items-center justify-center text-center" style={{ color: "var(--fg-dimmer)" }}>
              <div>
                <Terminal size={40} style={{ opacity: 0.2, margin: "0 auto 10px" }} />
                <div className="text-[13px]">Pick a harness on the left to see install + usage.</div>
              </div>
            </div>
          )}
          {selected && (
            <>
              <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-mono font-bold" style={{ color: TONE }}>{selected.name}</div>
                  <div className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{selected.path}</div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`npx skills add HKUDS/CLI-Anything --skill ${selected.name} -g -y`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition"
                  style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: TONE }}
                >
                  <Copy size={11} /> Copy install
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 scroll">
                <div className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)" }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "var(--cream-mute)" }}>Install</div>
                  <pre className="text-[11.5px] font-mono whitespace-pre-wrap break-all" style={{ color: TONE }}>npx skills add HKUDS/CLI-Anything --skill {selected.name} -g -y</pre>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} style={{ color: TONE }} />
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>AI Briefing</h4>
                    {briefLoading && <RefreshCw size={11} className="animate-spin" style={{ color: TONE }} />}
                  </div>
                  {brief && (
                    <pre className="text-[12px] leading-relaxed whitespace-pre-wrap p-4 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono',monospace" }}>{brief}</pre>
                  )}
                  {!brief && !briefLoading && <div className="text-[11px]" style={{ color: "var(--fg-dimmer)" }}>(waiting for briefing…)</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
