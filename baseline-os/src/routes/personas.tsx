/**
 * Personas — the Baseline Employee directory.
 *
 * Every non-Greek Hermes pantheon persona (Saul, Slim Charles, Don
 * Draper, Tony, Avon, Stringer, Vito, Mike, Gus, Jesse, Chris, Omar,
 * Beth, Carmela, Lester, Nacho, Paulie, Thomas Shelby, Ghost, Michael,
 * Phil Gaston, Maggie Walker, Robert Smith, Rogers & Hobson, Walter
 * Thornton). Each card shows the role, voice, summon phrases, tool
 * surface, and a one-click "Smoke test" that runs through the REAL
 * Hermes Agent (`hermes chat -q "<summon>, identify yourself…"`) via
 * /__agent_run — same path the Telegram gateway uses.
 *
 * Purpose: prove every persona is wired, identity-locked, and
 * responding in character with the real Hermes tool surface.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { GraphifyAwareness } from "@/components/graphify-awareness";
import { useCallback, useEffect, useState } from "react";
import { Bot, ExternalLink, Loader2, MessageSquare, Send, ShieldCheck, Sparkles, Wrench, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { FullChat } from "@/components/full-chat";

export const Route = createFileRoute("/personas")({
  head: () => ({
    meta: [
      { title: "Baseline Employee Personas — Baseline Automations" },
      { name: "description", content: "Every non-Greek Hermes pantheon persona, wired to the real Hermes Agent with its real tools." },
    ],
  }),
  component: PersonasPage,
});

interface Persona {
  id: string;
  name: string;
  job: string;
  description: string;
  tone: string;
  model: string;
  tools: string[];
  summonPhrases: string[];
  sysLen: number;
  avatarUrl: string;
}

const SMOKE_TEST_PROMPT =
  "Identify yourself in one sentence — name + role — then list the next concrete action you'd take for Walt today. No fluff.";

function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [q, setQ] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [chatPersona, setChatPersona] = useState<Persona | null>(null);

  const load = useCallback(() => {
    fetch("/__personas_overview")
      .then((r) => r.json())
      .then((j: { personas: Persona[] }) => setPersonas(j.personas ?? []))
      .catch(() => setPersonas([]));
  }, []);
  useEffect(() => load(), [load]);

  const filtered = (personas ?? []).filter((p) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      p.name.toLowerCase().includes(s) ||
      p.job.toLowerCase().includes(s) ||
      p.description.toLowerCase().includes(s) ||
      p.summonPhrases.some((sp) => sp.toLowerCase().includes(s))
    );
  });

  async function smokeTest(p: Persona) {
    if (running) return;
    setRunning(p.id);
    setReplies((prev) => ({ ...prev, [p.id]: "" }));
    try {
      const r = await fetch("/__agent_run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: p.id, messages: [{ role: "user", content: SMOKE_TEST_PROMPT }] }),
      });
      if (!r.body) throw new Error("no stream");
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const j = JSON.parse(line.slice(5).trim());
            if (j.delta) setReplies((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? "") + j.delta }));
            if (j.done) toast.success(`${p.name} replied`);
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setReplies((prev) => ({ ...prev, [p.id]: `[error] ${String(e)}` }));
      toast.error(`${p.name} failed`);
    }
    setRunning(null);
  }

  return (
    <div className="relative flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-5 py-3 shrink-0 border-b" style={{ borderColor: "var(--panel-border)" }}>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,210,30,0.12)", border: "1px solid rgba(255,210,30,0.4)" }}>
          <Sparkles size={16} style={{ color: "#FFD21E" }} />
        </div>
        <div className="flex flex-col leading-tight">
          <div className="text-[13px] font-semibold">Baseline Employee Personas</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/65">every persona runs on the real Hermes Agent with its real tools</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search by name / role / summon phrase…"
            className="w-72 px-3 py-1.5 rounded-lg text-[12px] bg-black/30 border border-white/10 focus:outline-none focus:border-yellow-400/40"
          />
          <Link to="/agents/hermes" className="px-3 py-1.5 rounded-lg text-[10.5px] uppercase tracking-[0.22em] font-semibold border" style={{ borderColor: "rgba(255,210,30,0.45)", color: "#FFD21E" }}>
            Hermes →
          </Link>
        </div>
      </header>

      <div className="px-5 pt-3"><GraphifyAwareness context="agent factory personas build" /></div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {personas === null ? (
          <div className="opacity-60 text-[12px]">loading personas…</div>
        ) : filtered.length === 0 ? (
          <div className="italic opacity-60 text-[12px] text-center py-12">No matches.</div>
        ) : (
          <>
            <div className="mb-3 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/65">
              <span style={{ color: "#FFD21E" }}>{filtered.length}</span> personas · all routed via <code className="text-foreground/80">hermes chat -q "&lt;summon&gt;, &lt;msg&gt;" -Q --yolo</code> · same engine that powers /agents/hermes + Saul on Telegram
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <PersonaCard
                  key={p.id}
                  persona={p}
                  reply={replies[p.id]}
                  running={running === p.id}
                  onSmokeTest={() => void smokeTest(p)}
                  onChat={() => setChatPersona(p)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Inline persona chat — voice + text in same surface as ClaudeClaw Specialist Team. */}
      {chatPersona && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "rgba(10,8,14,0.96)", backdropFilter: "blur(4px)" }}>
          <div className="flex items-center gap-3 px-4 py-2.5 shrink-0 border-b" style={{ borderColor: "var(--panel-border)", background: "rgba(255,210,30,0.06)" }}>
            <button onClick={() => setChatPersona(null)} className="text-[11px] uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--cream-mute)" }}>
              <X size={12} /> Close
            </button>
            <img src={chatPersona.avatarUrl} alt={chatPersona.name} className="h-8 w-8 rounded-lg object-cover" style={{ outline: "1px solid rgba(255,210,30,0.45)" }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold" style={{ color: "#fff" }}>{chatPersona.name}</div>
              <div className="text-[10.5px] uppercase tracking-widest" style={{ color: "#FFD21E" }}>{chatPersona.job}</div>
            </div>
            <div className="text-[10.5px] hidden md:block max-w-[40%] truncate" style={{ color: "var(--fg-dimmer)" }}>{chatPersona.tone}</div>
          </div>
          <FullChat
            agent={chatPersona.id}
            agentName={chatPersona.name}
            agentColor="#FFD21E"
            useHermesBackend
            storageKey={`claude-os.chat.persona.${chatPersona.id}.v1`}
            welcomeMessage={`I'm ${chatPersona.name}. ${chatPersona.description.slice(0, 200)}`}
            placeholder={`Talk to ${chatPersona.name}…`}
            className="flex-1 min-h-0"
          />
        </div>
      )}
    </div>
  );
}

