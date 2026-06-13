/**
 * Ecosystem app integration model — the Baseline Automations apps Mission
 * Control agents can VIEW and EXECUTE against. Data only; no secrets, no
 * network. The execution layer (API / browser / visible-only) reads this.
 *
 * Honesty rules:
 *   · No app is "connected" here — connection is resolved at runtime against
 *     the workspace's credentials + runtime (see capability-matrix.ts).
 *   · iframe_url / api_base_url are configured via env; absent → Setup Needed.
 *   · Browser/iframe execution is a CONTROLLED runtime mode: only allowlisted
 *     domains + allowlisted actions (browser-actions.ts), behind approval gates.
 */

export type EcosystemAppId = 'propcontrol' | 'visionops' | 'voiceops' | 'propcontrol-empire'

export type ExecutionMode = 'api' | 'browser' | 'visible_only'

export type EcosystemStatus =
  | 'visible_only'
  | 'browser_automation_ready'
  | 'api_connected'
  | 'workflow_ready'
  | 'needs_credentials'
  | 'blocked_by_iframe_policy'
  | 'setup_needed'

export interface EcosystemApp {
  id: EcosystemAppId
  name: string
  description: string
  /** Env var holding the iframe/app URL (operator-configured). */
  iframeUrlEnv: string
  /** Env var holding the API base URL, if the app exposes one. */
  apiBaseUrlEnv?: string
  /** Domains the controlled browser runtime may navigate within. */
  allowedDomains: string[]
  executionModesAvailable: ExecutionMode[]
  defaultExecutionMode: ExecutionMode
  proofSupported: boolean
  replaySupported: boolean
  /** Whether agents may access this app at all (workspace-gated at runtime). */
  agentAccess: boolean
  /** Product role note. */
  note?: string
}

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  {
    id: 'propcontrol',
    name: 'PropControl',
    description: 'Property operations — work orders, vendors, owners, tenants.',
    iframeUrlEnv: 'PROPCONTROL_IFRAME_URL',
    apiBaseUrlEnv: 'PROPCONTROL_API_BASE_URL',
    allowedDomains: ['propcontrolempire.com', 'app.propcontrolempire.com'],
    executionModesAvailable: ['api', 'browser', 'visible_only'],
    defaultExecutionMode: 'api',
    proofSupported: true,
    replaySupported: true,
    agentAccess: true,
  },
  {
    id: 'visionops',
    name: 'VisionOps',
    description: 'Inspection media review + visual proof generation.',
    iframeUrlEnv: 'VISIONOPS_IFRAME_URL',
    apiBaseUrlEnv: 'VISIONOPS_API_BASE_URL',
    allowedDomains: ['rehab-vision.emergent.host'],
    executionModesAvailable: ['api', 'browser', 'visible_only'],
    defaultExecutionMode: 'browser',
    proofSupported: true,
    replaySupported: true,
    agentAccess: true,
  },
  {
    id: 'voiceops',
    name: 'VoiceOps',
    description: 'Voice call logs, follow-ups, escalations.',
    iframeUrlEnv: 'VOICEOPS_IFRAME_URL',
    apiBaseUrlEnv: 'VOICEOPS_API_BASE_URL',
    allowedDomains: [],
    executionModesAvailable: ['visible_only'],
    defaultExecutionMode: 'visible_only',
    proofSupported: false,
    replaySupported: false,
    agentAccess: false,
    note: 'URL not yet provided by operator — Setup Needed until configured.',
  },
  {
    id: 'propcontrol-empire',
    name: 'PropControl Empire',
    description: 'Gamified real-estate strategy simulator — learn to build and operate a property portfolio by playing.',
    iframeUrlEnv: 'PROPCONTROL_EMPIRE_IFRAME_URL',
    allowedDomains: ['propcontrolempire.com'],
    executionModesAvailable: ['browser', 'visible_only'],
    defaultExecutionMode: 'visible_only',
    proofSupported: false,
    replaySupported: true,
    agentAccess: false,
    note: 'Learning/simulation layer (replaces the Office page). Not an operations app — agent automation is future work.',
  },
]

export function getEcosystemApp(id: string): EcosystemApp | undefined {
  return ECOSYSTEM_APPS.find((a) => a.id === id)
}

export interface ResolvedEcosystemApp extends EcosystemApp {
  iframeUrl: string | null
  apiBaseUrl: string | null
  hasApi: boolean
  status: EcosystemStatus
  setupNeeded: string[]
}

/**
 * Resolve an app's runtime status from env config + (optional) credential
 * presence. NEVER claims connected without evidence. `creds` maps a check key
 * to whether the workspace has the credential.
 */
export function resolveEcosystemApp(app: EcosystemApp, env: NodeJS.ProcessEnv = process.env): ResolvedEcosystemApp {
  const iframeUrl = (env[app.iframeUrlEnv] || '').trim() || null
  const apiBaseUrl = app.apiBaseUrlEnv ? (env[app.apiBaseUrlEnv] || '').trim() || null : null
  const setupNeeded: string[] = []
  if (!iframeUrl) setupNeeded.push(`Set ${app.iframeUrlEnv} to embed/open ${app.name}.`)
  if (app.apiBaseUrlEnv && !apiBaseUrl) setupNeeded.push(`Set ${app.apiBaseUrlEnv} to enable API execution.`)

  let status: EcosystemStatus
  if (!iframeUrl && !apiBaseUrl) {
    status = 'setup_needed'
  } else if (apiBaseUrl && app.executionModesAvailable.includes('api')) {
    status = 'api_connected'
  } else if (iframeUrl && app.executionModesAvailable.includes('browser')) {
    status = 'browser_automation_ready'
  } else {
    status = 'visible_only'
  }
  return { ...app, iframeUrl, apiBaseUrl, hasApi: !!apiBaseUrl, status, setupNeeded }
}

/**
 * Choose an execution mode for an app: prefer API, then controlled Browser,
 * then visible-only. Honest — returns the mode actually available.
 */
export function resolveExecutionMode(resolved: ResolvedEcosystemApp): ExecutionMode {
  if (resolved.hasApi && resolved.executionModesAvailable.includes('api')) return 'api'
  if (resolved.iframeUrl && resolved.executionModesAvailable.includes('browser')) return 'browser'
  return 'visible_only'
}
