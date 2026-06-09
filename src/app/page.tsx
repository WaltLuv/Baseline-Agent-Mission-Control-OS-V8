'use client'

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Brain,
  Terminal as TerminalIcon,
  ShieldAlert,
  CheckCircle2,
  Play,
  RotateCcw,
  ArrowRight,
  Zap,
  Cpu,
  Database,
  Network,
  ChevronDown,
  Check,
  Send,
  HelpCircle,
  TrendingUp,
  Layers,
} from "lucide-react";
import confetti from "canvas-confetti";
import { directivesByGroup, type ConsoleDirective } from "@/lib/workforce-console";
import { MissionControlHero } from "@/components/marketing/mission-control-hero";


// Simulation types
type AgentState = "idle" | "thinking" | "communicating" | "success" | "error";

interface SimulationStep {
  agent: string;
  avatar: string;
  message: string;
  status: "system" | "agent" | "gate" | "success";
  delay: number;
}

interface Sim {
  name: string;
  description: string;
  agents: { id: string; name: string; role: string }[];
  steps: SimulationStep[];
  /** Real CTA route shown after the simulation completes. */
  ctaRoute?: string;
  ctaLabel?: string;
}

// ── 3 general builder directives (verbatim) ─────────────────────────
const BASE_SIMULATIONS: Record<string, Sim> = {
  dev: {
    name: "Software Release (Code Audit & Deploy)",
    description: "Scan code for vulnerabilities, patch the code, run tests, and request deployment authorization.",
    agents: [
      { id: "auditor", name: "Security Auditor", role: "Audits repository for vulnerabilities" },
      { id: "coder", name: "Lead Developer", role: "Patches files and writes test cases" },
      { id: "qa", name: "QA Automator", role: "Executes test suite and validates E2E" },
      { id: "devops", name: "DevOps Engineer", role: "Coordinates deployment pipelines" }
    ],
    steps: [
      { agent: "SYSTEM", avatar: "🤖", message: "Initializing Software Release fleet. Allocating context space...", status: "system", delay: 1000 },
      { agent: "Security Auditor", avatar: "🛡️", message: "Cloning repository... Scanning src/routes/auth.ts for vulnerability signatures.", status: "agent", delay: 2000 },
      { agent: "Security Auditor", avatar: "🛡️", message: "CRITICAL FINDING: Raw SQL injection path found on line 42 (username query interpolation). Raising ticket #SEC-109.", status: "agent", delay: 2200 },
      { agent: "Lead Developer", avatar: "💻", message: "Ticket #SEC-109 received. Checkout branch hotfix/sql-injection-auth.", status: "agent", delay: 1800 },
      { agent: "Lead Developer", avatar: "💻", message: "Refactored auth.ts: Replacing template string query with parameterized db.query($1, [username]). Local type check passed.", status: "agent", delay: 2200 },
      { agent: "QA Automator", avatar: "🧪", message: "Triggering unit test suite for auth endpoints... npm run test:auth", status: "agent", delay: 1500 },
      { agent: "QA Automator", avatar: "🧪", message: "All 18 unit tests PASSED. Verifying session expiration and token boundaries. Clean run.", status: "agent", delay: 2000 },
      { agent: "DevOps Engineer", avatar: "🚀", message: "Preparing build artifact v1.4.2-patch. Generating changelog. Requesting production staging deploy...", status: "agent", delay: 1800 },
      { agent: "SYSTEM", avatar: "⚠️", message: "Security Gate triggered: DevOps Agent requests git push permission to staging branch. Manual operator override required.", status: "gate", delay: 500 },
      { agent: "DevOps Engineer", avatar: "🚀", message: "Approval received! Resuming deploy... Pushing to AWS Staging-3 cluster. Deploying K8s pods.", status: "agent", delay: 2000 },
      { agent: "DevOps Engineer", avatar: "🚀", message: "Performing post-deploy warm-up ping. Health status: 200 OK. Latency: 42ms.", status: "agent", delay: 1800 },
      { agent: "SYSTEM", avatar: "🎉", message: "Simulation finished. Security issue patched, tested, and deployed to Staging-3 in 18.8s (virtual time).", status: "success", delay: 1000 }
    ],
    ctaRoute: "/app/orchestration",
    ctaLabel: "Open Orchestration",
  },
  marketing: {
    name: "SaaS Launch Campaign",
    description: "Perform competitor analysis, draft launch copy, generate mock visuals, and schedule social blasts.",
    agents: [
      { id: "researcher", name: "Market Analyst", role: "Scrapes competitor positioning and hooks" },
      { id: "copywriter", name: "Copywriter Agent", role: "Drafts high-conversion web copy & emails" },
      { id: "designer", name: "Visual Designer", role: "Generates assets and templates" },
      { id: "manager", name: "Campaign Manager", role: "Coordinates calendar and schedules channels" }
    ],
    steps: [
      { agent: "SYSTEM", avatar: "🤖", message: "Initializing SaaS Campaign fleet. Bootstrapping workspace tools...", status: "system", delay: 1000 },
      { agent: "Market Analyst", avatar: "📊", message: "Analyzing Product Hunt launches in the Developer Tool category from the past 90 days. Identifying successful messaging frameworks...", status: "agent", delay: 2200 },
      { agent: "Market Analyst", avatar: "📊", message: "Trend identified: Focus on developer ROI and local-first setup. Recommending tagline angle 'Autonomous, local-first workforce OS'.", status: "agent", delay: 2000 },
      { agent: "Copywriter Agent", avatar: "✍️", message: "Drafting Product Hunt pitch, a 3-part launch Twitter thread, and marketing newsletter draft. Target tone: Tech-forward, high agency.", status: "agent", delay: 2500 },
      { agent: "Copywriter Agent", avatar: "✍️", message: "Preview Draft: 'Orchestrate your AI fleet directly from your local terminal. Local-first. Multi-agent. Secure.' Reviewing copywriting quality.", status: "agent", delay: 1800 },
      { agent: "Visual Designer", avatar: "🎨", message: "Initiating asset generation plugin. Canvas prompt: 'glowing futuristic nodes, dark cybernetic UI dashboard mockup, neon cyan accents, flat design, high-contrast, vector logo'.", status: "agent", delay: 2200 },
      { agent: "Visual Designer", avatar: "🎨", message: "Asset rendering complete. Output: src/assets/launch-banner.png. Optimizing dimensions for Product Hunt media gallery.", status: "agent", delay: 1500 },
      { agent: "SYSTEM", avatar: "⚠️", message: "Editorial Gate triggered: Review copy and generated visual asset before publishing. Manual operator confirmation required.", status: "gate", delay: 500 },
      { agent: "Campaign Manager", avatar: "🗓️", message: "Approval received! Initializing integration modules. Scheduling Product Hunt launch, queuing Mailchimp draft, and Buffer tweets.", status: "agent", delay: 2000 },
      { agent: "Campaign Manager", avatar: "🗓️", message: "Synchronization confirmed. Social scheduler synced. Notifications routed to Slack #announcements.", status: "agent", delay: 1800 },
      { agent: "SYSTEM", avatar: "🎉", message: "Simulation finished. SaaS launch marketing materials prepared, validated, and scheduled successfully.", status: "success", delay: 1000 }
    ],
    ctaRoute: "/app/activate?template=ai-product-launch",
    ctaLabel: "Install AI Product Launch Team",
  },
  intelligence: {
    name: "Competitor Market Intel",
    description: "Crawl web endpoints, create a strategic SWOT report, and notify stakeholders.",
    agents: [
      { id: "scraper", name: "Crawl Bot", role: "Extracts pricing and specifications from sites" },
      { id: "analyst", name: "Business Intelligence", role: "Cross-references features and generates SWOT" },
      { id: "writer", name: "Report Synthesizer", role: "Writes clean executive markdown summaries" },
      { id: "notifier", name: "Integrator Agent", role: "Pushes summaries to external APIs & Slack" }
    ],
    steps: [
      { agent: "SYSTEM", avatar: "🤖", message: "Initializing Competitor Intelligence fleet. Launching Chromium scraper headless...", status: "system", delay: 1000 },
      { agent: "Crawl Bot", avatar: "🕷️", message: "Crawling top 3 competitor pricing pages. Extracting tables, user seats, and modular feature lists.", status: "agent", delay: 2200 },
      { agent: "Crawl Bot", avatar: "🕷️", message: "Crawl completed. Extracted data payload: 12KB json. Found competitor A pricing at $49/mo, competitor B at $79/mo.", status: "agent", delay: 1500 },
      { agent: "Business Intelligence", avatar: "📈", message: "Correlating pricing structures. Running feature matrix comparison. Competitor A lacks self-hosted deployment. Competitor B lacks offline API usage.", status: "agent", delay: 2200 },
      { agent: "Business Intelligence", avatar: "📈", message: "Synthesizing SWOT. Strength: Baseline Automations is fully local-first. Weakness: New brand. Opportunity: Enterprise privacy requirements.", status: "agent", delay: 1800 },
      { agent: "Report Synthesizer", avatar: "📝", message: "Compiling competitive intelligence summary. Generating Markdown tables, graph layout, and bulleted recommendations.", status: "agent", delay: 2400 },
      { agent: "Report Synthesizer", avatar: "📝", message: "Report generated at /reports/intel-q2-2026.md. File length: 242 lines. Readability index: High.", status: "agent", delay: 1500 },
      { agent: "SYSTEM", avatar: "⚠️", message: "Notification Gate triggered: Send competitor report to leadership Slack channels and sync to Google Drive? Manual override required.", status: "gate", delay: 500 },
      { agent: "Integrator Agent", avatar: "🔌", message: "Approval received! Uploading Markdown report to Google Drive... Exporting to PDF format.", status: "agent", delay: 2000 },
      { agent: "Integrator Agent", avatar: "🔌", message: "Dispatching summary block to Slack #strategy-intel with direct Google Drive link. Status: Webhook accepted.", status: "agent", delay: 1800 },
      { agent: "SYSTEM", avatar: "🎉", message: "Simulation finished. Scraped competitor sites, drafted SWOT report, and published to Drive & Slack.", status: "success", delay: 1000 }
    ],
    ctaRoute: "/marketplace",
    ctaLabel: "Browse Market-Intel Skills",
  },
};

