import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { getAllGatewaySessions } from '@/lib/sessions'
import { parseJsonlTranscript, readSessionJsonl, type TranscriptMessage, type MessageContentPart } from '@/lib/transcript-parser'

export interface AggregateEvent {
  id: string
  ts: number
  sessionKey: string
  agentName: string
  role: string
  type: string
  content: string
  metadata?: Record<string, any>
}

/**
 * GET /api/sessions/transcript/aggregate?limit=100&since=<unix-ms>
 *
 * Fan out to all active session JSONL files on disk, parse, merge into
 * a single chronological event stream for the agent-feed panel.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Tenant isolation: scope to workspace
  const workspaceId = auth.user.workspace_id ?? 1

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 500)
  const since = parseInt(searchParams.get('since') || '0', 10) || 0

  const stateDir = config.openclawStateDir
  if (!stateDir) {
    return NextResponse.json({ events: [], sessionCount: 0 })
  }

  const sessions = getAllGatewaySessions()
  const allEvents: AggregateEvent[] = []

  // Tenant isolation: only return sessions for this workspace
  for (const session of sessions) {
    if (!session.sessionId) continue
    // Workspace-scoped: only include sessions whose key contains this workspace's context
    if (!session.key.includes(`ws-${workspaceId}`) && !session.key.includes('ws-1')) {
      if (workspaceId !== 1) continue // workspace 1 is the default shared workspace
    }

    const raw = readSessionJsonl(stateDir, session.agent, session.sessionId)
    if (!raw) continue

    const messages = parseJsonlTranscript(raw, 500)
    let lineIndex = 0

    for (const msg of messages) {
      const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : session.updatedAt
      if (since && ts <= since) { lineIndex++; continue }

      for (const part of msg.parts) {
        allEvents.push(partToEvent(part, msg.role, ts, session.key, session.agent, lineIndex))
        lineIndex++
      }
    }
  }

  // Sort chronologically (newest last), take the last `limit` entries
  allEvents.sort((a, b) => a.ts - b.ts)
  const trimmed = allEvents.slice(-limit)

  return NextResponse.json({
    events: trimmed,
    sessionCount: sessions.length,
  })
}

function partToEvent(
  part: MessageContentPart,
  role: string,
  ts: number,
  sessionKey: string,
  agentName: string,
  lineIndex: number,
): AggregateEvent {
  const id = `tx-${sessionKey}-${lineIndex}`

  switch (part.type) {
    case 'text':
      return { id, ts, sessionKey, agentName, role, type: 'text', content: part.text.slice(0, 500) }
    case 'thinking':
      return { id, ts, sessionKey, agentName, role, type: 'thinking', content: part.thinking.slice(0, 300) }
    case 'tool_use':
      return { id, ts, sessionKey, agentName, role, type: 'tool_use', content: part.name, metadata: { toolId: part.id, input: part.input } }
    case 'tool_result':
      return { id, ts, sessionKey, agentName, role, type: 'tool_result', content: part.content.slice(0, 500), metadata: { toolUseId: part.toolUseId, isError: part.isError } }
  }
}

export const dynamic = 'force-dynamic'
