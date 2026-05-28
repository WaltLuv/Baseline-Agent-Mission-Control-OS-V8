import { NextRequest, NextResponse } from 'next/server'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { isHermesInstalled, isHermesGatewayRunning, scanHermesSessions } from '@/lib/hermes-sessions'
import { getHermesTasks } from '@/lib/hermes-tasks'
import { getHermesMemory } from '@/lib/hermes-memory'
import { logger } from '@/lib/logger'

// In Docker, HOME=/nonexistent — check dataDir first, then homeDir
import { resolve } from 'node:path'
const dataDir = resolve(config.dataDir || '.data')
const homeDir = config.homeDir || ''
const HERMES_HOME = existsSync(join(dataDir, '.hermes'))
  ? join(dataDir, '.hermes')
  : existsSync(join(homeDir, '.hermes'))
    ? join(homeDir, '.hermes')
    : join(dataDir, '.hermes') // default to dataDir for new installs
const HOOK_DIR = join(HERMES_HOME, 'hooks', 'mission-control')

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const installed = isHermesInstalled()
    const gatewayRunning = installed ? isHermesGatewayRunning() : false
    const hookInstalled = existsSync(join(HOOK_DIR, 'HOOK.yaml'))
    const activeSessions = installed ? scanHermesSessions(50).filter(s => s.isActive).length : 0

    const cronJobCount = installed ? getHermesTasks().cronJobs.length : 0
    const memoryEntries = installed ? getHermesMemory().agentMemoryEntries : 0

    return NextResponse.json({
      installed,
      gatewayRunning,
      hookInstalled,
      activeSessions,
      cronJobCount,
      memoryEntries,
      hookDir: HOOK_DIR,
    })
  } catch (err) {
    logger.error({ err }, 'Hermes status check failed')
    return NextResponse.json({ error: 'Failed to check hermes status' }, { status: 500 })
  }
}