// ── 6 industry directives → sims (generated from the directive model) ─
const INDUSTRY_AVATARS = ["🧭", "🛠️", "🤝", "📅", "🔍", "📣", "🧾", "📊"];
function buildIndustrySim(d: ConsoleDirective): Sim {
  const agents = d.agentMap.map((name, i) => ({ id: `${d.directiveId}-${i}`, name, role: "" }));
  const steps: SimulationStep[] = [
    { agent: "SYSTEM", avatar: "🤖", message: `Initializing ${d.label.split(":")[0]} workforce. Allocating context space...`, status: "system", delay: 900 },
    ...d.steps.map((s, i) => ({ agent: agents[i % agents.length].name, avatar: INDUSTRY_AVATARS[i % INDUSTRY_AVATARS.length], message: s, status: "agent" as const, delay: 1500 })),
    { agent: "SYSTEM", avatar: "⚠️", message: `Human gate triggered: ${d.humanGates[0]}`, status: "gate", delay: 500 },
    { agent: "SYSTEM", avatar: "🎉", message: "Simulation finished. Proof package logged. (Demo simulation — no live work executed.)", status: "success", delay: 900 },
  ];
  return { name: d.label, description: d.description, agents, steps, ctaRoute: d.ctaRoute, ctaLabel: d.ctaLabel };
}

const INDUSTRY_SIMULATIONS: Record<string, Sim> = Object.fromEntries(
  directivesByGroup("industry").map((d) => [d.directiveId, buildIndustrySim(d)]),
);

// Ops simulation directives (VisionOps / VoiceOps / PropControl / Market Swarm).
const OPS_SIMULATIONS: Record<string, Sim> = Object.fromEntries(
  directivesByGroup("ops").map((d) => [d.directiveId, buildIndustrySim(d)]),
);

// 13 directives total: 3 general + 6 industry + 4 ops.
const SIMULATIONS: Record<string, Sim> = { ...BASE_SIMULATIONS, ...INDUSTRY_SIMULATIONS, ...OPS_SIMULATIONS };