function PersonaCard({ persona, reply, running, onSmokeTest, onChat }: {
  persona: Persona; reply?: string; running: boolean; onSmokeTest: () => void; onChat: () => void;
}) {
  const sysHealth = persona.sysLen > 2000 ? "rich" : persona.sysLen > 800 ? "ok" : "thin";
  const sysColor = sysHealth === "rich" ? "#10B981" : sysHealth === "ok" ? "#F59E0B" : "#EF4444";
  return (
    <article className="rounded-xl border overflow-hidden flex flex-col" style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-start gap-3 p-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <img src={persona.avatarUrl} alt={persona.name} className="h-12 w-12 rounded-lg object-cover shrink-0" style={{ outline: "1px solid rgba(255,210,30,0.35)" }} loading="lazy" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[13.5px] font-semibold truncate">{persona.name}</h3>
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] opacity-50">{persona.id}</span>
          </div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] mt-0.5 truncate" style={{ color: "#FFD21E" }}>{persona.job}</div>
          {persona.tone && (<div className="text-[10.5px] mt-1 italic" style={{ color: "rgba(255,255,255,0.55)" }}>{persona.tone}</div>)}
        </div>
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] px-1.5 py-0.5 rounded shrink-0" style={{ background: `${sysColor}18`, color: sysColor, border: `1px solid ${sysColor}55` }}>
          {sysHealth}
        </span>
      </div>
      <div className="p-3 space-y-2 text-[11.5px] flex-1">
        <div className="line-clamp-3 opacity-80">{persona.description}</div>
        {persona.summonPhrases.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {persona.summonPhrases.slice(0, 4).map((s) => (
              <span key={s} className="text-[9.5px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,210,30,0.08)", color: "#fde047", border: "1px solid rgba(255,210,30,0.25)" }}>
                {s}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px] font-mono opacity-65 pt-1">
          {persona.model && (<><Bot size={9} /> <span className="truncate">{persona.model}</span><span>·</span></>)}
          <Wrench size={9} />
          <span>{persona.tools.length} tool{persona.tools.length === 1 ? "" : "s"}</span>
        </div>
        {reply && (
          <div className="rounded-lg border p-2 mt-1.5" style={{ borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.05)" }}>
            <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.18em] font-mono opacity-75 mb-1">
              <Volume2 size={9} style={{ color: "#22C55E" }} />
              {persona.name} replied · real Hermes
            </div>
            <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words" style={{ color: "rgba(255,255,255,0.88)" }}>{reply}</pre>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <button
          type="button"
          onClick={onSmokeTest}
          disabled={running}
          title="Run identity smoke test through the real Hermes Agent"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.18em] font-semibold border disabled:opacity-50"
          style={{ borderColor: "rgba(34,197,94,0.45)", color: "#22C55E", background: "rgba(34,197,94,0.08)" }}
        >
          {running ? (<><Loader2 size={9} className="animate-spin" /> running</>) : (<><ShieldCheck size={10} /> Smoke test</>)}
        </button>
        <button
          type="button"
          onClick={onChat}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.18em] font-semibold border"
          style={{ borderColor: "rgba(255,210,30,0.45)", color: "#FFD21E", background: "rgba(255,210,30,0.08)" }}
        >
          <MessageSquare size={10} /> Chat
        </button>
        <a
          href={`https://t.me/prop_control_saul_bot`}
          target="_blank"
          rel="noreferrer"
          title="Saul lives on Telegram via the same gateway"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.18em] font-semibold border ml-auto"
          style={{ borderColor: "rgba(167,139,250,0.45)", color: "#A78BFA", background: "rgba(167,139,250,0.05)" }}
        >
          <Send size={10} /> Telegram <ExternalLink size={8} />
        </a>
      </div>
    </article>
  );
}
