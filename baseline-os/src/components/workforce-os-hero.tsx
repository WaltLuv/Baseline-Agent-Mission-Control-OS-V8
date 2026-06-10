/**
 * Workforce OS landing hero + product launcher.
 *
 * The Baseline OS home is the front door to the AI Workforce Operating System.
 * Organized like a real product: a primary "Launch Workforce" CTA plus four
 * operating groups — Launch · Operate · Build · Monitor. Every tile links to a
 * live route (verified); nothing aspirational.
 */
import { Link } from "@tanstack/react-router";
import { SankoreArch, MaliGeometry, GoldRule } from "@/components/mansa-musa-motif";
import { MANSA_PALETTE } from "@/lib/mansa-musa";
import {
  Rocket,
  PackagePlus,
  Building2,
  Users,
  Bot,
  LayoutDashboard,
  Plane,
  BrainCircuit,
  Clapperboard,
  Sparkles,
  Boxes,
  Cpu,
  Activity as ActivityIcon,
  CreditCard,
  Workflow,
  Server,
  Gauge,
} from "lucide-react";

interface Tile {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface Group {
  title: string;
  tone: string;
  tiles: Tile[];
}

const GROUPS: Group[] = [
  {
    title: "Launch Workforce",
    tone: "#a78bfa",
    tiles: [
      { to: "/app/activate", label: "Install Workforce Template", icon: PackagePlus },
      { to: "/mission-control", label: "Browse Industries", icon: Building2 },
      { to: "/triad", label: "Browse Teams", icon: Users },
      { to: "/personas", label: "Browse Agents", icon: Bot },
    ],
  },
  {
    title: "Operate Workforce",
    tone: "#3ddc97",
    tiles: [
      { to: "/", label: "Workforce OS", icon: Gauge },
      { to: "/mission-control", label: "Mission Control", icon: LayoutDashboard },
      { to: "/flight-deck", label: "Flight Deck", icon: Plane },
      { to: "/memory", label: "Knowledge OS", icon: BrainCircuit },
    ],
  },
  {
    title: "Build Workforce",
    tone: "#f59e0b",
    tiles: [
      { to: "/agents/claude-code-studio", label: "Claude Code Studio", icon: Clapperboard },
      { to: "/higgsfield", label: "Higgsfield", icon: Sparkles },
      { to: "/skills", label: "Skills Marketplace", icon: Boxes },
      { to: "/runtime-registry", label: "Runtime Marketplace", icon: Server },
    ],
  },
  {
    title: "Monitor Workforce",
    tone: "#60a5fa",
    tiles: [
      { to: "/agents/claude-code", label: "Agents", icon: Bot },
      { to: "/runtime-registry", label: "Runtimes", icon: Cpu },
      { to: "/settings", label: "Credits", icon: CreditCard },
      { to: "/activity", label: "Activity", icon: ActivityIcon },
      { to: "/maestro", label: "Orchestration", icon: Workflow },
    ],
  },
];

export function WorkforceOsHero() {
  return (
    <section className="mb-8" data-testid="workforce-os-hero">
      <div
        className="rounded-2xl border overflow-hidden p-6 sm:p-8"
        style={{
          borderColor: "rgba(167,139,250,0.22)",
          background:
            "radial-gradient(ellipse 60% 80% at 15% 0%, rgba(167,139,250,0.16) 0%, transparent 60%), radial-gradient(ellipse 50% 70% at 90% 10%, rgba(244,114,182,0.12) 0%, transparent 60%), rgba(0,0,0,0.30)",
        }}
      >
        {/* Mansa Musa accent (Baseline OS only) — gold manuscript ornament, visual layer */}
        <div className="mb-2 flex items-center gap-2" data-testid="mansa-musa-accent">
          <SankoreArch size={22} />
          <span
            className="text-[11px] uppercase tracking-[0.28em]"
            style={{ color: MANSA_PALETTE.goldBright }}
          >
            Baseline · AI Workforce Operating System
          </span>
          <MaliGeometry size={20} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#ede9fe" }}>
          Workforce OS
        </h1>
        <GoldRule className="mt-3 h-2 w-40 opacity-80" />
        <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
          Hire, build, operate, and monitor an AI workforce from one command center. Install a
          workforce template, connect runtimes, and supervise real work. Every status here is probed
          live; nothing is faked.
        </p>
        <Link
          to="/app/activate"
          data-testid="wos-launch-cta"
          className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "#a78bfa", color: "#1e1b4b" }}
        >
          <Rocket size={16} /> Launch Workforce
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <div
            key={g.title}
            className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
            data-testid={`wos-group-${g.title.replace(/\s+/g, "-").toLowerCase()}`}
          >
            <h3
              className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-3"
              style={{ color: g.tone }}
            >
              {g.title}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.tiles.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.label}
                    to={t.to}
                    data-testid={`wos-tile-${t.label.replace(/\W+/g, "-").toLowerCase()}`}
                    className="group flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-zinc-700"
                  >
                    <span
                      className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        background: `${g.tone}1f`,
                        border: `1px solid ${g.tone}44`,
                        color: g.tone,
                      }}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="text-[12px] font-medium text-zinc-200">{t.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