// ── Product layers (Build / Operate / Scale / Knowledge / Creative) ──
interface LayerTile { label: string; href?: string; desc: string }
const LAYERS: { title: string; blurb: string; tiles: LayerTile[] }[] = [
  {
    title: "Build",
    blurb: "Compose the workforce and its tools.",
    tiles: [
      { label: "Claude Code Studio", href: "/app/creative", desc: "Unified creative operating system + video team." },
      { label: "Higgsfield", href: "/app/higgsfield", desc: "Creative supercomputer provider control center." },
      { label: "Skills Marketplace", href: "/marketplace", desc: "Premium skills + workflows for your workforce." },
      { label: "Runtime Marketplace", href: "/login", desc: "Connect Claude Code, Codex, Hermes, OpenClaw, OMP." },
      { label: "Knowledge OS", href: "/login", desc: "Obsidian / Notion / Pinecone / NotebookLM brain layers." },
    ],
  },
  {
    title: "Operate",
    blurb: "Run the company day to day.",
    tiles: [
      { label: "Mission Control", href: "/login", desc: "The cloud command center for your workforce." },
      { label: "Workforce Orchestration", href: "/login", desc: "Route tasks across specialized agent squads." },
      { label: "Agent Directory", href: "/login", desc: "Every AI employee, status, and assignment." },
      { label: "Runtime Directory", href: "/login", desc: "Connected runtimes + health." },
      { label: "Activity Center", href: "/login", desc: "Live, auditable workforce activity." },
    ],
  },
  {
    title: "Scale",
    blurb: "Deploy beyond the browser.",
    tiles: [
      { label: "Flight Deck", href: "/flight-deck", desc: "Desktop terminal connecting local runtimes." },
      { label: "Deployment", href: "/flight-deck", desc: "Ship to your own infrastructure." },
      { label: "VPS Pairing", desc: "Pair a production controller securely (no SSH in-app)." },
      { label: "Local Install", href: "/flight-deck", desc: "Run the workforce on your hardware." },
      { label: "Enterprise Rollout", href: "/pricing", desc: "Org-wide deployment + guardrails." },
    ],
  },
  {
    title: "Knowledge Layer",
    blurb: "The four-brain memory architecture.",
    tiles: [
      { label: "Obsidian", desc: "Brain 1 — working memory + daily ops." },
      { label: "Notion", desc: "Brain 2 — structured business memory + SOPs." },
      { label: "Pinecone", desc: "Brain 3 — long-term semantic retrieval." },
      { label: "NotebookLM", desc: "Brain 4 — research synthesis + audio/video/slides." },
      { label: "PI Agent", desc: "Chief Memory Officer across the brain layers." },
    ],
  },
  {
    title: "Creative Layer",
    blurb: "Provider-sovereign creative production — assets stay in Baseline OS.",
    tiles: [
      { label: "Claude Code Studio", href: "/app/creative", desc: "Canonical creative workspace + render queue + proof." },
      { label: "Video Team", desc: "8 specialized creative agents." },
      { label: "Higgsfield", href: "/app/higgsfield", desc: "Image/video provider with agent orchestration." },
      { label: "HyperFrames", desc: "HTML-to-video rendering pipeline." },
      { label: "Soul IDs", desc: "Consent-gated identity models (high approval)." },
      { label: "Asset Library", desc: "Every asset/proof owned by Baseline OS, not the provider." },
    ],
  },
];

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [activeSimKey, setActiveSimKey] = useState<string>("dev");
  const [simState, setSimState] = useState<"idle" | "running" | "paused" | "waiting_gate" | "completed">("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [logs, setLogs] = useState<SimulationStep[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});

  const logEndRef = useRef<HTMLDivElement>(null);
  const simIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    return () => { if (simIntervalRef.current) clearTimeout(simIntervalRef.current); };
  }, []);

  const activeSim = SIMULATIONS[activeSimKey];

  const startSimulation = () => {
    if (simState === "running") return;
    let currentStep = stepIndex;
    if (simState === "completed" || simState === "idle") {
      setLogs([]);
      setStepIndex(0);
      currentStep = 0;
      const clearedStates = { ...agentStates };
      activeSim.agents.forEach((a) => { clearedStates[a.id] = "idle"; });
      setAgentStates(clearedStates);
    }
    setSimState("running");
    runNextStep(currentStep);
  };

  const runNextStep = (index: number) => {
    if (index >= activeSim.steps.length) {
      setSimState("completed");
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      return;
    }
    const step = activeSim.steps[index];
    simIntervalRef.current = setTimeout(() => {
      setLogs((prev) => [...prev, step]);
      setStepIndex(index + 1);
      setAgentStates((prev) => {
        const next = { ...prev };
        activeSim.agents.forEach((a) => {
          if (next[a.id] === "thinking" || next[a.id] === "communicating") next[a.id] = "success";
        });
        const actingAgent = activeSim.agents.find((a) => a.name === step.agent);
        if (actingAgent) next[actingAgent.id] = "thinking";
        return next;
      });
      if (step.status === "gate") {
        setSimState("waiting_gate");
        setAgentStates((prev) => {
          const next = { ...prev };
          const actingAgent = activeSim.agents.find((a) => a.name === step.agent);
          if (actingAgent) next[actingAgent.id] = "communicating";
          return next;
        });
        return;
      }
      runNextStep(index + 1);
    }, step.delay);
  };

  const approveGate = () => {
    if (simState !== "waiting_gate") return;
    setSimState("running");
    confetti({ particleCount: 15, spread: 30, origin: { y: 0.6 } });
    runNextStep(stepIndex);
  };

  const pauseSimulation = () => {
    if (simIntervalRef.current) clearTimeout(simIntervalRef.current);
    setSimState("paused");
  };

  const resetSimulation = () => {
    if (simIntervalRef.current) clearTimeout(simIntervalRef.current);
    setLogs([]);
    setStepIndex(0);
    setSimState("idle");
    const cleared = { ...agentStates };
    Object.keys(cleared).forEach((k) => { cleared[k] = "idle"; });
    setAgentStates(cleared);
  };

  const handleSimCategoryChange = (key: string) => {
    if (simIntervalRef.current) clearTimeout(simIntervalRef.current);
    setActiveSimKey(key);
    setLogs([]);
    setStepIndex(0);
    setSimState("idle");
    const cleared = { ...agentStates };
    Object.keys(cleared).forEach((k) => { cleared[k] = "idle"; });
    setAgentStates(cleared);
  };

  // ROI Calculator State
  const [numAgents, setNumAgents] = useState(15);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [humanRate, setHumanRate] = useState(65);
  const totalHoursYear = numAgents * hoursPerDay * 252;
  const humanCostYear = totalHoursYear * humanRate;
  const baselineCostHour = 0.18;
  const platformLicenseCost = 2400;
  const baselineCostYear = totalHoursYear * baselineCostHour + platformLicenseCost;
  const annualSavings = humanCostYear - baselineCostYear;
  const roiMultiplier = (annualSavings / baselineCostYear) * 100;
  const hoursReclaimed = totalHoursYear;

  // Newsletter Sign-up
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() === "") return;
    setSubmitted(true);
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  };

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#08080C] text-[#F3F4F6] font-sans overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Gradients & Effects */}
      <div className="absolute top-0 left-0 w-full h-[100vh] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0,rgba(0,0,0,0)_60%)] filter blur-3xl"></div>
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[70%] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0,rgba(0,0,0,0)_60%)] filter blur-3xl"></div>
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
      </div>

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#09090E]/80 border-b border-white/[0.06] backdrop-blur-lg py-3 shadow-lg shadow-black/20" : "bg-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="flex items-center justify-center w-full h-full rounded-[11px] bg-[#09090E]">
                <Brain className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-cyan-500 border border-[#08080C] animate-ping opacity-75"></div>
            </div>
            <div>
              <span className="font-bold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400">BASELINE</span>
              <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider text-cyan-400 border border-cyan-500/30 bg-cyan-950/20">AUTOMATIONS</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="/marketplace" data-testid="nav-marketplace" className="hover:text-white transition-colors">Marketplace</a>
            <a href="https://rehab-vision.emergent.host" target="_blank" rel="noopener noreferrer" data-testid="nav-visionops" className="hover:text-white transition-colors">VisionOps</a>
            <a href="https://propcontrol.netlify.app/" target="_blank" rel="noopener noreferrer" data-testid="nav-propcontrol" className="hover:text-white transition-colors">PC Empire</a>
            <a href="/login" data-testid="nav-mission-control" className="hover:text-white transition-colors">Mission Control</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="/login" data-testid="header-sign-in" className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/5 border border-white/[0.08] hover:bg-white/10 transition-all active:scale-[0.98]">Sign In</a>
            <a href="/signup" data-testid="header-start-free" className="relative inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-indigo-500 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/20 group overflow-hidden">
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
              <span className="relative flex items-center gap-1.5">Start Free <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" /></span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-6 flex justify-center" data-testid="hero-badge">
            <img src="/brand/baseline-logo.png" alt="Baseline Automations — The Real Estate Execution Platform" className="h-32 w-auto select-none sm:h-44" />
          </div>
          <div className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300/80 mb-4" data-testid="hero-workforce-os">Mission Control · Real Estate Execution</div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] max-w-5xl mx-auto">
            The Real Estate Execution Platform for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 drop-shadow-[0_2px_10px_rgba(6,182,212,0.15)]">Property Operations</span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-white font-semibold max-w-3xl mx-auto mb-3" data-testid="hero-install-line">
            Install an AI workforce to run property operations — with proof.
          </p>
          <p className="text-base sm:text-lg text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Triage maintenance, coordinate vendors, route owner approvals, manage property workflows, and prove every action with replay. Built to expand across brokerage, mortgage, lending, contractors, and home services — starting with property management.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <a href="/app/activate?template=property-management" data-testid="cta-install-pm" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-all active:scale-[0.97] shadow-xl shadow-white/5 gap-2"><ArrowRight className="w-4 h-4" /> Install Property Management Workforce</a>
            <a href="/marketing/mission-control-demo.mp4" target="_blank" rel="noopener" data-testid="cta-watch-demo" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl text-sm font-bold text-gray-300 bg-white/5 border border-white/[0.08] hover:bg-white/10 transition-all active:scale-[0.97] gap-2"><Play className="w-4 h-4 fill-current" /> Watch Live Maintenance Demo</a>
          </div>
          <div className="relative max-w-5xl mx-auto rounded-2xl border border-white/[0.08] bg-[#0A0A0F] p-2 sm:p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 opacity-60 z-30"></div>
            <MissionControlHero />
          </div>
        </div>
      </section>

      {/* Property Management Workflow — the first thing after the hero */}
      <section id="pm-workflow" className="py-20 px-4 sm:px-6 lg:px-8 relative z-10" data-testid="pm-workflow">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">One workflow, fully supervised — with proof</h2>
            <p className="text-gray-400">Every maintenance request flows through the same accountable pipeline. Owner approval gates the spend; proof and replay cover you.</p>
          </div>
          <div className="flex flex-wrap items-stretch justify-center gap-2">
            {[
              { k: "Maintenance Request", c: "#43E5FF" }, { k: "AI Triage", c: "#43E5FF" }, { k: "Vendor Match", c: "#7C5CFF" },
              { k: "Owner Approval", c: "#C9A227" }, { k: "Dispatch", c: "#7C5CFF" }, { k: "Proof Package", c: "#34d399" }, { k: "Replay", c: "#34d399" },
            ].map((s, i, arr) => (
              <div key={s.k} className="flex items-center">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white" style={{ boxShadow: `inset 0 0 0 1px ${s.c}22` }} data-testid={`pm-step-${i}`}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: s.c, boxShadow: `0 0 8px ${s.c}` }} />{s.k}
                </div>
                {i < arr.length - 1 && <ArrowRight className="mx-1 h-4 w-4 text-white/30" />}
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a href="/app/maintenance" className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-black hover:bg-gray-100 active:scale-[0.97]"><Play className="h-4 w-4 fill-current" /> Run the maintenance workflow</a>
          </div>
        </div>
      </section>

      {/* Flight Deck preview — the supervisor layer */}
      <section id="flight-deck" className="py-20 px-4 sm:px-6 lg:px-8 relative z-10 border-t border-white/[0.05]" data-testid="flight-deck-preview">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Flight Deck — your control tower</h2>
            <p className="text-gray-400">The supervisor layer over your AI workforce: runtimes, cost, approvals, deployments, and health in one view.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { t: "Runtime Registry", d: "What's connected" }, { t: "Cost Monitoring", d: "Spend per action" }, { t: "Approval Center", d: "Owner gates" },
              { t: "Deployments", d: "Workforce status" }, { t: "Health Monitoring", d: "Live telemetry" },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-sm font-bold text-white">{c.t}</div>
                <div className="text-[11px] text-gray-400 mt-1">{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simulator */}
      <section id="simulator" className="py-24 border-y border-white/[0.05] bg-[#09090D] relative z-10" data-testid="workforce-console">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Interactive Workforce OS Console</h2>
            <p className="text-gray-400">Choose a directive below. Run the simulation to see how Baseline Automations dispatches workers, tracks tools, and triggers human gating. <span className="text-amber-300/80" data-testid="console-demo-label">Simulation/demo — no live work is executed.</span></p>
          </div>

          {/* Directive Tabs — 9 total (3 general + 6 industry) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" data-testid="directive-grid">
            {Object.keys(SIMULATIONS).map((key) => {
              const sim = SIMULATIONS[key];
              const isActive = activeSimKey === key;
              return (
                <button key={key} onClick={() => handleSimCategoryChange(key)} data-testid={`directive-${key}`}
                  className={`text-left p-5 rounded-2xl border transition-all duration-300 relative group overflow-hidden ${isActive ? "border-cyan-500/30 bg-cyan-950/10 shadow-lg shadow-cyan-500/5 text-white" : "border-white/[0.05] bg-white/[0.01] text-gray-400 hover:bg-white/[0.02] hover:border-white/10"}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl border ${isActive ? "border-cyan-400 bg-cyan-950 text-cyan-400" : "border-white/10 bg-white/5 text-gray-400"}`}>
                      {key === "dev" ? <Cpu className="w-5 h-5" /> : key === "marketing" ? <Sparkles className="w-5 h-5" /> : key === "intelligence" ? <Database className="w-5 h-5" /> : <Network className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm leading-tight transition-colors ${isActive ? "text-white" : "text-gray-300 group-hover:text-white"}`}>{sim.name}</h4>
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{sim.description}</p>
                    </div>
                  </div>
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-indigo-500"></div>}
                </button>
              );
            })}
          </div>

          {/* Console Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left: Agent Map */}
            <div className="lg:col-span-5 flex flex-col justify-between border border-white/[0.08] rounded-2xl bg-[#0B0B10] p-6 shadow-inner relative overflow-hidden">
              <div className="absolute top-[-30px] right-[-30px] w-64 h-64 rounded-full bg-indigo-500/5 pointer-events-none filter blur-3xl"></div>
              <div>
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-6">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></div><span className="text-xs font-bold uppercase tracking-wider text-gray-300">Agent Map</span></div>
                  <span className="text-[10px] text-gray-500 font-mono">WORKSPACE_ID: AETH-6091</span>
                </div>
                <p className="text-xs text-gray-400 mb-6 leading-relaxed">Real-time status of assigned agents in the active workspace. Watch their status shift from <span className="text-gray-500 font-medium">Idle</span> to <span className="text-cyan-400 font-medium">Thinking</span>.</p>
                <div className="relative py-8 flex flex-col gap-5 items-center justify-center">
                  <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-[1px] shadow-lg shadow-indigo-500/20 mb-2">
                    <div className="flex items-center justify-center w-full h-full rounded-[15px] bg-[#09090D]"><Brain className="w-6 h-6 text-indigo-400" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-16 gap-y-10 w-full relative z-10" data-testid="console-agent-map">
                    {activeSim.agents.map((agent, i) => {
                      const state = agentStates[agent.id] ?? "idle";
                      const avatar = i === 0 ? "🛡️" : i === 1 ? "💻" : i === 2 ? "🧪" : i === 3 ? "🚀" : INDUSTRY_AVATARS[i % INDUSTRY_AVATARS.length];
                      let borderClass = "border-white/10 bg-white/5 text-gray-400";
                      let labelGlow = "";
                      if (state === "thinking") { borderClass = "border-cyan-500 bg-cyan-950/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] animate-pulse"; labelGlow = "text-cyan-400 font-semibold"; }
                      else if (state === "communicating") { borderClass = "border-amber-500 bg-amber-950/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]"; labelGlow = "text-amber-400 font-semibold"; }
                      else if (state === "success") { borderClass = "border-emerald-500 bg-emerald-950/10 text-emerald-400"; labelGlow = "text-emerald-500"; }
                      return (
                        <div key={agent.id} className="flex flex-col items-center" data-testid="agent-node">
                          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-lg transition-all duration-300 ${borderClass}`}>{avatar}</div>
                          <span className={`text-[10px] mt-2 font-bold tracking-tight text-center max-w-[90px] truncate ${labelGlow || "text-gray-400"}`}>{agent.name.split(" ")[0]}</span>
                          <span className="text-[8px] text-gray-600 font-mono mt-0.5 uppercase">{state}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-5 mt-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {simState === "running" ? (
                    <button onClick={pauseSimulation} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>Pause</button>
                  ) : (
                    <button onClick={startSimulation} disabled={simState === "waiting_gate"} data-testid="console-run" className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-indigo-500 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 shadow-lg shadow-cyan-500/10"><Play className="w-3.5 h-3.5 fill-current" />{simState === "paused" ? "Resume" : "Run Mission"}</button>
                  )}
                  <button onClick={resetSimulation} className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95" title="Reset Simulator"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>
                <div className="text-right"><div className="text-[10px] font-mono text-gray-500">Virtual Duration</div><div className="text-xs font-bold text-gray-300 font-mono mt-0.5">{stepIndex > 0 ? (stepIndex * 1.5).toFixed(1) : "0.0"}s</div></div>
              </div>
            </div>

            {/* Right: Output Log */}
            <div className="lg:col-span-7 flex flex-col justify-between border border-white/[0.08] rounded-2xl bg-[#09090D] shadow-2xl relative overflow-hidden min-h-[460px]">
              <div className="flex items-center justify-between px-4 py-3 bg-[#0c0c14] border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span><span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span><span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span></div>
                  <div className="w-[1px] h-3.5 bg-white/10 mx-1"></div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400"><TerminalIcon className="w-3.5 h-3.5 text-cyan-400" /><span>baseline-core@automations: ~/{activeSimKey}-session</span></div>
                </div>
                <div className="flex items-center gap-3"><div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-gray-500"><Cpu className="w-3 h-3 text-cyan-400" /><span>API_TOKENS: {logs.length > 0 ? (logs.length * 4200).toLocaleString() : "0"}</span></div></div>
              </div>
              <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] sm:text-xs leading-relaxed space-y-4 max-h-[360px]" data-testid="console-log">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 py-12"><TerminalIcon className="w-10 h-10 text-gray-700 mb-3" /><p className="max-w-[300px]">Baseline Automations kernel idling. Click <strong className="text-gray-400">Run Mission</strong> to initiate orchestration log.</p></div>
                ) : (
                  logs.map((log, i) => {
                    let logColor = "text-gray-300"; let prefixColor = "text-cyan-400"; let bg = "";
                    if (log.status === "system") { logColor = "text-indigo-400 italic"; prefixColor = "text-indigo-500"; }
                    else if (log.status === "success") { logColor = "text-emerald-400 font-semibold"; prefixColor = "text-emerald-500"; bg = "bg-emerald-950/10 border-l border-emerald-500 pl-2 py-1 my-1"; }
                    else if (log.status === "gate") { logColor = "text-amber-400 font-semibold"; prefixColor = "text-amber-500"; bg = "bg-amber-950/10 border-l border-amber-500 pl-2 py-1.5 my-1.5 animate-pulse"; }
                    return (
                      <div key={i} className={`flex items-start gap-2.5 transition-all duration-300 ${bg}`}>
                        <span className="text-[10px] text-gray-600 select-none">[{new Date().toLocaleTimeString(undefined, { hour12: false })}]</span>
                        <div className="flex-1"><span className={`font-bold mr-1.5 ${prefixColor}`}>{log.avatar} {log.agent}:</span><span className={logColor}>{log.message}</span></div>
                      </div>
                    );
                  })
                )}
                {/* CTA after completion */}
                {simState === "completed" && activeSim.ctaRoute && (
                  <div className="mt-3 flex items-center gap-3" data-testid="console-cta-wrap">
                    <a href={activeSim.ctaRoute} data-testid="console-cta" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-indigo-500 hover:brightness-110 active:scale-95 transition-all">{activeSim.ctaLabel ?? "Continue"} <ArrowRight className="w-3.5 h-3.5" /></a>
                    <span className="text-[10px] text-gray-600 font-mono">demo simulation — install to run for real</span>
                  </div>
                )}
                <div ref={logEndRef} />
              </div>
              {simState === "waiting_gate" && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-6 z-25">
                  <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0F0F16] p-5 shadow-2xl shadow-amber-500/5">
                    <div className="flex items-start gap-3.5 mb-4"><div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-950/20 text-amber-400"><ShieldAlert className="w-5 h-5" /></div><div><h4 className="font-bold text-sm text-white">Human Gate Approval Required</h4><p className="text-xs text-gray-400 mt-1 leading-relaxed">Baseline Automations has paused operations to await operator signature.</p></div></div>
                    <div className="rounded-lg bg-black/40 border border-white/[0.04] p-3 text-xs font-mono mb-5 space-y-1.5 text-gray-400">
                      <div><span className="text-gray-600">ACTION_TYPE:</span> {activeSimKey === "dev" ? "GIT_PUSH_PROD" : activeSimKey === "marketing" ? "SCHEDULE_CAMPAIGN" : activeSimKey === "intelligence" ? "PUBLISH_NOTIFICATIONS" : "WORKFORCE_ACTION"}</div>
                      <div><span className="text-gray-600">INITIATED_BY:</span> {activeSim.agents[activeSim.agents.length - 1].name}</div>
                      <div><span className="text-gray-600">SAFETY_INDEX:</span> <span className="text-emerald-400 font-bold">94% (LOW RISK)</span></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={approveGate} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-1.5"><Check className="w-4 h-4 stroke-[3px]" /> Approve and Continue</button>
                      <button onClick={resetSimulation} className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all active:scale-98">Decline</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="px-4 py-2.5 bg-[#0A0A0F] border-t border-white/[0.06] flex items-center justify-between text-[10px] text-gray-500 font-mono"><div>WORKSPACE: READY</div><div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>SSL_SECURE_LOCAL</span></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 z-10 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20"><h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Designed for High-Agency Autonomy</h2><p className="text-gray-400">Unlike simple chatbot interfaces, Baseline Automations is a complete workspace system that powers complex workflows with structural safety.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Network className="w-6 h-6" /></div>
              <h3 className="text-xl font-bold text-white mb-3">Multi-Agent Orchestration</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Coordinate complex hierarchy structures. Route sub-tasks automatically to specialized developer, qa, design, or research agents in parallel.</p>
            </div>
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Layers className="w-6 h-6" /></div>
              <h3 className="text-xl font-bold text-white mb-3">Global Semantic Memory</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Keep the fleet in sync. Agents leverage a shared database layer of project context, past sessions, API tokens, and markdown workspaces seamlessly.</p>
            </div>
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-purple-950/30 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><ShieldAlert className="w-6 h-6" /></div>
              <h3 className="text-xl font-bold text-white mb-3">Human-in-the-Loop Gates</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Retain complete authority. Pre-define checkpoints for financial transactions, code repository push sequences, or email dispatch lists.</p>
            </div>
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-teal-950/30 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Cpu className="w-6 h-6" /></div>
              <h3 className="text-xl font-bold text-white mb-3">MCP Tool Matrix</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Integrate external APIs natively. Utilize standard Model Context Protocol connectors for Google Workspace, Slack, Databases, and GitHub out of the box.</p>
            </div>
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-blue-950/30 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><TerminalIcon className="w-6 h-6" /></div>
              <h3 className="text-xl font-bold text-white mb-3">Local-First Sandbox</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Ensure absolute security. Run agents inside containerized sandboxes on local devices, avoiding external server leaks for sensitive proprietary source files.</p>
            </div>
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><TrendingUp className="w-6 h-6" /></div>
              <h3 className="text-xl font-bold text-white mb-3">Live ROI Observability</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Monitor business value directly. Track time-saved metrics, tool invocation counts, API token cost allocations, and performance ratios on a live dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="py-24 border-t border-white/[0.05] bg-gradient-to-b from-transparent to-[#07070B] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-950/20 text-xs font-semibold text-teal-300 mb-6"><Layers className="w-3.5 h-3.5" /><span>Under the Hood</span></div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">Engineered for Infinite Horizon Workflows</h2>
              <p className="text-gray-400 leading-relaxed mb-6">Baseline Automations sits between standard Large Language Models and your local machine environment, organizing processes into structured run-states that can handle loops, errors, and conditional branches.</p>
              <div className="space-y-4">
                <div className="flex gap-4"><div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mt-0.5"><Check className="w-4 h-4" /></div><div><h5 className="font-bold text-white text-sm">State Persistence Daemon</h5><p className="text-xs text-gray-400 mt-1 leading-relaxed">Runs continuously to store state checkpoints. If an agent crashes or hits a rate limit, the OS resumes immediately from the last token frame.</p></div></div>
                <div className="flex gap-4"><div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mt-0.5"><Check className="w-4 h-4" /></div><div><h5 className="font-bold text-white text-sm">Token Cost Controller</h5><p className="text-xs text-gray-400 mt-1 leading-relaxed">Dynamically routes requests between cheap LLMs for structured operations and reasoning models for architectural decisions, reducing costs by 70%.</p></div></div>
                <div className="flex gap-4"><div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-950/30 border border-purple-500/20 flex items-center justify-center text-purple-400 mt-0.5"><Check className="w-4 h-4" /></div><div><h5 className="font-bold text-white text-sm">Security Sandbox Agent</h5><p className="text-xs text-gray-400 mt-1 leading-relaxed">Intercepts all terminal execution commands. Checks command signatures against safe-lists and quarantines destructive operations prior to execution.</p></div></div>
              </div>
            </div>
            <div className="border border-white/[0.08] rounded-2xl bg-[#09090D] p-6 shadow-2xl relative overflow-hidden">
              <h4 className="font-bold text-sm text-white mb-6 border-b border-white/[0.06] pb-3 flex items-center justify-between"><span>Kernel Pipeline Visualizer</span><span className="text-[10px] text-cyan-400 font-mono px-2 py-0.5 rounded bg-cyan-950/20 border border-cyan-500/20">LIVE_STATE</span></h4>
              <div className="space-y-4 relative">
                <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-cyan-500 via-indigo-500 to-emerald-500 opacity-30"></div>
                <div className="flex gap-4 relative z-10 group"><div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-400 font-bold text-xs">1</div><div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 group-hover:border-cyan-500/30 transition-all"><span className="text-xs font-bold text-white block">Task Parsing &amp; Allocation</span><p className="text-[11px] text-gray-500 mt-1">User directive is decomposed into sub-tasks. Router matches target roles to registered agents.</p></div></div>
                <div className="flex gap-4 relative z-10 group"><div className="w-10 h-10 rounded-full bg-indigo-950 border border-indigo-400 flex items-center justify-center text-indigo-400 font-bold text-xs">2</div><div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 group-hover:border-indigo-500/30 transition-all"><span className="text-xs font-bold text-white block">Execution &amp; Tool Invocation</span><p className="text-[11px] text-gray-500 mt-1">Agents fetch files, execute terminal tasks, compile assets, and search vector DBs securely.</p></div></div>
                <div className="flex gap-4 relative z-10 group"><div className="w-10 h-10 rounded-full bg-purple-950 border border-purple-400 flex items-center justify-center text-purple-400 font-bold text-xs">3</div><div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 group-hover:border-purple-500/30 transition-all"><span className="text-xs font-bold text-white block">Guardrail Assessment</span><p className="text-[11px] text-gray-500 mt-1">Checkpoints block dangerous or expensive tool queries. Alerts are dispatched to human operator.</p></div></div>
                <div className="flex gap-4 relative z-10 group"><div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-400 flex items-center justify-center text-emerald-400 font-bold text-xs">4</div><div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 group-hover:border-emerald-500/30 transition-all"><span className="text-xs font-bold text-white block">Artifact Assembly &amp; Sync</span><p className="text-[11px] text-gray-500 mt-1">Outputs are checked, compiled, committed to git, and pushed to active Slack/Drive hooks.</p></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section id="roi" className="py-24 border-t border-white/[0.05] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16"><h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Calculate Your Operational ROI</h2><p className="text-gray-400">Adjust the workspace parameters to estimate how much engineering hours and budget Baseline Automations can save your organization.</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-7 border border-white/[0.08] rounded-2xl bg-[#0B0B10] p-6 sm:p-8 flex flex-col justify-between shadow-inner">
              <div>
                <h4 className="font-bold text-base text-white mb-6 border-b border-white/[0.06] pb-3">Workspace Cost Parameters</h4>
                <div className="mb-8"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"><span>Active AI Agents in Fleet</span><span className="text-cyan-400 font-mono text-sm">{numAgents} agents</span></div><input type="range" min="1" max="100" value={numAgents} onChange={(e) => setNumAgents(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none" /><div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1"><span>1 AGENT</span><span>50 AGENTS</span><span>100 AGENTS</span></div></div>
                <div className="mb-8"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"><span>Daily Task Time saved per agent</span><span className="text-cyan-400 font-mono text-sm">{hoursPerDay} hours/day</span></div><input type="range" min="1" max="24" value={hoursPerDay} onChange={(e) => setHoursPerDay(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none" /><div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1"><span>1 HOUR</span><span>12 HOURS</span><span>24 HOURS</span></div></div>
                <div className="mb-8"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"><span>Human Contractor Hourly Rate</span><span className="text-cyan-400 font-mono text-sm">${humanRate}/hour</span></div><input type="range" min="25" max="200" value={humanRate} onChange={(e) => setHumanRate(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none" /><div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1"><span>$25/HR</span><span>$112/HR</span><span>$200/HR</span></div></div>
              </div>
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 text-xs text-gray-500 leading-relaxed flex gap-3 items-start"><HelpCircle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" /><p>Baseline calculations include a platform base fee ($2,400/yr) and average API execution cost of $0.18 per active agent hour (using token optimization routes).</p></div>
            </div>
            <div className="lg:col-span-5 border border-white/[0.08] rounded-2xl bg-gradient-to-b from-indigo-950/10 to-[#0A0A0E] p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute bottom-[-50px] right-[-50px] w-72 h-72 rounded-full bg-cyan-500/5 pointer-events-none filter blur-3xl"></div>
              <div>
                <h4 className="font-bold text-base text-white mb-6 border-b border-white/[0.06] pb-3">Annual ROI Assessment</h4>
                <div className="space-y-6">
                  <div><span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Hours Reclaimed</span><span className="text-3xl font-extrabold text-white font-mono mt-1 block">{hoursReclaimed.toLocaleString()} <span className="text-xs font-normal text-gray-400 font-sans">hrs / year</span></span></div>
                  <div><span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Human Labor Cost</span><span className="text-xl font-bold text-gray-400 font-mono mt-1 block">${humanCostYear.toLocaleString()}</span></div>
                  <div><span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Baseline Platform Cost</span><span className="text-xl font-bold text-gray-400 font-mono mt-1 block">${Math.round(baselineCostYear).toLocaleString()}</span></div>
                  <div className="border-t border-white/[0.06] pt-5"><span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block">Net Budget Savings</span><span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 font-mono mt-1 block">${Math.round(annualSavings).toLocaleString()}</span></div>
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-6 mt-8 flex items-center justify-between text-xs"><div><div className="text-[10px] text-gray-500 font-mono uppercase">Calculated ROI</div><div className="font-extrabold text-emerald-400 font-mono text-sm mt-0.5">+{roiMultiplier.toFixed(0)}%</div></div><a href="/signup" className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-1.5">Deploy Fleet <ArrowRight className="w-3.5 h-3.5" /></a></div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 border-t border-white/[0.05] bg-[#09090D] relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16"><h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Frequently Asked Questions</h2><p className="text-gray-400">The Real Estate Execution Platform — for property managers, brokers, lenders, contractors, and home-service operators.</p></div>
          <div className="space-y-4">
            {[
              { q: "What is Mission Control?", a: "Mission Control is a cloud-based Real Estate Execution Platform that helps businesses automate and manage operational workflows using AI workforces, approvals, proof systems, and execution tracking. Instead of juggling emails, spreadsheets, phone calls, and disconnected software, Mission Control coordinates the work, tracks every action, and keeps humans in control of important decisions." },
              { q: "Who is Mission Control built for?", a: "Mission Control currently serves Property Management Companies, Real Estate Brokerages, Mortgage Brokers & Private Lenders, General Contractors, and Home Service Businesses. Property Management is our primary focus and launch market, but the platform is designed to support operational workflows across the entire real estate ecosystem." },
              { q: "What problem does Mission Control solve?", a: "Most businesses lose time because work gets stuck between people, systems, approvals, and communication channels. Mission Control creates a single execution layer that receives requests, routes work automatically, tracks progress, collects proof, manages approvals, and documents every action — reducing manual coordination so teams execute faster with fewer mistakes." },
              { q: "Do I need to know anything about AI?", a: "No. Mission Control is designed for operators, managers, and business owners. You do not need to understand prompts, models, agents, APIs, or technical infrastructure. The platform presents workflows in plain business language while the AI workforce handles the operational tasks behind the scenes." },
              { q: "Does Mission Control replace employees?", a: "No. Mission Control helps employees become more productive. It automates repetitive coordination, tracking, documentation, and follow-up so your team can focus on higher-value work. Humans remain in control of approvals, spending decisions, customer relationships, and business strategy." },
              { q: "How does the AI workforce actually work?", a: "Each workflow is assigned to specialized AI workers. For example, a maintenance request may involve Maintenance Intake → Vendor Matching → Cost Analysis → Owner Approval → Dispatch Coordination → Proof Collection. Mission Control coordinates these workers automatically while keeping a complete audit trail." },
              { q: "What is the Interactive Workforce Console?", a: "The Interactive Workforce Console is a live simulation environment that demonstrates how AI workers coordinate tasks, use tools, request approvals, and complete workflows. It lets you see how Mission Control operates before connecting it to your real business processes." },
              { q: "What is Proof and Replay?", a: "Every action inside Mission Control generates proof — decisions, messages, approvals, documents, work orders, vendor actions, and reports. Replay lets you review the entire workflow step-by-step to understand exactly what happened and why." },
              { q: "How does Mission Control help Property Management companies?", a: "It automates operational workflows such as Maintenance Requests, Vendor Dispatch, Owner Approvals, Tenant Communications, Inspections, Work Orders, Proof Collection, and Reporting — for faster response times, fewer missed tasks, and better operational visibility." },
              { q: "How does Mission Control help Real Estate Brokerages?", a: "It can automate Lead Intake, Follow-Up Plans, CMA Preparation, Listing Coordination, Marketing Workflows, and Transaction Checklists — so agents and brokers spend more time building relationships and closing deals." },
              { q: "How does Mission Control help Mortgage Brokers and Private Lenders?", a: "It can coordinate Lead Qualification, Borrower Intake, Document Collection, Follow-Up Sequences, Pipeline Management, and Approval Tracking — helping teams move loans through the process more efficiently." },
              { q: "How does Mission Control help Contractors and Home Service companies?", a: "It supports Service Requests, Dispatch Coordination, Scheduling, Estimate Workflows, Change Orders, Approval Management, and Job Documentation — so businesses manage more work with fewer administrative bottlenecks." },
              { q: "Is Mission Control cloud-based?", a: "Yes. Mission Control is a cloud-based platform accessible securely from anywhere. You can log in, manage workflows, monitor operations, review approvals, and track activity from a centralized command center." },
              { q: "How long does setup take?", a: "Most businesses can be operational in less than a day. Onboarding guides you through Account Setup, Workforce Installation, Team Configuration, and Workflow Activation — designed to deliver value quickly without lengthy implementation projects." },
              { q: "How do I know Mission Control is working?", a: "Mission Control provides complete operational visibility through Flight Deck, Activity Tracking, Proof Systems, Replay Systems, Approval Logs, and Workforce Analytics. Every workflow is tracked from start to finish — nothing disappears into a black box." },
              { q: "What makes Mission Control different?", a: "Most software helps you manage information. Mission Control helps you execute work. Instead of being another dashboard, it functions as an operational layer that coordinates people, AI workers, workflows, approvals, proof, and communication across your business." },
            ].map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className="rounded-2xl border border-white/[0.06] bg-[#0B0B10] overflow-hidden transition-all duration-300">
                  <button onClick={() => setOpenFaq(isOpen ? null : index)} className="w-full px-6 py-5 text-left flex items-center justify-between text-white font-bold text-sm sm:text-base hover:bg-white/[0.01]"><span>{item.q}</span><ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} /></button>
                  {isOpen && <div className="px-6 pb-6 text-xs sm:text-sm text-gray-400 leading-relaxed border-t border-white/[0.04] pt-4 bg-[#0A0A0F]/60">{item.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Waitlist */}
      <section id="waitlist" className="py-24 border-t border-white/[0.05] relative z-10 overflow-hidden">
        <div className="absolute bottom-[-100px] left-[50%] -translate-x-[50%] w-[500px] h-[300px] rounded-full bg-cyan-500/10 filter blur-[100px] pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 mb-8"><Zap className="w-7 h-7" /></div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Build Your Autonomous AI Workforce</h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10 text-sm sm:text-base leading-relaxed">Enter your work email to claim early access, or get started now to install a complete AI workforce.</p>
          {!submitted ? (
            <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your work email..." className="flex-1 px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:bg-white/[0.04] transition-all" />
              <button type="submit" className="py-4 px-6 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]">Join Waitlist <Send className="w-4 h-4" /></button>
            </form>
          ) : (
            <div className="max-w-md mx-auto rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6 flex flex-col items-center"><CheckCircle2 className="w-8 h-8 text-emerald-400 mb-3" /><h4 className="font-bold text-white text-sm">Access Request Submitted!</h4><p className="text-xs text-emerald-300/80 text-center mt-1.5 leading-relaxed">We have queued <strong className="text-white">{email}</strong> for slot allocations.</p><a href="/signup" className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 hover:text-white mt-4 underline decoration-dotted">Or get started now</a></div>
          )}
          <div className="mt-8 flex items-center justify-center gap-6 text-[11px] text-gray-500 font-mono"><span>VERSION: 0.8.2-PREVIEW</span><span>•</span><span>SUPPORT: GITHUB_MCP</span><span>•</span><span>LICENSING: APACHE_2.0</span></div>
        </div>
      </section>

      {/* Product layers */}
      <section id="layers" className="py-24 border-t border-white/[0.05] relative z-10" data-testid="layers">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Build · Operate · Scale · Know · Create</h2>
            <p className="text-gray-400">Everything an AI workforce needs, in one operating system. Free to start; credits power paid execution.</p>
          </div>
          <div className="space-y-12">
            {LAYERS.map((layer) => (
              <div key={layer.title} data-testid={`layer-${layer.title.replace(/\s+/g, "-").toLowerCase()}`}>
                <h3 className="text-xl font-bold text-white">{layer.title}</h3>
                <p className="text-sm text-gray-500 mt-1 mb-4">{layer.blurb}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {layer.tiles.map((t) => {
                    const inner = (
                      <>
                        <div className="text-sm font-bold text-white">{t.label}</div>
                        <div className="text-xs text-gray-500 mt-1">{t.desc}</div>
                      </>
                    );
                    return t.href ? (
                      <a key={t.label} href={t.href} className="rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all p-5 block">{inner}</a>
                    ) : (
                      <div key={t.label} className="rounded-2xl border border-white/[0.04] bg-white/[0.005] p-5">{inner}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/[0.05] bg-[#07070A] relative z-10 text-xs text-gray-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5"><Brain className="w-4 h-4 text-cyan-500" /><span className="font-mono text-gray-500">© {new Date().getFullYear()} Baseline Automations Technologies, Inc. All rights reserved.</span></div>
          <div className="flex items-center gap-8">
            <a href="/marketplace" className="hover:text-gray-400 transition-colors" data-testid="footer-link-marketplace">Marketplace</a>
            <a href="/pricing" className="hover:text-gray-400 transition-colors" data-testid="footer-link-pricing">Pricing</a>
            <a href="/flight-deck" className="hover:text-gray-400 transition-colors" data-testid="footer-link-flight-deck">Flight Deck</a>
            <a href="/help" className="hover:text-gray-400 transition-colors" data-testid="footer-link-help">Help</a>
            <a href="/login" className="hover:text-gray-400 transition-colors" data-testid="footer-link-mission-control">Mission Control</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
