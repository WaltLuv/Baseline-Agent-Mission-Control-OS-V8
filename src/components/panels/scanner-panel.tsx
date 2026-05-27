'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ScanLocation {
  id: string
  name: string
  tool: string
  path: string
  exists: boolean
  readable: boolean
  config: Record<string, unknown> | null
  masked: boolean
  status: 'detected' | 'not_found' | 'unreadable'
  registered: boolean
}

interface ScanRun {
  id: string
  startedAt: number
  completedAt: number
  duration: number
  locations: ScanLocation[]
  summary: {
    total: number
    detected: number
    notFound: number
    unreadable: number
  }
}

const TOOL_BADGES: Record<string, string> = {
  claude: '💚',
  codex: '🔵',
  openclaw: '🐾',
  hermes: '🪨',
  agents: '🤖',
  mcp: '🔌',
  obsidian: '📔',
  git: '⎇',
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    detected: 'bg-green-500/20 text-green-400 border-green-500/30',
    not_found: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    unreadable: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  const labels: Record<string, string> = {
    detected: 'Detected',
    not_found: 'Not Found',
    unreadable: 'Unreadable',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || colors.not_found}`}>
      {status === 'detected' && '●'}
      {status === 'not_found' && '○'}
      {status === 'unreadable' && '✕'}
      {labels[status] || status}
    </span>
  )
}

/**
 * Agent Discovery Scanner Panel
 * Admin-only UI for scanning local AI tools and agents.
 */
export function AgentScannerPanel() {
  const [enabled, setEnabled] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [lastScan, setLastScan] = useState<ScanRun | null>(null)
  const [showConfirm, setShowConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/scanner/runs')
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      if (data.runs.length) setLastScan(data.runs[0])
    } catch {
      // ignore — scanner may not be enabled
    }
  }, [])

  useEffect(() => {
    if (enabled) fetchRuns()
  }, [enabled, fetchRuns])

  const handleScan = async () => {
    if (!enabled) return
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/scanner/scan', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setLastScan(data.scan)
    } catch (err: any) {
      setError(err.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleRegister = async (scanId: string, locationId: string) => {
    setRegistering(true)
    setShowConfirm(null)
    try {
      const res = await fetch('/api/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          register: [{ scanId, locationId }],
        }),
      })
      if (!res.ok) throw new Error('Registration failed')
      const data = await res.json()
      setLastScan(data.scan)
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  if (!enabled) {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-zinc-300">Agent Discovery Scanner</h3>
        <p className="text-xs text-zinc-500">
          Scans local file system for installed AI tools and agents.
          Read-only operation. All secrets are automatically masked.
        </p>
        <button
          onClick={() => setEnabled(true)}
          className="self-start px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
        >
          Enable Scanner
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div data-testid="panel-story-scanner" className="rounded-lg border border-border/60 bg-card/20 p-3">
        <h2 className="text-base font-semibold text-foreground">Local AI Discovery</h2>
        <p className="mt-0.5 text-xs text-muted-foreground max-w-2xl">
          Story: scan this machine for already-installed AI tools (Claude, Codex, OpenClaw, MCP) and adopt them as AI employees in one click. Read-only and secrets-masked.
        </p>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-300">Agent Discovery Scanner</h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
            Enabled
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleScan}
            disabled={scanning}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            {scanning ? '⏳ Scanning...' : '🔍 Run Scan'}
          </Button>
          <button
            onClick={() => setEnabled(false)}
            className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Disable
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-md text-xs bg-red-500/10 text-red-400 border border-red-500/20">
          ⚠ {error}
        </div>
      )}

      {/* Summary */}
      {lastScan && (
        <div className="flex gap-3 text-xs">
          <span className="text-zinc-500">Last scan: <span className="text-zinc-300">{new Date(lastScan.startedAt).toLocaleTimeString()}</span></span>
          <span className="text-zinc-500">Duration: <span className="text-zinc-300">{lastScan.duration}ms</span></span>
          <span className="text-zinc-500">Found: <span className="text-green-400">{lastScan.summary.detected}</span> / {lastScan.summary.total}</span>
        </div>
      )}

      {/* Results Table */}
      {lastScan && lastScan.locations.length > 0 && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-3 py-2 text-zinc-500 font-medium"></th>
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">Tool</th>
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">Path</th>
                <th className="text-center px-3 py-2 text-zinc-500 font-medium">Status</th>
                <th className="text-center px-3 py-2 text-zinc-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {lastScan.locations.map((loc) => (
                <tr key={loc.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-3 py-2 text-lg">
                    {TOOL_BADGES[loc.tool] || '🔎'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-zinc-200">{loc.name}</span>
                    {loc.masked && (
                      <span className="ml-1 text-zinc-600" title="Secrets masked">🔒</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-400 font-mono truncate max-w-[200px]" title={loc.path}>
                    {loc.path}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={loc.status} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {loc.status === 'detected' && !loc.registered ? (
                      lastScan && (
                        <button
                          onClick={() => setShowConfirm(`${lastScan.id}:${loc.id}`)}
                          disabled={registering}
                          className="px-2 py-1 text-xs font-medium rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                        >
                          Register
                        </button>
                      )
                    ) : loc.registered ? (
                      <span className="text-xs text-green-400">✓ Registered</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {enabled && !lastScan && !scanning && (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-500 text-sm">
          <span className="text-2xl">🔍</span>
          <span>No scans yet. Click &quot;Run Scan&quot; to discover local AI tools.</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h4 className="text-sm font-semibold text-zinc-200 mb-2">Confirm Registration</h4>
            <p className="text-xs text-zinc-400 mb-4">
              This will register the detected agent with Mission Control.
              The agent will become available for task assignment.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const [scanId, locationId] = showConfirm.split(':')
                  handleRegister(scanId, locationId)
                }}
                disabled={registering}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {registering ? 'Registering...' : 'Confirm Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
