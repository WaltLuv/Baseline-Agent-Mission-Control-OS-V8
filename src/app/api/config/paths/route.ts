import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'

/**
 * Read-only view of the configurable paths + integration config presence.
 *
 * Every path is env-driven (see config.paths). Secrets are NEVER returned —
 * only whether each integration is configured, plus the env var that sets it.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    paths: [
      { key: 'repo', label: 'Repo path', value: config.paths.repo, env: 'MC_REPO_PATH' },
      { key: 'vault', label: 'Vault path', value: config.paths.vault, env: 'MC_VAULT_PATH' },
      { key: 'obsidianVault', label: 'Obsidian vault', value: config.paths.obsidianVault, env: 'MC_OBSIDIAN_VAULT_PATH / OBSIDIAN_VAULT_PATH' },
      { key: 'assets', label: 'Asset path', value: config.paths.assets, env: 'MC_ASSETS_PATH' },
      { key: 'output', label: 'Output path', value: config.paths.output, env: 'MC_OUTPUT_PATH' },
      { key: 'runtimes', label: 'Runtime path', value: config.paths.runtimes, env: 'MC_RUNTIMES_PATH' },
      { key: 'skills', label: 'Skills path', value: config.paths.skills, env: 'MC_SKILLS_PATH' },
      { key: 'hermes', label: 'Hermes path', value: config.paths.hermes, env: 'MC_HERMES_PATH / HERMES_HOME' },
      { key: 'notebookLmImport', label: 'NotebookLM import', value: config.paths.notebookLmImport, env: 'MC_NOTEBOOKLM_IMPORT_PATH' },
    ],
    integrations: [
      { key: 'pinecone', label: 'Pinecone', configured: !!config.integrations.pinecone.apiKey, env: 'PINECONE_API_KEY / PINECONE_INDEX / PINECONE_ENVIRONMENT' },
      { key: 'notion', label: 'Notion', configured: !!config.integrations.notion.apiKey, env: 'NOTION_API_KEY / NOTION_DATABASE_ID' },
    ],
  })
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
