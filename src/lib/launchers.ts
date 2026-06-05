/**
 * Embedded launcher catalogue.
 *
 * Third-party tools Mission Control links out to (not iframes — the page
 * surfaces a "Launch in new tab" button so customers can confirm what's
 * happening). For each launcher we read configuration from env vars and
 * report an honest `configured` flag — no fake "connected" state when
 * the URL/key aren't actually set on this deployment.
 *
 * Add a new launcher by adding a row to LAUNCHER_DEFS below.
 */

export interface LauncherDef {
  id: string
  name: string
  description: string
  category: 'media' | 'editor' | 'ide' | 'automation'
  /** Env var that, when set, signals this launcher is configured. */
  url_env: string
  /** Optional auth env var (key/token). */
  auth_env?: string
  /** Optional pre-fill notes the customer should know before launching. */
  launch_notes?: string
  setup_doc?: string
}

export interface LauncherStatus extends LauncherDef {
  configured: boolean
  url: string | null
  // We never return the raw key; only whether it's present.
  auth_present: boolean
}

export const LAUNCHER_DEFS: LauncherDef[] = [
  {
    id: 'higgsfield',
    name: 'Higgsfield',
    description: 'Video model with character-consistent generation. Walt uses it for the workforce demo reel.',
    category: 'media',
    url_env: 'HIGGSFIELD_URL',
    auth_env: 'HIGGSFIELD_API_KEY',
    launch_notes: 'After clicking launch, paste your runtime API key into the Higgsfield Mission Control bridge to mirror generation events back into your workspace.',
    setup_doc: 'https://higgsfield.ai',
  },
  {
    id: 'hyperedit',
    name: 'HyperEdit',
    description: 'Video edit pipeline (HyperFrames CLI under the hood). Pairs with the Hermes Video runtime to push frames back into Mission Control.',
    category: 'editor',
    url_env: 'HYPEREDIT_URL',
    auth_env: 'HYPEREDIT_API_KEY',
    launch_notes: 'Install the HyperFrames CLI on the machine that will receive edit jobs; HyperEdit hands frames off to it.',
    setup_doc: 'https://github.com/WaltLuv/hyperframes',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    description: 'IDE-style code agent. Cloud Mission Control pairs via runtime API key; the launcher just deep-links the local Antigravity install.',
    category: 'ide',
    url_env: 'ANTIGRAVITY_DEEPLINK',
    launch_notes: 'Deep-link assumes Antigravity is installed on the operator\'s machine.',
  },
]

export function getLauncherStatus(): LauncherStatus[] {
  return LAUNCHER_DEFS.map((def) => {
    const url = process.env[def.url_env] ?? null
    const authPresent = !!(def.auth_env && process.env[def.auth_env])
    return {
      ...def,
      configured: !!url,
      url,
      auth_present: authPresent,
    }
  })
}
