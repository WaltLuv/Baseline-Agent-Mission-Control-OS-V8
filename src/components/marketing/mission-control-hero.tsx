'use client'

/**
 * Mission Control cinematic hero. The "best available local asset": a real
 * animated CSS/SVG command-center scene (holographic grid, pulsing agent nodes
 * + neural links, the maintenance→approval→proof workflow flowing across the
 * floor) rendered live in-browser — no external render needed.
 *
 * A <video autoPlay muted loop playsInline poster> is layered on top and shows
 * the rendered cinematic MP4/WebM the moment Creative OS exports it to
 * /marketing/. Until then it gracefully falls back to the poster + animated
 * scene (no broken state, no layout shift). Honest by design.
 */
// Thumbnail / opening frame = the property-operator source image (also saved to
// Baseline OS Universal Asset Library). The cinematic poster SVG is the fallback.
const POSTER = '/marketing/mission-control-hero-opening.jpg'
const OPENING = '/marketing/mission-control-hero-opening.jpg'
const NODES = [
  { cx: 50, cy: 38, r: 5, d: 0 }, { cx: 30, cy: 26, r: 3.2, d: 0.6 }, { cx: 70, cy: 26, r: 3.2, d: 1.2 },
  { cx: 22, cy: 48, r: 2.6, d: 0.3 }, { cx: 78, cy: 48, r: 2.6, d: 0.9 }, { cx: 42, cy: 18, r: 2.4, d: 1.5 }, { cx: 60, cy: 18, r: 2.4, d: 0.45 },
]
const FLOW = ['Maintenance', 'Triage', 'Vendor', 'Owner Approval', 'Dispatch', 'Proof', 'Replay']

export function MissionControlHero() {
  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#05060c]"
      data-testid="hero-video-stage"
    >
      {/* Opening frame — the operator source image, cinematic fade-in → reveal */}
      <div className="mc-hero-intro absolute inset-0 z-20" aria-hidden data-testid="hero-opening">
        <img src={OPENING} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05060c] via-[#05060c]/30 to-transparent" />
      </div>

      {/* Animated cinematic scene (always renders) */}
      <div className="absolute inset-0" aria-hidden data-testid="hero-animation">
        <div className="mc-hero-bg absolute inset-0" />
        <div className="mc-hero-grid absolute inset-x-0 bottom-0 h-1/2" />
        <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
          <g stroke="#43E5FF" strokeWidth="0.18" opacity="0.5">
            {NODES.slice(1).map((n, i) => <line key={i} x1="50" y1="38" x2={n.cx} y2={n.cy} className="mc-link" style={{ animationDelay: `${n.d}s` }} />)}
          </g>
          {NODES.map((n, i) => (
            <circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill="#43E5FF" className="mc-node" style={{ animationDelay: `${n.d}s` }} />
          ))}
        </svg>
      </div>

      {/* Cinematic export (drops in when Creative OS renders it; falls back to poster) */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster={POSTER}
        preload="none"
        data-testid="hero-video"
      >
        <source src="/marketing/mission-control-hero.webm" type="video/webm" />
        <source src="/marketing/mission-control-hero.mp4" type="video/mp4" />
      </video>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060c]/85 via-[#05060c]/20 to-transparent" />

      {/* Live workflow ticker — the PM story, moving */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-white/[0.06] bg-black/40 backdrop-blur-sm">
        <div className="mc-hero-ticker flex items-center gap-3 whitespace-nowrap px-4 py-2 text-[11px] font-semibold">
          {[...FLOW, ...FLOW].map((s, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <span className="rounded px-2 py-0.5" style={{ background: 'rgba(67,229,255,0.14)', color: '#9fe9ff' }}>{s}</span>
              {(i + 1) % FLOW.length !== 0 && <span className="text-white/30">→</span>}
            </span>
          ))}
        </div>
      </div>

      <span className="sr-only">
        Mission Control — the AI workforce command center for property management: maintenance triage, vendor dispatch, owner approvals, proof and replay.
      </span>
    </div>
  )
}

export default MissionControlHero
