/**
 * P4 — every path is configurable (env-driven), nothing hardcoded to a machine.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { config } from '@/lib/config'

describe('configurable paths', () => {
  it('exposes every required configurable path', () => {
    for (const key of ['repo', 'vault', 'obsidianVault', 'assets', 'output', 'runtimes', 'skills', 'hermes', 'notebookLmImport']) {
      expect(config.paths[key as keyof typeof config.paths], `missing path ${key}`).toBeTruthy()
      expect(typeof config.paths[key as keyof typeof config.paths]).toBe('string')
    }
  })

  it('exposes Pinecone + Notion integration config (driven by env)', () => {
    expect(config.integrations.pinecone).toHaveProperty('apiKey')
    expect(config.integrations.pinecone).toHaveProperty('index')
    expect(config.integrations.notion).toHaveProperty('apiKey')
    expect(config.integrations.notion).toHaveProperty('databaseId')
  })

  it('paths source reads from env vars (no hardcoded absolute machine paths)', () => {
    const src = readFileSync('src/lib/config.ts', 'utf8')
    for (const env of ['MC_REPO_PATH', 'MC_VAULT_PATH', 'MC_ASSETS_PATH', 'MC_OUTPUT_PATH', 'MC_RUNTIMES_PATH', 'MC_SKILLS_PATH', 'MC_HERMES_PATH', 'MC_NOTEBOOKLM_IMPORT_PATH']) {
      expect(src, `config must honor ${env}`).toContain(env)
    }
    // No hardcoded user home directories committed in the paths block.
    expect(src).not.toMatch(/['"]\/Users\/[a-z]/i)
  })
})
