/**
 * <RuntimeCredentialStatus />
 *
 * Single-source-of-truth credential status badge for every runtime / agent
 * page. Reads the Baseline OS sidecar /__credentials catalogue once on
 * mount and renders one of four states per provider Walt named:
 *
 *   • Connected           — credential saved + last test ok
 *   • Missing Credentials — no row for this provider yet
 *   • Needs Setup         — row exists, never verified (status=pending)
 *   • Error               — row exists, last test failed (status=error)
 *
 * Always deep-links to /settings/api-keys so the operator has a one-click
 * path from "this is broken" to "fix it" with no dead-end messages.
 */

import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export type RuntimeCredentialKind = "connected" | "missing" | "needs_setup" | "error";

type ProviderField = {
  key: string;
  label: string;
  type: "secret" | "text" | "url" | "email" | "password";
  hint?: string;
  pattern?: string;
  placeholder?: string;
  optional?: boolean;
};

type SavedView = {
  status: "pending" | "connected" | "error" | "revoked";
  mode: "bring_your_own_key" | "mission_control_credits" | "both";
  secret_preview: string | null;
  public_config: Record<string, string>;
  last_verified_at: number | null;
  last_error: string | null;
  updated_at: number;
};

type CatalogProvider = {
  id: string;
  name: string;
  category: string;
  importance: "required" | "recommended" | "optional";
  description: string;
  env_var_names: string[];
  secret_fields: ProviderField[];
  public_config_fields: ProviderField[];
  setup_url?: string;
  docs_url?: string;
  test_connection_supported: boolean;
  required_for_features: string[];
  scope: "workspace" | "user" | "local";
  mode: "bring_your_own_key" | "mission_control_credits" | "both";
  saved: SavedView | null;
};

type CatalogResponse = {
  encryption_configured: boolean;
  storage: { kind: string; path: string };
  summary: { total: number; connected: number; pending: number; error: number; missing: number };
  providers: CatalogProvider[];
};

function deriveKind(p: CatalogProvider | undefined): RuntimeCredentialKind {
  if (!p) return "missing";
  if (!p.saved) return "missing";
  if (p.saved.status === "connected") return "connected";
  if (p.saved.status === "error") return "error";
  return "needs_setup";
}

const TONE: Record<RuntimeCredentialKind, { label: string; bg: string; border: string; fg: string }> = {
  connected: {
    label: "Connected",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.45)",
    fg: "#34d399",
  },
  missing: {
    label: "Missing credentials",
    bg: "rgba(113,113,122,0.10)",
    border: "rgba(113,113,122,0.30)",
    fg: "#a1a1aa",
  },
  needs_setup: {
    label: "Needs setup",
    bg: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.45)",
    fg: "#a78bfa",
  },
  error: {
    label: "Error",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.45)",
    fg: "#fca5a5",
  },
};

function ageString(unixSeconds: number | null): string {
  if (!unixSeconds) return "never";
  const ageMs = Date.now() - unixSeconds * 1000;
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export type RuntimeCredentialStatusProps = {
  /** One or more credential catalog provider IDs (e.g. ["anthropic"], ["openai","openrouter"]). */
  providerIds: string[];
  /** Optional explicit model id to display alongside the status (display only). */
  model?: string | null;
  /** Small visual style; "inline" keeps it compact for headers. */
  variant?: "card" | "inline";
};

export function RuntimeCredentialStatus({
  providerIds,
  model,
  variant = "card",
}: RuntimeCredentialStatusProps) {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/__credentials", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CatalogResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "load failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [] as Array<{ id: string; provider?: CatalogProvider; kind: RuntimeCredentialKind }>;
    return providerIds.map((id) => {
      const p = data.providers.find((x) => x.id === id);
      return { id, provider: p, kind: deriveKind(p) };
    });
  }, [data, providerIds]);

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 flex-wrap" data-testid="runtime-credential-status-inline">
        {rows.map((r) => {
          const tone = TONE[r.kind];
          return (
            <Link
              key={r.id}
              to="/settings/api-keys"
              data-testid={`runtime-cred-pill-${r.id}`}
              className="text-[10px] uppercase tracking-[0.18em] font-semibold border rounded-full px-2 py-0.5 inline-flex items-center gap-1.5 hover:opacity-90"
              style={{ background: tone.bg, borderColor: tone.border, color: tone.fg }}
              title={`${r.provider?.name ?? r.id} · ${tone.label}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: tone.fg }}
                aria-hidden
              />
              {r.provider?.name ?? r.id} · {tone.label}
            </Link>
          );
        })}
        {model && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-mono">
            model · {model}
          </span>
        )}
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
      data-testid="runtime-credential-status-card"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-semibold">
          Credential status
        </h3>
        <Link
          to="/settings/api-keys"
          className="text-[11px] text-zinc-400 hover:text-zinc-200 underline-offset-4 hover:underline"
        >
          Manage keys →
        </Link>
      </div>

      {error && <div className="text-xs text-red-300/85">Failed to load: {error}</div>}
      {!error && !data && <div className="text-xs text-zinc-500">Loading…</div>}

      {data && (
        <ul className="space-y-2">
          {rows.map((r) => {
            const tone = TONE[r.kind];
            const verified = r.provider?.saved?.last_verified_at ?? null;
            const lastError = r.provider?.saved?.last_error;
            return (
              <li
                key={r.id}
                data-testid={`runtime-cred-row-${r.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-zinc-100 truncate">
                    {r.provider?.name ?? r.id}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Provider · {r.provider?.category ?? "—"}
                    {model ? <> · Model · <span className="font-mono text-zinc-300">{model}</span></> : null}
                  </div>
                  {r.kind === "error" && lastError && (
                    <div className="mt-1 text-[11px] text-red-300/85 font-mono line-clamp-1">
                      {lastError}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5"
                    style={{ background: tone.bg, borderColor: tone.border, color: tone.fg }}
                  >
                    {tone.label}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {r.kind === "connected" ? ageString(verified) : ""}
                  </span>
                  {(r.kind === "missing" || r.kind === "needs_setup" || r.kind === "error") && (
                    <Link
                      to="/settings/api-keys"
                      data-testid={`runtime-cred-fix-${r.id}`}
                      className="text-[11px] font-semibold rounded-md border px-2 py-0.5 hover:opacity-90"
                      style={{ background: tone.bg, borderColor: tone.border, color: tone.fg }}
                    >
                      Set up →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
