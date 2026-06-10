'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

/**
 * <WorkforceInstaller /> — the "Install Your First System" step.
 *
 * Customer flow:
 *   1. Catalog grid: Property Management (Ready) + 7 verticals (Coming soon)
 *   2. Click "Install" on Property Management → 60-second progress strip
 *      (the actual API call is <200ms; the progress strip exists so the
 *      install FEELS like 6 people being onboarded, not a JSON POST)
 *   3. Installed state: persona roster + deep links into the supervisor surfaces
 */

interface Template {
  slug: string
  vertical: string
  headline: string
  tagline: string
  install_seconds: number
  status: 'ready' | 'coming_soon'
  persona_count: number
  workflow_count: number
  tool_count: number
  personas: Array<{ slug: string; name: string; role: string; description: string }>
  workflows: Array<{ slug: string; title: string; description: string; approval_policy: string; owner_persona: string }>
  tools: Array<{ cli_tool_id: string; label: string; description: string; state: string; default_risk: string }>
  approval_summary: { auto: string[]; medium: string[]; high: string[]; blocked: string[] }
  install_state: { installed: boolean; meta: Record<string, unknown> | null }
}

interface InstallResult {
  template: string
  status: 'installed' | 'already_installed' | 'unavailable'
  personas: Array<{ id: number; slug: string; name: string; role: string }>
  workflows: Array<{ id: number; slug: string; title: string }>
  tools: Array<{ cli_tool_id: string; label: string; state: string }>
  deep_links: {
    agents: string
    tasks: string
    tool_executions: string
    approvals: string
    runtime_registry: string
  }
}

interface Props {
  onComplete: () => void
  onSkip: () => void
}

