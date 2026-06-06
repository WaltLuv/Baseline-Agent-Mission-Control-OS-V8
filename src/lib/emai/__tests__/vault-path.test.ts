/**
 * EMAI vault path resolver — contract tests.
 *
 * Walt's directive (D-A4): default `~/Documents/EMAI-Command-Center-OS`,
 * `EMAI_VAULT_PATH` env override wins. Vault overlay install must NEVER
 * overwrite an existing vault without confirmation — these tests pin the
 * detection side of that gate.
 */
import { describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  EMAI_VAULT_DEFAULT_RELATIVE,
  resolveEmaiVaultPath,
  probeEmaiVault,
} from '@/lib/emai/vault-path'

describe('resolveEmaiVaultPath', () => {
  it('falls back to ~/Documents/EMAI-Command-Center-OS when no env override is set', () => {
    const resolved = resolveEmaiVaultPath({})
    expect(resolved).toBe(join(homedir(), EMAI_VAULT_DEFAULT_RELATIVE))
  })

  it('returns the EMAI_VAULT_PATH override verbatim (absolute) when set', () => {
    const override = '/var/data/emai-test-vault'
    expect(resolveEmaiVaultPath({ EMAI_VAULT_PATH: override })).toBe(override)
  })

  it('normalizes a relative env override to an absolute path', () => {
    const resolved = resolveEmaiVaultPath({ EMAI_VAULT_PATH: 'tmp/emai' })
    expect(resolved.startsWith('/')).toBe(true)
    expect(resolved.endsWith('tmp/emai')).toBe(true)
  })

  it('trims whitespace from the env override and ignores empty values', () => {
    expect(resolveEmaiVaultPath({ EMAI_VAULT_PATH: '   ' })).toBe(
      join(homedir(), EMAI_VAULT_DEFAULT_RELATIVE),
    )
    expect(resolveEmaiVaultPath({ EMAI_VAULT_PATH: '  /opt/vault  ' })).toBe('/opt/vault')
  })

  it('keeps the default relative constant stable (other modules import it)', () => {
    expect(EMAI_VAULT_DEFAULT_RELATIVE).toBe('Documents/EMAI-Command-Center-OS')
  })
})

describe('probeEmaiVault', () => {
  it('reports exists:false for a missing path', () => {
    const fsApi = {
      existsSync: () => false,
      statSync: () => ({ isDirectory: () => false } as never),
      readdirSync: () => [] as string[],
    }
    const probe = probeEmaiVault('/nope/missing', fsApi)
    expect(probe).toEqual({ exists: false, path: '/nope/missing' })
  })

  it('detects a populated vault when canonical markers are present', () => {
    const fsApi = {
      existsSync: (p: string) =>
        p === '/v' || p === '/v/notes' || p === '/v/projects',
      statSync: () => ({ isDirectory: () => true } as never),
      readdirSync: () => ['notes', 'projects'],
    }
    const probe = probeEmaiVault('/v', fsApi)
    if (!probe.exists) throw new Error('expected exists:true')
    expect(probe.populated).toBe(true)
    expect(probe.markers).toEqual(['notes', 'projects'])
  })

  it('treats an empty directory as exists:true, populated:false (safe-to-install)', () => {
    const fsApi = {
      existsSync: (p: string) => p === '/empty',
      statSync: () => ({ isDirectory: () => true } as never),
      readdirSync: () => [] as string[],
    }
    const probe = probeEmaiVault('/empty', fsApi)
    if (!probe.exists) throw new Error('expected exists:true')
    expect(probe.populated).toBe(false)
    expect(probe.markers).toEqual([])
  })

  it('treats a directory holding non-marker content as populated (refuse-overwrite gate)', () => {
    const fsApi = {
      existsSync: (p: string) => p === '/scratch',
      statSync: () => ({ isDirectory: () => true } as never),
      readdirSync: () => ['unrelated-thing.md', 'old-stuff'],
    }
    const probe = probeEmaiVault('/scratch', fsApi)
    if (!probe.exists) throw new Error('expected exists:true')
    // Vault overlay would clobber unrelated content — must report populated.
    expect(probe.populated).toBe(true)
    expect(probe.markers).toEqual([])
  })

  it('reports populated when a non-directory file sits at the vault path (refuse-overwrite)', () => {
    const fsApi = {
      existsSync: (p: string) => p === '/file',
      statSync: () => ({ isDirectory: () => false } as never),
      readdirSync: () => [] as string[],
    }
    const probe = probeEmaiVault('/file', fsApi)
    if (!probe.exists) throw new Error('expected exists:true')
    expect(probe.populated).toBe(true)
    expect(probe.markers).toContain('<not-a-directory>')
  })
})
