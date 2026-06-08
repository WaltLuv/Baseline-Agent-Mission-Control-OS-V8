import { NextResponse } from 'next/server'
import { classifyAction } from '@/lib/voice/permissions'

/**
 * Slim Charles tool-execution bridge.
 *
 * The realtime voice loop yields here when the model fires a function call. We
 * enforce the permission policy first: destructive / financial / secret-touching
 * actions are NEVER executed by Slim — they return `requires-walt` so a human
 * gate is shown. Auto-approvable actions are dispatched to the real runtime.
 *
 * Truth-first: we only report `executed: true` when a downstream runtime
 * actually accepts the dispatch. If no runtime is connected, we return
 * `setupNeeded` rather than pretending the tool ran.
 */
export async function POST(req: Request) {
  let body: { action?: string; tool?: string; args?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const action = (body.action ?? body.tool ?? '').toString()
  if (!action) return NextResponse.json({ ok: false, error: 'missing action' }, { status: 400 })

  const decision = classifyAction(action)
  if (decision === 'requires-walt') {
    return NextResponse.json({
      ok: true,
      executed: false,
      decision,
      reason: 'Destructive, financial, or secret-touching action. Only Walt can approve — Slim will not auto-execute this.',
    })
  }

  // Auto-approvable. Dispatch to the real runtime/task system. We forward to the
  // internal tasks API; if it isn't reachable, we surface setup-needed honestly.
  try {
    const origin = new URL(req.url).origin
    const res = await fetch(`${origin}/api/hermes/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'slim-charles', tool: action, args: body.args ?? null }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ ok: true, executed: true, decision, result: data })
    }
    return NextResponse.json({
      ok: true,
      executed: false,
      decision,
      setupNeeded: true,
      reason: 'No runtime accepted the dispatch. Connect a runtime in Flight Deck to let Slim execute tools.',
    })
  } catch {
    return NextResponse.json({
      ok: true,
      executed: false,
      decision,
      setupNeeded: true,
      reason: 'Runtime unreachable. Connect a runtime in Flight Deck.',
    })
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
