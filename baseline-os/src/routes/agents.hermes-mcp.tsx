import { createFileRoute } from "@tanstack/react-router";
import { AgentIdentityHeader } from "@/components/graphify-awareness";
import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Github,
  ArrowRight,
  Brain,
  Layers,
  Hand,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { FullChat } from "@/components/full-chat";

export const Route = createFileRoute("/agents/hermes-mcp")({
  head: () => ({
    meta: [
      { title: "Hermes MCP — Claude × Hermes Bridge" },
      {
        name: "description",
        content:
          "The Hermes MCP Loop™ — give Claude a body. Let it run your business while you sleep.",
      },
    ],
  }),
  component: HermesMcpPage,
});

const TONE = "#06B6D4"; // cyan — the bridge

// ─────────────────────────────────────────────────────────────────
// CommandBlock — dark code block with copy button
// ─────────────────────────────────────────────────────────────────
function CommandBlock({
  children,
  label,
  multiline,
}: {
  children: string;
  label?: string;
  multiline?: boolean;
}) {
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
      style={{ background: "rgba(0,0,0,0.60)", border: `1px solid ${TONE}33` }}
    >
      {label && (
        <div
          className="px-4 py-1.5 border-b text-[10px] uppercase tracking-[0.22em]"
          style={{
            borderColor: `${TONE}22`,
            background: `${TONE}10`,
            color: TONE,
          }}
        >
          {label}
        </div>
      )}
      <pre
        className={`font-mono text-[12px] leading-relaxed px-4 py-3 pr-12 overflow-x-auto ${
          multiline ? "whitespace-pre" : "whitespace-pre-wrap"
        }`}
        style={{ color: "#67e8f9" }}
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
// StatusPill
// ─────────────────────────────────────────────────────────────────
function StatusPill({
  label,
  ok,
  okText,
  offText,
  loading,
}: {
  label: string;
  ok: boolean | null;
  okText: string;
  offText: string;
  loading?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
      style={{
        background: "rgba(0,0,0,0.45)",
        border: `1px solid ${
          loading || ok === null
            ? "rgba(255,255,255,0.10)"
            : ok
            ? "rgba(52,211,153,0.40)"
            : "rgba(255,255,255,0.12)"
        }`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 flex-shrink-0">
        {label}
      </div>
      <div className="h-3.5 w-px bg-zinc-700 flex-shrink-0" />
      {loading || ok === null ? (
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-zinc-600 animate-pulse" />
          <span className="text-[11px] text-zinc-500">Checking…</span>
        </div>
      ) : ok ? (
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full bg-emerald-400"
            style={{ boxShadow: "0 0 6px rgba(52,211,153,0.7)" }}
          />
          <span className="text-[11px] font-semibold text-emerald-400">{okText}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-zinc-600" />
          <span className="text-[11px] text-zinc-400">{offText}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// StepBadge
// ─────────────────────────────────────────────────────────────────
function StepBadge({ n }: { n: number }) {
  return (
    <div
      className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${TONE}, #0284c7)`,
        boxShadow: `0 4px 20px -4px ${TONE}88`,
        color: "#fff",
      }}
    >
      {n}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// StepCard
// ─────────────────────────────────────────────────────────────────
function StepCard({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-2xl border bg-card overflow-hidden"
      style={{ borderColor: `${TONE}28` }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${TONE}66, transparent)`,
        }}
      />
      <div className="p-5 md:p-6 flex items-start gap-4">
        <StepBadge n={n} />
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground mb-3">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ErrorCallout — warning or error note
// ─────────────────────────────────────────────────────────────────
function ErrorCallout({
  code,
  fix,
  color = "orange",
}: {
  code: string;
  fix: string;
  color?: "orange" | "red";
}) {
  const c = color === "red" ? "#f87171" : "#fb923c";
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{
        background: `${c}0f`,
        border: `1px solid ${c}33`,
      }}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: c }} />
      <div>
        <code className="text-[12px] font-mono" style={{ color: c }}>
          {code}
        </code>
        <p className="text-[12px] text-zinc-400 mt-0.5">{fix}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FormMockup — connector form fields
// ─────────────────────────────────────────────────────────────────
function FormMockup({
  fields,
}: {
  fields: { label: string; value: string }[];
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(0,0,0,0.50)",
        border: `1px solid ${TONE}28`,
      }}
    >
      <div
        className="px-4 py-2 border-b text-[10px] uppercase tracking-[0.22em]"
        style={{ borderColor: `${TONE}18`, background: `${TONE}0c`, color: TONE }}
      >
        Claude Desktop — Add Custom Connector
      </div>
      <div className="p-4 space-y-3">
        {fields.map((f) => (
          <div key={f.label}>
            <label className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 block mb-1">
              {f.label}
            </label>
            <div
              className="w-full px-3 py-2 rounded-lg text-[12px] font-mono"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${TONE}28`,
                color: "#67e8f9",
              }}
            >
              {f.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// OptionCard — permanent setup option A / B
// ─────────────────────────────────────────────────────────────────
function OptionCard({
  letter,
  title,
  sub,
  recommended,
  children,
}: {
  letter: string;
  title: string;
  sub: string;
  recommended?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-2xl border bg-card overflow-hidden flex flex-col"
      style={{ borderColor: recommended ? `${TONE}55` : "rgba(255,255,255,0.10)" }}
    >
      {recommended && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${TONE}99, transparent)`,
          }}
        />
      )}
      <div className="p-5 md:p-6 flex-1">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{
              background: recommended ? `${TONE}22` : "rgba(255,255,255,0.06)",
              border: `1px solid ${recommended ? TONE + "55" : "rgba(255,255,255,0.10)"}`,
              color: recommended ? TONE : "#a1a1aa",
            }}
          >
            {letter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
              {recommended && (
                <span
                  className="text-[9px] uppercase tracking-[0.22em] px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    background: `${TONE}22`,
                    border: `1px solid ${TONE}55`,
                    color: TONE,
                  }}
                >
                  Recommended
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PulsingDot
// ─────────────────────────────────────────────────────────────────
function PulsingDot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{
        background: TONE,
        boxShadow: `0 0 6px ${TONE}`,
        animation: `pulse 1.8s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// CollapsibleSection — wraps any content with a toggle header
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
            <div
              className="text-[10px] uppercase tracking-[0.28em] mb-1"
              style={{ color: TONE }}
            >
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
function HermesMcpPage() {
  const [mcpInstalled, setMcpInstalled] = useState<boolean | null>(null);
  const [gatewayReachable, setGatewayReachable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch("/__hermes_mcp_status");
      if (!r.ok) throw new Error("not ok");
      const d = await r.json();
      setMcpInstalled(!!d?.mcpInstalled);
      setGatewayReachable(!!d?.gatewayReachable);
    } catch {
      setMcpInstalled(false);
      setGatewayReachable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, 10_000);
    return () => clearInterval(id);
  }, [checkStatus]);

  return (
    <div className="flex flex-col h-full gap-4 max-w-[1100px]">
      <AgentIdentityHeader name="Hermes MCP" provider="Hermes · MCP loop" context="hermes mcp orchestration loop" />

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
              "radial-gradient(ellipse 65% 100% at 0% 50%, rgba(6,182,212,0.22) 0%, transparent 55%)," +
              "linear-gradient(135deg, #0a0f1e 0%, #080610 100%)",
          }}
        />
        <div className="relative flex items-center gap-5 px-6 py-4">
          <div className="flex-1 min-w-0">
            <div
              className="text-[9px] uppercase tracking-[0.32em] mb-0.5"
              style={{ color: TONE }}
            >
              The Bridge · Claude × Hermes
            </div>
            <h1
              className="text-2xl font-extrabold tracking-tight leading-none"
              style={{ color: "#e0f2fe", textShadow: `0 0 20px ${TONE}66` }}
            >
              Hermes MCP
            </h1>
            <p className="text-[12px] text-zinc-400 mt-0.5">
              Give Claude a body — the Hermes MCP Loop™
            </p>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <StatusPill
              label="MCP Bridge"
              ok={mcpInstalled}
              okText="INSTALLED"
              offText="NOT INSTALLED"
              loading={loading}
            />
            <StatusPill
              label="Hermes Gateway"
              ok={gatewayReachable}
              okText="LIVE on :8642"
              offText="OFFLINE"
              loading={loading}
            />
          </div>
        </div>
      </header>

      {/* ── 3-LAYER DIAGRAM (collapsible, closed by default) ── */}
      <div className="flex-shrink-0">
        <CollapsibleSection eyebrow="The Hermes MCP Loop™" title="How It Works" defaultOpen={false}>
          <div className="flex flex-col md:flex-row items-stretch gap-0 mb-3">

            {/* Layer 1 — Brain */}
            <div
              className="relative flex-1 rounded-2xl md:rounded-r-none p-5 overflow-hidden"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(249,115,22,0.18) 0%, transparent 70%)," +
                  "rgba(0,0,0,0.40)",
                border: "1px solid rgba(249,115,22,0.30)",
                borderRight: "none",
              }}
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.70), transparent)" }}
              />
              <div className="mb-3">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center mb-2"
                  style={{ background: "rgba(249,115,22,0.18)", border: "1px solid rgba(249,115,22,0.40)" }}
                >
                  <Brain className="h-5 w-5" style={{ color: "#F97316" }} />
                </div>
                <div className="text-[9px] uppercase tracking-[0.28em] mb-0.5" style={{ color: "#F97316" }}>Layer 1</div>
                <h3 className="text-[16px] font-bold text-white mb-0.5">The Brain</h3>
                <div className="text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ color: "rgba(249,115,22,0.70)" }}>Claude</div>
              </div>
              <p className="text-[12px] text-zinc-300 leading-relaxed">Claude is the thinking, planning, decision-making layer — the CEO in the room.</p>
            </div>

            {/* Arrow 1 */}
            <div className="hidden md:flex flex-col items-center justify-center px-1 z-10">
              <div className="flex flex-col items-center gap-1 px-2.5 py-3 rounded-xl"
                style={{ background: "rgba(0,0,0,0.70)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
                <span className="text-[9px] uppercase tracking-[0.20em] text-zinc-600 [writing-mode:vertical-rl] rotate-180">delegates</span>
              </div>
            </div>
            <div className="flex md:hidden items-center justify-center py-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(0,0,0,0.60)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-[10px] uppercase tracking-[0.20em] text-zinc-500">delegates</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
              </div>
            </div>

            {/* Layer 2 — Bridge */}
            <div
              className="relative flex-1 p-5 overflow-hidden"
              style={{
                background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${TONE}25 0%, transparent 70%),rgba(0,0,0,0.40)`,
                border: `1px solid ${TONE}55`,
                zIndex: 2,
              }}
            >
              <div aria-hidden className="absolute inset-x-0 top-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent, ${TONE}, transparent)`, boxShadow: `0 0 16px ${TONE}88` }} />
              <div className="absolute top-2.5 right-2.5">
                <span className="text-[9px] uppercase tracking-[0.22em] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: `${TONE}22`, border: `1px solid ${TONE}88`, color: TONE, boxShadow: `0 0 12px ${TONE}44` }}>
                  You are here
                </span>
              </div>
              <div className="mb-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-2"
                  style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, boxShadow: `0 0 16px ${TONE}44` }}>
                  <Layers className="h-5 w-5" style={{ color: TONE }} />
                </div>
                <div className="text-[9px] uppercase tracking-[0.28em] mb-0.5" style={{ color: TONE }}>Layer 2</div>
                <h3 className="text-[16px] font-bold mb-0.5" style={{ color: "#e0f2fe", textShadow: `0 0 20px ${TONE}66` }}>The Bridge</h3>
                <div className="text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ color: `${TONE}99` }}>Hermes MCP</div>
              </div>
              <p className="text-[12px] text-zinc-300 leading-relaxed mb-1">The invisible pipeline. Sits between Claude and the real world.</p>
              <p className="text-[12px] font-semibold" style={{ color: TONE }}>The missing piece 99% of AI users don't have.</p>
              <div className="flex items-center gap-1.5 mt-3">
                <PulsingDot delay={0} /><PulsingDot delay={0.3} /><PulsingDot delay={0.6} />
              </div>
            </div>

            {/* Arrow 2 */}
            <div className="hidden md:flex flex-col items-center justify-center px-1 z-10">
              <div className="flex flex-col items-center gap-1 px-2.5 py-3 rounded-xl"
                style={{ background: "rgba(0,0,0,0.70)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
                <span className="text-[9px] uppercase tracking-[0.20em] text-zinc-600 [writing-mode:vertical-rl] rotate-180">acts</span>
              </div>
            </div>
            <div className="flex md:hidden items-center justify-center py-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(0,0,0,0.60)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-[10px] uppercase tracking-[0.20em] text-zinc-500">acts</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
              </div>
            </div>

            {/* Layer 3 — Hands */}
            <div
              className="relative flex-1 rounded-2xl md:rounded-l-none p-5 overflow-hidden"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,210,30,0.14) 0%, transparent 70%)," +
                  "rgba(0,0,0,0.40)",
                border: "1px solid rgba(255,210,30,0.25)",
                borderLeft: "none",
              }}
            >
              <div aria-hidden className="absolute inset-x-0 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,210,30,0.55), transparent)" }} />
              <div className="mb-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-2"
                  style={{ background: "rgba(255,210,30,0.12)", border: "1px solid rgba(255,210,30,0.30)" }}>
                  <Hand className="h-5 w-5" style={{ color: "#FFD21E" }} />
                </div>
                <div className="text-[9px] uppercase tracking-[0.28em] mb-0.5" style={{ color: "#FFD21E" }}>Layer 3</div>
                <h3 className="text-[16px] font-bold text-white mb-0.5">The Hands</h3>
                <div className="text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ color: "rgba(255,210,30,0.60)" }}>Hermes Agent</div>
              </div>
              <p className="text-[12px] text-zinc-300 leading-relaxed">Runs on your computer. Browses the web, sends emails, remembers things long-term. Never sleeps.</p>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* ── SETUP GUIDE (collapsible, closed by default) ── */}
      <div className="flex-shrink-0">
        <CollapsibleSection eyebrow="Setup Guide" title="Get Running in 8 Steps" defaultOpen={false}>
          <div className="space-y-3">

            <StepCard n={1} title="Install Hermes MCP">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">One command installs the Hermes MCP bridge globally via pipx.</p>
              <CommandBlock label="bash">pipx install hermes-mcp</CommandBlock>
            </StepCard>

            <StepCard n={2} title="Create Login Credentials">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
                Generates your OAuth credentials. Prints your{" "}
                <code className="font-mono text-[12px] px-1.5 py-0.5 rounded" style={{ background: `${TONE}15`, color: TONE }}>OAUTH_CLIENT_ID</code>{" "}
                and{" "}
                <code className="font-mono text-[12px] px-1.5 py-0.5 rounded" style={{ background: `${TONE}15`, color: TONE }}>OAUTH_CLIENT_SECRET</code>.
                Save them — you'll need them in Step 4.
              </p>
              <CommandBlock label="bash">hermes-mcp mint-client</CommandBlock>
            </StepCard>

            <StepCard n={3} title="Create a Secure Tunnel">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
                Uses Cloudflare Tunnel to expose your local Hermes server to Claude Desktop.
                Gives you a URL like{" "}
                <span className="font-mono text-[12px]" style={{ color: TONE }}>https://random-words.trycloudflare.com</span>{" "}
                — this is your bridge URL.
              </p>
              <CommandBlock label="bash">cloudflared tunnel --url http://127.0.0.1:8765</CommandBlock>
            </StepCard>

            <StepCard n={4} title="Set Environment Variables">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">Export these before running the bridge. Replace placeholders with your actual values.</p>
              <CommandBlock label="bash" multiline>{`export OAUTH_CLIENT_ID=<your client ID>
export OAUTH_CLIENT_SECRET=<your client secret>
export OAUTH_ISSUER_URL=https://your-tunnel.trycloudflare.com
export MCP_ALLOWED_HOSTS=your-tunnel.trycloudflare.com
export HERMES_API_KEY=<from ~/.hermes/.env>`}</CommandBlock>
            </StepCard>

            <StepCard n={5} title="Run the Health Check">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">Verify everything is wired up correctly before starting the bridge.</p>
              <CommandBlock label="bash">hermes-mcp doctor</CommandBlock>
              <div className="mt-3 space-y-2">
                <ErrorCallout code="gateway unreachable" fix="Start Hermes first, then retry." color="orange" />
                <ErrorCallout code="rejected API key (401)" fix="Fix your HERMES_API_KEY value in ~/.hermes/.env" color="red" />
              </div>
            </StepCard>

            <StepCard n={6} title="Start the Bridge">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">Starts the MCP bridge server. Keep this terminal open while using Claude.</p>
              <CommandBlock label="bash">hermes-mcp serve</CommandBlock>
            </StepCard>

            <StepCard n={7} title="Connect Claude">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">Open Claude Desktop → Settings → Connectors → Add Custom Connector. Fill in the three fields below.</p>
              <FormMockup
                fields={[
                  { label: "Connector URL", value: "https://your-tunnel.trycloudflare.com/mcp" },
                  { label: "Client ID", value: "<your OAUTH_CLIENT_ID>" },
                  { label: "Client Secret", value: "<your OAUTH_CLIENT_SECRET>" },
                ]}
              />
            </StepCard>

            <StepCard n={8} title="Test the Loop">
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">Paste this exact prompt into Claude to confirm the full delegation loop is working end-to-end.</p>
              <CommandBlock label="Test Prompt">
                {`"Use Hermes to schedule a daily cron job that emails me a summary of my inbox at 8am."`}
              </CommandBlock>
              <p className="text-[12px] text-zinc-500 mt-3 leading-relaxed">
                If Claude executes the task (not just describes it), the loop is live.
              </p>
            </StepCard>

            {/* Permanent Setup */}
            <div className="pt-2">
              <div className="text-[10px] uppercase tracking-[0.28em] mb-3" style={{ color: TONE }}>Permanent Setup — Stay Running Across Reboots</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <OptionCard letter="A" title="Named Cloudflare Tunnel" sub="Permanent URL. Survives reboots. Never changes." recommended>
                  <CommandBlock multiline label="bash">{`cloudflared tunnel login
cloudflared tunnel create hermes
cloudflared tunnel route dns hermes hermes.your-domain.com
hermes-mcp serve`}</CommandBlock>
                </OptionCard>
                <OptionCard letter="B" title="Run as System Service" sub="Auto-starts on every boot.">
                  <CommandBlock multiline label="bash">{`mkdir -p ~/.config/hermes-mcp
systemctl --user enable --now hermes-mcp`}</CommandBlock>
                </OptionCard>
              </div>
              <div className="flex items-start gap-3 px-5 py-4 rounded-xl"
                style={{ background: "rgba(255,210,30,0.06)", border: "1px solid rgba(255,210,30,0.25)" }}>
                <span className="text-base flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-[13px] text-zinc-300 font-medium">After reboot</p>
                  <p className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed">Claude Desktop → Settings → Connectors → Disconnect → Reconnect. Takes 3 seconds.</p>
                </div>
              </div>
            </div>

            {/* Quick Install Links */}
            <div className="pt-1">
              <a
                href="https://github.com/mlennie/hermes-mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center gap-5 rounded-2xl border p-5 transition-all"
                style={{
                  background: `radial-gradient(ellipse 60% 70% at 0% 50%, ${TONE}10 0%, transparent 60%),rgba(0,0,0,0.35)`,
                  borderColor: `${TONE}33`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = `${TONE}77`;
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 0 32px ${TONE}22`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = `${TONE}33`;
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                }}
              >
                <div aria-hidden className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${TONE}55, transparent)` }} />
                <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${TONE}18`, border: `1px solid ${TONE}44`, boxShadow: `0 0 20px ${TONE}22` }}>
                  <Github className="h-6 w-6" style={{ color: TONE }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-white">hermes-mcp</div>
                  <div className="text-[12px] font-mono mt-0.5" style={{ color: `${TONE}99` }}>github.com/mlennie/hermes-mcp</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Source, releases, documentation, and issue tracker.</div>
                </div>
                <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: TONE }} />
              </a>
            </div>

          </div>
        </CollapsibleSection>
      </div>

      {/* ── FULL CHAT — primary feature, fills remaining space ── */}
      <FullChat
        agent="hermes-mcp"
        agentName="Hermes MCP Assistant"
        agentColor="#06B6D4"
        storageKey="claude-os.chat.hermes-mcp.v1"
        welcomeMessage="🌉 Hermes MCP Assistant ready. I help you set up and use the bridge between Claude and Hermes Agent — the Hermes MCP Loop. Ask me about installation, troubleshooting, or how to automate tasks through the bridge."
        placeholder="Ask about setup, configuration, or automation workflows…"
        className="flex-1 min-h-0"
      />

    </div>
  );
}
