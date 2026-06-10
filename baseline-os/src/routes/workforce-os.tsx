import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Brain,
  Bot,
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
  Clock,
  Layers,
  ArrowUpRight,
  X,
  Plus,
} from "lucide-react";
import confetti from "canvas-confetti";
import workforceDashboard from "@/assets/workforce-dashboard.png";
import { directivesByGroup, getDirective, type ConsoleDirective } from "@/lib/workforce-console";
import { directiveToReplayEvents } from "@/lib/console-directive-run";
import { recordMission } from "@/lib/replay-store";

export const Route = createFileRoute("/workforce-os")({
  head: () => ({
    meta: [
      { title: "Baseline Automations — Autonomous Agent Orchestration" },
      {
        name: "description",
        content:
          "The first operating system for coordinating, monitoring, and scaling autonomous AI agent workforces with enterprise-grade human-in-the-loop guardrails.",
      },
    ],
  }),
  component: WorkforceOSLanding,
});

// Simulation types
type AgentState = "idle" | "thinking" | "communicating" | "success" | "error";

interface SimulationStep {
  agent: string;
  avatar: string;
  message: string;
  status: "system" | "agent" | "gate" | "success";
  delay: number;
}

const SIMULATIONS = {
  dev: {
    name: "Software Release (Code Audit & Deploy)",
    description:
      "Scan code for vulnerabilities, patch the code, run tests, and request deployment authorization.",
    agents: [
      { id: "auditor", name: "Security Auditor", role: "Audits repository for vulnerabilities" },
      { id: "coder", name: "Lead Developer", role: "Patches files and writes test cases" },
      { id: "qa", name: "QA Automator", role: "Executes test suite and validates E2E" },
      { id: "devops", name: "DevOps Engineer", role: "Coordinates deployment pipelines" },
    ],
    steps: [
      {
        agent: "SYSTEM",
        avatar: "🤖",
        message: "Initializing Software Release fleet. Allocating context space...",
        status: "system",
        delay: 1000,
      },
      {
        agent: "Security Auditor",
        avatar: "🛡️",
        message: "Cloning repository... Scanning src/routes/auth.ts for vulnerability signatures.",
        status: "agent",
        delay: 2000,
      },
      {
        agent: "Security Auditor",
        avatar: "🛡️",
        message:
          "CRITICAL FINDING: Raw SQL injection path found on line 42 (username query interpolation). Raising ticket #SEC-109.",
        status: "agent",
        delay: 2200,
      },
      {
        agent: "Lead Developer",
        avatar: "💻",
        message: "Ticket #SEC-109 received. Checkout branch hotfix/sql-injection-auth.",
        status: "agent",
        delay: 1800,
      },
      {
        agent: "Lead Developer",
        avatar: "💻",
        message:
          "Refactored auth.ts: Replacing template string query with parameterized db.query($1, [username]). Local type check passed.",
        status: "agent",
        delay: 2200,
      },
      {
        agent: "QA Automator",
        avatar: "🧪",
        message: "Triggering unit test suite for auth endpoints... npm run test:auth",
        status: "agent",
        delay: 1500,
      },
      {
        agent: "QA Automator",
        avatar: "🧪",
        message:
          "All 18 unit tests PASSED. Verifying session expiration and token boundaries. Clean run.",
        status: "agent",
        delay: 2000,
      },
      {
        agent: "DevOps Engineer",
        avatar: "🚀",
        message:
          "Preparing build artifact v1.4.2-patch. Generating changelog. Requesting production staging deploy...",
        status: "agent",
        delay: 1800,
      },
      {
        agent: "SYSTEM",
        avatar: "⚠️",
        message:
          "Security Gate triggered: DevOps Agent requests git push permission to staging branch. Manual operator override required.",
        status: "gate",
        delay: 500,
      },
      {
        agent: "DevOps Engineer",
        avatar: "🚀",
        message:
          "Approval received! Resuming deploy... Pushing to AWS Staging-3 cluster. Deploying K8s pods.",
        status: "agent",
        delay: 2000,
      },
      {
        agent: "DevOps Engineer",
        avatar: "🚀",
        message: "Performing post-deploy warm-up ping. Health status: 200 OK. Latency: 42ms.",
        status: "agent",
        delay: 1800,
      },
      {
        agent: "SYSTEM",
        avatar: "🎉",
        message:
          "Simulation finished. Security issue patched, tested, and deployed to Staging-3 in 18.8s (virtual time).",
        status: "success",
        delay: 1000,
      },
    ] as SimulationStep[],
  },
  marketing: {
    name: "SaaS Launch Campaign",
    description:
      "Perform competitor analysis, draft launch copy, generate mock visuals, and schedule social blasts.",
    agents: [
      {
        id: "researcher",
        name: "Market Analyst",
        role: "Scrapes competitor positioning and hooks",
      },
      {
        id: "copywriter",
        name: "Copywriter Agent",
        role: "Drafts high-conversion web copy & emails",
      },
      { id: "designer", name: "Visual Designer", role: "Generates assets and templates" },
      {
        id: "manager",
        name: "Campaign Manager",
        role: "Coordinates calendar and schedules channels",
      },
    ],
    steps: [
      {
        agent: "SYSTEM",
        avatar: "🤖",
        message: "Initializing SaaS Campaign fleet. Bootstrapping workspace tools...",
        status: "system",
        delay: 1000,
      },
      {
        agent: "Market Analyst",
        avatar: "📊",
        message:
          "Analyzing Product Hunt launches in the Developer Tool category from the past 90 days. Identifying successful messaging frameworks...",
        status: "agent",
        delay: 2200,
      },
      {
        agent: "Market Analyst",
        avatar: "📊",
        message:
          "Trend identified: Focus on developer ROI and local-first setup. Recommending tagline angle 'Autonomous, local-first workforce OS'.",
        status: "agent",
        delay: 2000,
      },
      {
        agent: "Copywriter Agent",
        avatar: "✍️",
        message:
          "Drafting Product Hunt pitch, a 3-part launch Twitter thread, and marketing newsletter draft. Target tone: Tech-forward, high agency.",
        status: "agent",
        delay: 2500,
      },
      {
        agent: "Copywriter Agent",
        avatar: "✍️",
        message:
          "Preview Draft: 'Orchestrate your AI fleet directly from your local terminal. Local-first. Multi-agent. Secure.' Reviewing copywriting quality.",
        status: "agent",
        delay: 1800,
      },
      {
        agent: "Visual Designer",
        avatar: "🎨",
        message:
          "Initiating asset generation plugin. Canvas prompt: 'glowing futuristic nodes, dark cybernetic UI dashboard mockup, neon cyan accents, flat design, high-contrast, vector logo'.",
        status: "agent",
        delay: 2200,
      },
      {
        agent: "Visual Designer",
        avatar: "🎨",
        message:
          "Asset rendering complete. Output: src/assets/launch-banner.png. Optimizing dimensions for Product Hunt media gallery.",
        status: "agent",
        delay: 1500,
      },
      {
        agent: "SYSTEM",
        avatar: "⚠️",
        message:
          "Editorial Gate triggered: Review copy and generated visual asset before publishing. Manual operator confirmation required.",
        status: "gate",
        delay: 500,
      },
      {
        agent: "Campaign Manager",
        avatar: "🗓️",
        message:
          "Approval received! Initializing integration modules. Scheduling Product Hunt launch, queuing Mailchimp draft, and Buffer tweets.",
        status: "agent",
        delay: 2000,
      },
      {
        agent: "Campaign Manager",
        avatar: "🗓️",
        message:
          "Synchronization confirmed. Social scheduler synced. Notifications routed to Slack #announcements.",
        status: "agent",
        delay: 1800,
      },
      {
        agent: "SYSTEM",
        avatar: "🎉",
        message:
          "Simulation finished. SaaS launch marketing materials prepared, validated, and scheduled successfully.",
        status: "success",
        delay: 1000,
      },
    ] as SimulationStep[],
  },
  intelligence: {
    name: "Competitor Market Intel",
    description: "Crawl web endpoints, create a strategic SWOT report, and notify stakeholders.",
    agents: [
      { id: "scraper", name: "Crawl Bot", role: "Extracts pricing and specifications from sites" },
      {
        id: "analyst",
        name: "Business Intelligence",
        role: "Cross-references features and generates SWOT",
      },
      {
        id: "writer",
        name: "Report Synthesizer",
        role: "Writes clean executive markdown summaries",
      },
      {
        id: "notifier",
        name: "Integrator Agent",
        role: "Pushes summaries to external APIs & Slack",
      },
    ],
    steps: [
      {
        agent: "SYSTEM",
        avatar: "🤖",
        message:
          "Initializing Competitor Intelligence fleet. Launching Chromium scraper headless...",
        status: "system",
        delay: 1000,
      },
      {
        agent: "Crawl Bot",
        avatar: "🕷️",
        message:
          "Crawling top 3 competitor pricing pages. Extracting tables, user seats, and modular feature lists.",
        status: "agent",
        delay: 2200,
      },
      {
        agent: "Crawl Bot",
        avatar: "🕷️",
        message:
          "Crawl completed. Extracted data payload: 12KB json. Found competitor A pricing at $49/mo, competitor B at $79/mo.",
        status: "agent",
        delay: 1500,
      },
      {
        agent: "Business Intelligence",
        avatar: "📈",
        message:
          "Correlating pricing structures. Running feature matrix comparison. Competitor A lacks self-hosted deployment. Competitor B lacks offline API usage.",
        status: "agent",
        delay: 2200,
      },
      {
        agent: "Business Intelligence",
        avatar: "📈",
        message:
          "Synthesizing SWOT. Strength: Baseline Automations is fully local-first. Weakness: New brand. Opportunity: Enterprise privacy requirements.",
        status: "agent",
        delay: 1800,
      },
      {
        agent: "Report Synthesizer",
        avatar: "📝",
        message:
          "Compiling competitive intelligence summary. Generating Markdown tables, graph layout, and bulleted recommendations.",
        status: "agent",
        delay: 2400,
      },
      {
        agent: "Report Synthesizer",
        avatar: "📝",
        message:
          "Report generated at /reports/intel-q2-2026.md. File length: 242 lines. Readability index: High.",
        status: "agent",
        delay: 1500,
      },
      {
        agent: "SYSTEM",
        avatar: "⚠️",
        message:
          "Notification Gate triggered: Send competitor report to leadership Slack channels and sync to Google Drive? Manual override required.",
        status: "gate",
        delay: 500,
      },
      {
        agent: "Integrator Agent",
        avatar: "🔌",
        message:
          "Approval received! Uploading Markdown report to Google Drive... Exporting to PDF format.",
        status: "agent",
        delay: 2000,
      },
      {
        agent: "Integrator Agent",
        avatar: "🔌",
        message:
          "Dispatching summary block to Slack #strategy-intel with direct Google Drive link. Status: Webhook accepted.",
        status: "agent",
        delay: 1800,
      },
      {
        agent: "SYSTEM",
        avatar: "🎉",
        message:
          "Simulation finished. Scraped competitor sites, drafted SWOT report, and published to Drive & Slack.",
        status: "success",
        delay: 1000,
      },
    ] as SimulationStep[],
  },
};

