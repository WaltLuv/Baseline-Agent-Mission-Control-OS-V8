/**
 * Agent Discovery Scanner — read-only file system scanner
 * Detects local AI tool configurations and agent installations.
 *
 * Safety: read-only, secrets masked, disabled by default.
 */

import { access, constants } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { maskAllConfigKeys } from './api-key-mask'

export interface ScanLocation {
  id: string
  name: string
  tool: string
  path: string
  exists: boolean
  readable: boolean
  config: Record<string, unknown> | null
  masked: boolean
  status: 'detected' | 'not_found' | 'unreadable'
  registered: boolean
}

export interface ScanRun {
  id: string
  startedAt: number
  completedAt: number
  duration: number
  locations: ScanLocation[]
  summary: {
    total: number
    detected: number
    notFound: number
    unreadable: number
  }
}

// In-memory store for scan runs
const _scanRuns: ScanRun[] = []
let _runCounter = 0

/**
 * Discovery paths to probe.
 * Each entry: { id, name, human label, tool name, path resolver }
 */
const DISCOVERY_PATHS: Array<{
  id: string
  name: string
  tool: string
  path: string
}> = [
  { id: 'claude-settings', name: 'Claude Code', tool: 'claude', path: join(homedir(), '.claude', 'settings.json') },
  { id: 'codex-config', name: 'Codex', tool: 'codex', path: join(homedir(), '.codex', 'config.json') },
  { id: 'openclaw', name: 'OpenClaw', tool: 'openclaw', path: join(homedir(), '.openclaw') },
  { id: 'hermes', name: 'Hermes', tool: 'hermes', path: join(homedir(), '.hermes') },
  { id: 'agents-skills', name: 'Agent Skills', tool: 'agents', path: join(homedir(), '.agents', 'skills') },
  { id: 'agents-workspace', name: 'Agent Workspace', tool: 'agents', path: join(homedir(), '.agents') },
  { id: 'mcp-config', name: 'MCP Config', tool: 'mcp', path: process.cwd() },
  { id: 'obsidian', name: 'Obsidian Vault', tool: 'obsidian', path: join(homedir(), 'obsidian-vault') },
  { id: 'git-config', name: 'Git Config', tool: 'git', path: join(process.cwd(), '.git', 'config') },
]

/**
 * Check if a path exists and is readable (read-only — never modifies anything).
 */
async function checkPath(
  fullPath: string,
  isFile: boolean
): Promise<{ readable: boolean; config: Record<string, unknown> | null }> {
  try {
    await access(fullPath, constants.R_OK)
    // Only read content for known config file types
    if (isFile && fullPath.endsWith('.json')) {
      const { readFile } = await import('node:fs/promises')
      const raw = await readFile(fullPath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      // Mask secrets before returning
      const masked = maskAllConfigKeys(parsed)
      return { readable: true, config: masked }
    }
    return { readable: true, config: null }
  } catch {
    return { readable: false, config: null }
  }
}

/**
 * Glob for MCP config files in a directory (read-only).
 */
async function findMcpConfigs(dir: string): Promise<
  Array<{ path: string; config: Record<string, unknown> | null }>
> {
  const results: Array<{ path: string; config: Record<string, unknown> | null }> = []
  try {
    const { readdirSync, statSync } = await import('node:fs')
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const name = entry.name
      if (name.includes('.config.mcp') || name.endsWith('.mcp.json') || name.endsWith('.mcp.config.json')) {
        const fullPath = join(dir, name)
        const check = await checkPath(fullPath, true)
        results.push({ path: fullPath, config: check.config })
      }
    }
  } catch {
    // Directory not readable or doesn't exist
  }
  return results
}

/**
 * Glob for workspace subdirectories in ~/.agents/workspace-*
 */
async function findAgentWorkspaces(): Promise<Array<{ path: string; name: string }>> {
  const base = join(homedir(), '.agents')
  const results: Array<{ path: string; name: string }> = []
  try {
    const { readdirSync, statSync } = await import('node:fs')
    const entries = readdirSync(base, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('workspace-')) {
        results.push({ path: join(base, entry.name), name: entry.name })
      }
    }
  } catch {
    // Directory not readable or doesn't exist
  }
  return results
}

/**
 * Run the full discovery scan. Pure read-only operations.
 */
export async function runDiscoveryScan(): Promise<ScanRun> {
  const runId = `scan-${String(++_runCounter).padStart(4, '0')}`
  const startedAt = Date.now()
  const locations: ScanLocation[] = []

  for (const probe of DISCOVERY_PATHS) {
    const location: ScanLocation = {
      id: probe.id,
      name: probe.name,
      tool: probe.tool,
      path: probe.path,
      exists: false,
      readable: false,
      config: null,
      masked: false,
      status: 'not_found',
      registered: false,
    }

    // Special handling for workspace-* (glob)
    if (probe.id === 'agents-workspace') {
      const workspaces = await findAgentWorkspaces()
      if (workspaces.length > 0) {
        location.exists = true
        location.readable = true
        location.status = 'detected'
        location.name = `Agent Workspaces (${workspaces.length})`
        location.config = { count: workspaces.length, workspaces: workspaces.map(w => w.name) }
      }
    }
    // Special handling for MCP configs (glob)
    else if (probe.id === 'mcp-config') {
      const configs = await findMcpConfigs(probe.path)
      if (configs.length > 0) {
        location.exists = true
        location.readable = true
        location.status = 'detected'
        location.name = `MCP Configs (${configs.length})`
        location.config = { count: configs.length, files: configs.map(c => c.path) }
        location.masked = true
      }
    }
    // Regular path check
    else {
      const isFile = !probe.path.endsWith('/') && probe.path.includes('.')
      const check = await checkPath(probe.path, isFile)

      if (check.readable) {
        location.exists = true
        location.readable = true
        location.status = 'detected'
        if (check.config) {
          location.config = check.config
          location.masked = true
        }
      } else {
        location.status = 'not_found'
      }
    }

    locations.push(location)
  }

  const completedAt = Date.now()
  const summary = {
    total: locations.length,
    detected: locations.filter(l => l.status === 'detected').length,
    notFound: locations.filter(l => l.status === 'not_found').length,
    unreadable: locations.filter(l => l.status === 'unreadable').length,
  }

  const scanRun: ScanRun = {
    id: runId,
    startedAt,
    completedAt,
    duration: completedAt - startedAt,
    locations,
    summary,
  }

  _scanRuns.push(scanRun)
  // Keep only last 50 runs
  while (_scanRuns.length > 50) _scanRuns.shift()

  return scanRun
}

/**
 * Get all stored scan runs.
 */
export function getScanRuns(): ScanRun[] {
  return [..._scanRuns].reverse()
}

/**
 * Mark a detected agent as registered.
 */
export function markRegistered(scanRunId: string, locationId: string): boolean {
  const run = _scanRuns.find(r => r.id === scanRunId)
  if (!run) return false
  const loc = run.locations.find(l => l.id === locationId)
  if (!loc) return false
  loc.registered = true
  return true
}
