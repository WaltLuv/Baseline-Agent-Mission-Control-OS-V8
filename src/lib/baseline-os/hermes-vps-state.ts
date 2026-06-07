/**
 * Hermes VPS pairing — shared constants + the pure state machine the
 * /app/runtimes "Hermes VPS" card renders. Kept framework-free so it can be
 * unit-tested without a browser.
 *
 * Walt's directive (2026-06-06): Hermes VPS is the Primary Production
 * Controller for the 24 AI Maintenance Pipelines. It pairs through the secure
 * runtime-key + curl handshake flow — NEVER via SSH credentials stored in the
 * app. The card must never show "connected" without a real heartbeat.
 */
import type { RuntimeProjection } from './runtime-registry'

export const HERMES_VPS_KIND = 'hermes-vps' as const
export const HERMES_VPS_NAME = 'Hermes VPS'
export const HERMES_VPS_ROLE = 'Primary Production Controller'
export const HERMES_VPS_WORKSPACE_HINT = '/opt/data/profiles/slim-charles'
export const HERMES_VPS_CAPABILITIES = [
  'production-controller',
  'pipelines',
  'agent-orchestration',
  'maintenance-pipelines',
] as const
export const HERMES_VPS_DOCS = '/docs/security/VPS_HERMES_PAIRING'
export const HERMES_VPS_HARDENING_DOCS = '/docs/security/VPS_HERMES_HARDENING'

/** The six lifecycle states the card can show. */
export type HermesVpsState =
  | 'not_paired'
  | 'token_minted'
  | 'awaiting_heartbeat'
  | 'connected'
  | 'stale'
  | 'error'

export const HERMES_VPS_STATE_LABEL: Record<HermesVpsState, string> = {
  not_paired: 'Not paired',
  token_minted: 'Pairing token minted',
  awaiting_heartbeat: 'Awaiting first heartbeat',
  connected: 'Connected',
  stale: 'Stale',
  error: 'Error',
}

export interface DeriveHermesVpsInput {
  /** The runtime_registry projection for runtime_id === 'hermes-vps', if any. */
  projection: Pick<RuntimeProjection, 'status'> | null | undefined
  /** True once a pairing key has been minted in this session. */
  minted: boolean
  /** True once we've started polling for the first heartbeat (command shown). */
  polling?: boolean
}

/**
 * Single source of truth for the card's status. A runtime is only ever
 * "connected" when a real heartbeat exists (projection.status === 'healthy').
 * Before any registry row exists we distinguish "token minted" (key generated)
 * from "awaiting heartbeat" (command shown, polling for the VPS to call home).
 */
export function deriveHermesVpsState(input: DeriveHermesVpsInput): HermesVpsState {
  const { projection, minted, polling } = input
  if (projection) {
    switch (projection.status) {
      case 'healthy':
        return 'connected'
      case 'warning':
      case 'offline':
        return 'stale'
      case 'critical':
        return 'error'
    }
  }
  if (minted) return polling ? 'awaiting_heartbeat' : 'token_minted'
  return 'not_paired'
}

/** UI dot colour bucket for a given state. */
export function hermesVpsDot(state: HermesVpsState): 'connected' | 'stale' | 'disconnected' | 'not-configured' {
  if (state === 'connected') return 'connected'
  if (state === 'stale' || state === 'awaiting_heartbeat' || state === 'token_minted') return 'stale'
  if (state === 'error') return 'disconnected'
  return 'not-configured'
}