// ── Generated directives → sims (6 industry + 4 ops = 10, from the model) ─
// The 3 hand-authored sims above + these 10 = 13 total console directives.
const GEN_AVATARS = ["🧭", "🛠️", "🤝", "📅", "🔍", "📣", "🧾", "📊", "🛰️", "✅"];
function buildSim(d: ConsoleDirective) {
  const agents = d.agentMap.map((name, i) => ({ id: `${d.directiveId}-${i}`, name, role: "" }));
  const steps: SimulationStep[] = [
    {
      agent: "SYSTEM",
      avatar: "🤖",
      message: `Initializing ${d.label.split(":")[0]} workforce. Allocating context space...`,
      status: "system",
      delay: 900,
    },
    ...d.steps.map((s, i) => ({
      agent: agents[i % agents.length].name,
      avatar: GEN_AVATARS[i % GEN_AVATARS.length],
      message: s,
      status: "agent" as const,
      delay: 1400,
    })),
    {
      agent: "SYSTEM",
      avatar: "⚠️",
      message: `Human gate triggered: ${d.humanGates[0]}`,
      status: "gate",
      delay: 500,
    },
    {
      agent: "SYSTEM",
      avatar: "🎉",
      message:
        "Simulation finished. Proof package logged. (Demo simulation — no live work executed.)",
      status: "success",
      delay: 900,
    },
  ];
  return { name: d.label, description: d.description, agents, steps };
}

