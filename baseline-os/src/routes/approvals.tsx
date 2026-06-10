/**
 * Approvals — Phase 4 operator queue.
 *
 * Single-pane queue: pending on the left, full diff + approve/deny on the
 * right. History tab shows the audit ledger. Auto-refreshes every 5s so an
 * operator + the engine never drift.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, ShieldAlert, RefreshCw, AlertCircle, CheckCircle2,
  XCircle, Clock, Copy, ChevronRight,
} from "lucide-react";

const TONE = "#fbbf24";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — Baseline OS Phase 4" },
      { name: "description", content: "Approval queue, history, and audit for risk-gated tool execution." },
    ],
  }),
  component: ApprovalsPage,
});

type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "consumed";
type Risk = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";

interface ApprovalRequest {
  id: string;
  status: ApprovalStatus;
  tool_id: string;
  verb: string;
  args: Record<string, string>;
  args_fingerprint: string;
  risk_level: Risk;
  reason: string;
  requested_by: string;
  requested_at: string;
  expires_at: string;
  workspace_id: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  approval_token: string | null;        // "[ISSUED]" in list view, actual token only on /approve response
  consumed_at: string | null;
  consumed_audit_id: string | null;
  task_id: string | number | null;
  decision_id: string | null;
}

const RISK_COLOR: Record<Risk, string> = {
  LOW:     "#10b981",
  MEDIUM:  "#fbbf24",
  HIGH:    "#f97316",
  BLOCKED: "#ef4444",
};
const STATUS_COLOR: Record<ApprovalStatus, string> = {
  pending:  "#fbbf24",
  approved: "#10b981",
  consumed: "#0ea5e9",
  denied:   "#ef4444",
  expired:  "#6b7280",
};

function fmtAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 0) return `in ${Math.abs(sec)}s`;
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
function fmtExpires(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "expired";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return `<1m`;
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [q, h, s] = await Promise.all([
        fetch("/api/approvals").then((r) => r.json()),
        fetch("/api/approvals/history?limit=60").then((r) => r.json()),
        fetch("/api/approvals/stats").then((r) => r.json()),
      ]);
      setRequests(q.requests ?? []);
      setHistory(h.history ?? []);
      setStats(s.stats ?? null);
      if (!selected && (q.requests ?? []).length > 0) setSelected(q.requests[0].id);
    } catch (e: any) { setError(String(e?.message ?? e)); }
    setLoading(false);
  }, [selected]);

  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const selectedReq = useMemo(() => requests.find((r) => r.id === selected) ?? null, [requests, selected]);

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <ShieldCheck size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#fef3c7" }}>Approvals</div>
          <div className="text-[10.5px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            Baseline OS · Phase 4 ·{" "}
            <span style={{ color: STATUS_COLOR.pending }}>{stats?.pending ?? 0} pending</span> ·{" "}
            <span style={{ color: STATUS_COLOR.consumed }}>{stats?.consumed ?? 0} consumed</span> ·{" "}
            <span style={{ color: STATUS_COLOR.denied }}>{stats?.denied ?? 0} denied</span> ·{" "}
            <span style={{ color: STATUS_COLOR.expired }}>{stats?.expired ?? 0} expired</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(["queue", "history"] as const).map((t) => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} className="px-3 py-1.5 text-[11px] uppercase tracking-widest font-semibold rounded transition" style={{ background: active ? `${TONE}22` : "transparent", border: `1px solid ${active ? `${TONE}55` : "var(--panel-border)"}`, color: active ? "#fef3c7" : "var(--fg-dim)" }}>{t}{t === "queue" && pending.length > 0 ? ` (${pending.length})` : ""}</button>
            );
          })}
        </div>
        <button onClick={() => void load()} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {error && (
        <div className="mx-4 mt-3 p-3 rounded text-[11.5px] flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {tab === "queue" && (
        <div className="flex-1 flex" style={{ minHeight: 0 }}>
          <div className="flex flex-col overflow-hidden border-r" style={{ width: "min(420px, 38vw)", borderColor: "var(--panel-border)" }}>
            <div className="px-3 py-2 shrink-0 border-b text-[10px] uppercase tracking-widest" style={{ borderColor: "var(--panel-border)", color: "var(--cream-mute)" }}>
              Recent requests · newest first
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll">
              {requests.length === 0 && !loading && (
                <div className="text-center py-12 text-[11.5px]" style={{ color: "var(--fg-dimmer)" }}>No requests yet.</div>
              )}
              {requests.map((r) => {
                const active = selected === r.id;
                const statusColor = STATUS_COLOR[r.status];
                const riskColor = RISK_COLOR[r.risk_level];
                return (
                  <button key={r.id} onClick={() => setSelected(r.id)} className="w-full text-left p-3 rounded-lg transition flex items-center gap-3"
                    style={{ background: active ? `${TONE}18` : "rgba(0,0,0,0.25)", border: `1px solid ${active ? TONE : "var(--panel-border)"}` }}>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${statusColor}18`, border: `1px solid ${statusColor}55`, color: statusColor }}>
                      {r.status === "pending" && <Clock size={14} />}
                      {r.status === "approved" && <CheckCircle2 size={14} />}
                      {r.status === "consumed" && <CheckCircle2 size={14} />}
                      {r.status === "denied" && <XCircle size={14} />}
                      {r.status === "expired" && <AlertCircle size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] font-bold truncate" style={{ color: "#fff" }}>{r.tool_id}.{r.verb}</span>
                        <span className="text-[9.5px] uppercase tracking-widest font-bold px-1.5 rounded shrink-0" style={{ background: `${riskColor}22`, color: riskColor, border: `1px solid ${riskColor}44` }}>{r.risk_level}</span>
                      </div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--fg-dimmer)" }}>
                        <span style={{ color: statusColor }}>{r.status}</span>
                        <span> · </span>
                        {r.status === "pending" ? `expires ${fmtExpires(r.expires_at)}` : fmtAgo(r.decided_at ?? r.requested_at)}
                        {r.task_id != null && <> · task {r.task_id}</>}
                      </div>
                    </div>
                    <ChevronRight size={12} style={{ color: "var(--fg-dimmer)" }} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 scroll">
            {!selectedReq && (
              <div className="text-center py-20 text-[12px]" style={{ color: "var(--fg-dimmer)" }}>
                Pick a request to inspect + approve / deny.
              </div>
            )}
            {selectedReq && <RequestDetail r={selectedReq} onReload={load} />}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-5 scroll">
          <div className="max-w-3xl space-y-1.5">
            {history.length === 0 && <div className="text-[11.5px]" style={{ color: "var(--fg-dimmer)" }}>(empty)</div>}
            {[...history].reverse().map((h, i) => {
              const r = h.request ?? {};
              return (
                <div key={i} className="rounded p-2.5 flex items-center gap-3 text-[11px]" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)" }}>
                  <span className="font-mono text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{h.ts?.slice(11, 19)}</span>
                  <span className="font-bold uppercase tracking-widest text-[9.5px] px-1.5 rounded" style={{ background: `${STATUS_COLOR[h.event as ApprovalStatus] ?? "#fff"}22`, color: STATUS_COLOR[h.event as ApprovalStatus] ?? "#fff" }}>{h.event}</span>
                  <span>by <span style={{ color: TONE }}>{h.actor}</span></span>
                  <span style={{ color: "var(--fg-dim)" }}>{r.tool_id}.{r.verb}</span>
                  <span className="text-[9.5px] uppercase tracking-widest font-bold px-1.5 rounded ml-auto" style={{ background: `${RISK_COLOR[r.risk_level as Risk] ?? "#fff"}22`, color: RISK_COLOR[r.risk_level as Risk] ?? "#fff" }}>{r.risk_level}</span>
                  <span className="text-[9.5px] font-mono truncate" style={{ color: "var(--fg-dimmer)", maxWidth: 240 }}>{r.id}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestDetail({ r, onReload }: { r: ApprovalRequest; onReload: () => void }) {
  const riskColor = RISK_COLOR[r.risk_level];
  const statusColor = STATUS_COLOR[r.status];
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState<"approve" | "deny" | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  async function decide(accept: boolean) {
    if (working) return;
    setWorking(accept ? "approve" : "deny");
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(r.id)}/${accept ? "approve" : "deny"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decided_by: "operator", reason: reason || (accept ? "approved via UI" : "denied via UI") }),
      });
      const j = await res.json();
      if (j.ok && accept && j.request?.approval_token) setIssuedToken(j.request.approval_token);
      onReload();
    } catch { /* skip */ }
    setWorking(null);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${riskColor}18`, border: `1px solid ${riskColor}55`, color: riskColor }}>
          {r.risk_level === "BLOCKED" ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-lg font-bold truncate" style={{ color: "#fff" }}>{r.tool_id}.{r.verb}</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: "var(--cream-mute)" }}>{r.id}</div>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: `${statusColor}18`, border: `1px solid ${statusColor}55` }}>
          <span className="h-2 w-2 rounded-full" style={{ background: statusColor }} />
          <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: statusColor }}>{r.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="risk" value={r.risk_level} color={riskColor} />
        <KPI label="requested" value={fmtAgo(r.requested_at)} color="#fff" />
        <KPI label="expires" value={fmtExpires(r.expires_at)} color={r.status === "pending" ? "#fbbf24" : "var(--fg-dimmer)"} />
        <KPI label="task" value={String(r.task_id ?? "—")} color="#fff" />
      </div>

      <div className="panel p-4 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Engine reason</h3>
        <div className="text-[12.5px]" style={{ color: "var(--fg-dim)" }}>{r.reason}</div>
      </div>

      <div className="panel p-4 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Args (signed by fingerprint)</h3>
        <pre className="text-[11px] whitespace-pre-wrap p-3 rounded font-mono" style={{ background: "rgba(0,0,0,0.4)", color: "var(--fg-dim)", border: "1px solid var(--panel-border)" }}>{JSON.stringify(r.args, null, 2)}</pre>
        <div className="text-[10px] font-mono break-all" style={{ color: "var(--fg-dimmer)" }}>fingerprint: {r.args_fingerprint}</div>
      </div>

      {(r.decided_by || r.decided_at || r.decision_reason) && (
        <div className="panel p-4 space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Decision</h3>
          <div className="grid grid-cols-2 gap-2 text-[11.5px]">
            <KV label="decided_by" value={r.decided_by ?? "—"} />
            <KV label="decided_at" value={r.decided_at ?? "—"} />
            <KV label="reason" value={r.decision_reason ?? "—"} />
            <KV label="consumed_at" value={r.consumed_at ?? "—"} />
          </div>
        </div>
      )}

      {issuedToken && (
        <div className="panel p-4 space-y-2" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#10b981" }}>Single-use token issued — hand to the caller</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono break-all p-2 rounded" style={{ background: "rgba(0,0,0,0.5)", color: "#10b981" }}>{issuedToken}</code>
            <button onClick={() => navigator.clipboard.writeText(issuedToken)} className="p-2 rounded" style={{ color: "#10b981" }}><Copy size={12} /></button>
          </div>
          <div className="text-[10.5px]" style={{ color: "var(--cream-mute)" }}>
            Bound to args fingerprint. One-shot. Caller retries: <code>POST /api/tools/{r.tool_id}/run</code> with <code>approval_token</code>.
          </div>
        </div>
      )}

      {r.status === "pending" && (
        <div className="panel p-4 space-y-3" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.3)" }}>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#fbbf24" }}>Operator decision</h3>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (recorded in audit + posted to MC)" className="w-full px-2.5 py-2 rounded text-[12px] outline-none resize-y" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }} />
          <div className="flex gap-2">
            <button onClick={() => void decide(true)} disabled={working !== null} className="flex-1 py-2 rounded text-[12px] font-semibold transition disabled:opacity-50" style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.55)", color: "#10b981" }}>
              {working === "approve" ? "Issuing token…" : "Approve & issue token"}
            </button>
            <button onClick={() => void decide(false)} disabled={working !== null} className="flex-1 py-2 rounded text-[12px] font-semibold transition disabled:opacity-50" style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.55)", color: "#ef4444" }}>
              {working === "deny" ? "Denying…" : "Deny"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--panel-border)" }}>
      <div className="text-[9.5px] uppercase tracking-[0.18em]" style={{ color: "var(--cream-mute)" }}>{label}</div>
      <div className="text-base font-semibold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2" style={{ borderColor: "var(--panel-border)", background: "rgba(0,0,0,0.2)" }}>
      <div className="text-[9.5px] uppercase tracking-[0.15em]" style={{ color: "var(--cream-mute)" }}>{label}</div>
      <div className="text-[11.5px] truncate" style={{ color: "var(--fg)" }}>{value}</div>
    </div>
  );
}
