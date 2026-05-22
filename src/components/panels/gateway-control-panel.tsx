'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'

interface GatewayStatus {
  type: string
  name: string
  installed: boolean
  running: boolean
  port?: number
  pid?: number | null
  version?: string | null
  error?: string
}

export function GatewayControlPanel() {
  const t = useTranslations('gatewayControl')
  const [gateways, setGateways] = useState<GatewayStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [output, setOutput] = useState<{ gateway: string; text: string; ok: boolean } | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/gateways/control')
      if (res.ok) {
        const data = await res.json()
        setGateways(data.gateways || [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleAction = async (gateway: string, action: string) => {
    const key = `${gateway}:${action}`
    setActionInProgress(key)
    setOutput(null)
    try {
      const res = await fetch('/api/gateways/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway, action }),
      })
      const data = await res.json()
      setOutput({ gateway, text: data.output || data.error || 'Done', ok: data.success !== false })
      // Refresh status after action
      await fetchStatus()
    } catch (err) {
      setOutput({ gateway, text: 'Action failed', ok: false })
    } finally {
      setActionInProgress(null)
    }
  }

  // Compute connection quality based on running gateways
  const runningCount = gateways.filter(g => g.running).length
  const totalCount = gateways.filter(g => g.installed).length
  const connectionQuality = totalCount === 0 ? 'none'
    : runningCount === totalCount ? 'good'
    : runningCount > 0 ? 'degraded'
    : 'critical'

  const qualityConfig = {
    none: { label: t('qualityNone'), color: 'text-muted-foreground', dot: 'bg-muted-foreground/30' },
    good: { label: t('qualityGood'), color: 'text-emerald-400', dot: 'bg-emerald-400' },
    degraded: { label: t('qualityDegraded'), color: 'text-amber-400', dot: 'bg-amber-400 animate-pulse' },
    critical: { label: t('qualityCritical'), color: 'text-red-400', dot: 'bg-red-400 animate-pulse' },
  }
  const q = qualityConfig[connectionQuality]

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">{t('title')}</h2>
        <div className="flex items-center justify-center py-12"><Loader /></div>
      </div>
    )
  }

  const installed = gateways.filter(g => g.installed)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
          </div>
          {/* Connection quality badge */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
            connectionQuality === 'good' ? 'border-emerald-500/30 bg-emerald-500/10' :
            connectionQuality === 'degraded' ? 'border-amber-500/30 bg-amber-500/10' :
            connectionQuality === 'critical' ? 'border-red-500/30 bg-red-500/10' :
            'border-border/30 bg-surface-1/10'
          }`}>
            <span className={`w-2 h-2 rounded-full ${q.dot}`} />
            <span className={q.color}>{q.label}</span>
          </div>
        </div>
        {/* Value context */}
        <div className="mt-3 px-3 py-2 rounded-lg border border-border/20 bg-card/50">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t('whatIsGatewayTitle')}</span>{' '}
            {t('whatIsGateway')}
          </p>
        </div>
      </div>

      {installed.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm font-medium">{t('noGatewaysInstalled')}</p>
          <p className="text-xs mt-1">{t('installHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {installed.map((gw) => {
            const isActing = actionInProgress?.startsWith(`${gw.type}:`)
            return (
              <div
                key={gw.type}
                className={`rounded-lg border overflow-hidden transition-all ${
                  gw.running
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border/30 bg-surface-1/10'
                }`}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${gw.running ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/30'}`} />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{gw.name}</h3>
                        <p className="text-2xs text-muted-foreground">
                          {gw.running ? t('running') : t('stopped')}
                          {gw.pid && <span className="ml-1.5 font-mono">(PID {gw.pid})</span>}
                          {gw.port && <span className="ml-1.5">port {gw.port}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {gw.running ? (
                        <>
                          <Button
                            variant="ghost" size="sm"
                            disabled={!!isActing}
                            onClick={() => handleAction(gw.type, 'restart')}
                            className="text-2xs h-7 px-2.5"
                          >
                            {actionInProgress === `${gw.type}:restart` ? t('restarting') : t('restart')}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            disabled={!!isActing}
                            onClick={() => handleAction(gw.type, 'stop')}
                            className="text-2xs h-7 px-2.5 text-red-400 hover:text-red-300"
                          >
                            {actionInProgress === `${gw.type}:stop` ? t('stopping') : t('stop')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost" size="sm"
                          disabled={!!isActing}
                          onClick={() => handleAction(gw.type, 'start')}
                          className="text-2xs h-7 px-2.5 text-emerald-400 hover:text-emerald-300"
                        >
                          {actionInProgress === `${gw.type}:start` ? t('starting') : t('start')}
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        disabled={!!isActing}
                        onClick={() => handleAction(gw.type, 'diagnose')}
                        className="text-2xs h-7 px-2.5"
                      >
                        {actionInProgress === `${gw.type}:diagnose` ? t('diagnosing') : t('diagnose')}
                      </Button>
                    </div>
                  </div>

                  {/* Output */}
                  {output?.gateway === gw.type && (
                    <div className={`mt-2 rounded border px-3 py-2 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto ${
                      output.ok ? 'border-border/20 bg-black/20 text-muted-foreground' : 'border-red-500/20 bg-red-500/5 text-red-400'
                    }`}>
                      {output.text}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Not-installed gateways */}
      {gateways.filter(g => !g.installed).length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/20">
          <p className="text-xs text-muted-foreground mb-2">{t('notInstalled')}</p>
          <div className="flex flex-wrap gap-2">
            {gateways.filter(g => !g.installed).map(gw => (
              <span key={gw.type} className="text-2xs px-2 py-1 rounded bg-surface-1/30 text-muted-foreground/50 border border-border/20">
                {gw.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Troubleshooting section */}
      <div className="mt-6 pt-4 border-t border-border/20">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('troubleshootingTitle')}
        </h3>
        <div className="space-y-2">
          <details className="group rounded-lg border border-border/20 bg-card/30">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground select-none">
              {t('troubleshootNotRunning')}
            </summary>
            <div className="px-3 pb-2 text-xs text-muted-foreground leading-relaxed">
              <p>{t('troubleshootNotRunningHelp')}</p>
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                <li>{t('troubleshootCheck1')}</li>
                <li>{t('troubleshootCheck2')}</li>
                <li>{t('troubleshootCheck3')}</li>
              </ul>
            </div>
          </details>
          <details className="group rounded-lg border border-border/20 bg-card/30">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground select-none">
              {t('troubleshootConnectionIssues')}
            </summary>
            <div className="px-3 pb-2 text-xs text-muted-foreground leading-relaxed">
              <p>{t('troubleshootConnectionHelp')}</p>
            </div>
          </details>
          <details className="group rounded-lg border border-border/20 bg-card/30">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground select-none">
              {t('troubleshootAgentsNot')}
            </summary>
            <div className="px-3 pb-2 text-xs text-muted-foreground leading-relaxed">
              <p>{t('troubleshootAgentsNotHelp')}</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
