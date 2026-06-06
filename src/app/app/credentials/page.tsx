'use client'

/**
 * Credentials Manager — workspace API key / token surface.
 *
 * Renders the merged catalog + saved state from /api/credentials/catalog
 * grouped by Required / Recommended / Optional / Connected / Missing /
 * Needs Attention. No raw secret value is ever fetched or kept in state —
 * the only field we render for a saved row is the `secret_preview`.
 *
 * Auth is enforced server-side. This page is admin-only for writes; viewers
 * can browse the catalogue and see what's connected.
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type ProviderField = {
  key: string
  label: string
  type: 'secret' | 'text' | 'url' | 'email' | 'password'
  hint?: string
  pattern?: string
  placeholder?: string
  optional?: boolean
}

type SavedView = {
  status: 'pending' | 'connected' | 'error' | 'revoked'
  mode: 'mission_control_credits' | 'bring_your_own_key' | 'both'
  secret_preview: string | null
  public_config: Record<string, string>
  last_verified_at: number | null
  last_error: string | null
}

type CatalogProvider = {
  id: string
  name: string
  category: string
  importance: 'required' | 'recommended' | 'optional'
  description: string
  env_var_names: string[]
  secret_fields: ProviderField[]
  public_config_fields: ProviderField[]
  setup_url?: string
  docs_url?: string
  test_connection_supported: boolean
  required_for_features: string[]
  scope: 'workspace' | 'user' | 'local'
  mode: 'mission_control_credits' | 'bring_your_own_key' | 'both'
  saved: SavedView | null
}

type CatalogResponse = {
  encryption_configured: boolean
  summary: { total: number; connected: number; pending: number; error: number; missing: number }
  providers: CatalogProvider[]
}

type StatusFilter = 'all' | 'missing' | 'connected' | 'needs_attention'

function statusBadge(saved: SavedView | null): { label: string; tone: string } {
  if (!saved) return { label: 'Missing', tone: 'text-white/45 bg-white/[0.04] border-white/[0.08]' }
  if (saved.status === 'connected') return { label: 'Connected', tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' }
  if (saved.status === 'error') return { label: 'Needs attention', tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30' }
  if (saved.status === 'revoked') return { label: 'Revoked', tone: 'text-red-300 bg-red-500/10 border-red-500/30' }
  return { label: 'Pending verify', tone: 'text-violet-300 bg-violet-500/10 border-violet-500/30' }
}

const CATEGORY_LABELS: Record<string, string> = {
  llm: 'LLM Providers',
  agent_runtime: 'Agent / Runtime CLIs',
  creative_media: 'Creative / Media',
  productivity: 'Google / Productivity',
  communication: 'Communication',
  data_search_memory: 'Data / Search / Memory',
  billing: 'Billing / Commerce',
  devops: 'Deployment / Git / DevOps',
  vertical_api: 'Vertical APIs',
}

export default function CredentialsPage() {
  const [data, setData] = useState<CatalogResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [publicConfig, setPublicConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/credentials/catalog', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CatalogResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.providers.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (status === 'missing' && p.saved) return false
      if (status === 'connected' && p.saved?.status !== 'connected') return false
      if (status === 'needs_attention' && p.saved?.status !== 'error') return false
      return true
    })
  }, [data, category, status])

  const active = useMemo(
    () => (activeProvider ? filtered.find((p) => p.id === activeProvider) ?? null : null),
    [activeProvider, filtered],
  )

  async function saveActive() {
    if (!active) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/credentials/${active.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secrets, public_config: publicConfig }),
      })
      const json = await res.json().catch(() => ({})) as { error?: string; code?: string; hint?: string }
      if (!res.ok) {
        const hint = json.hint ? ` — ${json.hint}` : ''
        setSaveError(`${json.error ?? `HTTP ${res.status}`}${hint}`)
        return
      }
      setSecrets({})
      setPublicConfig({})
      await reload()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteActive() {
    if (!active) return
    if (!confirm(`Delete the ${active.name} credential for this workspace?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/credentials/${active.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setSaveError(json.error ?? `HTTP ${res.status}`)
        return
      }
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const encryptionWarning = data && !data.encryption_configured

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased" data-testid="credentials-page">
      <main className="mx-auto max-w-screen-xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">API Keys &amp; Credentials</h1>
          <p className="mt-2 text-sm text-white/55 max-w-2xl">
            Connect your own providers so your workforce can run with your tools, models, and accounts.
          </p>
          {data && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/55" data-testid="credentials-summary">
              <span><strong className="text-white">{data.summary.connected}</strong> connected</span>
              <span>·</span>
              <span><strong className="text-white">{data.summary.missing}</strong> missing</span>
              <span>·</span>
              <span><strong className="text-white">{data.summary.error}</strong> need attention</span>
              <span>·</span>
              <span><strong className="text-white">{data.summary.total}</strong> providers in catalog</span>
            </div>
          )}
          {encryptionWarning && (
            <div
              data-testid="credentials-encryption-warning"
              className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200"
            >
              <strong>Storage blocked.</strong> Set <code className="text-amber-100 bg-amber-500/10 px-1 rounded">CREDENTIALS_ENCRYPTION_KEY</code>{' '}
              (64-char hex or a strong passphrase) before saving any secret. The catalog is read-only until then.
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200">
              Could not load catalog: {error}
            </div>
          )}
        </header>

        {/* Filters */}
        <section className="mb-6 flex flex-wrap items-center gap-3" data-testid="credentials-filters">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="credentials-filter-category"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm px-3 py-1.5"
          >
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            data-testid="credentials-filter-status"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm px-3 py-1.5"
          >
            <option value="all">All statuses</option>
            <option value="missing">Missing only</option>
            <option value="connected">Connected only</option>
            <option value="needs_attention">Needs attention</option>
          </select>
        </section>

        {/* Catalog grid */}
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="credentials-grid">
          {filtered.map((p) => {
            const badge = statusBadge(p.saved)
            return (
              <button
                type="button"
                key={p.id}
                data-testid={`credential-card-${p.id}`}
                onClick={() => {
                  setActiveProvider(p.id)
                  setSecrets({})
                  setPublicConfig(p.saved?.public_config ?? {})
                  setSaveError(null)
                }}
                className="text-left rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.18] transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{p.name}</h3>
                    <p className="text-[11px] text-white/40 mt-0.5">{CATEGORY_LABELS[p.category] ?? p.category}</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 ${badge.tone}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-[12px] text-white/55 leading-relaxed line-clamp-2">{p.description}</p>
                {p.saved?.secret_preview && (
                  <p className="mt-2 text-[11px] text-white/40 font-mono" data-testid={`credential-preview-${p.id}`}>
                    {p.saved.secret_preview}
                  </p>
                )}
                {p.required_for_features.length > 0 && (
                  <p className="mt-2 text-[11px] text-white/45">
                    Unlocks: {p.required_for_features.slice(0, 2).join(', ')}{p.required_for_features.length > 2 ? '…' : ''}
                  </p>
                )}
              </button>
            )
          })}
        </section>

        {/* Provider drawer */}
        {active && (
          <div
            className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-4"
            onClick={() => setActiveProvider(null)}
            data-testid="credentials-drawer"
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-white/[0.1] bg-[#0c0c10] p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{active.name}</h2>
                  <p className="text-[11px] text-white/45 mt-1">{CATEGORY_LABELS[active.category] ?? active.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveProvider(null)}
                  className="text-white/45 hover:text-white text-sm"
                  data-testid="credentials-drawer-close"
                >
                  Close
                </button>
              </header>

              <p className="text-sm text-white/65 leading-relaxed">{active.description}</p>

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
                <p className="mt-3 text-[11px] text-white/45">
                  Env var fallback: <code className="text-white/70">{active.env_var_names.join(', ')}</code>
                </p>
              )}

              {active.required_for_features.length > 0 && (
                <div className="mt-3 text-[12px] text-white/60">
                  <strong className="text-white/80">Unlocks:</strong> {active.required_for_features.join(' · ')}
                </div>
              )}

              {/* Secret fields */}
              {active.secret_fields.length > 0 && (
                <section className="mt-5 space-y-3" data-testid="credentials-secret-fields">
                  {active.secret_fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-[11px] uppercase tracking-wider text-white/45 font-mono">
                        {f.label} {f.optional && '(optional)'}
                      </span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder={f.placeholder ?? (active.saved?.secret_preview ? active.saved.secret_preview : '')}
                        value={secrets[f.key] ?? ''}
                        onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))}
                        data-testid={`credentials-secret-${f.key}`}
                        className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-sm font-mono"
                      />
                      {f.hint && <span className="text-[11px] text-white/40 mt-1 block">{f.hint}</span>}
                    </label>
                  ))}
                </section>
              )}

              {/* Public config fields */}
              {active.public_config_fields.length > 0 && (
                <section className="mt-5 space-y-3" data-testid="credentials-public-fields">
                  {active.public_config_fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-[11px] uppercase tracking-wider text-white/45 font-mono">
                        {f.label} {f.optional && '(optional)'}
                      </span>
                      <input
                        type="text"
                        placeholder={f.placeholder ?? ''}
                        value={publicConfig[f.key] ?? ''}
                        onChange={(e) => setPublicConfig((s) => ({ ...s, [f.key]: e.target.value }))}
                        data-testid={`credentials-public-${f.key}`}
                        className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-sm"
                      />
                    </label>
                  ))}
                </section>
              )}

              {saveError && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200" data-testid="credentials-save-error">
                  {saveError}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!active.saved || saving}
                  onClick={deleteActive}
                  data-testid="credentials-delete"
                  className="text-sm text-red-300/80 hover:text-red-300 disabled:opacity-40"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled={saving || (encryptionWarning ?? false)}
                  onClick={saveActive}
                  data-testid="credentials-save"
                  className="h-10 px-5 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 disabled:opacity-40"
                >
                  {saving ? 'Saving…' : active.saved ? 'Update' : 'Save credential'}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="mt-10 text-xs text-white/40 max-w-2xl">
          Stored credentials are encrypted at rest with AES-256-GCM. Mission Control never returns raw secret values from any API. The preview row (e.g. <code className="text-white/70">sk-…abcd</code>) is the only fragment visible after save.{' '}
          <Link href="/app/runtimes" className="underline hover:text-white/70">Runtime registry →</Link>
        </p>
      </main>
    </div>
  )
}
