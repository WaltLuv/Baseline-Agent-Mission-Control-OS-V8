'use client'

/**
 * Mission Control — flagship cinematic hero (Tier-2, in-browser).
 *
 * HONEST SCOPE: this is NOT a rendered 4K film — no video-generation/render
 * provider is connected and no source video was supplied. It is a real,
 * keynote-paced, MULTI-ACT cinematic sequence (not a static particle field):
 * the camera moves through four acts that visualize the actual Mission Control
 * systems, tied to the narration beats. When a render provider + source video
 * are supplied, Creative OS exports the final film to /marketing/*.mp4 and the
 * <video> below shows it automatically (this sequence becomes the fallback).
 */
import { useEffect, useState } from 'react'

// Poster = a graded frame from Walt's actual source film. Opening intro = the
// operator photo (fades into the real video, which now plays as the hero).
const POSTER = '/marketing/mission-control-hero-poster.jpg'
const OPENING = '/marketing/mission-control-hero-opening.jpg'

// The four acts — built around the existing narration / story structure.
const ACTS = [
  { key: 'boot', tag: 'ACT I · BOOT', title: 'Mission Control comes online', caption: 'The Real Estate Execution Platform — workforce, runtimes, and brain igniting.' },
  { key: 'portfolio', tag: 'ACT II · OPERATIONS', title: 'Property operations, orchestrated', caption: 'Maintenance triage → vendor match → owner approval → dispatch — with proof.' },
  { key: 'swarm', tag: 'ACT III · MARKET SWARM', title: '100 agents scanning the market', caption: 'Distressed-property swarm, lead scoring, market intelligence.' },
  { key: 'tower', tag: 'ACT IV · CONTROL TOWER', title: 'Flight Deck · Graphify · Replay', caption: 'Supervisor layer: runtimes, approvals, proof, replay — every action accountable.' },
] as const

const ACT_MS = 5500

function BootScene() {
  return (
    <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <circle key={i} cx={20 + (i % 3) * 30} cy={18 + Math.floor(i / 3) * 14} r="2.2" fill="#43E5FF" className="mc-node" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
      <g stroke="#43E5FF" strokeWidth="0.15" opacity="0.45">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1="50" y1="32" x2={20 + (i % 3) * 30} y2={18 + Math.floor(i / 3) * 14} className="mc-link" style={{ animationDelay: `${i * 0.12}s` }} />)}
      </g>
      <circle cx="50" cy="32" r="4" fill="#7C5CFF" className="mc-node" />
    </svg>
  )
}
function PortfolioScene() {
  const chips = ['Maintenance', 'Triage', 'Vendor', 'Owner Approval', 'Dispatch', 'Proof']
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="grid grid-cols-3 gap-2 opacity-90">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mc-node h-10 w-16 rounded-md border border-cyan-400/40 bg-cyan-400/5" style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </div>
      <div className="mc-hero-ticker absolute bottom-6 flex gap-2 whitespace-nowrap text-[10px] font-semibold">
        {[...chips, ...chips].map((c, i) => <span key={i} className="rounded px-2 py-0.5" style={{ background: 'rgba(67,229,255,0.16)', color: '#9fe9ff' }}>{c}</span>)}
      </div>
    </div>
  )
}
function SwarmScene() {
  return (
    <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g stroke="#7C5CFF" strokeWidth="0.1" opacity="0.25">
        {Array.from({ length: 11 }).map((_, i) => <line key={`v${i}`} x1={10 + i * 8} y1="6" x2={10 + i * 8} y2="54" />)}
        {Array.from({ length: 7 }).map((_, i) => <line key={`h${i}`} x1="10" y1={6 + i * 8} x2="90" y2={6 + i * 8} />)}
      </g>
      {Array.from({ length: 40 }).map((_, i) => (
        <circle key={i} cx={12 + (i * 17) % 76} cy={8 + (i * 11) % 44} r="0.8" fill="#43E5FF" className="mc-node" style={{ animationDelay: `${(i % 10) * 0.2}s` }} />
      ))}
    </svg>
  )
}
function TowerScene() {
  const reads = ['runtimes ●', 'approvals 2', 'replay ▶', 'proof ✓', 'comms live']
  return (
    <div className="absolute inset-0" aria-hidden>
      <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <g stroke="#43E5FF" strokeWidth="0.16" opacity="0.5">
          {[[50, 30, 25, 16], [50, 30, 75, 16], [50, 30, 20, 46], [50, 30, 80, 46], [50, 30, 50, 10], [50, 30, 50, 52]].map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} className="mc-link" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </g>
        {[[25, 16], [75, 16], [20, 46], [80, 46], [50, 10], [50, 52], [50, 30]].map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === 6 ? 3.4 : 2} fill={i === 6 ? '#7C5CFF' : '#43E5FF'} className="mc-node" style={{ animationDelay: `${i * 0.12}s` }} />)}
      </svg>
      <div className="absolute right-3 top-3 space-y-1 text-right text-[9px] font-mono text-cyan-300/80">
        {reads.map((r, i) => <div key={r} className="mc-node" style={{ animationDelay: `${i * 0.3}s` }}>{r}</div>)}
      </div>
    </div>
  )
}

