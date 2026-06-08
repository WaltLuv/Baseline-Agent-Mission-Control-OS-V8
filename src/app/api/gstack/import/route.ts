/**
 * GStack import API.
 *
 * GET  → returns the bundled first-25 GStack manifest + classification.
 * POST → validates an uploaded manifest array and returns the validation
 *        report + preview (no persistence side effects beyond echoing the
 *        validated set; the client renders the import preview).
 *
 * Auth: viewer+ can read the bundled manifest; importing an arbitrary manifest
 * is admin-only (write).
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { GSTACK_MANIFEST, classifyManifest, validateGStackManifest, GSTACK_FIRST_25_COUNT } from '@/lib/gstack/manifest'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({
    source: 'bundled-first-25',
    count: GSTACK_FIRST_25_COUNT,
    skills: GSTACK_MANIFEST,
    byCategory: classifyManifest(),
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, errors: ['Body must be JSON.'] }, { status: 400 })
  }
  // Accept either a bare array or { skills: [...] }.
  const arr = Array.isArray(body) ? body : (body as { skills?: unknown })?.skills
  const result = validateGStackManifest(arr)
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
