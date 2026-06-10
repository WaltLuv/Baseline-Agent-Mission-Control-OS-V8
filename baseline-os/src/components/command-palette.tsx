import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Sparkles, Box, Cpu, ChevronRight, X } from "lucide-react";

interface Action {
  id: string;
  label: string;
  hint: string;
  agent: "claude" | "openclaw" | "hermes";
  args: string[];
}

const ACTIONS: Action[] = [
  { id: "oc-health",   label: "OpenClaw: health",      hint: "gateway + agent status",  agent: "openclaw", args: ["health"] },
  { id: "oc-doctor",   label: "OpenClaw: doctor",      hint: "diagnostics + fixes",     agent: "openclaw", args: ["doctor"] },
  { id: "oc-agents",   label: "OpenClaw: list agents", hint: "all configured agents",   agent: "openclaw", args: ["agents", "list"] },
  { id: "hm-status",   label: "Hermes: status",        hint: "env, model, keys",        agent: "hermes",   args: ["status"] },
  { id: "hm-doctor",   label: "Hermes: doctor",        hint: "config + dep check",      agent: "hermes",   args: ["doctor"] },
  { id: "hm-sessions", label: "Hermes: sessions",      hint: "list session history",    agent: "hermes",   args: ["sessions", "list"] },
  { id: "hm-skills",   label: "Hermes: skills",        hint: "installed skills",        agent: "hermes",   args: ["skills", "list"] },
  { id: "cl-version",  label: "Claude: version",       hint: "check claude --version",  agent: "claude",   args: ["--version"] },
  { id: "cl-doctor",   label: "Claude: doctor",        hint: "diagnostics",             agent: "claude",   args: ["doctor"] },
];

const ICONS = {
  claude:   <Sparkles size={13} style={{ color: "var(--claude)" }} />,
  openclaw: <Box      size={13} style={{ color: "var(--openclaw)" }} />,
  hermes:   <Cpu      size={13} style={{ color: "var(--hermes)" }} />,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ label: string; out: string } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function execute(a: Action) {
    setRunning(true);
    setResult({ label: a.label, out: "running…" });
    try {
      const r = await fetch("/__run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: a.agent, args: a.args }),
      });
      const j = await r.json() as { stdout?: string; stderr?: string; error?: string };
      setResult({ label: a.label, out: (j.stdout ?? "") + (j.stderr ? `\n[stderr] ${j.stderr}` : "") || j.error || "(no output)" });
    } catch (e) {
      setResult({ label: a.label, out: String(e) });
    }
    setRunning(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition"
        style={{
          background: "rgba(243,235,218,0.04)",
          border: "1px solid var(--panel-border)",
          color: "var(--fg-dimmer)",
        }}
        title="Open command palette (⌘K)"
      >
        <span style={{ color: "var(--gold)" }}>⌘K</span>
        <span>Commands</span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="panel panel-hot w-[min(640px,92vw)] mx-auto overflow-hidden"
        style={{ boxShadow: "0 32px 64px rgba(0,0,0,0.7)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command palette" loop>
          <div className="flex items-center border-b" style={{ borderColor: "var(--panel-border)" }}>
            <Command.Input
              placeholder="Run a command across your agents…"
              autoFocus
              style={{
                flex: 1, padding: "14px 16px",
                background: "transparent", border: "none", outline: "none",
                fontFamily: "Manrope, sans-serif", fontSize: 14,
                color: "var(--fg)", caretColor: "var(--gold)",
              }}
            />
            <button
              onClick={() => setOpen(false)}
              className="mr-3 p-1.5 rounded-md transition"
              style={{ color: "var(--fg-dimmer)" }}
            >
              <X size={14} />
            </button>
          </div>

          <div className="p-2 max-h-[50vh] overflow-y-auto scroll">
            <Command.Empty style={{ padding: "12px 16px", fontSize: 13, color: "var(--fg-dim)" }}>
              No commands found.
            </Command.Empty>
            <Command.Group heading="Agent Commands">
              {ACTIONS.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`${a.label} ${a.hint}`}
                  onSelect={() => execute(a)}
                >
                  {ICONS[a.agent]}
                  <span style={{ flex: 1, fontSize: 13, color: "var(--fg)" }}>{a.label}</span>
                  <span style={{ fontSize: 11, color: "var(--fg-dimmer)" }}>{a.hint}</span>
                  <ChevronRight size={12} style={{ opacity: 0.4 }} />
                </Command.Item>
              ))}
            </Command.Group>
          </div>

          {result && (
            <div
              className="border-t p-3"
              style={{ borderColor: "var(--panel-border)", background: "rgba(0,0,0,0.25)" }}
            >
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--fg-dimmer)", marginBottom: 4 }}>
                {running ? "running" : "result"} · {result.label}
              </div>
              <pre
                className="scroll max-h-[200px] overflow-auto whitespace-pre-wrap"
                style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--fg-dim)" }}
              >
                {result.out}
              </pre>
            </div>
          )}
        </Command>
      </div>
    </div>
  );
}
