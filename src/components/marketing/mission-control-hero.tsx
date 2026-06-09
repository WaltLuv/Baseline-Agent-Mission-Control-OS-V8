'use client'

/**
 * Mission Control hero — the sales presentation, not decoration.
 *
 * The FOUNDATION is Walt's real 2:33 film (graded, with narration). The operator
 * image is the opening frame + poster + thumbnail. On click the full narration
 * plays with volume + controls + fullscreen (no autoplay audio). On top we render
 * ENHANCEMENT LAYERS — narration-synced chapters (text derived from the actual
 * transcript), a Graphify HUD network, and live telemetry — Palantir × Iron-Man
 * HUD × Apple-event-film. The video stays the foundation; overlays sit on top.
 */
import { useRef, useState } from 'react'

const POSTER = '/marketing/mission-control-hero-opening.jpg'

// Chapters derived from the ACTUAL narration (Whisper transcript), offset +3s for
// the intro card. start = film seconds.
const CHAPTERS = [
  { t: 0, tag: 'OPENING', title: 'Mission Control', text: 'The Real Estate Execution Platform.' },
  { t: 3, tag: '0:00 · THE PROBLEM', title: 'Software, but no execution', text: '“Every business has software. Very few have execution” — inbox overload, spreadsheets, sticky notes, and still no idea what to do next.' },
  { t: 20, tag: '0:17 · CHATBOTS DON’T EXECUTE', title: 'Talk vs. work', text: '“Chatbots answer questions. They do not execute, follow through, or own outcomes. Your business needs something that works.”' },
  { t: 36, tag: '0:33 · THE AI AGENT', title: 'Meet the new worker', text: 'A role, memory, tools, and tasks — human approval for anything risky, and everything it does logged as proof.' },
  { t: 61, tag: '0:58 · THE FACTORY', title: 'Draw it. Generate it.', text: 'Draw the architecture, connect the pieces — one click generates the full spec. “Not a prompt. A blueprint.”' },
  { t: 101, tag: '1:38 · SKILLS & MARKETPLACE', title: 'Services create cash, marketplace creates leverage', text: 'Reusable skills, agent teams, and workflow packages become marketplace products.' },
  { t: 120, tag: '1:57 · PROPCONTROL', title: 'Property operations, proven', text: '24 automated pipelines: voice receptionist, visual inspection, vendor dispatch, approval gates, portfolio dashboards — everything logged, everything proven.' },
  { t: 135, tag: '2:12 · INSTALL THE WORKFORCE', title: 'We build it. You install it. It executes.', text: '“AI workers are no longer a future idea. We build the workforce, you install it, it executes — and shows you proof every time.”' },
] as const

function chapterAt(s: number): (typeof CHAPTERS)[number] {
  let c: (typeof CHAPTERS)[number] = CHAPTERS[0]
  for (const ch of CHAPTERS) if (s >= ch.t) c = ch
  return c
}
function fmt(s: number) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` }

export function MissionControlHero() {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(153)
  const ch = chapterAt(t)

  const playWithSound = () => {
    const v = ref.current; if (!v) return
    v.muted = false; v.volume = 1
    v.play().then(() => setPlaying(true)).catch(() => {})
  }
  const seek = (sec: number) => { const v = ref.current; if (v) { v.currentTime = sec; if (!playing) playWithSound() } }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#04050b]" data-testid="hero-video-stage">
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        poster={POSTER}
        playsInline
        controls={playing}
        preload="metadata"
        data-testid="hero-video"
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 153)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src="/marketing/mission-control-hero.mp4" type="video/mp4" />
      </video>

      {/* ENHANCEMENT LAYER — HUD, only while playing (keeps the poster clean) */}
      {playing && (
        <div className="pointer-events-none absolute inset-0" aria-hidden data-testid="hero-hud">
          {/* corner Graphify network */}
          <svg viewBox="0 0 100 100" className="absolute right-3 top-3 h-20 w-20 opacity-50">
            <g stroke="#43E5FF" strokeWidth="0.6" opacity="0.6">{[[50,50,20,20],[50,50,80,25],[50,50,25,80],[50,50,82,78]].map((l,i)=><line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} className="mc-link"/>)}</g>
            {[[50,50,3],[20,20,1.6],[80,25,1.6],[25,80,1.6],[82,78,1.6]].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={p[2]} fill="#43E5FF" className="mc-node"/>)}
          </svg>
          {/* live telemetry */}
          <div className="absolute left-3 top-3 space-y-0.5 font-mono text-[9px] text-cyan-300/70">
            <div>● MISSION CONTROL · LIVE</div><div>graphify ▷ online</div><div>proof ✓ replay ▷</div>
          </div>
          <div className="absolute right-3 bottom-24 text-right font-mono text-[9px] text-white/45">{fmt(t)} / {fmt(dur)}</div>
        </div>
      )}

      {/* PLAY FILM button — narration audio on click */}
      {!playing && (
        <button onClick={playWithSound} className="group absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-t from-[#04050b]/80 via-[#04050b]/20 to-[#04050b]/40" data-testid="hero-play">
          <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition-transform group-hover:scale-110">
            <span className="ml-1 border-y-[14px] border-l-[22px] border-y-transparent border-l-white" />
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.28em] text-white">▶ Play the Film</span>
          <span className="mt-1 text-[11px] text-cyan-300/80">2:33 · with narration · The Real Estate Execution Platform</span>
        </button>
      )}

      {/* CHAPTER CAPTION — synced to the narration */}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/[0.06] bg-black/55 px-4 py-2.5 backdrop-blur-sm" data-testid="hero-chapter">
        <div className="text-[9px] font-bold uppercase tracking-[0.26em] text-cyan-300/80">{ch.tag}</div>
        <div className="text-sm font-semibold text-white">{ch.title}</div>
        <div className="line-clamp-2 text-[11px] text-white/60">{ch.text}</div>
        {/* clickable chapter rail */}
        <div className="mt-1.5 flex gap-1" data-testid="hero-chapter-rail">
          {CHAPTERS.slice(1).map((c) => (
            <button key={c.t} onClick={() => seek(c.t)} title={c.title} className="h-1 flex-1 rounded-full transition-colors" style={{ background: ch.t === c.t ? '#43E5FF' : 'rgba(255,255,255,0.18)' }} />
          ))}
        </div>
      </div>

      <span className="sr-only">
        Mission Control — the Real Estate Execution Platform. A 2:33 narrated film: the problem (software without execution), why chatbots don’t execute, the AI agent, the factory, skills marketplace, PropControl property operations (vendor dispatch, inspection, approval gates, proof), and installing the workforce.
      </span>
    </div>
  )
}

export default MissionControlHero
