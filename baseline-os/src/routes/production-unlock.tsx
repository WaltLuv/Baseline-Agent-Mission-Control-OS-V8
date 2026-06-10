import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  unlockItemsByImpact,
  type ProductionImpact,
  type UnlockItem,
} from "@/lib/production-unlock";

export const Route = createFileRoute("/production-unlock")({
  head: () => ({
    meta: [
      { title: "Production Unlock Center — Baseline Automations" },
      {
        name: "description",
        content:
          "Every external system required to unlock full production functionality, with status, env vars, setup, and impact.",
      },
    ],
  }),
  component: ProductionUnlockPage,
});

const IMPACT_STYLE: Record<ProductionImpact, string> = {
  critical: "border-red-500/30 bg-red-950/20 text-red-400",
  high: "border-orange-500/30 bg-orange-950/20 text-orange-400",
  medium: "border-sky-500/30 bg-sky-950/20 text-sky-400",
  low: "border-white/10 bg-white/5 text-gray-400",
};

type Status = "configured" | "setup" | "unknown";

function ProductionUnlockPage() {
  const items = useMemo(() => unlockItemsByImpact(), []);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [probed, setProbed] = useState(false);

  // Probe the local sidecar config to mark configured items honestly.
  useEffect(() => {
    fetch("/__os_config")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setConfig(data && typeof data === "object" ? data : {}))
      .catch(() => setConfig(null))
      .finally(() => setProbed(true));
  }, []);

  const statusFor = (item: UnlockItem): Status => {
    if (!probed) return "unknown";
    if (!config) return "setup"; // sidecar unreachable → honest setup-needed
    const present = item.requiredEnvVars.some((k) => {
      const v = (config as Record<string, unknown>)[k];
      return typeof v === "string" ? v.length > 0 : Boolean(v);
    });
    return present ? "configured" : "setup";
  };

  const statuses = items.map((it) => ({ it, status: statusFor(it) }));
  const configured = statuses.filter((s) => s.status === "configured").length;
  const readiness = Math.round((configured / items.length) * 100);

  return (
    <div
      className="min-h-screen bg-[#09090D] text-white p-6 max-w-6xl mx-auto"
      data-testid="production-unlock"
    >
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.01] p-6 mb-6">
        <h1 className="text-2xl font-bold">Production Unlock Center</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-3xl">
          Every external system required to unlock full production functionality in Baseline OS.
          Each card shows status, required env vars / config keys, where it&apos;s used, what it
          unlocks, setup steps, and production-readiness impact. Status is probed from your local
          config — no fake-ready states.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${readiness}%` }}
            />
          </div>
          <span className="text-sm font-medium whitespace-nowrap">
            {configured}/{items.length} unlocked · {readiness}% ready
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {statuses.map(({ it, status }) => (
          <div
            key={it.id}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.01] p-5 flex flex-col gap-3"
            data-testid={`unlock-card-${it.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-bold text-sm">{it.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{it.whereUsed}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    status === "configured"
                      ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400"
                      : status === "setup"
                        ? "border-amber-500/30 bg-amber-950/20 text-amber-400"
                        : "border-white/10 bg-white/5 text-gray-400"
                  }`}
                  data-testid={`unlock-status-${it.id}`}
                >
                  {status === "configured"
                    ? "Configured"
                    : status === "setup"
                      ? "Setup needed"
                      : "Checking…"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${IMPACT_STYLE[it.impact]}`}
                >
                  {it.impact} impact
                </span>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">Unlocks</p>
              <ul className="text-xs text-gray-300 list-disc list-inside space-y-0.5">
                {it.featuresUnlocked.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">
                Required env / config keys
              </p>
              <div className="flex flex-wrap gap-1">
                {it.requiredEnvVars.map((v) => (
                  <code
                    key={v}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 font-mono"
                  >
                    {v}
                  </code>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400">{it.setupInstructions}</p>

            <div className="flex items-center gap-2 mt-auto pt-1">
              <a
                href="/settings"
                className="text-xs px-2.5 py-1 rounded-md border border-white/10 hover:bg-white/5 text-white"
              >
                Open Settings
              </a>
              {it.setupUrl && (
                <a
                  href={it.setupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2.5 py-1 rounded-md border border-white/10 hover:bg-white/5 text-gray-400"
                >
                  Provider site ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
