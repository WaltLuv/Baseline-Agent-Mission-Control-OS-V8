import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  BookOpen,
  Zap,
  Star,
  ArrowRight,
  Download,
  Vault,
} from "lucide-react";
import { writeToVault } from "@/lib/obsidian-sync";

export const Route = createFileRoute("/guide")({
  component: GuidePage,
});

// ---------------------------------------------------------------------------
// Inline CopyButton — shows a ✓ for 2 s then resets
// ---------------------------------------------------------------------------
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-mono font-medium transition-all"
      style={{
        background: "rgba(217, 119, 87, 0.15)",
        border: "1px solid rgba(217, 119, 87, 0.35)",
        color: "#FFB96A",
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Command block — monospace code line + copy button
// ---------------------------------------------------------------------------
function Cmd({ children }: { children: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 my-2"
      style={{
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <code className="text-[13px] font-mono text-green-300/90 select-all flex-1">
        {children}
      </code>
      <CopyButton text={children} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------
function Step({
  n,
  emoji,
  title,
  children,
}: {
  n: number;
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-2xl p-6 transition-all hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(135deg, rgba(30,18,40,0.9) 0%, rgba(20,12,30,0.95) 100%)",
        border: "1px solid rgba(217,119,87,0.18)",
        boxShadow:
          "0 4px 24px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Step badge */}
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full text-[13px] font-bold"
          style={{
            background:
              "linear-gradient(135deg, #FFB071 0%, #D97757 60%, #C45A39 100%)",
            boxShadow: "0 4px 12px -4px rgba(217,119,87,0.6)",
            color: "#1a0a00",
          }}
        >
          {n}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-semibold mb-3 leading-snug">
            <span className="mr-2">{emoji}</span>
            {title}
          </h3>
          <div className="text-[14px] text-muted-foreground leading-relaxed space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tip card
// ---------------------------------------------------------------------------
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex items-start gap-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(217,119,87,0.12), rgba(255,195,100,0.08))",
        border: "1px solid rgba(217,119,87,0.28)",
      }}
    >
      <span className="text-lg shrink-0 mt-0.5">💡</span>
      <p className="text-[13.5px] leading-relaxed text-foreground/85">
        {children}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stack card
// ---------------------------------------------------------------------------
function StackCard({
  emoji,
  name,
  desc,
  color,
}: {
  emoji: string;
  name: string;
  desc: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 transition-all hover:-translate-y-1"
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${color}22, ${color}08 55%, transparent 80%), rgba(20,12,30,0.9)`,
        border: `1px solid ${color}33`,
        boxShadow: `0 8px 20px -8px ${color}30`,
      }}
    >
      <div className="text-2xl">{emoji}</div>
      <div className="text-[13px] font-semibold">{name}</div>
      <div className="text-[11.5px] text-muted-foreground leading-snug">
        {desc}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The full markdown guide content (used by Save to Vault)
// ---------------------------------------------------------------------------
const GUIDE_MARKDOWN = `# 🧠 Build Your Own AI Command Center

> How I built a personal mission control for Claude, OpenClaw, and Hermes — and how you can too.
> *by Walt, powered by Baseline Automations*

---

## ✅ What You'll Build

A beautiful dashboard that:
- Tracks all your AI conversations
- Shows your token spend and ROI
- Gives you a 3D memory graph
- Connects Claude Code + OpenClaw + Hermes in one place
- Has a daily "Dream" AI audit prescribing your top 4 improvements
- Voice input everywhere
- Saves your goals and journal to Obsidian

---

## 🛠️ The Stack

| Tool | Role |
|------|------|
| Claude Code | AI command-line engine |
| OpenClaw | Multi-model orchestration |
| Hermes | Persona-based agent system |
| Obsidian | Local knowledge base & journal |
| Bun | Ultra-fast JS runtime |
| React 19 | Dashboard UI |

---

## 📋 Step by Step

### Step 1 🛠️ Install the Tools

\`\`\`bash
npm i -g @anthropic/claude
brew install oven-sh/bun/bun
\`\`\`

### Step 2 📥 Get Baseline Automations

\`\`\`bash
git clone https://github.com/WaltLuv/baseline-agent-os.git ~/code/claude-os
cd ~/code/claude-os && bun install
\`\`\`

### Step 3 ⚡ First Launch

\`\`\`bash
bun run setup
bun run dev
\`\`\`

### Step 4 🔮 Walk the Setup Wizard

7 steps in your browser. Takes 3 minutes.
Set your vault path, hourly rate, and API keys.

### Step 5 🧠 Connect Your Agents

The dashboard auto-detects Claude Code, OpenClaw, and Hermes.

### Step 6 💭 Enable the Dream Review

\`\`\`bash
bun run install-dream
\`\`\`

Every morning at 7am, Claude audits your last 24 hours and writes 4 prescriptions for improvement.

### Step 7 🎤 Use Voice Everywhere

Every chat box has a microphone button. Click it, speak, your words appear as text.

### Step 8 📔 Write in Your Journal

Daily prompts. Voice input. Auto-saves to your Obsidian vault.

### Step 9 🎯 Set Your Goals

Track what matters. Checkbox lists. Voice input. Vault sync.

### Step 10 🚀 Share It

This dashboard is yours. Customize it. Make it beautiful. Share screenshots with your community.

---

## 💡 Tips from the Builder

- "The Dream feature is what makes this more than a metrics dashboard — it's a coaching system that reads your actual work."
- "Set your hourly rate — the ROI numbers become motivating when you see real dollars saved."
- "Your goals and journal live in Obsidian so you own your data, forever."

---

## ⚡ The B.L.A.S.T. Protocol

**Blueprint → Link → Architect → Stylize → Trigger**

The methodology behind every System Pilot build:

1. **Blueprint** — Define the system before touching code
2. **Link** — Wire your data sources (Claude, Obsidian, APIs)
3. **Architect** — Structure routes, components, middleware
4. **Stylize** — Apply the Midnight Aubergine design language
5. **Trigger** — Set up crons, webhooks, and automated flows

---

## 🌐 Community

Share this guide with someone who should be using Claude Code. The future of work is personal AI command centers — and yours is already running.
`;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function GuidePage() {
  const [saving, setSaving] = useState(false);

  const saveToVault = async () => {
    setSaving(true);
    const result = await writeToVault("Baseline Automations/Guide.md", GUIDE_MARKDOWN);
    setSaving(false);
    if (result.ok) {
      toast.success("Guide saved to Obsidian vault!", {
        description: "Baseline Automations/Guide.md",
      });
    } else {
      toast.error("Could not save to vault", {
        description:
          result.error === "No vault configured"
            ? "Configure your vault path in Settings first."
            : result.error,
      });
    }
  };

  return (
    <div className="min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #1a0533 0%, #120d1e 40%, #0d0a14 100%)",
        }}
      >
        {/* Ambient glow orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-30"
          style={{ background: "#D97757" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 right-0 h-80 w-80 rounded-full blur-3xl opacity-20"
          style={{ background: "#7C3AED" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-64 w-full blur-3xl opacity-15"
          style={{ background: "linear-gradient(90deg, #D97757, #7C3AED)" }}
        />

        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] mb-8"
            style={{
              background: "rgba(217,119,87,0.15)",
              border: "1px solid rgba(217,119,87,0.4)",
              color: "#FFB96A",
            }}
          >
            <Star className="h-3 w-3" />
            Community Guide
          </div>

          <h1
            className="text-5xl sm:text-6xl font-black mb-6 leading-[1.08] tracking-tight"
            style={{
              background:
                "linear-gradient(135deg, #fff9f0 0%, #FFD29A 40%, #FF8A4A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            🧠 Build Your Own
            <br />
            AI Command Center
          </h1>

          <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4">
            How I built a personal mission control for Claude, OpenClaw, and
            Hermes — and how you can too.
          </p>
          <p
            className="text-[13px] mb-10"
            style={{ color: "rgba(217,119,87,0.8)" }}
          >
            by Walt, powered by Baseline Automations
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#step-1"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold transition-all hover:-translate-y-0.5"
              style={{
                background:
                  "linear-gradient(135deg, #FFB071 0%, #D97757 60%, #C45A39 100%)",
                boxShadow: "0 8px 24px -8px rgba(217,119,87,0.7)",
                color: "#1a0800",
              }}
            >
              Start Building <ArrowRight className="h-4 w-4" />
            </a>
            <button
              onClick={saveToVault}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
              style={{
                background: "rgba(124,58,237,0.2)",
                border: "1px solid rgba(124,58,237,0.4)",
                color: "#C4B5FD",
              }}
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-purple-400/40 border-t-purple-400 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Vault className="h-4 w-4" />
                  Save to Vault
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── WHAT YOU'LL BUILD ─────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div
          className="rounded-2xl p-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(217,119,87,0.08), rgba(124,58,237,0.06))",
            border: "1px solid rgba(217,119,87,0.2)",
          }}
        >
          <h2 className="text-[22px] font-bold mb-6 flex items-center gap-3">
            <Zap
              className="h-6 w-6"
              style={{ color: "#FFB96A" }}
            />
            What You'll Build
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Tracks all your AI conversations",
              "Shows your token spend and ROI",
              "Gives you a 3D memory graph",
              "Connects Claude Code + OpenClaw + Hermes in one place",
              "Has a daily \"Dream\" AI audit with your top 4 improvements",
              "Voice input everywhere",
              "Saves your goals and journal to Obsidian",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2.5 text-[14px] text-foreground/85"
              >
                <span className="mt-0.5 shrink-0 text-[15px]">✅</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* ── THE STACK ───────────────────────────────────────────────────── */}
        <div className="mt-16">
          <h2 className="text-[22px] font-bold mb-2">The Stack</h2>
          <p className="text-muted-foreground text-[14px] mb-6">
            Six tools. One beautiful dashboard.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StackCard
              emoji="🤖"
              name="Claude Code"
              desc="AI command-line engine from Anthropic"
              color="#D97757"
            />
            <StackCard
              emoji="🦅"
              name="OpenClaw"
              desc="Multi-model orchestration & routing"
              color="#EF4444"
            />
            <StackCard
              emoji="⚡"
              name="Hermes"
              desc="Persona-based autonomous agent system"
              color="#FFD21E"
            />
            <StackCard
              emoji="🗃️"
              name="Obsidian"
              desc="Local knowledge base, vault & journal"
              color="#7C3AED"
            />
            <StackCard
              emoji="🥟"
              name="Bun"
              desc="Ultra-fast JavaScript runtime & bundler"
              color="#FBF0DF"
            />
            <StackCard
              emoji="⚛️"
              name="React 19"
              desc="Dashboard UI with TanStack Router"
              color="#61DAFB"
            />
          </div>
        </div>

        {/* ── STEPS ───────────────────────────────────────────────────────── */}
        <div className="mt-16">
          <h2 className="text-[22px] font-bold mb-2">Step by Step</h2>
          <p className="text-muted-foreground text-[14px] mb-8">
            From zero to running dashboard in under 10 minutes. ⏱️
          </p>
          <div className="space-y-4" id="step-1">
            <Step n={1} emoji="🛠️" title="Install the Tools">
              <p>You'll need four things installed before you start:</p>
              <Cmd>npm i -g @anthropic/claude</Cmd>
              <Cmd>brew install oven-sh/bun/bun</Cmd>
              <p className="text-[13px] text-muted-foreground mt-2">
                No Homebrew? Use the curl installer:{" "}
                <code className="text-green-300/80 text-[12px]">
                  curl -fsSL https://bun.sh/install | bash
                </code>
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href="https://docs.anthropic.com/claude-code"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] underline underline-offset-2"
                  style={{ color: "#FFB96A" }}
                >
                  Hermes docs →
                </a>
                <a
                  href="https://openclaw.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] underline underline-offset-2"
                  style={{ color: "#FFB96A" }}
                >
                  OpenClaw docs →
                </a>
              </div>
            </Step>

            <Step n={2} emoji="📥" title="Get Baseline Automations">
              <p>Clone the repo and install dependencies:</p>
              <Cmd>
                git clone https://github.com/WaltLuv/baseline-agent-os.git
                ~/code/claude-os
              </Cmd>
              <Cmd>cd ~/code/claude-os && bun install</Cmd>
            </Step>

            <Step n={3} emoji="⚡" title="First Launch">
              <p>Two commands and you're live:</p>
              <Cmd>bun run setup</Cmd>
              <p className="text-[12.5px] text-muted-foreground">
                ↑ Scans your machine, installs the Dream cron, populates your dashboard data.
              </p>
              <Cmd>bun run dev</Cmd>
              <p className="text-[12.5px] text-muted-foreground">
                ↑ Opens at{" "}
                <a
                  href="http://localhost:8081"
                  className="underline"
                  style={{ color: "#FFB96A" }}
                >
                  localhost:8081
                </a>
              </p>
            </Step>

            <Step n={4} emoji="🔮" title="Walk the Setup Wizard">
              <p>
                7 steps in your browser. Takes about 3 minutes.
              </p>
              <p>
                You'll set your <strong className="text-foreground">Obsidian vault path</strong>,{" "}
                <strong className="text-foreground">hourly rate</strong>, and any{" "}
                <strong className="text-foreground">API keys</strong> (Pinecone, OpenRouter).
              </p>
              <p className="mt-1">
                None of this leaves your machine. Everything is saved to{" "}
                <code className="text-[12px] text-green-300/80">~/.claude-os/config.json</code>.
              </p>
            </Step>

            <Step n={5} emoji="🧠" title="Connect Your Agents">
              <p>
                The dashboard auto-detects Claude Code, OpenClaw, and Hermes by
                scanning your{" "}
                <code className="text-[12px] text-green-300/80">~/.claude/</code> directory and
                known install paths.
              </p>
              <p>
                If an agent isn't detected, open{" "}
                <strong className="text-foreground">Settings → Agents</strong> and set the path
                manually.
              </p>
            </Step>

            <Step n={6} emoji="💭" title="Enable the Dream Review">
              <Cmd>bun run install-dream</Cmd>
              <p>
                This installs a macOS launchd job that fires every morning at{" "}
                <strong className="text-foreground">7:00 AM</strong>.
              </p>
              <p>
                Claude reads your last 24 hours of activity and writes{" "}
                <strong className="text-foreground">4 prescriptions</strong> — specific,
                actionable improvements for your workflow. Life-changing.
              </p>
            </Step>

            <Step n={7} emoji="🎤" title="Use Voice Everywhere">
              <p>
                Every chat box and input in the dashboard has a{" "}
                <strong className="text-foreground">microphone button</strong>.
              </p>
              <p>
                Click it, speak naturally, and your words appear as text — ready
                to send or edit. Uses the Web Speech API, so it's 100% local.
                No cloud transcription.
              </p>
            </Step>

            <Step n={8} emoji="📔" title="Write in Your Journal">
              <p>
                Head to{" "}
                <a href="/journal" className="underline" style={{ color: "#FFB96A" }}>
                  Journal
                </a>{" "}
                for daily prompts and a voice-enabled writing experience.
              </p>
              <p>
                Every entry auto-saves to your Obsidian vault under{" "}
                <code className="text-[12px] text-green-300/80">Journal/YYYY-MM-DD.md</code>
              </p>
            </Step>

            <Step n={9} emoji="🎯" title="Set Your Goals">
              <p>
                Head to{" "}
                <a href="/goals" className="underline" style={{ color: "#FFB96A" }}>
                  Goals
                </a>{" "}
                to track what matters. Checkbox lists, voice input, vault sync.
              </p>
              <p>
                Goals save to{" "}
                <code className="text-[12px] text-green-300/80">Baseline Automations/Goals.md</code> in
                your vault so they're always with you.
              </p>
            </Step>

            <Step n={10} emoji="🚀" title="Share It">
              <p>
                This dashboard is <strong className="text-foreground">yours</strong>. Customize
                the colors, add new routes, wire up new APIs.
              </p>
              <p>
                Take a screenshot. Share it with someone who should be using Claude Code.
                The future of work is personal AI command centers — and yours is already
                running. 🎉
              </p>
              <div className="mt-3">
                <a
                  href="https://github.com/WaltLuv/baseline-agent-os"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    background: "rgba(217,119,87,0.15)",
                    border: "1px solid rgba(217,119,87,0.3)",
                    color: "#FFB96A",
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Star on GitHub
                </a>
              </div>
            </Step>
          </div>
        </div>

        {/* ── TIPS ─────────────────────────────────────────────────────────── */}
        <div className="mt-16">
          <h2 className="text-[22px] font-bold mb-6">Tips from the Builder</h2>
          <div className="space-y-3">
            <Tip>
              "The Dream feature is what makes this more than a metrics
              dashboard. It's a daily coaching system that actually reads your
              work and knows what you need to improve. Run it for a week and
              you'll wonder how you ever worked without it."
            </Tip>
            <Tip>
              "Set your hourly rate in the setup wizard. Once you see real
              dollar amounts next to every skill run, the ROI numbers become
              deeply motivating — and it's easy to justify premium API spend."
            </Tip>
            <Tip>
              "Your goals and journal live inside your Obsidian vault, so you
              own your data forever. Baseline Automations is just the interface — your
              actual knowledge base is plain Markdown files on your hard drive."
            </Tip>
          </div>
        </div>

        {/* ── B.L.A.S.T. PROTOCOL ─────────────────────────────────────────── */}
        <div className="mt-16">
          <div
            className="rounded-2xl p-8"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(167,139,250,0.06))",
              border: "1px solid rgba(124,58,237,0.25)",
            }}
          >
            <h2
              className="text-[22px] font-bold mb-2"
              style={{ color: "#C4B5FD" }}
            >
              ⚡ The B.L.A.S.T. Protocol
            </h2>
            <p className="text-[14px] text-muted-foreground mb-8">
              The System Pilot methodology behind every great Baseline Automations build.
            </p>
            <div className="space-y-4">
              {[
                {
                  letter: "B",
                  word: "Blueprint",
                  desc: "Define the system before touching code. Map your data sources, routes, and user flows on paper first.",
                },
                {
                  letter: "L",
                  word: "Link",
                  desc: "Wire your data sources — Claude sessions, Obsidian vaults, OpenRouter balances, Pinecone indexes.",
                },
                {
                  letter: "A",
                  word: "Architect",
                  desc: "Structure your routes, components, and middleware. Vite dev server + TanStack Router makes this beautiful.",
                },
                {
                  letter: "S",
                  word: "Stylize",
                  desc: "Apply the Midnight Aubergine design language. Dark backgrounds, cream text, gold accents, satisfying micro-animations.",
                },
                {
                  letter: "T",
                  word: "Trigger",
                  desc: "Set up your crons, webhooks, and automated flows. The Dream cron is the crown jewel.",
                },
              ].map(({ letter, word, desc }) => (
                <div key={letter} className="flex items-start gap-4">
                  <div
                    className="shrink-0 h-10 w-10 rounded-lg flex items-center justify-center text-[18px] font-black"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(124,58,237,0.4), rgba(167,139,250,0.2))",
                      border: "1px solid rgba(167,139,250,0.3)",
                      color: "#C4B5FD",
                    }}
                  >
                    {letter}
                  </div>
                  <div>
                    <span className="text-[15px] font-semibold text-foreground">
                      {word}
                    </span>
                    <p className="text-[13.5px] text-muted-foreground mt-0.5 leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COMMUNITY CTA ────────────────────────────────────────────────── */}
        <div className="mt-16 mb-8">
          <div
            className="rounded-2xl p-10 text-center relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(217,119,87,0.15) 0%, rgba(124,58,237,0.12) 100%)",
              border: "1px solid rgba(217,119,87,0.25)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div
                className="h-64 w-64 rounded-full blur-3xl opacity-20"
                style={{ background: "#D97757" }}
              />
            </div>
            <div className="relative">
              <BookOpen
                className="h-10 w-10 mx-auto mb-4"
                style={{ color: "#FFB96A" }}
              />
              <h2 className="text-[26px] font-black mb-3 leading-snug">
                Share This With Someone
                <br />
                Who Should Be Using Claude Code
              </h2>
              <p className="text-[15px] text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
                The best way to learn is to teach. If this guide helped you,
                send it to one person who'd love to build their own AI command
                center.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied!", {
                      description: "Share it with your community 🚀",
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    background:
                      "linear-gradient(135deg, #FFB071 0%, #D97757 60%, #C45A39 100%)",
                    boxShadow: "0 8px 24px -8px rgba(217,119,87,0.6)",
                    color: "#1a0800",
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy Guide Link
                </button>
                <button
                  onClick={saveToVault}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{
                    background: "rgba(124,58,237,0.2)",
                    border: "1px solid rgba(124,58,237,0.4)",
                    color: "#C4B5FD",
                  }}
                >
                  <Vault className="h-4 w-4" />
                  Save to Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