export function MissionControlHero() {
  const [act, setAct] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setAct((a) => (a + 1) % ACTS.length), ACT_MS)
    return () => clearInterval(t)
  }, [])
  const a = ACTS[act]

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#05060c]" data-testid="hero-video-stage">
      {/* Opening frame — operator source image, cinematic fade → reveal */}
      <div className="mc-hero-intro absolute inset-0 z-20" aria-hidden data-testid="hero-opening">
        <img src={OPENING} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05060c] via-[#05060c]/30 to-transparent" />
      </div>

      {/* Cinematic multi-act sequence (the live Tier-2 asset) */}
      <div className="absolute inset-0" aria-hidden data-testid="hero-animation">
        <div className="mc-hero-bg absolute inset-0" />
        <div className="mc-hero-grid absolute inset-x-0 bottom-0 h-1/2" />
        {ACTS.map((act2, i) => (
          <div key={act2.key} className="absolute inset-0 transition-all duration-1000" style={{ opacity: i === act ? 1 : 0, transform: i === act ? 'scale(1)' : 'scale(1.06)' }} data-testid={`hero-act-${act2.key}`}>
            {act2.key === 'boot' && <BootScene />}
            {act2.key === 'portfolio' && <PortfolioScene />}
            {act2.key === 'swarm' && <SwarmScene />}
            {act2.key === 'tower' && <TowerScene />}
          </div>
        ))}
      </div>

      {/* Final rendered film drops in here (Creative OS export) — else poster + sequence */}
      <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline poster={POSTER} preload="none" data-testid="hero-video">
        <source src="/marketing/mission-control-hero.webm" type="video/webm" />
        <source src="/marketing/mission-control-hero.mp4" type="video/mp4" />
      </video>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060c]/85 via-[#05060c]/15 to-transparent" />

      {/* Act caption — keynote-style title card, advances with the scene */}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/[0.06] bg-black/45 px-4 py-2.5 backdrop-blur-sm" data-testid="hero-act-caption">
        <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">{a.tag}</div>
        <div className="text-sm font-semibold text-white">{a.title}</div>
        <div className="text-[11px] text-white/55">{a.caption}</div>
        <div className="mt-1.5 flex gap-1">
          {ACTS.map((_, i) => <span key={i} className="h-0.5 flex-1 rounded-full transition-colors duration-500" style={{ background: i === act ? '#43E5FF' : 'rgba(255,255,255,0.15)' }} />)}
        </div>
      </div>

      <span className="sr-only">
        Mission Control flagship cinematic — Act I boot sequence, Act II property operations (maintenance, vendor, owner approval, dispatch, proof), Act III 100-agent market swarm, Act IV Flight Deck, Graphify, and Workforce Replay control tower.
      </span>
    </div>
  )
}

export default MissionControlHero
