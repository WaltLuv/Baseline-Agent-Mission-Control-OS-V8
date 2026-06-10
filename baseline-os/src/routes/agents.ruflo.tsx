import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Target,
  BookOpen,
  Code2,
  Shield,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Package,
  ChevronRight,
  Database,
  Activity,
  Layers,
  Cpu,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { FullChat } from "@/components/full-chat";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";
import { AgentActivity } from "@/components/agent-activity";
import { GraphifyAwareness } from "@/components/graphify-awareness";

export const Route = createFileRoute("/agents/ruflo")({
  head: () => ({
    meta: [
      { title: "Ruflo — Baseline Automations" },
      {
        name: "description",
        content: "Ruflo: 200+ tools, multi-agent swarms, goal decomposition. Built for business.",
      },
    ],
  }),
  component: RufloPage,
});

const TONE = "#6366F1";

// ─────────────────────────────────────────────────────────────────
// CommandBlock — dark code block with copy button
// ─────────────────────────────────────────────────────────────────
function CommandBlock({ children, multiline }: { children: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — please select and copy manually.");
    }
  }, [children]);

  return (
    <div
      className="relative group rounded-xl overflow-hidden"
      style={{ background: "rgba(0,0,0,0.55)", border: `1px solid ${TONE}33` }}
    >
      <pre
        className={`font-mono text-[12px] leading-relaxed px-4 py-3 pr-12 overflow-x-auto ${multiline ? "whitespace-pre" : "whitespace-pre-wrap"}`}
        style={{ color: "#a5b4fc" }}
      >
        {children}
      </pre>
      <button
        onClick={handleCopy}
        aria-label="Copy command"
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg transition-all opacity-60 group-hover:opacity-100"
        style={{
          background: copied ? `${TONE}30` : "rgba(255,255,255,0.07)",
          border: `1px solid ${copied ? TONE : "rgba(255,255,255,0.12)"}`,
        }}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" style={{ color: TONE }} />
        ) : (
          <Copy className="h-3.5 w-3.5 text-zinc-400" />
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CopyAllBlock — multiple commands with a copy-all button
// ─────────────────────────────────────────────────────────────────
function CopyAllBlock({ commands }: { commands: string[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(commands.join("\n"));
      setCopied(true);
      toast.success("All commands copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — please select and copy manually.");
    }
  }, [commands]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "rgba(0,0,0,0.55)", border: `1px solid ${TONE}33` }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: `${TONE}22` }}
      >
        <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Commands</span>
        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-[0.15em] font-semibold transition-all"
          style={{
            background: copied ? `${TONE}25` : "rgba(255,255,255,0.06)",
            border: `1px solid ${copied ? TONE : "rgba(255,255,255,0.12)"}`,
            color: copied ? TONE : "#a1a1aa",
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy all"}
        </button>
      </div>
      <div className="p-4 space-y-1.5">
        {commands.map((cmd, i) => (
          <div
            key={i}
            className="font-mono text-[12px] leading-relaxed"
            style={{ color: "#a5b4fc" }}
          >
            <span style={{ color: `${TONE}80` }}>$ </span>
            {cmd}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pill
// ─────────────────────────────────────────────────────────────────
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] px-2.5 py-1 rounded-full border bg-black/30"
      style={{ borderColor: `${TONE}55`, color: TONE }}
    >
      {children}
    </span>
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
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="relative rounded-2xl border border-border bg-card p-4 overflow-hidden"
      style={{ backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${TONE}1f, transparent 60%)` }}
    >
      <div
        aria-hidden
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-40"
        style={{ background: TONE }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" style={{ color: TONE }} />
          {label}
        </div>
        <div
          className="mt-2 text-2xl font-semibold tabular-nums"
          style={{ color: TONE, textShadow: `0 0 18px ${TONE}55` }}
        >
          {value}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// StepNumber badge
// ─────────────────────────────────────────────────────────────────
function StepBadge({ n }: { n: number }) {
  return (
    <div
      className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${TONE}, #4338ca)`,
        boxShadow: `0 4px 20px -4px ${TONE}88`,
        color: "#fff",
      }}
    >
      {n}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// USE CASE PILL
// ─────────────────────────────────────────────────────────────────
const USE_CASES = [
  { icon: FileText, label: "Content" },
  { icon: Database, label: "Research" },
  { icon: Code2, label: "Code Review" },
  { icon: Shield, label: "Security" },
  { icon: BookOpen, label: "Docs" },
] as const;

function UseCasePills() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {USE_CASES.map(({ icon: Icon, label }) => {
        const active = selected === label;
        return (
          <button
            key={label}
            onClick={() => setSelected(active ? null : label)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
            style={{
              background: active ? `${TONE}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${active ? TONE : "rgba(255,255,255,0.10)"}`,
              color: active ? TONE : "#a1a1aa",
              boxShadow: active ? `0 0 12px ${TONE}33` : "none",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PLUGIN CARD
// ─────────────────────────────────────────────────────────────────
function PluginCard({
  name,
  description,
  command,
}: {
  name: string;
  description: string;
  command: string;
}) {
  return (
    <div
      className="relative rounded-2xl border bg-card p-5 overflow-hidden"
      style={{ borderColor: `${TONE}33` }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${TONE}88, transparent)` }}
      />
      <div className="flex items-start gap-3 mb-4">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${TONE}18`, border: `1px solid ${TONE}33` }}
        >
          <Package className="h-4 w-4" style={{ color: TONE }} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold font-mono" style={{ color: "#e0e7ff" }}>
            {name}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
      <CommandBlock>{command}</CommandBlock>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// StepCard — numbered card wrapper
// ─────────────────────────────────────────────────────────────────
function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-2xl border bg-card overflow-hidden"
      style={{ borderColor: `${TONE}28` }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${TONE}66, transparent)` }}
      />
      <div className="p-5 md:p-6 flex items-start gap-4">
        <StepBadge n={n} />
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground mb-2">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MemoryBubble — styled command with copy button
// ─────────────────────────────────────────────────────────────────
function MemoryBubble({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed.");
    }
  }, [command]);

  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-4 py-2.5"
      style={{
        background: "rgba(0,0,0,0.40)",
        border: `1px solid ${TONE}28`,
      }}
    >
      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: TONE }} />
      <code className="flex-1 font-mono text-[12px] text-indigo-300 leading-relaxed break-all">
        {command}
      </code>
      <button
        onClick={handleCopy}
        aria-label="Copy"
        className="flex-shrink-0 p-1 rounded-lg opacity-40 group-hover:opacity-100 transition-opacity"
        style={{ color: copied ? TONE : "#a1a1aa" }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LogTemplate — step 8 documentation card
// ─────────────────────────────────────────────────────────────────
function LogTemplate() {
  const FIELDS = [
    { label: "Task", placeholder: "What goal did you run?" },
    { label: "Output", placeholder: "What did the swarm produce?" },
    { label: "Refine Next Time", placeholder: "What would you change?" },
  ] as const;

  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const text = FIELDS.map((f) => `${f.label}: ${values[f.label] ?? "—"}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setSaved(true);
      toast.success("Log copied to clipboard!");
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${TONE}33` }}>
      <div
        className="px-4 py-2.5 border-b flex items-center justify-between"
        style={{ background: `${TONE}12`, borderColor: `${TONE}22` }}
      >
        <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: TONE }}>
          Run Log Template
        </span>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-[0.15em] font-semibold transition-all"
          style={{
            background: saved ? `${TONE}25` : "rgba(255,255,255,0.06)",
            border: `1px solid ${saved ? TONE : "rgba(255,255,255,0.12)"}`,
            color: saved ? TONE : "#a1a1aa",
          }}
        >
          {saved ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {saved ? "Copied!" : "Copy log"}
        </button>
      </div>
      <div className="p-4 space-y-3" style={{ background: "rgba(0,0,0,0.40)" }}>
        {FIELDS.map((f) => (
          <div key={f.label}>
            <label className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 block mb-1">
              {f.label}
            </label>
            <input
              type="text"
              value={values[f.label] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.label]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 rounded-lg text-[13px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${TONE}28`,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = `${TONE}88`)}
              onBlur={(e) => (e.currentTarget.style.borderColor = `${TONE}28`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CollapsibleSection
// ─────────────────────────────────────────────────────────────────
function CollapsibleSection({
  title,
  eyebrow,
  defaultOpen = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between group mb-0"
      >
        <div className="text-left">
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: TONE }}>
              {eyebrow}
            </div>
          )}
          <h2 className="text-xl font-bold text-foreground group-hover:text-white transition-colors">
            {title}
          </h2>
        </div>
        <div
          className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center ml-4 transition-colors"
          style={{
            background: open ? `${TONE}18` : "rgba(255,255,255,0.05)",
            border: `1px solid ${open ? TONE + "44" : "rgba(255,255,255,0.10)"}`,
          }}
        >
          {open ? (
            <ChevronUp className="h-4 w-4" style={{ color: TONE }} />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      </button>

      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
function RufloPage() {
  const [mcpActive, setMcpActive] = useState<boolean | null>(null);

  // Check if ruflo MCP is registered
  useEffect(() => {
    const controller = new AbortController();
    fetch("/__ruflo_status", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("not ok");
        return r.json();
      })
      .then((d) => setMcpActive(!!d?.active))
      .catch(() => setMcpActive(false));
    return () => controller.abort();
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 max-w-[1400px]">
      <RuntimeCredentialStatus providerIds={["ruflo"]} variant="inline" />
      <div className="px-4 py-3 space-y-3">
        <GraphifyAwareness context="PI agent memory orchestration" />
        <AgentActivity agentId="ruflo" runtime="Ruflo MCP" provider="Ruflo" />
      </div>

      <SwarmLauncher />

      {/* ── HEADER (compact) ── */}
      <header
        className="relative rounded-2xl overflow-hidden border border-border flex-shrink-0"
        style={{ minHeight: 80 }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 100% at 100% 50%, rgba(99,102,241,0.28) 0%, transparent 55%)," +
              "linear-gradient(135deg, #0f0a1e 0%, #08060f 100%)",
          }}
        />
        <svg
          aria-hidden
          className="absolute inset-0 w-full h-full opacity-[0.06]"
          preserveAspectRatio="none"
          viewBox="0 0 800 80"
        >
          <defs>
            <pattern id="ruflo-hdr-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#6366F1" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="800" height="80" fill="url(#ruflo-hdr-grid)" />
        </svg>
        <div className="relative flex items-center gap-5 px-6 py-4">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.28em] mb-0.5" style={{ color: TONE }}>
              AI Automation Platform
            </div>
            <h1
              className="text-2xl font-extrabold tracking-tight leading-none"
              style={{ color: "#e0e7ff", textShadow: `0 0 20px ${TONE}66` }}
            >
              Ruflo
            </h1>
            <p className="text-[12px] text-zinc-400 mt-0.5">
              200+ tools · Multi-agent swarms · Goal decomposition
            </p>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0 items-center">
            <div className="flex items-center gap-2">
              {mcpActive === null ? (
                <>
                  <div className="h-2.5 w-2.5 rounded-full animate-pulse bg-zinc-500" />
                  <span className="text-[11px] text-zinc-500 uppercase tracking-[0.18em]">
                    Checking…
                  </span>
                </>
              ) : mcpActive ? (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
                    MCP Active
                  </span>
                </>
              ) : (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Not Configured
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Pill>200+ Tools</Pill>
              <Pill>Multi-Agent</Pill>
            </div>
          </div>
        </div>
      </header>

      {/* ── STAT STRIP (compact) ── */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatTile icon={Layers} label="Tools" value="200+" sub="via MCP" />
        <StatTile icon={Activity} label="Steps" value="8" sub="to running" />
        <StatTile icon={Cpu} label="Protocol" value="MCP" sub="Claude-native" />
        <StatTile icon={DollarSign} label="To start" value="$0" sub="web demo free" />
      </div>

      {/* ── SETUP SOP (collapsible, closed by default) ── */}
      <div className="flex-shrink-0">
        <CollapsibleSection
          eyebrow="Setup SOP"
          title="Get Ruflo Running in 8 Steps"
          defaultOpen={false}
        >
          <div className="space-y-3">
            <StepCard n={1} title="Try Before You Install">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
                Go to flo.ruv.io now, pick a model, and type a task. No account, no commitment — see
                what Ruflo does before touching your machine.
              </p>
              <a
                href="https://flo.ruv.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
                style={{
                  background: `linear-gradient(135deg, ${TONE}, #4338ca)`,
                  color: "#fff",
                  boxShadow: `0 4px 20px -6px ${TONE}99`,
                }}
              >
                <Globe className="h-4 w-4" />
                Open flo.ruv.io
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </StepCard>

            <StepCard n={2} title="Install Ruflo">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
                Run this in any terminal. It scaffolds the ruflo config and installs the CLI
                globally via npx — no global install needed.
              </p>
              <CommandBlock>npx ruflo@latest init</CommandBlock>
            </StepCard>

            <StepCard n={3} title="Add to Claude Code as MCP">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
                Register Ruflo as an MCP server in Claude Code. This lets every Claude Code session
                call 200+ Ruflo tools natively.
              </p>
              <CommandBlock>claude mcp add ruflo -- npx ruflo@latest mcp start</CommandBlock>
            </StepCard>

            <StepCard n={4} title="Choose Your First Use Case">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-1">
                Pick the workflow you want to automate first. Each use case unlocks a recommended
                plugin set and memory template.
              </p>
              <UseCasePills />
            </StepCard>

            <StepCard n={5} title="Set Up Business Memory">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
                Tell Ruflo who you are and what you're building. These three memory commands seed
                context that persists across all agent runs.
              </p>
              <div className="space-y-2">
                {[
                  `/memory set company "Acme Corp — B2B SaaS, 12-person team"`,
                  `/memory set tone "concise, technical, no fluff"`,
                  `/memory set stack "Next.js, Supabase, Vercel, GitHub"`,
                ].map((cmd, i) => (
                  <MemoryBubble key={i} command={cmd} />
                ))}
              </div>
            </StepCard>

            <StepCard n={6} title="Install Core Plugins">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
                Three plugins unlock the full Ruflo stack: core tools, multi-agent coordination, and
                background automation. Install all three.
              </p>
              <CopyAllBlock
                commands={[
                  "/plugin install ruflo-core@ruflo",
                  "/plugin install ruflo-swarm@ruflo",
                  "/plugin install ruflo-autopilot@ruflo",
                ]}
              />
            </StepCard>

            <StepCard n={7} title="Run Your First Swarm Task">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
                Head to goal.ruv.io and paste in a real business goal. Ruflo decomposes it, assigns
                sub-agents, and runs them in parallel. Example goal below.
              </p>
              <div
                className="rounded-xl p-4 mb-4"
                style={{ background: "rgba(0,0,0,0.45)", border: `1px solid ${TONE}33` }}
              >
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-2">
                  Example goal
                </div>
                <p className="text-[13px] leading-relaxed italic" style={{ color: "#c7d2fe" }}>
                  "Write a competitive analysis of our top 3 competitors, pull their latest pricing
                  pages, summarize key differentiators, and output a one-page brief in Notion."
                </p>
              </div>
              <a
                href="https://goal.ruv.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
                style={{
                  background: `linear-gradient(135deg, ${TONE}, #4338ca)`,
                  color: "#fff",
                  boxShadow: `0 4px 20px -6px ${TONE}99`,
                }}
              >
                <Target className="h-4 w-4" />
                Open goal.ruv.io
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </StepCard>

            <StepCard n={8} title="Document What Works">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
                After each successful swarm run, log what worked. Over time this becomes your team's
                AI playbook. Use this template.
              </p>
              <LogTemplate />
            </StepCard>

            {/* Plugin Manager */}
            <div className="pt-2">
              <div className="text-[10px] uppercase tracking-[0.28em] mb-3" style={{ color: TONE }}>
                Core Plugins
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PluginCard
                  name="ruflo-core"
                  description="The foundation — 200+ tools, auth, context management."
                  command="/plugin install ruflo-core@ruflo"
                />
                <PluginCard
                  name="ruflo-swarm"
                  description="Multi-agent coordination — spawn, delegate, merge."
                  command="/plugin install ruflo-swarm@ruflo"
                />
                <PluginCard
                  name="ruflo-autopilot"
                  description="Background automation — scheduled goals, cron tasks."
                  command="/plugin install ruflo-autopilot@ruflo"
                />
              </div>
            </div>

            {/* Quick Links */}
            <div
              className="rounded-2xl border p-5 flex flex-col sm:flex-row items-center gap-4"
              style={{
                background: `linear-gradient(135deg, ${TONE}10, transparent)`,
                borderColor: `${TONE}33`,
              }}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] uppercase tracking-[0.22em] mb-1"
                  style={{ color: TONE }}
                >
                  Quick Links
                </div>
                <p className="text-sm text-zinc-400">
                  Jump straight to the Ruflo web tools — no install required.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <a
                  href="https://flo.ruv.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap"
                  style={{
                    background: `linear-gradient(135deg, ${TONE}, #4338ca)`,
                    color: "#fff",
                    boxShadow: `0 6px 24px -6px ${TONE}aa`,
                  }}
                >
                  <Globe className="h-4 w-4" />
                  flo.ruv.io
                </a>
                <a
                  href="https://goal.ruv.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${TONE}44`,
                    color: "#a5b4fc",
                  }}
                >
                  <Target className="h-4 w-4" />
                  goal.ruv.io
                </a>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* ── FULL CHAT — primary feature, fills remaining space ── */}
      <FullChat
        agent="ruflo"
        agentName="Ruflo"
        agentColor="#6366F1"
        storageKey="claude-os.chat.ruflo.v1"
        welcomeMessage="🔮 Ruflo online. I'm your multi-model agent orchestration system with 200+ tools. Give me a task — content creation, research, code review, security scanning, documentation — and I'll spawn the right agents and get it done. What's the goal?"
        placeholder="Give Ruflo a task… content, research, code, automation"
        className="flex-1 min-h-0"
      />
    </div>
  );
}

// ─── SwarmLauncher — Campaign #91 ────────────────────────────────────────
// One-prompt cross-engine swarm dispatcher. Picks the mission + the
// agent mix, hits /__swarm_dispatch which creates a parent kanban task,
// decomposes it via Hermes, then round-robin assigns each child to one
// of the picked agents. The kanban external dispatcher (already shipping
// in vite.config.ts) then picks up each ready non-Hermes child and runs
// it through /__agent_run. Hermes-pantheon children get run by Hermes'
// own dispatcher.
const DEFAULT_AGENT_MIX = ["claudeclaw", "gemini", "codex", "ruflo"];
const ALL_AGENTS = [
  { id: "ruflo", label: "Ruflo", tone: "#6366F1" },
  { id: "claudeclaw", label: "ClaudeClaw", tone: "#D97757" },
  { id: "gemini", label: "Gemini", tone: "#4F8EF7" },
  { id: "codex", label: "Codex", tone: "#22C55E" },
  { id: "openclaw", label: "OpenClaw", tone: "#EF4444" },
  { id: "antigravity", label: "Antigravity", tone: "#3B82F6" },
  { id: "free-claude", label: "Coding Agent", tone: "#10B981" },
  { id: "notebooklm", label: "NotebookLM", tone: "#A78BFA" },
  { id: "hermes-mcp", label: "Hermes MCP", tone: "#06B6D4" },
];

function SwarmLauncher() {
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState("");
  const [picked, setPicked] = useState<string[]>(DEFAULT_AGENT_MIX);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    parentId: string;
    children: { id: string; title?: string }[];
    assigned: { id: string; assignee: string }[];
    note: string;
  }>(null);

  function toggle(id: string): void {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function dispatch(): Promise<void> {
    if (!objective.trim() || picked.length === 0 || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const r = await fetch("/__swarm_dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: objective.trim(), agents: picked }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(`Swarm failed: ${j.error ?? r.statusText}`);
      } else {
        toast.success(`Swarm dispatched · parent ${j.parentId} + ${j.assigned.length} assigned`);
        setResult(j);
      }
    } catch (e) {
      toast.error(String(e));
    }
    setSubmitting(false);
  }

  return (
    <section
      className="relative rounded-2xl border overflow-hidden"
      style={{
        background:
          "linear-gradient(120deg, rgba(99,102,241,0.18) 0%, rgba(217,119,87,0.10) 50%, rgba(7,29,28,0.6) 100%)",
        borderColor: "rgba(99,102,241,0.45)",
        boxShadow: "0 0 28px -8px rgba(99,102,241,0.4)",
      }}
    >
      <div className="px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "#A78BFA" }} />
          <div
            className="text-[11.5px] uppercase tracking-[0.24em] font-semibold"
            style={{ color: "#A78BFA" }}
          >
            Cross-engine swarm launcher
          </div>
          <span className="text-[10.5px] text-muted-foreground/70 ml-2">
            One mission → Hermes decomposes → kanban round-robins across your agent mix.
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="ml-auto px-3 py-1.5 rounded-lg text-[10.5px] uppercase tracking-[0.2em] font-semibold border"
            style={{
              background: open ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.12)",
              borderColor: "rgba(99,102,241,0.5)",
              color: "#A78BFA",
            }}
          >
            {open ? "− collapse" : "+ open"}
          </button>
        </div>

        {open && (
          <div className="space-y-3">
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              placeholder="Mission (plain English) — e.g. 'Audit the AI Workforce OS demo across property mgmt, contractors, home services, sales, marketing, and local businesses. Identify production blockers and propose fixes.'"
              className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-black/40 border border-white/10 focus:outline-none focus:border-indigo-400/50 resize-y font-sans"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mr-1">
                agent mix:
              </span>
              {ALL_AGENTS.map((a) => {
                const on = picked.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className="px-2.5 py-1 rounded-full text-[10.5px] uppercase tracking-[0.18em] font-mono border transition"
                    style={{
                      background: on ? `${a.tone}25` : "transparent",
                      borderColor: on ? a.tone : "rgba(255,255,255,0.18)",
                      color: on ? a.tone : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {a.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => void dispatch()}
                disabled={!objective.trim() || picked.length === 0 || submitting}
                className="ml-auto px-4 py-2 rounded-lg text-[12px] font-bold disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #A78BFA, #6366F1)",
                  color: "#fff",
                  boxShadow: "0 6px 18px -6px rgba(99,102,241,0.6)",
                }}
              >
                {submitting ? "dispatching…" : "▶ Launch swarm"}
              </button>
            </div>
            {result && (
              <div
                className="rounded-lg border p-3 text-[11.5px]"
                style={{ borderColor: "rgba(99,102,241,0.35)", background: "rgba(0,0,0,0.35)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#10B981" }} />
                  <span className="font-mono text-[10.5px]" style={{ color: "#A78BFA" }}>
                    parent {result.parentId}
                  </span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground/80">{result.note}</span>
                  <Link
                    to="/kanban"
                    className="ml-auto text-[10.5px] uppercase tracking-[0.2em] underline decoration-dotted text-indigo-300 hover:text-indigo-200"
                  >
                    view on kanban →
                  </Link>
                </div>
                <ul className="space-y-0.5">
                  {result.assigned.map((c) => (
                    <li key={c.id} className="font-mono text-[10.5px] flex gap-2">
                      <span className="opacity-60">{c.id}</span>
                      <span>→</span>
                      <span
                        style={{
                          color: ALL_AGENTS.find((a) => a.id === c.assignee)?.tone ?? "#fde047",
                        }}
                      >
                        {c.assignee}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
