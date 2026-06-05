/**
 * CLI inventory API — returns the documented `mc` command surface.
 *
 *   GET /api/cli → { namespaces, legacy, shortcuts, common_flags, install_hint }
 *
 * Read-only documentation surface. NEVER executes any command — the CLI
 * is a customer-side binary; this endpoint just describes it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  CLI_NAMESPACES,
  CLI_LEGACY_GROUPS,
  CLI_COMMON_FLAGS,
  CLI_TOP_LEVEL_SHORTCUTS,
} from '@/lib/cli-inventory'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    namespaces: CLI_NAMESPACES,
    legacy: CLI_LEGACY_GROUPS,
    shortcuts: CLI_TOP_LEVEL_SHORTCUTS,
    common_flags: CLI_COMMON_FLAGS,
    install_hint: {
      pnpm: 'pnpm mc <group> <action>          # alias for: pnpm run mc',
      npm: 'npx mission-control mc <group> <action>  # via the published CLI (when released)',
      direct: 'node scripts/mc-cli.cjs <group> <action>',
    },
    note: 'This endpoint describes the CLI surface. It does not execute commands.',
  })
}