export function WorkforceInstaller({ onComplete, onSkip }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installProgress, setInstallProgress] = useState(0)
  const [result, setResult] = useState<InstallResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/workforce/templates', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { templates: Template[] }
      // Property Management is the default target — always first.
      const sorted = [...data.templates].sort((a, b) =>
        a.slug === 'property-management' ? -1 : b.slug === 'property-management' ? 1 : 0,
      )
      setTemplates(sorted)
      // Auto-expand the flagship.
      const flag = data.templates.find((t) => t.slug === 'property-management')
      if (flag) setSelected(flag.slug)
      // If already installed, show the result panel immediately.
      if (flag?.install_state?.installed) {
        // Fetch a synthetic InstallResult shape from the catalog detail.
        setResult({
          template: flag.slug,
          status: 'already_installed',
          personas: flag.personas.map((p, i) => ({ id: 0, slug: p.slug, name: p.name, role: p.role })),
          workflows: flag.workflows.map((w, i) => ({ id: 0, slug: w.slug, title: w.title })),
          tools: flag.tools.map((t) => ({ cli_tool_id: t.cli_tool_id, label: t.label, state: t.state })),
          deep_links: {
            agents: '/app/agents',
            tasks: '/app/tasks',
            tool_executions: '/app/tool-executions',
            approvals: '/app/tool-executions?status=pending_approval',
            runtime_registry: '/app/runtime-validation',
          },
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function install(slug: string) {
    setError(null)
    setInstalling(slug)
    setInstallProgress(0)
    // Cosmetic progress strip — gives the customer a "this is meaningful" moment.
    const tmpl = templates.find((t) => t.slug === slug)
    const seconds = Math.max(8, Math.min(15, tmpl?.install_seconds ?? 60))
    const startedAt = Date.now()
    const ticker = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000
      setInstallProgress(Math.min(95, Math.round((elapsed / seconds) * 100)))
    }, 200)
    try {
      const res = await fetch('/api/workforce/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: slug }),
      })
      const data = (await res.json()) as InstallResult & { error?: string }
      if (!res.ok || data.status === 'unavailable') {
        throw new Error(data.error || 'install failed')
      }
      // Wait at least 8s so the customer sees the progress strip animate.
      const minDuration = 8000
      const elapsed = Date.now() - startedAt
      if (elapsed < minDuration) await new Promise((r) => setTimeout(r, minDuration - elapsed))
      setInstallProgress(100)
      setResult(data)
      // Mark the step complete after a beat so the success state lands.
      setTimeout(() => onComplete(), 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'install failed')
    } finally {
      clearInterval(ticker)
      setInstalling(null)
    }
  }

  if (loading) return <div className="text-sm text-white/55">Loading workforce catalog…</div>

  // Installed state — render the persona roster + deep links.
  if (result) {
    const tmpl = templates.find((t) => t.slug === result.template)
    return (
      <div className="space-y-5" data-testid="workforce-installed">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-300/80 font-mono mb-1">
            {result.status === 'installed' ? 'Workforce installed' : 'Workforce already installed'}
          </p>
          <h3 className="text-lg font-semibold tracking-tight">
            {tmpl?.vertical} workforce is live in your workspace.
          </h3>
          <p className="text-sm text-white/65 mt-1.5 leading-relaxed">
            {result.personas.length} AI employees provisioned · {result.workflows.length} starter workflows queued ·
            {' '}{result.tools.length} tools tracked
          </p>
        </div>

        {/* Persona grid */}
        <section data-testid="workforce-personas">
          <p className="text-xs uppercase tracking-wider text-white/45 font-mono mb-2">Your AI employees</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.personas.map((p) => {
              const detail = tmpl?.personas.find((x) => x.slug === p.slug)
              return (
                <div
                  key={p.slug}
                  data-testid={`workforce-persona-${p.slug}`}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <p className="text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-[11px] text-violet-300/80 font-mono">{p.role}</p>
                  {detail?.description && (
                    <p className="text-xs text-white/65 mt-1.5 leading-snug">{detail.description}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Deep links */}
        <section data-testid="workforce-deep-links" className="flex flex-wrap gap-2">
          <Link
            href={result.deep_links.tasks}
            className="h-9 px-3 inline-flex items-center rounded-md bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90"
            data-testid="workforce-go-tasks"
          >
            See the {result.workflows.length} queued tasks →
          </Link>
          <Link
            href={result.deep_links.tool_executions}
            className="h-9 px-3 inline-flex items-center rounded-md bg-white/[0.06] text-white/85 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1]"
          >
            Connected Tools
          </Link>
          <Link
            href={result.deep_links.approvals}
            className="h-9 px-3 inline-flex items-center rounded-md bg-white/[0.06] text-white/85 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1]"
          >
            Approval queue
          </Link>
          <Link
            href={result.deep_links.agents}
            className="h-9 px-3 inline-flex items-center rounded-md bg-white/[0.06] text-white/85 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1]"
          >
            Agent roster
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="workforce-installer">
      <header>
        <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono mb-1">
          Install your first workforce
        </p>
        <h3 className="text-lg font-semibold tracking-tight">
          Pick the vertical that matches your business.
        </h3>
        <p className="text-sm text-white/60 mt-1 leading-relaxed">
          A complete AI workforce — employees, workflows, tools, approval rules — installed in under a minute.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Catalog grid — Property Management (primary) is always shown; the
          other verticals collapse under "More templates" so they don't distract
          from the default PM activation path. */}
      <div className="grid grid-cols-1 gap-2" data-testid="workforce-catalog">
        {(() => {
          const isPrimary = (slug: string) => slug === 'property-management'
          const primary = templates.filter((t) => isPrimary(t.slug) || t.install_state?.installed)
          const secondary = templates.filter((t) => !isPrimary(t.slug) && !t.install_state?.installed)
          const renderCard = (t: Template) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => t.status === 'ready' && setSelected(t.slug)}
              disabled={t.status !== 'ready'}
              data-testid={`workforce-card-${t.slug}`}
              data-status={t.status}
              className={`text-left rounded-xl border p-4 transition-colors ${
                t.status !== 'ready'
                  ? 'border-white/[0.04] bg-white/[0.01] opacity-50 cursor-not-allowed'
                  : selected === t.slug
                  ? 'border-violet-400/50 bg-violet-500/[0.06]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-semibold text-white">{t.vertical}</h4>
                    {t.status === 'ready' ? (
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-200">
                        Ready
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.04] text-white/45">
                        Coming soon
                      </span>
                    )}
                    {t.install_state?.installed && (
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/25 text-emerald-100">
                        Installed
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/65 mt-1 leading-snug">{t.tagline}</p>
                  {t.status === 'ready' && (
                    <p className="text-[11px] text-white/45 mt-1.5 font-mono">
                      {t.persona_count} AI employees · {t.workflow_count} workflows · {t.tool_count} tools · ~{t.install_seconds}s
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
          return (
            <>
              {primary.map(renderCard)}
              {secondary.length > 0 && !showMore && (
                <button
                  type="button"
                  onClick={() => setShowMore(true)}
                  data-testid="workforce-more-templates"
                  className="text-left rounded-xl border border-dashed border-white/[0.1] bg-white/[0.01] p-3 text-sm text-white/55 hover:text-white hover:border-white/[0.2]"
                >
                  More templates ({secondary.length}) — Insurance, AI Product Launch & more ▾
                </button>
              )}
              {showMore && secondary.map(renderCard)}
            </>
          )
        })()}
      </div>

      {/* Selected template preview */}
      {selected &&
        (() => {
          const tmpl = templates.find((t) => t.slug === selected)
          if (!tmpl) return null
          return (
            <div
              data-testid={`workforce-preview-${tmpl.slug}`}
              className="rounded-xl border border-violet-400/30 bg-violet-500/[0.04] p-4 space-y-3"
            >
              <p className="text-sm text-white/85 leading-snug">{tmpl.headline}</p>
              {tmpl.approval_summary.high.length > 0 && (
                <div className="text-[11px] text-amber-200/85">
                  <span className="font-mono uppercase tracking-wider text-amber-300/70">Needs your approval:</span>{' '}
                  {tmpl.approval_summary.high.join(', ')}
                </div>
              )}
              {tmpl.approval_summary.blocked.length > 0 && (
                <div className="text-[11px] text-rose-200/85">
                  <span className="font-mono uppercase tracking-wider text-rose-300/70">Always blocked:</span>{' '}
                  {tmpl.approval_summary.blocked.join(', ')}
                </div>
              )}
              {installing === tmpl.slug ? (
                <div className="space-y-2" data-testid="workforce-progress">
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full bg-violet-400 transition-all duration-200"
                      style={{ width: `${installProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-white/55 font-mono">
                    Provisioning {tmpl.vertical} workforce… {installProgress}%
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => install(tmpl.slug)}
                    data-testid={`workforce-install-${tmpl.slug}`}
                    className="h-10 px-5 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90"
                  >
                    Install {tmpl.vertical} Workforce →
                  </button>
                  <button
                    type="button"
                    onClick={onSkip}
                    data-testid="workforce-skip"
                    className="h-10 px-3 text-sm text-white/55 hover:text-white"
                  >
                    Skip for now
                  </button>
                </div>
              )}
            </div>
          )
        })()}
    </div>
  )
}
