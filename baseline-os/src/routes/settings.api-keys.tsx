import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────
// Baseline OS — API Keys / Credentials Manager
//
// Walt's rule for local Baseline OS: "Bring Your Own Keys by default."
// All storage goes through the sidecar /__credentials endpoint, which
// writes ~/.claude-os/credentials.local.json (mode 0600). The browser
// never sees raw secret values for saved rows — only the masked preview
// (sk-…abcd).
// ─────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/settings/api-keys")({
  head: () => ({
    meta: [
      { title: "API Keys — Baseline OS" },
      { name: "description", content: "Bring your own API keys for every provider Baseline OS supports." },
    ],
  }),
  component: ApiKeysPage,
});

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

const CATEGORY_LABELS: Record<string, string> = {
  llm: "LLM Providers",
  agent_runtime: "Agent / Runtime CLIs",
  creative_media: "Creative / Media",
  productivity: "Google / Productivity",
  communication: "Communication",
  data_search_memory: "Data / Search / Memory",
  billing: "Billing / Commerce",
  devops: "Deployment / Git / DevOps",
  vertical_api: "Vertical APIs",
};

function statusLabel(saved: SavedView | null): { label: string; tone: string } {
  if (!saved) return { label: "Missing", tone: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" };
  if (saved.status === "connected") return { label: "Connected", tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
  if (saved.status === "error") return { label: "Needs attention", tone: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
  if (saved.status === "revoked") return { label: "Revoked", tone: "text-red-300 bg-red-500/10 border-red-500/30" };
  return { label: "Pending verify", tone: "text-violet-300 bg-violet-500/10 border-violet-500/30" };
}

function ApiKeysPage() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "missing" | "connected" | "needs_attention">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [publicConfig, setPublicConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/__credentials", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.providers.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (statusFilter === "missing" && p.saved) return false;
      if (statusFilter === "connected" && p.saved?.status !== "connected") return false;
      if (statusFilter === "needs_attention" && p.saved?.status !== "error") return false;
      return true;
    });
  }, [data, category, statusFilter]);

  const active = useMemo(
    () => (activeId ? filtered.find((p) => p.id === activeId) ?? null : null),
    [activeId, filtered],
  );

  async function saveActive() {
    if (!active) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/__credentials/${active.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secrets, public_config: publicConfig }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSaveError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setSecrets({});
      setPublicConfig({});
      await reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteActive() {
    if (!active) return;
    if (!confirm(`Delete ${active.name}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/__credentials/${active.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaveError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-screen-xl mx-auto" data-testid="settings-api-keys-page">
      <header className="mb-8">
        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Baseline OS · BYOK</div>
        <h1 className="text-2xl font-semibold">API Keys &amp; Credentials</h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
          Connect your own providers so your workforce can run with your tools, models, and accounts.
          Stored locally at <code className="text-zinc-300">{data?.storage.path ?? "~/.claude-os/credentials.local.json"}</code> (mode 0600).
        </p>
        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400" data-testid="api-keys-summary">
            <span><strong className="text-white">{data.summary.connected}</strong> connected</span>
            <span>·</span>
            <span><strong className="text-white">{data.summary.missing}</strong> missing</span>
            <span>·</span>
            <span><strong className="text-white">{data.summary.error}</strong> need attention</span>
            <span>·</span>
            <span><strong className="text-white">{data.summary.total}</strong> providers in catalog</span>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200">
            Could not load catalog: {error}
          </div>
        )}
      </header>

      <section className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          data-testid="api-keys-filter-category"
          className="rounded-lg border border-zinc-700 bg-zinc-900/60 text-sm px-3 py-1.5"
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          data-testid="api-keys-filter-status"
          className="rounded-lg border border-zinc-700 bg-zinc-900/60 text-sm px-3 py-1.5"
        >
          <option value="all">All statuses</option>
          <option value="missing">Missing only</option>
          <option value="connected">Connected only</option>
          <option value="needs_attention">Needs attention</option>
        </select>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="api-keys-grid">
        {filtered.map((p) => {
          const badge = statusLabel(p.saved);
          return (
            <button
              type="button"
              key={p.id}
              data-testid={`api-key-card-${p.id}`}
              onClick={() => {
                setActiveId(p.id);
                setSecrets({});
                setPublicConfig(p.saved?.public_config ?? {});
                setSaveError(null);
              }}
              className="text-left rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate">{p.name}</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{CATEGORY_LABELS[p.category] ?? p.category}</p>
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 ${badge.tone}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-2">{p.description}</p>
              {p.saved?.secret_preview && (
                <p className="mt-2 text-[11px] text-zinc-500 font-mono" data-testid={`api-key-preview-${p.id}`}>
                  {p.saved.secret_preview}
                </p>
              )}
            </button>
          );
        })}
      </section>

      {active && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-4"
          onClick={() => setActiveId(null)}
          data-testid="api-keys-drawer"
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-950 p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">{active.name}</h2>
                <p className="text-[11px] text-zinc-500 mt-1">{CATEGORY_LABELS[active.category] ?? active.category}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
                data-testid="api-keys-drawer-close"
              >
                Close
              </button>
            </header>

            <p className="text-sm text-zinc-300 leading-relaxed">{active.description}</p>

            {active.setup_url && (
              <a
                href={active.setup_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200"
              >
                Get a key ↗
              </a>
            )}

            {active.env_var_names.length > 0 && (
              <p className="mt-3 text-[11px] text-zinc-500">
                Env var fallback: <code className="text-zinc-300">{active.env_var_names.join(", ")}</code>
              </p>
            )}

            {active.required_for_features.length > 0 && (
              <div className="mt-3 text-[12px] text-zinc-400">
                <strong className="text-zinc-200">Unlocks:</strong> {active.required_for_features.join(" · ")}
              </div>
            )}

            {active.secret_fields.length > 0 && (
              <section className="mt-5 space-y-3">
                {active.secret_fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-mono">
                      {f.label} {f.optional && "(optional)"}
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder={f.placeholder ?? (active.saved?.secret_preview ?? "")}
                      value={secrets[f.key] ?? ""}
                      onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))}
                      data-testid={`api-keys-secret-${f.key}`}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm font-mono"
                    />
                    {f.hint && <span className="text-[11px] text-zinc-500 mt-1 block">{f.hint}</span>}
                  </label>
                ))}
              </section>
            )}

            {active.public_config_fields.length > 0 && (
              <section className="mt-5 space-y-3">
                {active.public_config_fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-mono">
                      {f.label} {f.optional && "(optional)"}
                    </span>
                    <input
                      type="text"
                      placeholder={f.placeholder ?? ""}
                      value={publicConfig[f.key] ?? ""}
                      onChange={(e) => setPublicConfig((s) => ({ ...s, [f.key]: e.target.value }))}
                      data-testid={`api-keys-public-${f.key}`}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </section>
            )}

            {saveError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200">
                {saveError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={!active.saved || saving}
                onClick={deleteActive}
                data-testid="api-keys-delete"
                className="text-sm text-red-300/80 hover:text-red-300 disabled:opacity-40"
              >
                Delete
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveActive}
                data-testid="api-keys-save"
                className="h-10 px-5 rounded-lg bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40"
              >
                {saving ? "Saving…" : active.saved ? "Update" : "Save credential"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-10 text-xs text-zinc-500 max-w-2xl">
        Local-first: Baseline OS does not transmit credentials anywhere. The sidecar writes the
        credentials file with mode 0600 (owner read/write only). Restart the dev server after
        adding keys so agent backends pick them up from <code>process.env</code>.
      </p>
    </div>
  );
}
