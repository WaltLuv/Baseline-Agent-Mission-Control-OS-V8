/**
 * Agent Gateway client — server-side wrapper around the FastMCP gateway's
 * HTTP control plane.
 *
 * Single source of truth for:
 *   - resolving the gateway URL (env-driven, no defaults that surprise)
 *   - forwarding the operator's API key
 *   - 5s timeout so a slow/offline gateway never wedges a Mission Control
 *     route handler
 *
 * All callers should go through here; do not fetch the gateway directly from
 * routes.
 */

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8765'
const FETCH_TIMEOUT_MS = 5000

export type GatewayUnreachable = {
  ok: false
  reachable: false
  status: number
  error: string
  gatewayUrl: string
}

export type GatewayResponse<T> =
  | { ok: true; reachable: true; status: number; data: T; gatewayUrl: string }
  | { ok: false; reachable: true; status: number; data: any; gatewayUrl: string }
  | GatewayUnreachable

export function getGatewayUrl(): string {
  const raw = (process.env.AGENT_GATEWAY_URL || DEFAULT_GATEWAY_URL).trim()
  return raw.replace(/\/+$/, '')
}

export function getGatewayApiKey(): string {
  // The gateway accepts the SAME api key Mission Control hands out to
  // operators. Either AGENT_GATEWAY_API_KEY (explicit) or fall back to MC's
  // global API_KEY env var (admin-grade).
  return (process.env.AGENT_GATEWAY_API_KEY || process.env.API_KEY || '').trim()
}

async function gatewayFetch(
  path: string,
  init: RequestInit = {},
): Promise<GatewayResponse<any>> {
  const gatewayUrl = getGatewayUrl()
  const apiKey = getGatewayApiKey()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    }
    if (apiKey) {
      headers['x-api-key'] = apiKey
      headers['authorization'] = `Bearer ${apiKey}`
    }
    const res = await fetch(`${gatewayUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    })
    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    return {
      ok: res.ok,
      reachable: true,
      status: res.status,
      data,
      gatewayUrl,
    } as GatewayResponse<any>
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError'
    return {
      ok: false,
      reachable: false,
      status: 0,
      error: isAbort
        ? `Gateway timeout after ${FETCH_TIMEOUT_MS}ms`
        : (err?.message || 'Unknown gateway fetch error'),
      gatewayUrl,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function getGatewayHealth(): Promise<GatewayResponse<any>> {
  return gatewayFetch('/health', { method: 'GET' })
}

export async function listGatewayTasks(opts: { limit?: number; agent?: string | null } = {}): Promise<GatewayResponse<any>> {
  const params = new URLSearchParams()
  if (opts.limit) params.set('limit', String(opts.limit))
  if (opts.agent) params.set('agent', opts.agent)
  const qs = params.toString()
  return gatewayFetch(`/v1/tasks${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export async function getGatewayTask(taskId: string): Promise<GatewayResponse<any>> {
  return gatewayFetch(`/v1/tasks/${encodeURIComponent(taskId)}`, { method: 'GET' })
}

export async function getGatewayLogs(
  taskId: string,
  stream: 'stdout' | 'stderr' = 'stdout',
  tailBytes = 16384,
): Promise<GatewayResponse<any>> {
  const params = new URLSearchParams({ stream, tail_bytes: String(tailBytes) })
  return gatewayFetch(`/v1/logs/${encodeURIComponent(taskId)}?${params.toString()}`, { method: 'GET' })
}

export async function getGatewayAgents(): Promise<GatewayResponse<any>> {
  return gatewayFetch('/v1/agents', { method: 'GET' })
}
