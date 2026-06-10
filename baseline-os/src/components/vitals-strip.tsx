/**
 * VitalsStrip — Agent health status tiles shown at top of home page.
 * Polls /__vitals every 10s for live status.
 */

import { useEffect, useState } from "react";
import { Sparkles, Box, Cpu, Activity, Zap } from "lucide-react";
import type { ReactNode } from "react";

interface VitalsData {
  claude: { ok: boolean; version: string; latencyMs: number };
  openclaw: { ok: boolean; agents: number; latencyMs: number };
  hermes: { ok: boolean; model: string; provider: string; latencyMs: number };
}

function VitalTile({
  label, icon, primary, sub, status, href,
}: {
  label: string;
  icon: ReactNode;
  primary: ReactNode;
  sub?: string;
  status: "ok" | "warn" | "err" | "info";
  href?: string;
}) {
  const inner = (
    <div
      className="vital-tile transition"
      style={{ cursor: href ? "pointer" : "default" }}
    >
      <div className="flex items-center justify-between">
        <span className="k flex items-center gap-1.5">
          <span style={{ color: "var(--gold)" }}>{icon}</span>
          {label}
        </span>
        <span className={`status-dot ${status}`} />
      </div>
      <div className="v">{primary}</div>
      {sub && <div className="sub truncate">{sub}</div>}
    </div>
  );
  if (href) return <a href={href} className="block">{inner}</a>;
  return inner;
}

export function VitalsStrip() {
  const [data, setData] = useState<VitalsData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    const fetchIt = async () => {
      try {
        const r = await fetch("/__vitals", { cache: "no-store" });
        if (r.ok) {
          const v = await r.json() as VitalsData;
          if (!stop) setData(v);
        }
      } catch { /* ignore */ }
    };
    fetchIt();
    const t = setInterval(() => {
      fetchIt();
      setTick((n) => n + 1);
    }, 10_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const totalLatency = data
    ? data.claude.latencyMs + data.openclaw.latencyMs + data.hermes.latencyMs
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <VitalTile
        label="Claude Code"
        icon={<Sparkles size={12} />}
        primary={data?.claude.ok ? "Online" : "…"}
        sub={data ? `${data.claude.version.slice(0, 20)} · ${data.claude.latencyMs}ms` : "checking…"}
        status={data?.claude.ok ? "ok" : "warn"}
        href="/"
      />
      <VitalTile
        label="OpenClaw"
        icon={<Box size={12} />}
        primary={data?.openclaw.ok ? "Ready" : data ? "Offline" : "…"}
        sub={data ? `${data.openclaw.agents} agents · ${data.openclaw.latencyMs}ms` : "checking…"}
        status={data?.openclaw.ok ? "ok" : "err"}
        href="/agents/openclaw"
      />
      <VitalTile
        label="Hermes"
        icon={<Cpu size={12} />}
        primary={data?.hermes.ok ? "Online" : data ? "Offline" : "…"}
        sub={data ? `${data.hermes.model.split("/").pop()} · ${data.hermes.provider}` : "checking…"}
        status={data?.hermes.ok ? "ok" : "warn"}
        href="/agents/hermes"
      />
      <VitalTile
        label="Heartbeat"
        icon={<Activity size={12} />}
        primary={<><em>{tick}</em></>}
        sub="poll · 10s"
        status="info"
      />
      <VitalTile
        label="Latency"
        icon={<Zap size={12} />}
        primary={
          data ? (
            <>
              {totalLatency}
              <span style={{ color: "var(--cream-dim)", fontSize: "0.7em", marginLeft: "2px" }}>ms</span>
            </>
          ) : "…"}
        sub="combined p50"
        status="ok"
      />
    </div>
  );
}
