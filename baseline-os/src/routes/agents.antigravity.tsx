import { createFileRoute } from "@tanstack/react-router";
import { AgentIdentityHeader } from "@/components/graphify-awareness";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import {
  Zap,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Brain,
  Calendar,
  DollarSign,
  Clock,
  ArrowRight,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { FullChat } from "@/components/full-chat";
import { AntigravityTerminal } from "@/components/antigravity-terminal";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";

export const Route = createFileRoute("/agents/antigravity")({
  head: () => ({
    meta: [
      { title: "Antigravity — Baseline Automations" },
      {
        name: "description",
        content:
          "Hermes MCP Loop Architecture — Gemini 3.5 Flash + Antigravity multi-agent platform.",
      },
    ],
  }),
  component: AntigravityPage,
});

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const BLUE = "#3B82F6";
const GOLD = "#FBBF24";
const PURPLE = "#8B5CF6";
const EMERALD = "#10B981";
const RED = "#EF4444";

interface AntigravityStatus {
  configured: boolean;
  hasState: boolean;
  dir: string | null;
}

// ─────────────────────────────────────────────────────────────────
// CommandBlock — dark code block with copy button
// ─────────────────────────────────────────────────────────────────
function CommandBlock({ children, multiline }: { children: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — please select and copy manually.");
    }
  }, [children]);

  return (
    <div
      className="relative group rounded-xl overflow-hidden"
      style={{ background: "rgba(0,0,0,0.55)", border: `1px solid ${BLUE}33` }}
    >
      <pre
        className={`font-mono text-[12px] leading-relaxed px-4 py-3 pr-12 overflow-x-auto ${multiline ? "whitespace-pre" : "whitespace-pre-wrap"}`}
        style={{ color: "#93c5fd" }}
      >
        {children}
      </pre>
      <button
        onClick={handleCopy}
        aria-label="Copy command"
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg transition-all opacity-60 group-hover:opacity-100"
        style={{
          background: copied ? `${BLUE}30` : "rgba(255,255,255,0.07)",
          border: `1px solid ${copied ? BLUE : "rgba(255,255,255,0.12)"}`,
        }}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" style={{ color: BLUE }} />
        ) : (
          <Copy className="h-3.5 w-3.5 text-zinc-400" />
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// StatTile
// ─────────────────────────────────────────────────────────────────
function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  color = BLUE,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div
      className="relative rounded-2xl border border-border bg-card p-5 overflow-hidden"
      style={{ backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${color}1f, transparent 60%)` }}
    >
      <div
        aria-hidden
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-35"
        style={{ background: color }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          {label}
        </div>
        <div
          className="mt-2 text-3xl font-semibold tabular-nums"
          style={{ color, textShadow: `0 0 18px ${color}55` }}
        >
          {value}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LayerCard — The 5-layer architecture centrepiece
// ─────────────────────────────────────────────────────────────────
function LayerCard({
  number,
  title,
  subtitle,
  body,
  extra,
  borderColor,
  badge,
  badgeColor,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  body: string;
  extra?: string;
  borderColor: string;
  badge?: string;
  badgeColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-2xl border-l-4 overflow-hidden"
      style={{
        borderLeftColor: borderColor,
        borderTop: "1px solid rgba(255,255,255,0.07)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: `linear-gradient(135deg, ${borderColor}0d 0%, rgba(0,0,0,0.40) 100%)`,
      }}
    >
      {/* Top shimmer line */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, ${borderColor}99, ${borderColor}33, transparent)`,
        }}
      />
      <div className="p-6 md:p-8">
        <div className="flex items-start gap-5">
          {/* Layer number bubble */}
          <div
            className="flex-shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg"
            style={{
              background: `${borderColor}22`,
              border: `1.5px solid ${borderColor}55`,
              color: borderColor,
              textShadow: `0 0 12px ${borderColor}99`,
            }}
          >
            {number}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className="text-[10px] uppercase tracking-[0.24em] font-semibold"
                style={{ color: borderColor }}
              >
                Layer {number}
              </span>
              {badge && (
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.16em]"
                  style={{
                    background: `${badgeColor ?? borderColor}22`,
                    border: `1px solid ${badgeColor ?? borderColor}55`,
                    color: badgeColor ?? borderColor,
                  }}
                >
                  {badge}
                </span>
              )}
            </div>
            <h3
              className="text-lg md:text-xl font-bold mb-0.5"
              style={{ color: "#f1f5f9" }}
            >
              {title}
            </h3>
            <p className="text-[13px] font-medium mb-2" style={{ color: borderColor }}>
              {subtitle}
            </p>
            <p className="text-[13px] text-zinc-400 leading-relaxed">{body}</p>
            {extra && (
              <p className="text-[13px] text-zinc-400 leading-relaxed mt-1">{extra}</p>
            )}
            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BeliefToggle — accordion wrong → right belief pair
