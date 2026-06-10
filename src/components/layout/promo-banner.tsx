'use client'

/**
 * Baseline Ecosystem promo strip.
 *
 * Points operators to the two sibling products that share Baseline OS
 * infrastructure. No third-party / dev-shop branding.
 */
export function PromoBanner() {
  return (
    <div className="mx-4 mt-3 mb-0 flex flex-col gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm md:flex-row md:items-center">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-void-cyan shrink-0" />
        <p className="text-xs text-white/70">
          Part of the <span className="font-semibold text-white">Baseline OS</span> ecosystem.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        <a
          href="https://propcontrolempire.com/"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="ecosystem-link-pc-empire"
          className="text-2xs font-medium text-white/80 hover:text-white px-2 py-1 rounded border border-white/15 hover:border-white/30 transition-colors"
        >
          PC Empire
        </a>
        <a
          href="https://propcontrol.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="ecosystem-link-propcontrol"
          className="text-2xs font-medium text-white/80 hover:text-white px-2 py-1 rounded border border-white/15 hover:border-white/30 transition-colors"
        >
          PropControl
        </a>
        <a
          href="https://rehab-vision.emergent.host"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="ecosystem-link-visionops"
          className="text-2xs font-medium text-white/80 hover:text-white px-2 py-1 rounded border border-white/15 hover:border-white/30 transition-colors"
        >
          VisionOps
        </a>
      </div>
    </div>
  )
}
