/**
 * Workspace Capability Matrix — the single source of truth for why something
 * can or cannot execute in a workspace.
 *
 * Reads REAL state: the encrypted credential store (workspace-scoped) + the
 * ecosystem app config. Runtime capabilities default to honest "needs runtime"
 * / "offline" — NEVER a fake connected state. Each row carries the blocker and
 * the exact action (+ link) that fixes it.
 */
import { listCredentials } from '@/lib/credentials/store'
import { ECOSYSTEM_APPS, resolveEcosystemApp, type EcosystemStatus } from '@/lib/ecosystem/apps'

export type CapabilityStatus =
  | 'ready'
  | 'connected'
  | 'workflow_ready'
  | 'api_connected'
  | 'browser_automation_ready'
  | 'visible_only'
  | 'needs_credentials'
  | 'needs_runtime'
  | 'setup_needed'
  | 'offline'

export type CapabilityGroup = 'core' | 'runtimes' | 'ecosystem' | 'integrations'

export interface CapabilityRow {
  id: string
  label: string
  group: CapabilityGroup
  status: CapabilityStatus
  blocker: string | null
  fixAction: string | null
  link: string | null
  lastChecked: number
  workspaceId: number
}

/** Credential-backed integrations: capability id → provider id + fix link. */
const CREDENTIAL_CAPS: Array<{ id: string; label: string; provider: string; link: string }> = [
  { id: 'twilio', label: 'Twilio (SMS/Voice)', provider: 'twilio', link: '/app/credentials' },
  { id: 'email', label: 'Email (Resend)', provider: 'resend', link: '/app/credentials' },
  { id: 'stripe', label: 'Stripe', provider: 'stripe', link: '/app/credentials' },
  { id: 'pinecone', label: 'Pinecone', provider: 'pinecone', link: '/app/credentials' },
  { id: 'google_oauth', label: 'Google OAuth', provider: 'google_oauth', link: '/app/credentials' },
]

/** Runtimes default to honest needs-runtime until a runtime/Flight Deck connects. */
const RUNTIME_CAPS: Array<{ id: string; label: string }> = [
  { id: 'hermes', label: 'Hermes Runtime' },
  { id: 'claude_code', label: 'Claude Code Runtime' },
  { id: 'codex', label: 'Codex Runtime' },
  { id: 'openclaw', label: 'OpenClaw Runtime' },
  { id: 'opencode', label: 'Opencode Runtime' },
  { id: 'browser_automation', label: 'Browser Automation' },
  { id: 'computer_use', label: 'Computer Use' },
]

const ECO_TO_CAP: Record<EcosystemStatus, CapabilityStatus> = {
  api_connected: 'api_connected',
  workflow_ready: 'workflow_ready',
  browser_automation_ready: 'browser_automation_ready',
  visible_only: 'visible_only',
  needs_credentials: 'needs_credentials',
  blocked_by_iframe_policy: 'setup_needed',
  setup_needed: 'setup_needed',
}

export interface CapabilityMatrixOptions {
  /** Whether a Flight Deck device is paired + online for this workspace. */
  flightDeckOnline?: boolean
  env?: NodeJS.ProcessEnv
  now?: number
}

export function computeCapabilityMatrix(workspaceId: number, opts: CapabilityMatrixOptions = {}): CapabilityRow[] {
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const env = opts.env ?? process.env
  const rows: CapabilityRow[] = []
  const base = (id: string, label: string, group: CapabilityGroup, status: CapabilityStatus, blocker: string | null, fixAction: string | null, link: string | null): CapabilityRow =>
    ({ id, label, group, status, blocker, fixAction, link, lastChecked: now, workspaceId })

  // ── Core (Mission-Control-native; always available) ──
  rows.push(base('mc_native_workflows', 'Mission Control Native Workflows', 'core', 'workflow_ready', null, null, null))
  rows.push(base('pi_agent_harness', 'PI Agent Harness', 'core', 'ready', null, null, '/app/pi-agent'))
  rows.push(base('graphify', 'Graphify', 'core', 'ready', null, null, null))
  rows.push(base('knowledge_os', 'Knowledge OS', 'core', 'ready', null, null, null))

  // ── Credential-backed integrations (real store read) ──
  let credStatus = new Map<string, string>()
  try {
    for (const c of listCredentials(workspaceId)) credStatus.set(c.provider_id, c.status)
  } catch {
    credStatus = new Map()
  }
  for (const c of CREDENTIAL_CAPS) {
    const st = credStatus.get(c.provider)
    if (st === 'connected') {
      rows.push(base(c.id, c.label, 'integrations', 'connected', null, null, c.link))
    } else if (st === 'pending' || st === 'error') {
      rows.push(base(c.id, c.label, 'integrations', 'needs_credentials', `Credential ${st === 'error' ? 'failed verification' : 'unverified'}.`, 'Re-test the connection', c.link))
    } else {
      rows.push(base(c.id, c.label, 'integrations', 'needs_credentials', 'No credential saved for this workspace.', `Add ${c.label} in Credentials`, c.link))
    }
  }

  // ── Runtimes (honest defaults — no fake green) ──
  for (const r of RUNTIME_CAPS) {
    if (r.id === 'browser_automation' || r.id === 'computer_use') {
      rows.push(base(r.id, r.label, 'runtimes', 'needs_runtime', 'Browser/Computer-Use runtime not connected.', 'Connect Browser Use or pair Flight Deck', '/app/flight-deck'))
    } else {
      rows.push(base(r.id, r.label, 'runtimes', 'needs_runtime', `${r.label} not connected.`, `Connect ${r.label} (Flight Deck or runtime registry)`, '/app/runtimes'))
    }
  }
  // Flight Deck — paired device evidence only.
  rows.push(
    opts.flightDeckOnline
      ? base('flight_deck', 'Flight Deck', 'runtimes', 'connected', null, null, '/app/flight-deck')
      : base('flight_deck', 'Flight Deck', 'runtimes', 'setup_needed', 'No paired device online for this workspace.', 'Pair a device in Flight Deck', '/app/flight-deck'),
  )

  // ── Ecosystem apps (env config + status) ──
  for (const app of ECOSYSTEM_APPS) {
    const resolved = resolveEcosystemApp(app, env)
    rows.push(
      base(
        `eco_${app.id}`,
        app.name,
        'ecosystem',
        ECO_TO_CAP[resolved.status],
        resolved.setupNeeded[0] ?? null,
        resolved.setupNeeded.length ? 'Configure app URL/credentials' : null,
        '/app/ecosystem',
      ),
    )
  }

  return rows
}

/** Convenience: is a given capability id usable for execution right now? */
const EXECUTABLE: Set<CapabilityStatus> = new Set(['ready', 'connected', 'workflow_ready', 'api_connected', 'browser_automation_ready'])
export function capabilityReady(rows: CapabilityRow[], id: string): boolean {
  const row = rows.find((r) => r.id === id)
  return !!row && EXECUTABLE.has(row.status)
}
