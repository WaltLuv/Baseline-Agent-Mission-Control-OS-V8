/**
 * Slim Charles tool & skill access model.
 *
 * Slim can drive every eligible skill and tool the workspace exposes: the
 * marketplace skill catalog, the Skills Library, MCP tools, and the runtime /
 * integration tool sources (Browser Use, Hermes, OpenClaw, Claude Code, Codex,
 * Maestro, Google Calendar, Telegram, Computer Use).
 *
 * Truth-first: access is never faked. A tool is `ready` only when its backing
 * credential/runtime is actually present; otherwise it is `setup-needed` with a
 * link to wire it. Slim sees the full surface but can only execute what's ready.
 */
import { SKILLS, type SkillProduct } from '@/lib/marketplace-catalog'

export type ToolAccessState = 'ready' | 'setup-needed'

export interface SlimTool {
  id: string
  label: string
  source: ToolSourceId
  /** Honest access state derived from real signals. */
  state: ToolAccessState
  /** Where to wire it when setup-needed. */
  setupHref?: string
  /** Destructive tools still flow through the permission policy (Walt-only). */
  destructive?: boolean
}

export type ToolSourceId =
  | 'skills-marketplace'
  | 'skills-library'
  | 'mcp'
  | 'browser-use'
  | 'hermes'
  | 'openclaw'
  | 'claude-code'
  | 'codex'
  | 'maestro'
  | 'google-calendar'
  | 'telegram'
  | 'computer-use'

export interface ToolSource {
  id: ToolSourceId
  label: string
  /** Signal key in WorkspaceSignals that gates readiness. */
  signal: keyof WorkspaceSignals
  setupHref: string
}

export const TOOL_SOURCES: ToolSource[] = [
  { id: 'skills-marketplace', label: 'Skills Marketplace', signal: 'marketplace', setupHref: '/marketplace' },
  { id: 'skills-library', label: 'Skills Library', signal: 'skillsLibrary', setupHref: '/app/library' },
  { id: 'mcp', label: 'MCP tools', signal: 'mcp', setupHref: '/app/settings' },
  { id: 'browser-use', label: 'Browser Use', signal: 'browserUse', setupHref: '/flight-deck' },
  { id: 'hermes', label: 'Hermes tools', signal: 'hermes', setupHref: '/flight-deck' },
  { id: 'openclaw', label: 'OpenClaw tools', signal: 'openclaw', setupHref: '/flight-deck' },
  { id: 'claude-code', label: 'Claude Code tools', signal: 'claudeCode', setupHref: '/flight-deck' },
  { id: 'codex', label: 'Codex tools', signal: 'codex', setupHref: '/flight-deck' },
  { id: 'maestro', label: 'Maestro tools', signal: 'maestro', setupHref: '/app/maestro' },
  { id: 'google-calendar', label: 'Google Calendar', signal: 'googleCalendar', setupHref: '/app/integrations' },
  { id: 'telegram', label: 'Telegram', signal: 'telegram', setupHref: '/app/integrations' },
  { id: 'computer-use', label: 'Computer Use', signal: 'computerUse', setupHref: '/flight-deck' },
]

/** Real signals about what is actually wired in the workspace. */
export interface WorkspaceSignals {
  marketplace?: boolean
  skillsLibrary?: boolean
  mcp?: boolean
  browserUse?: boolean
  hermes?: boolean
  openclaw?: boolean
  claudeCode?: boolean
  codex?: boolean
  maestro?: boolean
  googleCalendar?: boolean
  telegram?: boolean
  computerUse?: boolean
}

/**
 * Build Slim's full tool registry from the live skill catalog + tool sources.
 * Every marketplace skill is exposed (Slim can execute every one that's ready),
 * and each runtime/integration source contributes a tool entry with an honest
 * access state. Nothing is hidden; nothing is faked.
 */
export function buildSlimToolRegistry(signals: WorkspaceSignals, catalog: SkillProduct[] = SKILLS): SlimTool[] {
  const sourceState = (id: ToolSourceId): ToolAccessState => {
    const src = TOOL_SOURCES.find((s) => s.id === id)!
    return signals[src.signal] ? 'ready' : 'setup-needed'
  }

  const sourceTools: SlimTool[] = TOOL_SOURCES.map((s) => ({
    id: `source:${s.id}`,
    label: s.label,
    source: s.id,
    state: sourceState(s.id),
    setupHref: sourceState(s.id) === 'setup-needed' ? s.setupHref : undefined,
  }))

  // Every skill in the marketplace/library is reachable by Slim. A skill is
  // ready when its source is wired AND its declared integrations are present.
  const libraryReady = signals.skillsLibrary || signals.marketplace
  const skillTools: SlimTool[] = catalog.map((sk) => {
    const integrationsOk = !sk.integrations?.length || !!signals.mcp
    const ready = libraryReady && integrationsOk
    return {
      id: `skill:${sk.slug}`,
      label: sk.name,
      source: 'skills-library',
      state: ready ? 'ready' : 'setup-needed',
      setupHref: ready ? undefined : sk.integrations?.length ? '/app/settings' : '/app/library',
    }
  })

  return [...sourceTools, ...skillTools]
}

export function readyToolCount(tools: SlimTool[]): number {
  return tools.filter((t) => t.state === 'ready').length
}

/** Whether Slim can actually execute a given tool id right now. */
export function canExecuteTool(tools: SlimTool[], toolId: string): boolean {
  return tools.find((t) => t.id === toolId)?.state === 'ready'
}
