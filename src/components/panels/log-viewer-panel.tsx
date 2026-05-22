'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { useMissionControl } from '@/store'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('LogViewer')

const MAX_LOG_BUFFER = 1000

type ViewMode = 'developer' | 'customer'

interface LogFilters {
  level?: string
  source?: string
  search?: string
  session?: string
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function LogViewerPanel() {
  const t = useTranslations('logViewer')
  const { logs, logFilters, setLogFilters, clearLogs, addLog } = useMissionControl()
  const [viewMode, setViewMode] = useState<ViewMode>('customer')
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const [availableSources, setAvailableSources] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [logFilePath, setLogFilePath] = useState<string | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<boolean>(true)
  const logsRef = useRef(logs)
  const logFiltersRef = useRef(logFilters)

  const isBufferFull = logs.length >= MAX_LOG_BUFFER

  // Update ref when autoScroll state changes
  useEffect(() => {
    autoScrollRef.current = isAutoScroll
  }, [isAutoScroll])

  // Keep refs in sync so callbacks don't need `logs` / `logFilters` deps.
  useEffect(() => {
    logsRef.current = logs
  }, [logs])

  useEffect(() => {
    logFiltersRef.current = logFilters
  }, [logFilters])

  const loadLogs = useCallback(async (tail = false) => {
    log.debug(`Loading logs (tail=${tail})`)
    setIsLoading(!tail) // Only show loading for initial load, not for tailing

    try {
      const currentFilters = logFiltersRef.current
      const currentLogs = logsRef.current

      const params = new URLSearchParams({
        action: tail ? 'tail' : 'recent',
        limit: '200',
        ...(currentFilters.level && { level: currentFilters.level }),
        ...(currentFilters.source && { source: currentFilters.source }),
        ...(currentFilters.search && { search: currentFilters.search }),
        ...(currentFilters.session && { session: currentFilters.session }),
        ...(tail && currentLogs.length > 0 && { since: currentLogs[0]?.timestamp.toString() })
      })

      log.debug(`Fetching /api/logs?${params}`)
      const response = await fetch(`/api/logs?${params}`)
      const data = await response.json()

      log.debug(`Received ${data.logs?.length || 0} logs from API`)

      if (data.logs && data.logs.length > 0) {
        if (tail) {
          // Add new logs for tail mode - prepend to existing logs
          let newLogsAdded = 0
          const existingIds = new Set((currentLogs || []).map((l: any) => l?.id).filter(Boolean))
          data.logs.reverse().forEach((entry: any) => {
            if (existingIds.has(entry?.id)) return
            addLog(entry)
            newLogsAdded++
          })
          log.debug(`Added ${newLogsAdded} new logs (tail mode)`)
        } else {
          // Replace logs for initial load or refresh
          log.debug(`Clearing existing logs and loading ${data.logs.length} logs`)
          clearLogs() // Clear existing logs
          data.logs.reverse().forEach((entry: any) => {
            addLog(entry)
          })
          log.debug(`Successfully added ${data.logs.length} logs to store`)
        }
      } else {
        log.debug('No logs received from API')
      }
    } catch (error) {
      log.error('Failed to load logs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [addLog, clearLogs])

  const loadSources = useCallback(async () => {
    try {
      const response = await fetch('/api/logs?action=sources')
      const data = await response.json()
      setAvailableSources(data.sources || [])
    } catch (error) {
      log.error('Failed to load log sources:', error)
    }
  }, [])

  // Try to fetch log file path from gateway status
  const loadLogFilePath = useCallback(async () => {
    try {
      const response = await fetch('/api/status')
      const data = await response.json()
      const path = data?.config?.logFile || data?.logFile || null
      setLogFilePath(path)
    } catch {
      // Gateway may not expose this — silently ignore
    }
  }, [])

  // Load initial logs and sources
  useEffect(() => {
    log.debug('Initial load started')
    loadLogs()
    loadSources()
    loadLogFilePath()
  }, [loadLogs, loadSources, loadLogFilePath])

  // Smart polling for log tailing (10s, visibility-aware, logs mostly come via WS)
  const pollLogs = useCallback(() => {
    if (autoScrollRef.current && !isLoading) {
      loadLogs(true) // tail mode
    }
  }, [isLoading, loadLogs])

  useSmartPoll(pollLogs, 30000, { pauseWhenConnected: true })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isAutoScroll])

  const handleFilterChange = (newFilters: Partial<LogFilters>) => {
    setLogFilters(newFilters)
    // Reload logs with new filters
    setTimeout(() => loadLogs(), 100)
  }

  const handleScrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      case 'debug': return 'text-muted-foreground'
      default: return 'text-foreground'
    }
  }

  const getLogLevelBg = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'bg-red-500/10 border-red-500/20'
      case 'warn': return 'bg-yellow-500/10 border-yellow-500/20'
      case 'info': return 'bg-blue-500/10 border-blue-500/20'
      case 'debug': return 'bg-gray-500/10 border-gray-500/20'
      default: return 'bg-secondary border-border'
    }
  }

  const filteredLogs = logs.filter(entry => {
    if (logFilters.level && entry.level !== logFilters.level) return false
    if (logFilters.source && entry.source !== logFilters.source) return false
    if (logFilters.search && !entry.message.toLowerCase().includes(logFilters.search.toLowerCase())) return false
    if (logFilters.session && (!entry.session || !entry.session.includes(logFilters.session))) return false
    return true
  })

  const handleExportText = useCallback(() => {
    const lines = filteredLogs.map(entry => {
      const ts = new Date(entry.timestamp).toISOString()
      return `[${ts}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`
    })
    const filename = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`
    downloadFile(lines.join('\n'), filename, 'text/plain')
  }, [filteredLogs])

  const handleExportJson = useCallback(() => {
    const filename = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    downloadFile(JSON.stringify(filteredLogs, null, 2), filename, 'application/json')
  }, [filteredLogs])

  // Debug logging
  log.debug(`Store has ${logs.length} logs, filtered to ${filteredLogs.length}`)

  // ── Customer View aggregates ──────────────────────────────────────────────
  const oneHourAgo = Date.now() - 3600_000
  const issueLogs = logs.filter(l => l.level === 'error' || l.level === 'warn')
  const recentIssues = issueLogs.filter(l => {
    const ts = new Date(l.timestamp).getTime()
    return ts >= oneHourAgo
  })
  const errorCount = recentIssues.filter(l => l.level === 'error').length
  const warningCount = recentIssues.filter(l => l.level === 'warn').length

  // Bucket by message pattern for counting error types
  const errorBuckets: Record<string, { count: number; latest: any }> = {}
  for (const entry of recentIssues) {
    const key = `${entry.level}|${entry.source}|${entry.message.substring(0, 80)}`
    if (errorBuckets[key]) {
      errorBuckets[key].count++
      if (new Date(entry.timestamp).getTime() > new Date(errorBuckets[key].latest.timestamp).getTime()) {
        errorBuckets[key].latest = entry
      }
    } else {
      errorBuckets[key] = { count: 1, latest: entry }
    }
  }
  const groupedIssues = Object.values(errorBuckets)
    .map(b => ({ ...b.latest, occurrences: b.count }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Trend arrow: compare last hour vs previous hour
  const twoHoursAgo = Date.now() - 7200_000
  const prevHourIssues = issueLogs.filter(l => {
    const ts = new Date(l.timestamp).getTime()
    return ts >= twoHoursAgo && ts < oneHourAgo
  }).length
  const recentTotal = recentIssues.length
  const trendDirection = prevHourIssues === 0
    ? (recentTotal > 0 ? 'up' as const : 'flat' as const)
    : recentTotal > prevHourIssues
      ? 'up' as const
      : recentTotal < prevHourIssues
        ? 'down' as const
        : 'flat' as const

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      <div className="border-b border-border pb-4">
        {/* View Mode Toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode('customer')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'customer' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
            >
              Customer View
            </button>
            <button
              onClick={() => setViewMode('developer')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'developer' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
            >
              Developer View
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <div className={`flex items-center gap-3 text-sm p-2 rounded-md border ${errorCount > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
          <span className="font-medium">
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium text-yellow-400">
            {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
          </span>
          <span className="text-muted-foreground ml-2">in last hour</span>
          <span className="ml-auto text-lg">
            {trendDirection === 'up' && '↑'}
            {trendDirection === 'down' && '↓'}
            {trendDirection === 'flat' && '→'}
          </span>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
      <p className="text-muted-foreground mt-2">
        {t('description')}
        {logFilePath && (
          <span className="ml-3 font-mono text-xs text-muted-foreground/70">{logFilePath}</span>
        )}
      </p>

      {/* Filters and Controls */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Level Filter */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('filterLevel')}
            </label>
            <select
              value={logFilters.level || ''}
              onChange={(e) => handleFilterChange({ level: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">{t('allLevels')}</option>
              <option value="error">{t('levelError')}</option>
              <option value="warn">{t('levelWarning')}</option>
              <option value="info">{t('levelInfo')}</option>
              <option value="debug">{t('levelDebug')}</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('filterSource')}
            </label>
            <select
              value={logFilters.source || ''}
              onChange={(e) => handleFilterChange({ source: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">{t('allSources')}</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>

          {/* Session Filter */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('filterSession')}
            </label>
            <input
              type="text"
              value={logFilters.session || ''}
              onChange={(e) => handleFilterChange({ session: e.target.value || undefined })}
              placeholder={t('sessionPlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Search Filter */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('filterSearch')}
            </label>
            <input
              type="text"
              value={logFilters.search || ''}
              onChange={(e) => handleFilterChange({ search: e.target.value || undefined })}
              placeholder={t('searchPlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Controls */}
          <div className="flex items-end space-x-2">
            <Button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              variant={isAutoScroll ? 'success' : 'outline'}
            >
              {isAutoScroll ? t('auto') : t('manual')}
            </Button>
            <Button
              onClick={handleScrollToBottom}
              className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
            >
              {t('bottom')}
            </Button>
          </div>

          {/* Export & Clear */}
          <div className="flex items-end space-x-2">
            <Button
              onClick={handleExportText}
              disabled={filteredLogs.length === 0}
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {t('exportLog')}
            </Button>
            <Button
              onClick={handleExportJson}
              disabled={filteredLogs.length === 0}
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {t('exportJson')}
            </Button>
            <Button
              onClick={clearLogs}
              variant="destructive"
            >
              {t('clear')}
            </Button>
          </div>
        </div>
      </div>

      {/* Log Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{t('showing', { filtered: filteredLogs.length, total: logs.length })}</span>
          {isBufferFull && (
            <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
              {t('bufferFull', { max: MAX_LOG_BUFFER })}
            </span>
          )}
        </div>
        <div>
          {t('autoScroll')}: {isAutoScroll ? t('on') : t('off')} •
          {t('lastUpdated')}: {logs.length > 0 ? new Date(logs[0]?.timestamp).toLocaleTimeString() : t('never')}
        </div>
      </div>

      {/* Log Display */}
      <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden">
        {viewMode === 'customer' ? (
          /* ── Customer View: error/warning cards ──────────────────────── */
          <div className="overflow-auto p-4 space-y-3" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {isLoading ? (
              <Loader variant="panel" label="Loading logs" />
            ) : groupedIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <span className="text-lg mb-1">No issues found</span>
                <span className="text-sm">No errors or warnings in the last hour.</span>
              </div>
            ) : (
              groupedIssues.map((issue, idx) => (
                <div
                  key={`${issue.id || idx}`}
                  className={`border-l-4 pl-4 py-3 rounded-r-md ${getLogLevelBg(issue.level)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <span className={`font-semibold uppercase px-1.5 py-0.5 rounded text-white ${
                          issue.level === 'error' ? 'bg-red-500' : 'bg-amber-500'
                        }`}>
                          {issue.level}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(issue.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-muted-foreground">[{issue.source}]</span>
                        {issue.occurrences > 1 && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                            ×{issue.occurrences}
                          </span>
                        )}
                      </div>
                      <div className="text-foreground break-words">{issue.message}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ── Developer View: raw log feed ────────────────────────────── */
          <div
            ref={logContainerRef}
            className="h-full overflow-auto p-4 space-y-2 font-mono text-sm"
          >
            {isLoading ? (
              <Loader variant="panel" label="Loading logs" />
            ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              {t('noLogs')}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className={`border-l-4 pl-4 py-2 rounded-r-md ${getLogLevelBg(log.level)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`font-medium uppercase ${getLogLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-muted-foreground">
                        [{log.source}]
                      </span>
                      {log.session && (
                        <span className="text-muted-foreground">
                          session:{log.session}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-foreground break-words">
                      {log.message}
                    </div>
                    {log.data && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          {t('additionalData')}
                        </summary>
                        <pre className="mt-1 text-xs text-muted-foreground overflow-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        )}
      </div>
    </div>
  )
}
