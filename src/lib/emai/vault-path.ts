/**
 * EMAI vault path resolver.
 *
 * Walt's directive (2026-06-06, CONSOLIDATION_ARCHITECTURE.md §10 D-A4):
 *
 *   - Default root: ~/Documents/EMAI-Command-Center-OS
 *   - Env override: EMAI_VAULT_PATH (when set, wins over default)
 *   - Future: Knowledge OS page surfaces a manual selector
 *   - Rules:
 *       · never overwrite an existing vault without confirmation
 *       · update pack must dry-run first
 *       · preserve existing notes/projects/tasks/context
 *       · show vault status in UI
 *
 * This module intentionally does NOT touch the filesystem mutationally.
 * Callers must opt in via the dedicated overlay-install path, which is
 * the place the "no overwrite without confirmation" gate lives.
 */
import { existsSync as nodeExistsSync, statSync as nodeStatSync, readdirSync as nodeReaddirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const EMAI_VAULT_DEFAULT_RELATIVE = 'Documents/EMAI-Command-Center-OS'

/** Markers that imply a real EMAI vault already lives at the path. */
const EMAI_VAULT_MARKERS = ['notes', 'projects', 'tasks', 'context']

/** Subset of process.env that resolveEmaiVaultPath cares about. */
export interface VaultEnv {
  EMAI_VAULT_PATH?: string
}

/**
 * Resolve the on-disk path for the EMAI vault.
 *
 * Precedence: EMAI_VAULT_PATH env var → ~/Documents/EMAI-Command-Center-OS
 *
 * Always returns an absolute, normalized path. Does not create directories.
 *
 * @param env optional env shim — pass `{}` in tests to ignore the live env.
 */
export function resolveEmaiVaultPath(env: VaultEnv = process.env as VaultEnv): string {
  const override = env.EMAI_VAULT_PATH?.trim()
  if (override) return resolve(override)
  return resolve(join(homedir(), EMAI_VAULT_DEFAULT_RELATIVE))
}

export type VaultProbe =
  | { exists: false; path: string }
  | { exists: true; path: string; populated: boolean; markers: string[] }

/**
 * Minimal fs shim used by probeEmaiVault. Kept narrow on purpose so test
 * fakes don't have to satisfy the full Node fs `PathLike` overload soup.
 */
export interface VaultFsShim {
  existsSync: (path: string) => boolean
  statSync: (path: string) => { isDirectory: () => boolean }
  readdirSync: (path: string) => string[]
}

const DEFAULT_FS_SHIM: VaultFsShim = {
  existsSync: (p) => nodeExistsSync(p),
  statSync: (p) => nodeStatSync(p),
  readdirSync: (p) => nodeReaddirSync(p) as string[],
}

/**
 * Probe the vault path without modifying it.
 *
 * - `exists: false` — directory does not exist; safe to create.
 * - `exists: true, populated: false` — directory exists but holds no EMAI
 *   markers (treat as "empty scratch dir, safe to install into").
 * - `exists: true, populated: true` — at least one of the EMAI vault
 *   markers (`notes`, `projects`, `tasks`, `context`) is present. The
 *   caller MUST refuse overwrite without explicit user confirmation.
 *
 * The optional `fsApi` shim lets tests inject a fake fs without
 * round-tripping through tmpdir.
 */
export function probeEmaiVault(
  vaultPath: string = resolveEmaiVaultPath(),
  fsApi: VaultFsShim = DEFAULT_FS_SHIM,
): VaultProbe {
  if (!fsApi.existsSync(vaultPath)) return { exists: false, path: vaultPath }
  try {
    if (!fsApi.statSync(vaultPath).isDirectory()) {
      // A file sits where the vault should be — refuse to treat it as a
      // vault. Surfacing this as "populated" prevents the overlay-install
      // path from overwriting the file.
      return { exists: true, path: vaultPath, populated: true, markers: ['<not-a-directory>'] }
    }
  } catch {
    return { exists: true, path: vaultPath, populated: true, markers: ['<stat-failed>'] }
  }

  const found: string[] = []
  for (const marker of EMAI_VAULT_MARKERS) {
    if (fsApi.existsSync(join(vaultPath, marker))) found.push(marker)
  }

  // Also count any non-marker children as "populated" so we don't blow
  // away a half-built vault that hasn't grown its canonical subdirs yet.
  let populated = found.length > 0
  if (!populated) {
    try {
      const children = fsApi.readdirSync(vaultPath).filter((c) => !c.startsWith('.'))
      populated = children.length > 0
    } catch {
      populated = true
    }
  }

  return { exists: true, path: vaultPath, populated, markers: found }
}

/**
 * Convenience predicate: true when the resolved vault already holds an
 * EMAI overlay. Wraps `probeEmaiVault` for callers that only need the
 * boolean.
 */
export function vaultExists(vaultPath?: string): boolean {
  const probe = probeEmaiVault(vaultPath ?? resolveEmaiVaultPath())
  return probe.exists && probe.populated
}
