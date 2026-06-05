/**
 * Embedded launchers API.
 *
 *   GET /api/launchers → { launchers: [...] }
 *
 * Read-only. Returns the catalogue from `src/lib/launchers.ts` annotated
 * with whether each launcher has its env-driven URL + auth configured on
 * this deployment. We never echo back the raw key.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getLauncherStatus } from '@/lib/launchers'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const launchers = getLauncherStatus()
  return NextResponse.json({
    launchers,
    totals: {
      catalogue: launchers.length,
      configured: launchers.filter((l) => l.configured).length,
    },
  })
}