function stripAnsiAndControl(input: string): string {
  return input
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\u009b[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
}

function extractDeviceAuth(output: string): { cleanOutput: string; deviceUrl: string | null; userCode: string | null } {
  const cleanOutput = stripAnsiAndControl(output).replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const deviceUrl = cleanOutput.match(/https?:\/\/[^\s)]+/i)?.[0] || null
  const userCode =
    cleanOutput.match(/(?:code|user code|device code)\s*[:=]\s*([A-Z0-9-]{4,})/i)?.[1]
    || cleanOutput.match(/\b[A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+\b/)?.[0]
    || null
  return { cleanOutput, deviceUrl, userCode }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'install-hook') {
      if (!isHermesInstalled()) {
        return NextResponse.json({ error: 'Hermes is not installed (~/.hermes/ not found)' }, { status: 400 })
      }

      mkdirSync(HOOK_DIR, { recursive: true })

      // Write HOOK.yaml
      writeFileSync(join(HOOK_DIR, 'HOOK.yaml'), HOOK_YAML, 'utf8')

      // Write handler.py
      writeFileSync(join(HOOK_DIR, 'handler.py'), HANDLER_PY, 'utf8')

      logger.info('Installed Mission Control hook for Hermes Agent')
      return NextResponse.json({ success: true, message: 'Hook installed', hookDir: HOOK_DIR })
    }

    if (action === 'uninstall-hook') {
      if (existsSync(HOOK_DIR)) {
        rmSync(HOOK_DIR, { recursive: true, force: true })
      }

      logger.info('Uninstalled Mission Control hook for Hermes Agent')
      return NextResponse.json({ success: true, message: 'Hook uninstalled' })
    }

    if (action === 'set-env') {
      const { key, value } = body
      if (!key || typeof key !== 'string' || !value || typeof value !== 'string') {
        return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
      }
      // Only allow known env var keys
      const ALLOWED_KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'NOUS_API_KEY', 'GOOGLE_API_KEY', 'XAI_API_KEY']
      if (!ALLOWED_KEYS.includes(key)) {
        return NextResponse.json({ error: `Key must be one of: ${ALLOWED_KEYS.join(', ')}` }, { status: 400 })
      }

      const envPath = join(HERMES_HOME, '.env')
      let envContent = ''
      try { envContent = require('node:fs').readFileSync(envPath, 'utf8') } catch { /* new file */ }

      // Replace existing key or append
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`)
      } else {
        envContent = envContent.trimEnd() + `\n${key}=${value}\n`
      }

      writeFileSync(envPath, envContent, 'utf8')
      logger.info({ key }, 'Hermes env var set via setup wizard')
      return NextResponse.json({ success: true })
    }

    if (action === 'set-soul') {
      const { content } = body
      if (typeof content !== 'string') {
        return NextResponse.json({ error: 'content is required' }, { status: 400 })
      }

      const soulPath = join(HERMES_HOME, 'SOUL.md')
      writeFileSync(soulPath, content, 'utf8')
      logger.info('Hermes SOUL.md updated via setup wizard')
      return NextResponse.json({ success: true })
    }

    if (action === 'run-oauth-model') {
      const { model, provider, authMethod } = body
      const hermesBin = join(HERMES_HOME, 'hermes-agent', 'venv', 'bin', 'hermes')
      const bin = existsSync(hermesBin) ? hermesBin : 'hermes'
      const HOME_DIR = existsSync(join(dataDir, '.hermes')) ? dataDir : homeDir
      const baseEnv = {
        ...process.env,
        HOME: HOME_DIR,
        PATH: `${join(dataDir, '.local', 'bin')}:${process.env.PATH || ''}`,
      }

      try {
        const { runCommand } = require('@/lib/command')

        const requestedProvider = typeof provider === 'string' && provider.trim() ? provider.trim() : 'openai-codex'
        const providerForOAuth = requestedProvider === 'openai' ? 'openai-codex' : requestedProvider
        const requestedAuthMethod = typeof authMethod === 'string' ? authMethod.trim().toLowerCase() : 'device_code'
        if (requestedAuthMethod !== 'device_code') {
          return NextResponse.json({ success: false, error: `Unsupported OAuth auth method: ${requestedAuthMethod}` }, { status: 400 })
        }

        // Ensure provider/model are preselected before invoking device-code auth.
        await runCommand(bin, ['config', 'set', 'model.provider', providerForOAuth], {
          timeoutMs: 15_000,
          env: {
            ...baseEnv,
            HERMES_NONINTERACTIVE: '1',
            CI: '1',
          },
        })

        if (typeof model === 'string' && model.trim()) {
          await runCommand(bin, ['config', 'set', 'model.default', model.trim()], {
            timeoutMs: 15_000,
            env: {
              ...baseEnv,
              HERMES_NONINTERACTIVE: '1',
              CI: '1',
            },
          })
        }

        // Run OAuth/device-code flow inside a PTY so interactive prompts/device codes are emitted.
        const nodePty = await import('node-pty')
        const ptySpawn = nodePty.spawn || (nodePty as any).default?.spawn
        if (!ptySpawn) throw new Error('node-pty spawn unavailable')

        const oauthResult: { code: number; output: string } = await new Promise((resolve) => {
          let output = ''
          let done = false

          const pty = ptySpawn(bin, ['model'], {
            name: 'xterm-256color',
            cols: 120,
            rows: 30,
            cwd: HOME_DIR || process.cwd(),
            env: {
              ...baseEnv,
              TERM: 'xterm-256color',
            } as Record<string, string>,
          })

          const autoInputDelays = [250, 900, 1800]
          autoInputDelays.forEach((delayMs) => {
            setTimeout(() => {
              if (done) return
              try { pty.write('\r') } catch { /* ignore */ }
            }, delayMs)
          })

          const timeout = setTimeout(() => {
            if (done) return
            done = true
            try { pty.kill() } catch { /* ignore */ }
            resolve({ code: 124, output: output.trim() })
          }, 300_000)

          pty.onData((data: string) => {
            output += data
            if (output.length > 50_000) output = output.slice(-50_000)
          })

          pty.onExit(({ exitCode }: { exitCode: number }) => {
            if (done) return
            done = true
            clearTimeout(timeout)
            resolve({ code: exitCode ?? 1, output: output.trim() })
          })
        })

        const parsed = extractDeviceAuth(oauthResult.output)
        const success = oauthResult.code === 0

        return NextResponse.json({
          success,
          output: parsed.cleanOutput || (success ? 'Authentication complete.' : ''),
          code: oauthResult.code,
          deviceUrl: parsed.deviceUrl,
          userCode: parsed.userCode,
        })
      } catch (err: any) {
        const parsed = extractDeviceAuth((err?.stdout || '') + '\n' + (err?.stderr || ''))
        return NextResponse.json({
          success: false,
          error: err?.message || 'OAuth command failed',
          output: parsed.cleanOutput,
          deviceUrl: parsed.deviceUrl,
          userCode: parsed.userCode,
        })
      }
    }

    if (action === 'run-command') {
      const { command } = body
      if (!command || typeof command !== 'string') {
        return NextResponse.json({ error: 'command is required' }, { status: 400 })
      }

      // Only allow hermes commands for security
      const trimmed = command.trim()
      if (!trimmed.startsWith('hermes')) {
        return NextResponse.json({ error: 'Only hermes commands are allowed' }, { status: 400 })
      }

      // Parse command into binary + args
      const parts = trimmed.split(/\s+/)
      const hermesBin = join(HERMES_HOME, 'hermes-agent', 'venv', 'bin', 'hermes')
      const bin = existsSync(hermesBin) ? hermesBin : parts[0]
      const args = parts.slice(1)

      // Add --non-interactive flags for commands that might prompt
      const env = {
        ...process.env,
        HOME: existsSync(join(dataDir, '.hermes')) ? dataDir : homeDir,
        HERMES_NONINTERACTIVE: '1',
        CI: '1',
        PATH: `${join(dataDir, '.local', 'bin')}:${process.env.PATH || ''}`,
      }

      try {
        const { runCommand } = require('@/lib/command')
        const result = await runCommand(bin, args, {
          timeoutMs: 30_000,
          env,
        })
        return NextResponse.json({
          success: result.code === 0,
          output: (result.stdout + '\n' + result.stderr).trim(),
          code: result.code,
        })
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          error: err?.message || 'Command failed',
          output: (err?.stdout || '') + '\n' + (err?.stderr || ''),
        })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    logger.error({ err }, 'Hermes hook management failed')
    return NextResponse.json({ error: err.message || 'Hook operation failed' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Hook file contents
// ---------------------------------------------------------------------------

const HOOK_YAML = `name: mission-control
description: Reports agent telemetry to Mission Control
version: "1.1"
events:
  - agent:start
  - agent:end
  - session:start
  - task:complete
  - skill:used
  - skill:escalated
  - memory:cited
  - agent:handoff
`

const HANDLER_PY = `"""
Mission Control hook for Hermes Agent.
Reports session telemetry to the MC /api/sessions endpoint.

Configuration (via ~/.hermes/.env or environment):
  MC_URL      - Mission Control base URL (default: http://localhost:3000)
  MC_API_KEY  - API key for authentication (optional)
"""

import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger("hooks.mission-control")

MC_URL = os.environ.get("MC_URL", "http://localhost:3000")
MC_API_KEY = os.environ.get("MC_API_KEY", "")


def _headers():
    h = {"Content-Type": "application/json"}
    if MC_API_KEY:
        h["X-Api-Key"] = MC_API_KEY
    return h


async def handle(event_name: str, payload: dict) -> None:
    """
    Called by the Hermes hook registry on matching events.
    Fire-and-forget with a short timeout — never blocks the agent.
    """
    try:
        import httpx
    except ImportError:
        logger.debug("httpx not available, skipping MC telemetry")
        return

    try:
        if event_name == "agent:start":
            await _report_agent_start(payload)
        elif event_name == "agent:end":
            await _report_agent_end(payload)
        elif event_name == "session:start":
            await _report_session_start(payload)
        elif event_name == "task:complete":
            await _report_task_outcome(payload)
        elif event_name == "skill:used":
            await _report_skill_used(payload, success=True)
        elif event_name == "skill:escalated":
            await _report_skill_used(payload, success=False)
            await _report_escalation(payload)
        elif event_name == "memory:cited":
            await _report_memory_use(payload)
        elif event_name == "agent:handoff":
            await _report_collaboration(payload)
    except Exception as exc:
        logger.debug("MC hook error (%s): %s", event_name, exc)


async def _post(path: str, data: dict, timeout: float = 4.0) -> None:
    """POST helper. Never raises — Hermes execution must never crash on telemetry."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            await client.post(f"{MC_URL}{path}", json=data, headers=_headers())
    except Exception as exc:
        logger.debug("MC POST %s failed: %s", path, exc)


async def _report_agent_start(payload: dict) -> None:
    data = {
        "name": payload.get("agent_name", "hermes"),
        "role": "Hermes Agent",
        "status": "active",
        "source": "hermes-hook",
    }
    await _post("/api/agents", data)


async def _report_agent_end(payload: dict) -> None:
    data = {
        "name": payload.get("agent_name", "hermes"),
        "status": "idle",
        "source": "hermes-hook",
    }
    await _post("/api/agents", data)


async def _report_session_start(payload: dict) -> None:
    data = {
        "event": "session:start",
        "session_id": payload.get("session_id", ""),
        "source": payload.get("source", "cli"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await _post("/api/hermes/events", data)


async def _report_skill_used(payload: dict, *, success: bool) -> None:
    """
    Report a skill activation. Maps to runtime-telemetry contract:
      POST /api/skills/event
    """
    data = {
        "skillSlug": payload.get("skill_slug") or payload.get("skill") or "",
        "agentSlug": payload.get("agent_slug") or payload.get("agent_name"),
        "valueImpactCents": int(payload.get("value_cents", 0) or 0),
        "durationMinutes": payload.get("duration_min"),
        "success": success,
        "taskId": payload.get("task_id"),
        "note": (payload.get("summary") or payload.get("note") or "")[:240],
    }
    if not data["skillSlug"]:
        return
    await _post("/api/skills/event", data)


async def _report_task_outcome(payload: dict) -> None:
    """
    Report a completed/failed/partial task. Maps to:
      POST /api/agents/outcome
    Also calls /api/skills/event when the task carries a skill slug.
    """
    status = payload.get("status") or ("done" if payload.get("success", True) else "failed")
    data = {
        "agentSlug": payload.get("agent_slug") or payload.get("agent_name"),
        "taskId": payload.get("task_id"),
        "status": status if status in ("done", "failed", "partial") else "done",
        "valueImpactCents": int(payload.get("value_cents", 0) or 0),
        "durationMinutes": payload.get("duration_min"),
        "summary": (payload.get("summary") or "")[:180],
    }
    await _post("/api/agents/outcome", data)
    if payload.get("skill_slug"):
        await _report_skill_used(payload, success=(status == "done"))


async def _report_escalation(payload: dict) -> None:
    data = {
        "agentSlug": payload.get("agent_slug") or payload.get("agent_name"),
        "taskId": payload.get("task_id"),
        "reason": (payload.get("reason") or payload.get("summary") or "Escalated by runtime")[:240],
        "severity": payload.get("severity", "medium"),
        "source": payload.get("memory_source") or "Internal",
    }
    await _post("/api/agents/escalation", data)


async def _report_memory_use(payload: dict) -> None:
    src = payload.get("source") or "Internal"
    if src not in ("Obsidian", "Notion", "Pinecone", "Internal"):
        src = "Internal"
    data = {
        "agentSlug": payload.get("agent_slug") or payload.get("agent_name"),
        "taskId": payload.get("task_id"),
        "source": src,
        "title": (payload.get("title") or payload.get("memory_title") or "Memory citation")[:180],
        "excerpt": (payload.get("excerpt") or "")[:240],
        "rationale": (payload.get("rationale") or "")[:240],
    }
    if not data["title"]:
        return
    await _post("/api/agents/memory-use", data)


async def _report_collaboration(payload: dict) -> None:
    data = {
        "fromAgentSlug": payload.get("from_agent_slug") or payload.get("agent_slug"),
        "toAgentSlug": payload.get("to_agent_slug"),
        "taskId": payload.get("task_id"),
        "reason": (payload.get("reason") or "")[:240],
    }
    if not data["fromAgentSlug"] or not data["toAgentSlug"]:
        return
    await _post("/api/agents/collaboration", data)
`

export const dynamic = 'force-dynamic'
