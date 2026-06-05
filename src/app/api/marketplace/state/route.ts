/**
 * Marketplace state — context the UI needs to render item states honestly.
 *
 *   GET /api/marketplace/state
 *     → {
 *         balance: { credits, granted, used, refunded },
 *         purchased: {
 *           skills:    string[]   // slugs in workforce_skills (non-workflow)
 *           workflows: string[]   // slugs in workforce_skills (workflow category)
 *           employees: string[]   // slugs in workforce_subscriptions
 *           bundles:   string[]   // future — empty for now
 *         },
 *       }
 *
 * Read-only. Cheap. Refreshed by the marketplace page on mount and on
 * any focus event so badges reflect just-completed purchases.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { getWorkspaceBalance } from '@/lib/billing'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const db = getDatabase()
  // Lazy-create the inventory tables so a brand-new workspace doesn't 500.
  db.exec(`
    CREATE TABLE IF NOT EXISTS workforce_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL,
      category TEXT NOT NULL, price_cents INTEGER NOT NULL,
      attached_agent_id INTEGER, installed_at INTEGER NOT NULL,
      idempotency_key TEXT, UNIQUE(workspace_id, slug, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS workforce_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL, employee_slug TEXT NOT NULL,
      monthly_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      started_at INTEGER NOT NULL, idempotency_key TEXT,
      UNIQUE(workspace_id, employee_slug, idempotency_key)
    );
  `)

  const balance = getWorkspaceBalance(workspaceId)
  const skillRows = db.prepare(
    `SELECT DISTINCT slug, category FROM workforce_skills WHERE workspace_id = ?`,
  ).all(workspaceId) as Array<{ slug: string; category: string }>
  const subRows = db.prepare(
    `SELECT DISTINCT employee_slug FROM workforce_subscriptions WHERE workspace_id = ?`,
  ).all(workspaceId) as Array<{ employee_slug: string }>

  const skills: string[] = []
  const workflows: string[] = []
  for (const r of skillRows) {
    if (/workflow/i.test(r.category)) workflows.push(r.slug)
    else skills.push(r.slug)
  }

  return NextResponse.json({
    balance: {
      credits: balance.balance,
      granted: balance.granted,
      used: balance.used,
      refunded: balance.refunded,
    },
    purchased: {
      skills,
      workflows,
      employees: subRows.map((s) => s.employee_slug),
      bundles: [],
    },
  })
}
