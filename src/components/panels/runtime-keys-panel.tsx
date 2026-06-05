'use client'

/**
 * RuntimeKeysPanel — customer-facing UI to mint MC_API_KEY for an agent.
 *
 * Previously: backend POST /api/agents/{id}/keys existed; no browser flow.
 * Now: pick an agent → name the key → choose expiry → mint. Key is shown
 * ONCE in a clear "copy me — this is the only time you'll see it" block.
 *
 * Recommended scopes for unattended daemons: viewer + operator + agent:self
 * + agent:heartbeat. That's the default; the customer doesn't have to
 * understand the scope vocabulary.
 *
 * Admin-only (matches the backend role gate).
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Agent = {
  id: number
  name: string
  framework?: string | null
  runtime_type?: string | null
  status?: string | null
  last_seen?: number | null
}

type ApiKey = {
  id: number
  name: string
  key_prefix: string
  scopes: string[]
  created_at: number
  expires_at: number | null
  revoked_at: number | null
  last_used_at: number | null
}

const DEFAULT_SCOPES = ['viewer', 'operator', 'agent:self', 'agent:heartbeat']

export function RuntimeKeysPanel() {
  const [me, setMe] = useState<{ workspace_id: number; role: string } | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mintForm, setMintForm] = useState({ name: '', expires_in_days: 365 })
  const [minting, setMinting] = useState(false)
  const [freshKey, setFreshKey] = useState<{ key_prefix: string; api_key: string; agent: Agent } | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .catch((e) => setError(e.message))
  }, [])

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/agents', { cache: 'no-store' })
      const d = await r.json()
      const list: Agent[] = (d.agents || []).filter((a: Agent) => !!a.id && !!a.name)
      setAgents(list)
      if (list.length > 0 && selectedAgentId === null) setSelectedAgentId(list[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [selectedAgentId])

  const loadKeys = useCallback(async (agentId: number) => {
    const r = await fetch(`/api/agents/${agentId}/keys`, { cache: 'no-store' })
    if (!r.ok) {
      setKeys([])
      return
    }
    const d = await r.json()
    setKeys(d.keys || [])
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])
  useEffect(() => {
    if (selectedAgentId) loadKeys(selectedAgentId)
  }, [selectedAgentId, loadKeys])

  const isAdmin = me?.role === 'admin'
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null

  const mintKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgent || !mintForm.name.trim() || minting) return
    setMinting(true)
    setFreshKey(null)
    setFeedback(null)
    try {
      const r = await fetch(`/api/agents/${selectedAgent.id}/keys`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: mintForm.name.trim(),
          scopes: DEFAULT_SCOPES,
          expires_in_days: Math.max(1, Math.min(mintForm.expires_in_days, 3650)),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setFeedback({ ok: false, text: d.error || `Mint failed (${r.status})` })
        return
      }
      setFreshKey({ key_prefix: d.key.key_prefix, api_key: d.api_key, agent: selectedAgent })
      setMintForm({ name: '', expires_in_days: 365 })
      loadKeys(selectedAgent.id)
      setFeedback({ ok: true, text: 'Key minted — copy it now, you will not see it again.' })
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof Error ? err.message : 'Mint failed' })
    } finally {
      setMinting(false)
    }
  }

  const revoke = async (keyId: number) => {
    if (!selectedAgent) return
    if (!confirm('Revoke this key? Any daemon using it will be rejected immediately.')) return
    const r = await fetch(`/api/agents/${selectedAgent.id}/keys`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key_id: keyId }),
    })
    if (r.ok) {
      loadKeys(selectedAgent.id)
      setFeedback({ ok: true, text: 'Key revoked' })
    } else {
      setFeedback({ ok: false, text: 'Revoke failed' })
    }
  }

  const copyKey = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setFeedback({ ok: true, text: 'Key copied to clipboard' })
    } catch {
      setFeedback({ ok: false, text: 'Copy blocked — long-press / right-click the key above' })
    }
  }

  if (!me && !error) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>
  }
  if (error) {
    return <div className="p-8 text-sm text-red-400" data-testid="runtime-keys-error">{error}</div>
  }

  return (
    <div className="p-4 space-y-6" data-testid="runtime-keys-panel">
      <header>
        <h1 className="text-xl font-semibold text-foreground" data-testid="runtime-keys-title">Runtime API keys</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Long-lived MC_API_KEY values for unattended daemons (Hermes / OpenClaw / Claude Code / Codex).
          Use these instead of browser session cookies.
        </p>
      </header>

      {feedback && (
        <div
          data-testid="runtime-keys-feedback"
          className={`rounded-md px-3 py-2 text-sm border ${
            feedback.ok ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-4 space-y-3" data-testid="runtime-keys-mint-section">
        <h2 className="text-sm font-medium">Mint a key</h2>
        {loading && <p className="text-xs text-muted-foreground">Loading agents…</p>}
        {!loading && agents.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No agents yet — register one first via the <code className="px-1 bg-muted rounded">connect-runtime.mjs</code> script
            or the runtime registry page.
          </p>
        )}
        {!loading && agents.length > 0 && (
          <form onSubmit={mintKey} className="space-y-3">
            <div>
              <label htmlFor="key-agent" className="block text-xs text-muted-foreground mb-1">Agent</label>
              <select
                id="key-agent"
                data-testid="key-agent-select"
                value={selectedAgentId ?? ''}
                onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.framework ? `(${a.framework})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="key-name" className="block text-xs text-muted-foreground mb-1">Key label</label>
                <input
                  id="key-name"
                  data-testid="key-name-input"
                  required
                  value={mintForm.name}
                  onChange={(e) => setMintForm({ ...mintForm, name: e.target.value })}
                  placeholder="e.g. vps-1-hermes"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="key-expiry" className="block text-xs text-muted-foreground mb-1">Expires in (days)</label>
                <input
                  id="key-expiry"
                  data-testid="key-expiry-input"
                  type="number"
                  min={1}
                  max={3650}
                  value={mintForm.expires_in_days}
                  onChange={(e) => setMintForm({ ...mintForm, expires_in_days: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={!isAdmin || !mintForm.name || minting}
              data-testid="mint-key-button"
            >
              {minting ? 'Minting…' : isAdmin ? 'Mint key' : 'Admins only'}
            </Button>
          </form>
        )}
      </section>

      {freshKey && (
        <section
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3"
          data-testid="fresh-key-block"
        >
          <div className="text-amber-200 font-medium">
            Copy this key now — Mission Control will never show it again.
          </div>
          <div className="font-mono break-all text-amber-100 text-sm bg-black/30 rounded p-2" data-testid="fresh-key-value">
            {freshKey.api_key}
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => copyKey(freshKey.api_key)} data-testid="copy-fresh-key-button">
              Copy key
            </Button>
            <Button type="button" variant="outline" onClick={() => setFreshKey(null)} data-testid="dismiss-fresh-key-button">
              I&apos;ve copied it
            </Button>
          </div>
          <pre className="text-xs text-amber-100 bg-black/40 rounded p-2 overflow-x-auto">
{`MC_URL=$(your-mission-control-url)
MC_API_KEY=${freshKey.api_key}
RUNTIME_NAME=${freshKey.agent.name}
RUNTIME_TYPE=${freshKey.agent.framework || freshKey.agent.runtime_type || 'hermes'}
node scripts/connect-runtime.mjs`}
          </pre>
        </section>
      )}

      {selectedAgent && (
        <section className="rounded-lg border border-border bg-card" data-testid="runtime-keys-existing-list">
          <header className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            Existing keys for {selectedAgent.name}
          </header>
          {keys.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No keys yet for this agent.</div>
          ) : (
            <ul className="divide-y divide-border">
              {keys.map((k) => {
                const revoked = !!k.revoked_at
                const expired = !!(k.expires_at && k.expires_at * 1000 < Date.now())
                return (
                  <li key={k.id} className="flex items-center justify-between px-4 py-2 text-sm" data-testid={`existing-key-${k.id}`}>
                    <div>
                      <div className="font-medium">{k.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {k.key_prefix}… · created {new Date(k.created_at * 1000).toLocaleDateString()}
                        {k.expires_at ? ` · expires ${new Date(k.expires_at * 1000).toLocaleDateString()}` : ' · no expiry'}
                        {k.last_used_at ? ` · last used ${new Date(k.last_used_at * 1000).toLocaleString()}` : ' · never used'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {revoked && <span className="text-xs px-2 py-0.5 rounded border border-red-500/30 bg-red-500/15 text-red-300">revoked</span>}
                      {!revoked && expired && <span className="text-xs px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/15 text-amber-300">expired</span>}
                      {!revoked && !expired && isAdmin && (
                        <Button type="button" variant="outline" onClick={() => revoke(k.id)} data-testid={`revoke-key-${k.id}`}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <footer className="text-xs text-muted-foreground space-y-1" data-testid="runtime-keys-footer">
        <div>
          Need the connector? See <code className="px-1 rounded bg-muted">scripts/connect-runtime.mjs</code> or the Runtime Setup Guide.
        </div>
        <div>
          The Flight Deck desktop terminal also uses these keys to attach to this Mission Control workspace —
          paste a freshly-minted key into Flight Deck&apos;s &ldquo;Add workspace&rdquo; dialog.{' '}
          <a href="/flight-deck" className="underline hover:text-foreground" data-testid="runtime-keys-flight-deck-link">
            Install Flight Deck →
          </a>
        </div>
      </footer>
    </div>
  )
}