// ─────────────────────────────────────────────────────────────────
function BeliefToggle({ wrong, right }: { wrong: string; right: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        border: `1px solid ${open ? BLUE + "55" : "rgba(255,255,255,0.08)"}`,
        background: open ? `${BLUE}0d` : "rgba(255,255,255,0.03)",
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-lg flex-shrink-0">{open ? "✅" : "❌"}</span>
        <span
          className="flex-1 text-[13px] font-medium"
          style={{ color: open ? "#f1f5f9" : "#a1a1aa" }}
        >
          {open ? right : wrong}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-zinc-500" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-zinc-600" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-4 flex items-start gap-3">
          <span className="text-lg flex-shrink-0">❌</span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600 mb-1">
              Old belief
            </p>
            <p className="text-[13px] text-zinc-500 italic">{wrong}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WeekRoadmap — collapsible week block
// ─────────────────────────────────────────────────────────────────
function WeekRoadmap({
  week,
  subtitle,
  days,
  defaultOpen = false,
}: {
  week: number;
  subtitle: string;
  days: { day: number; action: string }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${open ? GOLD + "44" : "rgba(255,255,255,0.08)"}`,
        background: open ? `${GOLD}08` : "rgba(255,255,255,0.03)",
      }}
    >
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-black"
          style={{
            background: `${GOLD}22`,
            border: `1px solid ${GOLD}44`,
            color: GOLD,
          }}
        >
          W{week}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-bold text-zinc-300">Week {week}</span>
          <span className="text-[11px] text-zinc-600 ml-2">{subtitle}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-600 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-2 border-t" style={{ borderColor: `${GOLD}22` }}>
          {days.map(({ day, action }) => (
            <div key={day} className="flex items-baseline gap-3 pt-2">
              <span
                className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.20em] w-12"
                style={{ color: GOLD }}
              >
                Day {day}
              </span>
              <span className="text-[13px] text-zinc-400">{action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CompoundingBars — pure CSS week-over-week growth chart
// ─────────────────────────────────────────────────────────────────
function CompoundingBars() {
  const bars = [
    { label: "Week 1", height: 25, color: `${RED}88` },
    { label: "Week 2", height: 45, color: `${RED}aa` },
    { label: "Week 3", height: 68, color: `${RED}cc` },
    { label: "Week 4", height: 100, color: RED },
  ];

  return (
    <div className="mt-4">
      <div className="flex items-end gap-3 h-20">
        {bars.map(({ label, height, color }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="w-full rounded-t-lg transition-all"
              style={{
                height: `${height}%`,
                background: color,
                boxShadow: `0 0 12px ${RED}44`,
              }}
            />
            <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-600 mt-2">Output compounds week over week — not linear, exponential.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ArchitectureSection — collapsible Hermes MCP Loop info
// ─────────────────────────────────────────────────────────────────
function ArchitectureSection({ configured }: { configured: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{ borderColor: open ? `${GOLD}44` : "rgba(255,255,255,0.08)" }}
    >
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Layers className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />
        <span
          className="flex-1 text-[13px] font-bold uppercase tracking-[0.16em]"
          style={{ color: GOLD }}
        >
          Hermes MCP Loop · 5-Layer Architecture
        </span>
        <span className="text-[10px] text-zinc-600 mr-2">
          {open ? "collapse" : "expand"}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-600 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-6 border-t" style={{ borderColor: `${GOLD}22` }}>
          {/* Architecture layers */}
          <div className="relative space-y-3 mt-5">
            <div
              aria-hidden
              className="absolute left-[1.6rem] top-12 bottom-12 w-px"
              style={{
                background: `linear-gradient(180deg, ${BLUE}00, ${BLUE}44 15%, ${PURPLE}44 35%, ${EMERALD}44 55%, ${GOLD}44 75%, ${RED}44 90%, ${RED}00)`,
              }}
            />
            <LayerCard
              number="1"
              title="The Command Layer"
              subtitle="You — The Architect"
              body="You don't write the content. You direct the agents who do. One sentence. Agent does the rest."
              borderColor={BLUE}
              badge="YOU ARE HERE"
              badgeColor={BLUE}
            >
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">Example command</p>
                <CommandBlock>{"Build me a landing page for this offer."}</CommandBlock>
              </div>
            </LayerCard>
            <LayerCard
              number="2"
              title="The Intelligence Layer"
              subtitle="Gemini 3.5 Flash"
              body="The reasoning engine. Plans. Thinks. Solves. 4X faster than other frontier models. Frontier intelligence."
              extra="Outperforms Gemini 3.1 Pro on coding + agentic benchmarks."
              borderColor={PURPLE}
            >
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                style={{
                  background: `${PURPLE}18`,
                  border: `1px solid ${PURPLE}33`,
                  color: `${PURPLE}dd`,
                }}
              >
                <Sparkles className="h-3 w-3" />
                Outperforms Gemini 3.1 Pro on coding + agentic benchmarks
              </div>
            </LayerCard>
            <LayerCard
              number="3"
              title="The Execution Layer"
              subtitle="Antigravity Subagents"
              body="The workers. Multiple agents running in parallel."
              extra="Launch one goal → spawn N agents → all output to one place."
              borderColor={EMERALD}
            >
              {configured ? (
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                  style={{
                    background: `${EMERALD}18`,
                    border: `1px solid ${EMERALD}44`,
                    color: EMERALD,
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Antigravity configured on your machine
                </div>
              ) : (
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-zinc-500"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <div className="h-2 w-2 rounded-full bg-zinc-600" />
                  Not yet configured
                </div>
              )}
            </LayerCard>
            <LayerCard
              number="4"
              title="The Organisation Layer"
              subtitle="Baseline Automations Dashboard"
              body="See every file, every task, every agent — in one place."
              extra="This dashboard is your Layer 4."
              borderColor={GOLD}
              badge="← You are here"
              badgeColor={GOLD}
            />
            <LayerCard
              number="5"
              title="The Compounding Layer"
              subtitle="The Output Stack"
              body="Every output becomes a building block. Content. Tools. Code. Research."
              extra="Over 30 days: your business doesn't just grow — it compounds."
              borderColor={RED}
            >
              <CompoundingBars />
            </LayerCard>
          </div>

          {/* Stats */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4" style={{ color: BLUE }} />
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-300">
                Gemini 3.5 Flash by the numbers
              </h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile icon={Zap} label="Speed vs frontier" value="4×" sub="Faster than comparable models" color={BLUE} />
              <StatTile icon={Brain} label="Context window" value="1M" sub="Tokens — long-horizon tasks" color={PURPLE} />
              <StatTile icon={DollarSign} label="Cost vs frontier" value="< ½" sub="Less than half the cost" color={EMERALD} />
              <StatTile icon={Calendar} label="Release date" value="May 19" sub="2026 — latest frontier model" color={GOLD} />
            </div>
          </div>

          {/* Beliefs */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4" style={{ color: BLUE }} />
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-300">
                Beliefs That Are Holding You Back
              </h3>
            </div>
            <div className="space-y-2">
              <BeliefToggle
                wrong="AI agents are too technical — I'm not a developer."
                right="If you can type a sentence, you can command an agent. That's the whole point."
              />
              <BeliefToggle
                wrong="I'll wait until it's more mature — it's still too early."
                right="The window to get ahead is right now. Early adopters compound. Late adopters catch up."
              />
              <BeliefToggle
                wrong="ChatGPT is enough for what I need."
                right="ChatGPT helps you write. Gemini 3.5 Flash helps you BUILD and DEPLOY. Different category entirely."
              />
              <BeliefToggle
                wrong="Managing multiple agents sounds complicated and overwhelming."
                right="The Baseline Automations exists specifically so this is simple. One dashboard. Full visibility."
              />
              <BeliefToggle
                wrong="Multi-agent platforms are only for big companies with big budgets."
                right="Less than half the cost of other frontier models. Antigravity is the great equaliser."
              />
            </div>
          </div>

          {/* 30-day roadmap */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4" style={{ color: GOLD }} />
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-300">
                30-Day Roadmap
              </h3>
            </div>
            <div className="space-y-2">
              <WeekRoadmap week={1} subtitle="Foundation" defaultOpen={true} days={[
                { day: 1, action: "Access Antigravity. Run your first test prompt." },
                { day: 2, action: "Build your Baseline Automations dashboard using the provided starter prompt." },
                { day: 3, action: "Identify 3 time-consuming tasks you'll hand to agents." },
                { day: 4, action: "Write a draft agent prompt for each of the 3 tasks." },
                { day: 5, action: "Build your Prompt Library doc — save and label each prompt." },
                { day: 6, action: "Run your first parallel workflow with 2 simultaneous subagents." },
                { day: 7, action: "Review Week 1. Note your biggest win. Identify one prompt to improve." },
              ]} />
              <WeekRoadmap week={2} subtitle="Acceleration" days={[
                { day: 8, action: "Expand to 3 parallel agents. Add a research agent." },
                { day: 9, action: "Build a content calendar using agents." },
                { day: 10, action: "Create your first agent workflow template." },
                { day: 11, action: "Run a competitor research workflow." },
                { day: 12, action: "Add outputs to a shared team doc or Obsidian." },
                { day: 13, action: "Refine your top 3 prompts based on output quality." },
                { day: 14, action: "Review Week 2 — track time saved vs. week 1." },
              ]} />
              <WeekRoadmap week={3} subtitle="Compounding" days={[
                { day: 15, action: "Launch a 5-agent parallel workflow." },
                { day: 16, action: "Automate your weekly content batch." },
                { day: 17, action: "Build an agent prompt for every major use case." },
                { day: 18, action: "Share best outputs with your audience or team." },
                { day: 19, action: "Add an agent for customer or prospect research." },
                { day: 20, action: "Document your agent stack — turn it into an SOP." },
                { day: 21, action: "Review Week 3 — calculate your output multiplier." },
              ]} />
              <WeekRoadmap week={4} subtitle="Scale" days={[
                { day: 22, action: "Delegate an entire project to your agent stack." },
                { day: 23, action: "Build a recurring weekly agent workflow." },
                { day: 24, action: "Review and archive your best 10 prompts." },
                { day: 25, action: "Share your agent system with your team or community." },
                { day: 26, action: "Identify the next 3 tasks to agent-ify." },
                { day: 27, action: "Run your biggest parallel workflow yet — 7+ agents." },
                { day: 28, action: "Review the full 30 days. Your output stack is now compounding. Ship something." },
              ]} />
            </div>
          </div>

          {/* Quick links */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="h-4 w-4" style={{ color: BLUE }} />
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-300">Quick Links</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${BLUE}, #1d4ed8)`,
                  color: "#fff",
                  boxShadow: `0 4px 20px -4px ${BLUE}88`,
                }}
              >
                Open Google AI Studio
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
              <a
                href="https://labs.google.com/antigravity"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${BLUE}44`,
                  color: `${BLUE}dd`,
                }}
              >
                Google Antigravity Platform
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>

          {/* Setup SOP */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4" style={{ color: BLUE }} />
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-300">
                Setup SOP
              </h3>
              <span className="text-[10px] text-zinc-600 uppercase tracking-[0.16em]">8 steps to launch</span>
            </div>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.30)" }}
            >
              {[
                { n: 1, title: "Access Antigravity", body: "Open Google AI Studio and access the Antigravity platform.", cta: { label: "Open Google AI Studio →", href: "https://aistudio.google.com" } },
                { n: 2, title: "Set up your first workspace", body: "Create a dedicated workspace for your agent projects inside Antigravity." },
                { n: 3, title: "Launch your Baseline Automations dashboard", body: "Paste this prompt into Antigravity to spin up your control centre:", command: `Build me a complete Baseline Automations dashboard with a dark-mode UI. Include tabs for: Launch Task, Active Agents, Workspace Files, and Completed Work. Save all files to scratch/agent-os/.` },
                { n: 4, title: "Define your 3 core agent tasks", body: "Identify the three most time-consuming, repeatable tasks in your workflow — these become your first agent assignments." },
                { n: 5, title: "Run your first parallel workflow", body: "Launch multiple subagents simultaneously. Try this starter prompt:", command: `Run 3 parallel subagents: (1) Research [topic] and produce a summary, (2) Write a first-draft article outline, (3) Generate 5 social posts from the research. Save all outputs to scratch/agent-os/outputs/.` },
                { n: 6, title: "Review and approve all outputs", body: "Check your Baseline Automations dashboard — every file, every task result, in one place. Approve, refine, or redirect." },
                { n: 7, title: "Build your agent prompt library", body: "Save your best prompts as reusable templates. Every prompt you save compounds your future productivity." },
                { n: 8, title: "Assign daily agent tasks", body: "Start each day with a 5-minute commander session. Assign tasks, launch agents, review outputs at day's end." },
              ].map(({ n, title, body, cta, command }, idx, arr) => (
                <div
                  key={n}
                  className="flex gap-4 p-5"
                  style={{ borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                >
                  <div
                    className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-black"
                    style={{ background: `${BLUE}22`, border: `1.5px solid ${BLUE}44`, color: BLUE }}
                  >
                    {n}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <span className="text-[13px] font-semibold text-zinc-200">{title}</span>
                      <p className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">{body}</p>
                    </div>
                    {command && <CommandBlock multiline={command.length > 80}>{command}</CommandBlock>}
                    {cta && (
                      <a
                        href={cta.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-all hover:opacity-80"
                        style={{ color: BLUE }}
                      >
                        {cta.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Content Factory — iframed High Frequency Media Factory app.
//
// Walt's directive: "create this app inside of the antigravity agent page
// and create a tab inside of the page called content factory and build it
// inside of there or add it in as an iframe if it makes things less risky
// and stop the app from becoming to bloated."
//
// The remote app is the source of truth — we wrap it in an iframe so the
// AntigravityPage bundle stays slim. If the remote app refuses to embed
// (X-Frame-Options / CSP), we surface a graceful fallback with an
// "Open in new tab" button so the link still works.
//
// API keys are NEVER held in this file or in claude-os env. Whatever key
// the embedded app requires is collected by the embedded app's own UI on
// the remote origin.
// ─────────────────────────────────────────────────────────────────

const CONTENT_FACTORY_URL =
  "https://high-frequency-media-factory-299637104251.us-east1.run.app";

function ContentFactoryPanel() {
  const [loadFailed, setLoadFailed] = useState(false);

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0" data-testid="content-factory-panel">
      <div
        className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
        style={{ borderColor: `${BLUE}44`, background: `${BLUE}0d` }}
      >
        <div className="min-w-0">
          <div className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: BLUE }}>
            High Frequency Media Factory
          </div>
          <p className="text-[12px] text-zinc-400 mt-0.5">
            Embedded as an iframe so the Antigravity bundle stays slim. The
            remote app handles its own auth and Gemini key.
          </p>
        </div>
        <a
          href={CONTENT_FACTORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="content-factory-open-new-tab"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{
            background: `${BLUE}22`,
            border: `1px solid ${BLUE}55`,
            color: BLUE,
          }}
        >
          Open in new tab
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </a>
      </div>

      {loadFailed ? (
        <div
          className="flex-1 min-h-0 rounded-2xl border border-border flex flex-col items-center justify-center gap-3 p-8 text-center"
          style={{ background: "rgba(0,0,0,0.30)" }}
          data-testid="content-factory-blocked"
        >
          <div className="text-sm font-semibold text-zinc-200">
            The remote app refused to embed.
          </div>
          <p className="text-[13px] text-zinc-500 max-w-md">
            Most likely the Cloud Run deployment sets an X-Frame-Options or
            frame-ancestors CSP header that blocks the iframe. Open it in
            a new tab instead — same app, same session.
          </p>
          <a
            href={CONTENT_FACTORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${BLUE}, #1d4ed8)`,
              color: "#fff",
              boxShadow: `0 4px 20px -4px ${BLUE}88`,
            }}
          >
            Open Content Factory
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>
        </div>
      ) : (
        <iframe
          src={CONTENT_FACTORY_URL}
          title="High Frequency Media Factory"
          data-testid="content-factory-iframe"
          className="flex-1 min-h-0 rounded-2xl border border-border bg-black"
          style={{ minHeight: 600 }}
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox"
          onError={() => setLoadFailed(true)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
type AntigravityTab = "overview" | "content-factory";

function AntigravityPage() {
  const [tab, setTab] = useState<AntigravityTab>("overview");
  const { data: status } = useQuery<AntigravityStatus>({
    queryKey: ["antigravity-status"],
    queryFn: async () => {
      const r = await fetch("/__antigravity_status");
      if (!r.ok) throw new Error("not ok");
      return r.json();
    },
    retry: false,
  });

  const configured = status?.configured ?? false;

  return (
    <div className="flex flex-col gap-5 h-full" style={{ minHeight: "calc(100vh - 120px)" }}>
      <AgentIdentityHeader name="Antigravity" provider="Google DeepMind · agy" context="antigravity multi-agent" />
      <RuntimeCredentialStatus
        providerIds={["antigravity", "google_gemini"]}
        variant="inline"
      />
      {/* ══════════════════════════════════════════════════════════
          TAB STRIP
      ══════════════════════════════════════════════════════════ */}
      <div
        className="flex items-center gap-1 rounded-xl border border-border bg-black/40 p-1 self-start"
        data-testid="antigravity-tab-strip"
      >
        {([
          { id: "overview", label: "Overview" },
          { id: "content-factory", label: "Content Factory" },
        ] as Array<{ id: AntigravityTab; label: string }>).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              data-testid={`antigravity-tab-${t.id}`}
              className="px-4 py-1.5 rounded-lg text-[12px] font-semibold uppercase tracking-[0.16em] transition-all"
              style={{
                background: active ? `${BLUE}22` : "transparent",
                border: `1px solid ${active ? `${BLUE}55` : "transparent"}`,
                color: active ? BLUE : "#a1a1aa",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "content-factory" ? (
        <ContentFactoryPanel />
      ) : (
      <>
      {/* ══════════════════════════════════════════════════════════
          OVERVIEW TAB (default) — original page content below.
      ══════════════════════════════════════════════════════════ */}

      {/* ══════════════════════════════════════════════════════════
          HERO HEADER (compact)
      ══════════════════════════════════════════════════════════ */}
      <section className="relative rounded-3xl overflow-hidden border border-border flex-shrink-0">
        {/* Background */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 75% 65% at 90% 15%, rgba(59,130,246,0.32) 0%, transparent 55%)," +
              "radial-gradient(ellipse 50% 55% at 10% 85%, rgba(30,58,138,0.22) 0%, transparent 60%)," +
              "linear-gradient(135deg, #050c1a 0%, #060a14 100%)",
          }}
        />
        {/* Grid overlay */}
        <svg
          aria-hidden
          className="absolute inset-0 w-full h-full opacity-[0.07]"
          preserveAspectRatio="none"
          viewBox="0 0 1200 200"
        >
          <defs>
            <pattern id="ag-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M36 0H0V36" fill="none" stroke="#3B82F6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="1200" height="200" fill="url(#ag-grid)" />
        </svg>

        <div className="relative px-8 py-6 md:px-10 md:py-8">
          {/* Eyebrow */}
          <div
            className="text-[10px] uppercase tracking-[0.32em] mb-3 inline-flex items-center gap-2"
            style={{ color: `${BLUE}cc` }}
          >
            <span>Google DeepMind</span>
            <span style={{ color: `${BLUE}44` }}>·</span>
            <span>Antigravity</span>
            <span style={{ color: `${BLUE}44` }}>·</span>
            <span>Gemini 3.5 Flash</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Title */}
            <h1
              className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none"
              style={{
                color: "#e8f4ff",
                textShadow: `0 0 50px ${BLUE}77, 0 0 100px ${BLUE}33`,
              }}
            >
              Antigravity
            </h1>

            {/* Hermes MCP Loop badge */}
            <span
              className="text-[11px] px-3 py-1 rounded-full font-black uppercase tracking-[0.22em]"
              style={{
                background: `${GOLD}18`,
                border: `1px solid ${GOLD}55`,
                color: GOLD,
                textShadow: `0 0 10px ${GOLD}88`,
              }}
            >
              ✦ Hermes MCP
            </span>

            {/* Status pill */}
            {status === undefined ? (
              <span className="text-[11px] px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-500 uppercase tracking-[0.18em]">
                Checking…
              </span>
            ) : configured ? (
              <span
                className="text-[11px] px-3 py-1.5 rounded-full font-semibold uppercase tracking-[0.18em]"
                style={{
                  background: `${EMERALD}18`,
                  border: `1px solid ${EMERALD}55`,
                  color: EMERALD,
                }}
              >
                🟢 CONFIGURED
              </span>
            ) : (
              <span className="text-[11px] px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 uppercase tracking-[0.18em]">
                ⚪ NOT CONFIGURED
              </span>
            )}

            {/* Feature pills */}
            {["Gemini 3.5 Flash", "Multi-Agent", "Parallel Subagents"].map((p) => (
              <span
                key={p}
                className="text-[11px] px-2.5 py-1 rounded-full"
                style={{
                  background: `${BLUE}14`,
                  border: `1px solid ${BLUE}33`,
                  color: `${BLUE}dd`,
                }}
              >
                {p}
              </span>
            ))}
          </div>

          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            The platform where subagents work in parallel. Command the architecture — give me a goal and I'll decompose it.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          Hermes MCP Loop INFO (collapsed by default)
      ══════════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0">
        <ArchitectureSection configured={configured} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          ANTIGRAVITY CLI TERMINAL
          The real `agy --print` (Google Antigravity CLI, installed via
          `brew install antigravity-cli`) wrapped in a terminal-grade
          UI — monospace dark theme, prompt prefix, command history
          via ↑/↓, per-turn timing + exit code, "copy last output" +
          "clear" controls. Hits /__agent_run with agent="antigravity"
          which now routes to `agy --print --dangerously-skip-permissions`.
      ══════════════════════════════════════════════════════════ */}
      <div className="mb-4">
        <AntigravityTerminal />
      </div>

      {/* ══════════════════════════════════════════════════════════
          FULL-HEIGHT CHAT
      ══════════════════════════════════════════════════════════ */}
      <FullChat
        agent="antigravity"
        agentName="Antigravity"
        agentColor={BLUE}
        storageKey="claude-os.chat.antigravity.v1"
        welcomeMessage="🚀 Antigravity online. I'm powered by Gemini 3.5 Flash — Google's fastest frontier model. Give me a complex multi-step goal and I'll decompose it into parallel subagent tasks and execute them. What do you want to build or automate?"
        placeholder="Give me a goal to orchestrate… research, build, analyze, automate"
        className="flex-1 min-h-0"
      />

      {/* Bottom spacer */}
      <div className="h-4 flex-shrink-0" />
      </>
      )}
    </div>
  );
}