const GENERATED_SIMS = Object.fromEntries(
  [...directivesByGroup("industry"), ...directivesByGroup("ops")].map((d) => [
    d.directiveId,
    buildSim(d),
  ]),
);

// 13 directives total: 3 general (hand-authored) + 6 industry + 4 ops (generated).
const ALL_SIMULATIONS = { ...SIMULATIONS, ...GENERATED_SIMS } as Record<
  string,
  (typeof SIMULATIONS)["dev"]
>;

export default function WorkforceOSLanding() {
  // Navigation scrolling glass effect
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Simulator State
  const [activeSimKey, setActiveSimKey] = useState<string>("dev");
  const [simState, setSimState] = useState<
    "idle" | "running" | "paused" | "waiting_gate" | "completed"
  >("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [logs, setLogs] = useState<SimulationStep[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({
    auditor: "idle",
    coder: "idle",
    qa: "idle",
    devops: "idle",
    researcher: "idle",
    copywriter: "idle",
    designer: "idle",
    manager: "idle",
    scraper: "idle",
    analyst: "idle",
    writer: "idle",
    notifier: "idle",
  });

  const logEndRef = useRef<HTMLDivElement>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll simulator logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Clean interval on unmount
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // Get active agents config for currently selected simulation
  const activeSim = ALL_SIMULATIONS[activeSimKey];

  // Start Simulation
  const startSimulation = () => {
    if (simState === "running") return;

    // If completed or idle, reset first
    let currentStep = stepIndex;
    if (simState === "completed" || simState === "idle") {
      setLogs([]);
      setStepIndex(0);
      currentStep = 0;
      // Reset agent states to idle
      const clearedStates = { ...agentStates };
      activeSim.agents.forEach((a) => {
        clearedStates[a.id] = "idle";
      });
      setAgentStates(clearedStates);
    }

    setSimState("running");
    runNextStep(currentStep);

    // Platform integration: a directive run is a graph-first, replayable mission
    // (Replay + Proof + Agent Activity + Graphify + Knowledge OS). Fire once per start.
    if (currentStep === 0) {
      const directive = getDirective(activeSimKey);
      if (directive) {
        void (async () => {
          let files: string[] = [];
          try {
            const r = await fetch(`/__graphify?q=${encodeURIComponent(directive.label)}`);
            const j = await r.json();
            files = (j.results ?? []).map((n: { path: string }) => n.path).slice(0, 6);
          } catch {
            /* graph optional */
          }
          try {
            recordMission(
              directive.label,
              directive.description,
              directiveToReplayEvents(directive, files, Date.now()),
            );
          } catch {
            /* replay optional */
          }
        })();
      }
    }
  };

  // Run next step recursively based on delay
  const runNextStep = (index: number) => {
    if (index >= activeSim.steps.length) {
      setSimState("completed");
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
      });
      return;
    }

    const step = activeSim.steps[index];

    simIntervalRef.current = setTimeout(() => {
      // Add step to log
      setLogs((prev) => [...prev, step]);
      setStepIndex(index + 1);

      // Update agent states based on who is acting
      setAgentStates((prev) => {
        const next = { ...prev };
        // Clear previous active states to idle/success
        activeSim.agents.forEach((a) => {
          if (next[a.id] === "thinking" || next[a.id] === "communicating") {
            next[a.id] = "success";
          }
        });

        // Set active agent state
        const actingAgent = activeSim.agents.find((a) => a.name === step.agent);
        if (actingAgent) {
          next[actingAgent.id] = "thinking";
        }
        return next;
      });

      // Check if this step is a Human gate
      if (step.status === "gate") {
        setSimState("waiting_gate");
        // Highlight active agent as waiting
        setAgentStates((prev) => {
          const next = { ...prev };
          const actingAgent = activeSim.agents.find((a) => a.name === step.agent);
          if (actingAgent) next[actingAgent.id] = "communicating";
          return next;
        });
        return; // Pause execution loop
      }

      runNextStep(index + 1);
    }, step.delay);
  };

  // Human gate approval
  const approveGate = () => {
    if (simState !== "waiting_gate") return;
    setSimState("running");

    // Trigger tiny confetti pop for gate success
    confetti({
      particleCount: 15,
      spread: 30,
      origin: { y: 0.6 },
    });

    runNextStep(stepIndex);
  };

  // Pause Simulation
  const pauseSimulation = () => {
    if (simIntervalRef.current) {
      clearTimeout(simIntervalRef.current);
    }
    setSimState("paused");
  };

  // Reset Simulation
  const resetSimulation = () => {
    if (simIntervalRef.current) {
      clearTimeout(simIntervalRef.current);
    }
    setLogs([]);
    setStepIndex(0);
    setSimState("idle");

    const cleared = { ...agentStates };
    Object.keys(cleared).forEach((k) => {
      cleared[k] = "idle";
    });
    setAgentStates(cleared);
  };

  // Switch Simulation Category
  const handleSimCategoryChange = (key: string) => {
    if (simIntervalRef.current) {
      clearTimeout(simIntervalRef.current);
    }
    setActiveSimKey(key);
    setLogs([]);
    setStepIndex(0);
    setSimState("idle");

    const cleared = { ...agentStates };
    Object.keys(cleared).forEach((k) => {
      cleared[k] = "idle";
    });
    setAgentStates(cleared);
  };

  // ROI Calculator State
  const [numAgents, setNumAgents] = useState(15);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [humanRate, setHumanRate] = useState(65);

  // Calculations
  const totalHoursYear = numAgents * hoursPerDay * 252; // 252 working days in a year
  const humanCostYear = totalHoursYear * humanRate;

  // Baseline costs: estimated API tokens & platform license: ~$0.18 per agent hour
  const baselineCostHour = 0.18;
  const platformLicenseCost = 2400; // annual base platform fee
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
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#08080C] text-[#F3F4F6] font-sans overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Gradients & Effects */}
      <div className="absolute top-0 left-0 w-full h-[100vh] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0,rgba(0,0,0,0)_60%)] filter blur-3xl"></div>
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[70%] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0,rgba(0,0,0,0)_60%)] filter blur-3xl"></div>
        {/* Fine background grid */}
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      {/* Modern Sticky/Shrinking Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#09090E]/80 border-b border-white/[0.06] backdrop-blur-lg py-3 shadow-lg shadow-black/20"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="flex items-center justify-center w-full h-full rounded-[11px] bg-[#09090E]">
                <Brain className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-cyan-500 border border-[#08080C] animate-ping opacity-75"></div>
            </div>
            <div>
              <span className="font-bold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400">
                BASELINE
              </span>
              <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider text-cyan-400 border border-cyan-500/30 bg-cyan-950/20">
                AUTOMATIONS
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <a href="#simulator" className="hover:text-white transition-colors">
              OS Console
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Architecture
            </a>
            <a href="#roi" className="hover:text-white transition-colors">
              ROI Calculator
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="#waitlist"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/5 border border-white/[0.08] hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Sign In
            </a>
            <a
              href="#waitlist"
              className="relative inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-indigo-500 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/20 group overflow-hidden"
            >
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
              <span className="relative flex items-center gap-1.5">
                Join Waitlist{" "}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-950/20 text-xs font-semibold text-indigo-300 mb-8 animate-fade-in shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Introducing Baseline Automations Virtual Fleet Coordinator</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] max-w-5xl mx-auto">
            The Operating System for Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 drop-shadow-[0_2px_10px_rgba(6,182,212,0.15)]">
              AI Workforce
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Coordinate, monitor, and scale specialized AI agent squads. Manage complex projects
            locally with enterprise-grade human guardrails, global semantic memory, and native API
            toolsets.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <a
              href="#simulator"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-all active:scale-[0.97] shadow-xl shadow-white/5 gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> Try Live Console Demo
            </a>
            <a
              href="#architecture"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl text-sm font-bold text-gray-300 bg-white/5 border border-white/[0.08] hover:bg-white/10 transition-all active:scale-[0.97]"
            >
              View System Architecture
            </a>
          </div>

          {/* Glowing Mockup Dashboard */}
          <div className="relative max-w-5xl mx-auto rounded-2xl border border-white/[0.08] bg-[#0A0A0F] p-2 sm:p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] group overflow-hidden">
            {/* Top Bar Decoration */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 opacity-60"></div>

            <div className="absolute top-[-100px] left-[50%] -translate-x-[50%] w-[600px] h-[300px] rounded-full bg-indigo-500/10 filter blur-[80px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors duration-500"></div>

            {/* Embedded image */}
            <div className="relative rounded-xl overflow-hidden aspect-[16/15] sm:aspect-[16/10] border border-white/[0.05] bg-[#0c0c12]">
              <img
                src={workforceDashboard}
                alt="Baseline Automations Orchestration Dashboard Console"
                className="w-full h-full object-cover select-none pointer-events-none scale-[1.01] hover:scale-[1.03] transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F]/30 via-transparent to-transparent"></div>
            </div>
          </div>

          {/* Trust/Vitals Stats Strip */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01] backdrop-blur-sm divide-y-2 md:divide-y-0 md:divide-x divide-white/[0.06]">
            <div className="text-center px-4 py-2 md:py-0">
              <span className="block text-2xl md:text-3xl font-extrabold text-white">1.2M+</span>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-1 block">
                Tasks Completed
              </span>
            </div>
            <div className="text-center px-4 py-2 md:py-0">
              <span className="block text-2xl md:text-3xl font-extrabold text-cyan-400">99.8%</span>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-1 block">
                Automation Accuracy
              </span>
            </div>
            <div className="text-center px-4 py-2 md:py-0">
              <span className="block text-2xl md:text-3xl font-extrabold text-white">&lt; 15s</span>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-1 block">
                Avg. Task Resolution
              </span>
            </div>
            <div className="text-center px-4 py-2 md:py-0">
              <span className="block text-2xl md:text-3xl font-extrabold text-indigo-400">
                $45K+
              </span>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-1 block">
                Avg. Saved / Month
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Simulator Section */}
      <section
        id="simulator"
        className="py-24 border-y border-white/[0.05] bg-[#09090D] relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
              Interactive Workforce OS Console
            </h2>
            <p className="text-gray-400">
              Choose a directive below. Run the simulation to see how Baseline Automations
              dispatches workers, tracks tools, and triggers human gating.
            </p>
          </div>

          {/* Directive Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {Object.keys(ALL_SIMULATIONS).map((key) => {
              const sim = ALL_SIMULATIONS[key];
              const isActive = activeSimKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSimCategoryChange(key)}
                  className={`text-left p-5 rounded-2xl border transition-all duration-300 relative group overflow-hidden ${
                    isActive
                      ? "border-cyan-500/30 bg-cyan-950/10 shadow-lg shadow-cyan-500/5 text-white"
                      : "border-white/[0.05] bg-white/[0.01] text-gray-400 hover:bg-white/[0.02] hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isActive
                          ? "border-cyan-400 bg-cyan-950 text-cyan-400"
                          : "border-white/10 bg-white/5 text-gray-400"
                      }`}
                    >
                      {key === "dev" ? (
                        <Cpu className="w-5 h-5" />
                      ) : key === "marketing" ? (
                        <Sparkles className="w-5 h-5" />
                      ) : (
                        <Database className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4
                        className={`font-bold text-sm leading-tight transition-colors ${isActive ? "text-white" : "text-gray-300 group-hover:text-white"}`}
                      >
                        {sim.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {sim.description}
                      </p>
                    </div>
                  </div>
                  {/* Active bottom glow */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-indigo-500"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Interactive Workspace Console Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left: Agent Dispatcher & Node Graph (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between border border-white/[0.08] rounded-2xl bg-[#0B0B10] p-6 shadow-inner relative overflow-hidden">
              {/* Radial gradient background */}
              <div className="absolute top-[-30px] right-[-30px] w-64 h-64 rounded-full bg-indigo-500/5 pointer-events-none filter blur-3xl"></div>

              <div>
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                      Agent Map
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono">
                    WORKSPACE_ID: AETH-6091
                  </span>
                </div>

                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                  Real-time status of assigned agents in the active workspace. Watch their status
                  shift from <span className="text-gray-500 font-medium">Idle</span> to{" "}
                  <span className="text-cyan-400 font-medium">Thinking</span>.
                </p>

                {/* Nodes Layout */}
                <div className="relative py-8 flex flex-col gap-5 items-center justify-center">
                  {/* Central OS Core Node */}
                  <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-[1px] shadow-lg shadow-indigo-500/20 mb-2">
                    <div className="flex items-center justify-center w-full h-full rounded-[15px] bg-[#09090D]">
                      <Brain className="w-6 h-6 text-indigo-400" />
                    </div>
                  </div>

                  {/* Connections Path Indicators (SVG layer behind nodes) */}
                  <div className="absolute inset-0 pointer-events-none z-0">
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 400 300"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Coder connection */}
                      <path
                        d="M 200 130 L 70 65"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      {/* Auditor connection */}
                      <path
                        d="M 200 130 L 330 65"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      {/* QA connection */}
                      <path
                        d="M 200 130 L 70 235"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      {/* DevOps connection */}
                      <path
                        d="M 200 130 L 330 235"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />

                      {/* Glowing connection lines based on simulation progress */}
                      {simState === "running" && (
                        <>
                          <path
                            d="M 200 130 L 70 65"
                            stroke="url(#pulse-gradient-1)"
                            strokeWidth="2.5"
                            strokeDasharray="10 10"
                            className="animate-[dash_8s_linear_infinite]"
                          />
                          <path
                            d="M 200 130 L 330 65"
                            stroke="url(#pulse-gradient-2)"
                            strokeWidth="2.5"
                            strokeDasharray="10 10"
                            className="animate-[dash_8s_linear_infinite]"
                          />
                          <path
                            d="M 200 130 L 70 235"
                            stroke="url(#pulse-gradient-1)"
                            strokeWidth="2.5"
                            strokeDasharray="10 10"
                            className="animate-[dash_8s_linear_infinite]"
                          />
                          <path
                            d="M 200 130 L 330 235"
                            stroke="url(#pulse-gradient-2)"
                            strokeWidth="2.5"
                            strokeDasharray="10 10"
                            className="animate-[dash_8s_linear_infinite]"
                          />
                        </>
                      )}

                      <defs>
                        <linearGradient
                          id="pulse-gradient-1"
                          x1="200"
                          y1="130"
                          x2="70"
                          y2="65"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.8" />
                        </linearGradient>
                        <linearGradient
                          id="pulse-gradient-2"
                          x1="200"
                          y1="130"
                          x2="330"
                          y2="65"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  {/* Grid of Agents (Positioned around the center) */}
                  <div className="grid grid-cols-2 gap-x-28 gap-y-24 w-full relative z-10">
                    {activeSim.agents.map((agent, i) => {
                      const state = agentStates[agent.id] ?? "idle";
                      const avatar = i === 0 ? "🛡️" : i === 1 ? "💻" : i === 2 ? "🧪" : "🚀";

                      let borderClass = "border-white/10 bg-white/5 text-gray-400";
                      let labelGlow = "";

                      if (state === "thinking") {
                        borderClass =
                          "border-cyan-500 bg-cyan-950/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] animate-pulse";
                        labelGlow = "text-cyan-400 font-semibold";
                      } else if (state === "communicating") {
                        borderClass =
                          "border-amber-500 bg-amber-950/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]";
                        labelGlow = "text-amber-400 font-semibold";
                      } else if (state === "success") {
                        borderClass = "border-emerald-500 bg-emerald-950/10 text-emerald-400";
                        labelGlow = "text-emerald-500";
                      }

                      return (
                        <div key={agent.id} className="flex flex-col items-center">
                          <div
                            className={`w-12 h-12 rounded-xl border flex items-center justify-center text-lg transition-all duration-300 ${borderClass}`}
                          >
                            {avatar}
                          </div>
                          <span
                            className={`text-[10px] mt-2 font-bold tracking-tight text-center max-w-[80px] truncate ${labelGlow || "text-gray-400"}`}
                          >
                            {agent.name.split(" ")[0]}
                          </span>
                          <span className="text-[8px] text-gray-600 font-mono mt-0.5 uppercase">
                            {state}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Console control cluster */}
              <div className="border-t border-white/[0.06] pt-5 mt-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {simState === "running" ? (
                    <button
                      onClick={pauseSimulation}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={startSimulation}
                      disabled={simState === "waiting_gate"}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-indigo-500 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 shadow-lg shadow-cyan-500/10"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {simState === "paused" ? "Resume" : "Run Mission"}
                    </button>
                  )}
                  <button
                    onClick={resetSimulation}
                    className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
                    title="Reset Simulator"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-mono text-gray-500">Virtual Duration</div>
                  <div className="text-xs font-bold text-gray-300 font-mono mt-0.5">
                    {stepIndex > 0 ? (stepIndex * 1.5).toFixed(1) : "0.0"}s
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Output Log (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between border border-white/[0.08] rounded-2xl bg-[#09090D] shadow-2xl relative overflow-hidden min-h-[460px]">
              {/* Terminal Title Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0c0c14] border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
                  </div>
                  <div className="w-[1px] h-3.5 bg-white/10 mx-1"></div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400">
                    <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>baseline-core@automations: ~/{activeSimKey}-session</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-gray-500">
                    <Cpu className="w-3 h-3 text-cyan-400" />
                    <span>
                      API_TOKENS: {logs.length > 0 ? (logs.length * 4200).toLocaleString() : "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terminal Logs Viewport */}
              <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] sm:text-xs leading-relaxed space-y-4 max-h-[360px] scrollbar-thin scrollbar-thumb-white/10">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 py-12">
                    <TerminalIcon className="w-10 h-10 text-gray-700 mb-3" />
                    <p className="max-w-[300px]">
                      Baseline Automations kernel idling. Click{" "}
                      <strong className="text-gray-400">Run Mission</strong> to initiate
                      orchestration log.
                    </p>
                  </div>
                ) : (
                  logs.map((log, i) => {
                    let logColor = "text-gray-300";
                    let prefixColor = "text-cyan-400";
                    let bg = "";

                    if (log.status === "system") {
                      logColor = "text-indigo-400 italic";
                      prefixColor = "text-indigo-500";
                    } else if (log.status === "success") {
                      logColor = "text-emerald-400 font-semibold";
                      prefixColor = "text-emerald-500";
                      bg = "bg-emerald-950/10 border-l border-emerald-500 pl-2 py-1 my-1";
                    } else if (log.status === "gate") {
                      logColor = "text-amber-400 font-semibold";
                      prefixColor = "text-amber-500";
                      bg =
                        "bg-amber-950/10 border-l border-amber-500 pl-2 py-1.5 my-1.5 animate-pulse";
                    }

                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2.5 transition-all duration-300 ${bg}`}
                      >
                        <span className="text-[10px] text-gray-600 select-none">
                          [{new Date().toLocaleTimeString(undefined, { hour12: false })}]
                        </span>
                        <div className="flex-1">
                          <span className={`font-bold mr-1.5 ${prefixColor}`}>
                            {log.avatar} {log.agent}:
                          </span>
                          <span className={logColor}>{log.message}</span>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Auto Scroll Marker */}
                <div ref={logEndRef} />
              </div>

              {/* Human-in-the-loop Gate Prompt Overlay */}
              {simState === "waiting_gate" && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-6 z-25 animate-fade-in">
                  <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0F0F16] p-5 shadow-2xl shadow-amber-500/5 animate-[scale-up_0.3s_ease-out]">
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-950/20 text-amber-400">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">
                          Human Gate Approval Required
                        </h4>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          Baseline Automations has paused operations to await operator signature.
                          Verify details below:
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/40 border border-white/[0.04] p-3 text-xs font-mono mb-5 space-y-1.5 text-gray-400">
                      <div>
                        <span className="text-gray-600">ACTION_TYPE:</span>{" "}
                        {activeSimKey === "dev"
                          ? "GIT_PUSH_PROD"
                          : activeSimKey === "marketing"
                            ? "SCHEDULE_CAMPAIGN"
                            : "PUBLISH_NOTIFICATIONS"}
                      </div>
                      <div>
                        <span className="text-gray-600">INITIATED_BY:</span>{" "}
                        {activeSim.agents[activeSim.agents.length - 1].name}
                      </div>
                      <div>
                        <span className="text-gray-600">SAFETY_INDEX:</span>{" "}
                        <span className="text-emerald-400 font-bold">94% (LOW RISK)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={approveGate}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4 stroke-[3px]" /> Approve and Deploy
                      </button>
                      <button
                        onClick={resetSimulation}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all active:scale-98"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Status footer bar */}
              <div className="px-4 py-2.5 bg-[#0A0A0F] border-t border-white/[0.06] flex items-center justify-between text-[10px] text-gray-500 font-mono">
                <div>WORKSPACE: READY</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>SSL_SECURE_LOCAL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 z-10 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
              Designed for High-Agency Autonomy
            </h2>
            <p className="text-gray-400">
              Unlike simple chatbot interfaces, Baseline Automations is a complete workspace system
              that powers complex workflows with structural safety.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Multi-agent routing */}
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Network className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Multi-Agent Orchestration</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Coordinate complex hierarchy structures. Route sub-tasks automatically to
                specialized developer, qa, design, or research agents in parallel.
              </p>
            </div>

            {/* Card 2: Shared context */}
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Global Semantic Memory</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Keep the fleet in sync. Agents leverage a shared database layer of project context,
                past sessions, API tokens, and markdown workspaces seamlessly.
              </p>
            </div>

            {/* Card 3: Guardrails */}
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-purple-950/30 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Human-in-the-Loop Gates</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Retain complete authority. Pre-define checkpoints for financial transactions, code
                repository push sequences, or email dispatch lists.
              </p>
            </div>

            {/* Card 4: Tool Matrix */}
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-teal-950/30 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">MCP Tool Matrix</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Integrate external APIs natively. Utilize standard Model Context Protocol connectors
                for Google Workspace, Slack, Databases, and GitHub out of the box.
              </p>
            </div>

            {/* Card 5: Local Execution */}
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-blue-950/30 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TerminalIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Local-First Sandbox</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Ensure absolute security. Run agents inside containerized sandboxes on local
                devices, avoiding external server leaks for sensitive proprietary source files.
              </p>
            </div>

            {/* Card 6: Time ROI Tracking */}
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Live ROI Observability</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Monitor business value directly. Track time-saved metrics, tool invocation counts,
                API token cost allocations, and performance ratios on a live dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Visualizer Section */}
      <section
        id="architecture"
        className="py-24 border-t border-white/[0.05] bg-gradient-to-b from-transparent to-[#07070B] relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-950/20 text-xs font-semibold text-teal-300 mb-6">
                <Layers className="w-3.5 h-3.5" />
                <span>Under the Hood</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
                Engineered for Infinite Horizon Workflows
              </h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                Baseline Automations sits between standard Large Language Models and your local
                machine environment, organizing processes into structured run-states that can handle
                loops, errors, and conditional branches.
              </p>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">State Persistence Daemon</h5>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Runs continuously to store state checkpoints. If an agent crashes or hits a
                      rate limit, the OS resumes immediately from the last token frame.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">Token Cost Controller</h5>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Dynamically routes requests between cheap LLMs for structured operations and
                      reasoning models for architectural decisions, reducing costs by 70%.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-950/30 border border-purple-500/20 flex items-center justify-center text-purple-400 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">Security Sandbox Agent</h5>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Intercepts all terminal execution commands. Checks command signatures against
                      safe-lists and quarantines destructive operations prior to execution.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Flow visualization component */}
            <div className="border border-white/[0.08] rounded-2xl bg-[#09090D] p-6 shadow-2xl relative overflow-hidden">
              <h4 className="font-bold text-sm text-white mb-6 border-b border-white/[0.06] pb-3 flex items-center justify-between">
                <span>Kernel Pipeline Visualizer</span>
                <span className="text-[10px] text-cyan-400 font-mono px-2 py-0.5 rounded bg-cyan-950/20 border border-cyan-500/20">
                  LIVE_STATE
                </span>
              </h4>

              {/* Flow Steps */}
              <div className="space-y-4 relative">
                {/* Connecting pipeline line on left */}
                <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-cyan-500 via-indigo-500 to-emerald-500 opacity-30"></div>

                {/* Step 1 */}
                <div className="flex gap-4 relative z-10 group">
                  <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-400 font-bold text-xs shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                    1
                  </div>
                  <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 group-hover:border-cyan-500/30 transition-all">
                    <span className="text-xs font-bold text-white block">
                      Task Parsing & Allocation
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      User directive is decomposed into sub-tasks. Router matches target roles to
                      registered agents.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4 relative z-10 group">
                  <div className="w-10 h-10 rounded-full bg-indigo-950 border border-indigo-400 flex items-center justify-center text-indigo-400 font-bold text-xs shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                    2
                  </div>
                  <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 group-hover:border-indigo-500/30 transition-all">
                    <span className="text-xs font-bold text-white block">
                      Execution & Tool Invocation
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Agents fetch files, execute terminal tasks, compile assets, and search vector
                      DBs securely.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4 relative z-10 group">
                  <div className="w-10 h-10 rounded-full bg-purple-950 border border-purple-400 flex items-center justify-center text-purple-400 font-bold text-xs shadow-[0_0_10px_rgba(192,132,252,0.2)]">
                    3
                  </div>
                  <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 group-hover:border-purple-500/30 transition-all">
                    <span className="text-xs font-bold text-white block">Guardrail Assessment</span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Checkpoints block dangerous or expensive tool queries. Alerts are dispatched
                      to human operator.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4 relative z-10 group">
                  <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-400 flex items-center justify-center text-emerald-400 font-bold text-xs shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                    4
                  </div>
                  <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 group-hover:border-emerald-500/30 transition-all">
                    <span className="text-xs font-bold text-white block">
                      Artifact Assembly & Sync
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Outputs are checked, compiled, committed to git, and pushed to active
                      Slack/Drive hooks.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section id="roi" className="py-24 border-t border-white/[0.05] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
              Calculate Your Operational ROI
            </h2>
            <p className="text-gray-400">
              Adjust the workspace parameters to estimate how much engineering hours and budget
              Baseline Automations can save your organization.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            {/* Input Sliders (7 Cols) */}
            <div className="lg:col-span-7 border border-white/[0.08] rounded-2xl bg-[#0B0B10] p-6 sm:p-8 flex flex-col justify-between shadow-inner">
              <div>
                <h4 className="font-bold text-base text-white mb-6 border-b border-white/[0.06] pb-3">
                  Workspace Cost Parameters
                </h4>

                {/* Slider 1: Active Agents */}
                <div className="mb-8">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    <span>Active AI Agents in Fleet</span>
                    <span className="text-cyan-400 font-mono text-sm">{numAgents} agents</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={numAgents}
                    onChange={(e) => setNumAgents(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
                    <span>1 AGENT</span>
                    <span>50 AGENTS</span>
                    <span>100 AGENTS</span>
                  </div>
                </div>

                {/* Slider 2: Hours / Day */}
                <div className="mb-8">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    <span>Daily Task Time saved per agent</span>
                    <span className="text-cyan-400 font-mono text-sm">{hoursPerDay} hours/day</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
                    <span>1 HOUR</span>
                    <span>12 HOURS</span>
                    <span>24 HOURS</span>
                  </div>
                </div>

                {/* Slider 3: Human Rate Offset */}
                <div className="mb-8">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    <span>Human Contractor Hourly Rate</span>
                    <span className="text-cyan-400 font-mono text-sm">${humanRate}/hour</span>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="200"
                    value={humanRate}
                    onChange={(e) => setHumanRate(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
                    <span>$25/HR</span>
                    <span>$112/HR</span>
                    <span>$200/HR</span>
                  </div>
                </div>
              </div>

              {/* Informative Note */}
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 text-xs text-gray-500 leading-relaxed flex gap-3 items-start">
                <HelpCircle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                <p>
                  Baseline calculations include a platform base fee ($2,400/yr) and average API
                  execution cost of $0.18 per active agent hour (using token optimization routes).
                </p>
              </div>
            </div>

            {/* Output Display (5 Cols) */}
            <div className="lg:col-span-5 border border-white/[0.08] rounded-2xl bg-gradient-to-b from-indigo-950/10 to-[#0A0A0E] p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              {/* Radial gradient background */}
              <div className="absolute bottom-[-50px] right-[-50px] w-72 h-72 rounded-full bg-cyan-500/5 pointer-events-none filter blur-3xl"></div>

              <div>
                <h4 className="font-bold text-base text-white mb-6 border-b border-white/[0.06] pb-3">
                  Annual ROI Assessment
                </h4>

                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
                      Hours Reclaimed
                    </span>
                    <span className="text-3xl font-extrabold text-white font-mono mt-1 block">
                      {hoursReclaimed.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-gray-400 font-sans">
                        hrs / year
                      </span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
                      Human Labor Cost
                    </span>
                    <span className="text-xl font-bold text-gray-400 font-mono mt-1 block">
                      ${humanCostYear.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
                      Baseline Platform Cost
                    </span>
                    <span className="text-xl font-bold text-gray-400 font-mono mt-1 block">
                      ${Math.round(baselineCostYear).toLocaleString()}
                    </span>
                  </div>

                  <div className="border-t border-white/[0.06] pt-5">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block">
                      Net Budget Savings
                    </span>
                    <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 font-mono mt-1 block drop-shadow-[0_2px_10px_rgba(6,182,212,0.15)]">
                      ${Math.round(annualSavings).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-6 mt-8 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-gray-500 font-mono uppercase">
                    Calculated ROI
                  </div>
                  <div className="font-extrabold text-emerald-400 font-mono text-sm mt-0.5">
                    +{roiMultiplier.toFixed(0)}%
                  </div>
                </div>

                <a
                  href="#waitlist"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-1.5"
                >
                  Deploy Fleet <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 border-t border-white/[0.05] bg-[#09090D] relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-400">
              Clear up queries on security, tokens, hosting configurations, and API structures.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Is Baseline Automations self-hosted or cloud-dependent?",
                a: "Baseline Automations runs locally. The orchestration daemon, local workspace storage, tools, and sandboxes are hosted entirely on your hardware. It communicates with cloud model providers (Anthropic, OpenAI, OpenRouter) exclusively for prompt processing, or links with local model nodes (ollama/llama.cpp) for offline security.",
              },
              {
                q: "How does Baseline Automations optimize LLM token usage?",
                a: "Baseline Automations relies on a custom Model Router logic. Repetitive system actions, simple crawl-jobs, and syntax checks are routed to smaller, cheaper models (like GPT-4o-mini or Llama-3-70b) using native MCP tool schemas. It calls reasoning engines (Claude Opus, Gemini Pro) only for high-horizon planning, reducing platform API overhead.",
              },
              {
                q: "What is Model Context Protocol (MCP) support?",
                a: "Model Context Protocol is a standard protocol co-designed by Anthropic. Baseline Automations has native MCP Client capabilities, allowing you to mount any community MCP server (e.g. GitHub, Slack, Postgres database connector, Puppeteer scraper, file system) directly into the agent scope by adding their endpoint URL configuration.",
              },
              {
                q: "How secure are the human guardrail controls?",
                a: "Extremely secure. You define exact conditions under which agents require manual operator approval. The OS halts the state cycle, encrypts the current memory state, and prompts the client with a visual override dialog. No execution can progress until the cryptographic signature or click event registers locally.",
              },
              {
                q: "Can I connect custom APIs as tools?",
                a: "Yes. You can write custom tool definitions in TypeScript or Python and drop them inside the `/tools` directory of Baseline Automations. The system scans the folder on startup, auto-generates JSON tool declarations for the LLM schema, and links code execution bounds automatically.",
              },
            ].map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-white/[0.06] bg-[#0B0B10] overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between text-white font-bold text-sm sm:text-base hover:bg-white/[0.01]"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-xs sm:text-sm text-gray-400 leading-relaxed border-t border-white/[0.04] pt-4 bg-[#0A0A0F]/60">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Waitlist Email Section */}
      <section
        id="waitlist"
        className="py-24 border-t border-white/[0.05] relative z-10 overflow-hidden"
      >
        {/* Glow orb */}
        <div className="absolute bottom-[-100px] left-[50%] -translate-x-[50%] w-[500px] h-[300px] rounded-full bg-cyan-500/10 filter blur-[100px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 mb-8">
            <Zap className="w-7 h-7" />
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Build Your Autonomous AI Workforce
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10 text-sm sm:text-base leading-relaxed">
            Baseline Automations is currently in private preview. Enter your developer credentials
            to claim early access to local binaries, SDK toolkits, and template files.
          </p>

          {!submitted ? (
            <form
              onSubmit={handleSubscribe}
              className="max-w-md mx-auto flex flex-col sm:flex-row gap-3"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email..."
                className="flex-1 px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:bg-white/[0.04] transition-all"
              />
              <button
                type="submit"
                className="py-4 px-6 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                Join Waitlist <Send className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="max-w-md mx-auto rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6 flex flex-col items-center animate-[scale-up_0.3s_ease-out]">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-3" />
              <h4 className="font-bold text-white text-sm">Access Request Submitted!</h4>
              <p className="text-xs text-emerald-300/80 text-center mt-1.5 leading-relaxed">
                Thank you. We have queued <strong className="text-white">{email}</strong> for slot
                allocations. Check your inbox for setup instructions shortly.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-white mt-4 underline decoration-dotted"
              >
                Enter Another Email
              </button>
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-6 text-[11px] text-gray-500 font-mono">
            <span>VERSION: 0.8.2-PREVIEW</span>
            <span>•</span>
            <span>SUPPORT: GITHUB_MCP</span>
            <span>•</span>
            <span>LICENSING: APACHE_2.0</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/[0.05] bg-[#07070A] relative z-10 text-xs text-gray-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Brain className="w-4 h-4 text-cyan-500" />
            <span className="font-mono text-gray-500">
              © 2026 Baseline Automations Technologies, Inc. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#" className="hover:text-gray-400 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-gray-400 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-gray-400 transition-colors">
              Docs API
            </a>
            <a href="#" className="hover:text-gray-400 transition-colors">
              Security Audit
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
