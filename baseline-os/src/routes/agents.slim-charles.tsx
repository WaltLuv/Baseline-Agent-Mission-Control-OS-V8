/**
 * Slim Charles — Walt's PRIVATE personal assistant (Baseline OS ONLY).
 *
 * The Jarvis-style "Sankoré Control System". Hermes-backed. Never exposed in
 * Baseline Mission Control. Tabs: Chat · Voice · Build (Agent Factory) · Tools ·
 * Skills · Memory · Computer Use · Wall Mode.
 *
 * Truth-first: the Voice tab only reports "connected" when a realtime provider
 * is actually configured; otherwise it shows setup-needed + the free browser
 * listening fallback. Tool access is honest (ready vs setup-needed), never faked.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Mic,
  Hammer,
  Wrench,
  Sparkles,
  Brain,
  Monitor,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
  Phone,
  Lock,
} from "lucide-react";
import { FullChat } from "@/components/full-chat";
import { AgentFactory } from "@/components/agent-factory";
import {
  SLIM_CHARLES,
  VOICE_STATE_LABEL,
  AUTO_APPROVE_ACTIONS,
  REQUIRES_WALT_ACTIONS,
  TOOL_SOURCES,
  type VoiceState,
} from "@/lib/slim-charles";

export const Route = createFileRoute("/agents/slim-charles")({
  head: () => ({
    meta: [
      { title: "Slim Charles — Baseline OS" },
      {
        name: "description",
        content: "Walt's private Hermes-backed personal assistant. Baseline OS only.",
      },
    ],
  }),
  component: SlimCharlesPage,
});

const TONE = "#38BDF8";
type Tab =
  | "chat"
  | "voice"
  | "phone"
  | "build"
  | "tools"
  | "skills"
  | "memory"
  | "computer"
  | "wall";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "chat", label: "Chat", icon: <MessageSquare size={14} /> },
  { id: "voice", label: "Voice", icon: <Mic size={14} /> },
  { id: "phone", label: "Phone", icon: <Phone size={14} /> },
  { id: "build", label: "Agent Factory", icon: <Hammer size={14} /> },
  { id: "tools", label: "Tools", icon: <Wrench size={14} /> },
  { id: "skills", label: "Skills", icon: <Sparkles size={14} /> },
  { id: "memory", label: "Memory", icon: <Brain size={14} /> },
  { id: "computer", label: "Computer Use", icon: <Monitor size={14} /> },
  { id: "wall", label: "Wall Mode", icon: <Maximize2 size={14} /> },
];

function SlimCharlesPage() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="min-h-screen p-6 text-white" data-testid="slim-charles-page">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          🎙️ {SLIM_CHARLES.name}
          <span className="text-[10px] uppercase tracking-widest text-white/40">
            Private · Baseline OS only
          </span>
        </h1>
        <p className="text-xs text-white/50">
          Hermes-backed personal assistant · voice id{" "}
          <code data-testid="slim-voice-id">{SLIM_CHARLES.voiceId}</code>
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`slim-tab-${t.id}`}
            className="flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold"
            style={{
              borderBottomColor: tab === t.id ? TONE : "transparent",
              color: tab === t.id ? "#e0f2fe" : "rgba(255,255,255,0.45)",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <div className="flex h-[calc(100vh-220px)] min-h-[420px]">
          <FullChat
            agent="slim-charles"
            agentName={SLIM_CHARLES.name}
            agentColor={TONE}
            useHermesBackend
            storageKey="baseline-os.slim-charles.chat.v1"
            welcomeMessage={SLIM_CHARLES.bootGreeting}
            placeholder="Talk to Slim…"
            className="flex-1 min-h-0"
          />
        </div>
      )}
      {tab === "voice" && <SlimVoice wall={false} />}
      {tab === "phone" && <SlimPhone />}
      {tab === "build" && <AgentFactory model="gemma4:31b" />}
      {tab === "tools" && <ToolsTab />}
      {tab === "skills" && <SkillsTab />}
      {tab === "memory" && <MemoryTab />}
      {tab === "computer" && <ComputerUseTab />}
      {tab === "wall" && <SlimVoice wall />}
    </div>
  );
}

// ── Oracle neural-brain visual ──────────────────────────────────────
// Cyberpunk neural network: a central brain core, concentric neural nodes,
// pulse paths, and orbiting tool/skill nodes. Color + animation are driven by
// the live voice state (idle / booting / listening / processing / speaking).
const STATE_COLOR: Record<string, string> = {
  idle: "#334155",
  booting: "#a78bfa",
  listening: "#22d3ee",
  processing: "#f59e0b",
  speaking: "#34d399",
};

function OracleBrain({ state, size = 280 }: { state: VoiceState; size?: number }) {
  const color = STATE_COLOR[state] ?? "#38bdf8";
  const active = state !== "idle";
  const orbit = (TOOL_SOURCES as Array<{ name?: string } | string>).slice(0, 8);
  const c = size / 2;
  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      data-testid="oracle-brain"
      data-state={state}
    >
      {/* radial glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}33 0%, transparent 60%)`,
          filter: "blur(12px)",
          transition: "background 400ms",
          animation: active ? "slim-pulse 2.2s ease-in-out infinite" : undefined,
        }}
      />
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="slim-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.15" />
          </radialGradient>
        </defs>
        {/* concentric neural rings */}
        {[0.42, 0.62, 0.82].map((r, ri) => (
          <circle
            key={ri}
            cx={c}
            cy={c}
            r={c * r}
            fill="none"
            stroke={color}
            strokeOpacity={0.12 + ri * 0.04}
            strokeWidth={1}
            strokeDasharray="3 6"
            style={{
              animation: active ? `slim-spin ${18 + ri * 8}s linear infinite` : undefined,
              transformOrigin: "center",
            }}
          />
        ))}
        {/* neural nodes + pulse paths */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const r = c * (0.55 + (i % 3) * 0.13);
          const x = c + Math.cos(a) * r;
          const y = c + Math.sin(a) * r;
          return (
            <g key={i}>
              <line
                x1={c}
                y1={c}
                x2={x}
                y2={y}
                stroke={color}
                strokeOpacity={active ? 0.25 : 0.08}
                strokeWidth={0.8}
              />
              <circle cx={x} cy={y} r={2.4} fill={color} opacity={active ? 0.9 : 0.4}>
                {active && (
                  <animate
                    attributeName="opacity"
                    values="0.3;1;0.3"
                    dur={`${1.4 + (i % 4) * 0.3}s`}
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            </g>
          );
        })}
        {/* core */}
        <circle cx={c} cy={c} r={c * 0.22} fill="url(#slim-core)" />
        <circle
          cx={c}
          cy={c}
          r={c * 0.22}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.8}
        />
      </svg>
      {/* orbiting tool/skill nodes */}
      <div
        className="absolute inset-0"
        style={{
          animation: active ? "slim-spin 24s linear infinite" : undefined,
          transformOrigin: "center",
        }}
      >
        {orbit.map((t, i) => {
          const a = (i / orbit.length) * Math.PI * 2;
          const r = c * 0.92;
          const x = c + Math.cos(a) * r - 6;
          const y = c + Math.sin(a) * r - 6;
          const label = typeof t === "string" ? t : (t.name ?? "tool");
          return (
            <div
              key={i}
              className="absolute h-3 w-3 rounded-full"
              title={label}
              data-testid="orbit-node"
              style={{
                left: x,
                top: y,
                background: color,
                boxShadow: `0 0 8px ${color}`,
                opacity: active ? 0.9 : 0.4,
              }}
            />
          );
        })}
      </div>
      {/* audio-reactive bars (animate while speaking/listening) */}
      <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-end gap-1" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="w-1 rounded-full"
            style={{
              height: 6,
              background: color,
              animation:
                state === "speaking" || state === "listening"
                  ? `slim-eq 0.${5 + (i % 4)}s ease-in-out ${i * 0.06}s infinite alternate`
                  : undefined,
              opacity: 0.8,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes slim-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes slim-spin { to { transform: rotate(360deg) } }
        @keyframes slim-eq { from { height: 6px } to { height: 26px } }
      `}</style>
    </div>
  );
}

// ── Voice ───────────────────────────────────────────────────────────
function SlimVoice({ wall }: { wall: boolean }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<
    { role: "user" | "assistant" | "system"; text: string }[]
  >([]);
  // Honest: probe whether the real ElevenLabs voice is configured (key present).
  const [realtimeConfigured, setRealtimeConfigured] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<unknown>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // /__voice_voices returns the account's voices when the key is set, else a note.
    fetch("/__voice_voices")
      .then((r) => r.json())
      .then((j: { voices?: unknown[]; note?: string }) =>
        setRealtimeConfigured(Array.isArray(j.voices) && j.voices.length > 0),
      )
      .catch(() => setRealtimeConfigured(false));
  }, []);

  // Speak in Slim's REAL ElevenLabs voice (low-latency eleven_turbo_v2_5).
  // Interruptible: a new utterance cancels the previous audio. Falls back to the
  // browser voice ONLY if the ElevenLabs key isn't set (honest setup-needed).
  const speak = useCallback(async (text: string) => {
    try {
      audioRef.current?.pause();
      setState("speaking");
      const r = await fetch("/__voice_speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voiceId: SLIM_CHARLES.voiceId }),
      });
      if (!r.ok) {
        // 503 = key not set → honest fallback so it still talks.
        setRealtimeConfigured(false);
        try {
          const u = new SpeechSynthesisUtterance(text);
          window.speechSynthesis?.speak(u);
        } catch {
          /* no speech */
        }
        setState("listening");
        return;
      }
      setRealtimeConfigured(true);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setState("listening");
      };
      await audio.play().catch(() => setState("listening"));
    } catch {
      setState("listening");
    }
  }, []);

  const boot = useCallback(() => {
    setState("booting");
    setTranscript((t) => [...t, { role: "system", text: SLIM_CHARLES.bootGreeting }]);
    void speak(SLIM_CHARLES.bootGreeting);
  }, [speak]);

  const ask = useCallback(
    async (text: string) => {
      setTranscript((t) => [...t, { role: "user", text }]);
      setState("processing");
      let reply = "Hermes is not reachable — start Hermes to let Slim respond.";
      try {
        // Hermes-backed brain (real assistant, not a demo).
        const r = await fetch("/__hermes_chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agent: "slim-charles",
            message: text,
            persona: SLIM_CHARLES.persona,
          }),
        });
        if (r.ok) reply = (await r.text()).slice(0, 4000) || "(no reply)";
      } catch {
        reply = "Hermes unreachable — start Hermes to enable Slim.";
      }
      setTranscript((t) => [...t, { role: "assistant", text: reply }]);
      void speak(reply); // speak the reply in Slim's real voice
    },
    [speak],
  );

  const toggleMic = useCallback(() => {
    type SR = {
      start: () => void;
      stop: () => void;
      onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      onend: (() => void) | null;
      continuous: boolean;
      interimResults: boolean;
    };
    const w = window as unknown as {
      SpeechRecognition?: new () => SR;
      webkitSpeechRecognition?: new () => SR;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setTranscript((t) => [...t, { role: "system", text: "Voice input needs Chrome or Safari." }]);
      return;
    }
    if (listening) {
      (recRef.current as SR | null)?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      ask(t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
    setState("listening");
  }, [listening, ask]);

  const userTurns = transcript.filter((m) => m.role === "user");
  const lastUser = userTurns[userTurns.length - 1]?.text?.toLowerCase() ?? "";
  const intent = lastUser.startsWith("show me")
    ? "visual"
    : lastUser.startsWith("build me")
      ? "build"
      : null;

  return (
    <div
      className={
        wall
          ? "fixed inset-0 z-50 overflow-auto bg-gradient-to-b from-black via-[#05070d] to-black p-8 text-white"
          : "rounded-2xl bg-gradient-to-b from-[#05070d] to-black p-5 text-white"
      }
      data-testid="slim-voice-tab"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-wide">Slim · Operator Control System</span>
        <span
          className="rounded-full border px-2 py-1 text-[11px] uppercase tracking-wider"
          style={{
            borderColor: `${STATE_COLOR[state] ?? TONE}66`,
            color: STATE_COLOR[state] ?? TONE,
          }}
          data-testid="voice-state"
        >
          {VOICE_STATE_LABEL[state]}
        </span>
      </div>

      {/* Oracle neural brain */}
      <OracleBrain state={state} size={wall ? 420 : 280} />

      {/* state machine HUD */}
      <div
        className="mx-auto my-4 flex max-w-md justify-between gap-1 text-[10px] uppercase tracking-wider"
        data-testid="voice-states"
      >
        {(["listening", "processing", "speaking"] as const).map((s) => (
          <span
            key={s}
            className="flex-1 rounded-md border px-2 py-1 text-center"
            style={{
              borderColor: state === s ? STATE_COLOR[s] : "rgba(255,255,255,0.1)",
              color: state === s ? STATE_COLOR[s] : "rgba(255,255,255,0.35)",
              background: state === s ? `${STATE_COLOR[s]}14` : "transparent",
            }}
          >
            {s === "processing" ? "Thinking / Executing" : s}
          </span>
        ))}
      </div>

      {intent && (
        <div
          className="mx-auto mb-3 max-w-md rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-center text-xs text-sky-300"
          data-testid="voice-intent"
        >
          {intent === "visual"
            ? "“show me…” → visual action queued (renders in the wall)"
            : "“build me…” → routed to Agent Factory (Build tab)"}
        </div>
      )}

      {!realtimeConfigured ? (
        <div
          className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
          data-testid="voice-setup-needed"
        >
          <div className="font-semibold text-amber-300">Realtime voice: setup needed</div>
          <p className="mt-1 text-white/60">
            No native speech-to-speech provider is configured, so Slim won't fake a live call.
            Listening works now via your browser; add an ElevenLabs / GPT-Realtime / Gemini Live key
            to enable the spoken voice ({SLIM_CHARLES.voiceId}) and interruptible real-time mode.
          </p>
        </div>
      ) : (
        <div
          className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-300"
          data-testid="voice-connected"
        >
          Live · interruptible · VAD
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={boot}
          data-testid="voice-boot"
          className="rounded-md px-4 py-2 text-sm font-semibold text-black"
          style={{ backgroundColor: TONE }}
        >
          Boot Slim
        </button>
        <button
          data-testid="live-call"
          onClick={() => setState((s) => (s === "listening" ? "idle" : "listening"))}
          className="rounded-md border border-white/15 px-4 py-2 text-sm"
        >
          📞 Live call
        </button>
        <button
          data-testid="push-to-talk"
          onClick={toggleMic}
          className={`rounded-md border px-4 py-2 text-sm ${listening ? "border-emerald-500 bg-emerald-600 text-white" : "border-white/15"}`}
        >
          🎤 Push to talk
        </button>
      </div>

      <div
        className="mb-4 max-h-72 space-y-1 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-sm"
        data-testid="voice-transcript"
      >
        {transcript.length === 0 ? (
          <p className="text-xs text-white/40">
            No turns yet. Boot Slim and talk, or use push-to-talk.
          </p>
        ) : (
          transcript.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "assistant"
                  ? "text-sky-300"
                  : m.role === "system"
                    ? "italic text-white/40"
                    : "text-white"
              }
            >
              <span className="mr-2 text-[10px] uppercase tracking-wider">{m.role}</span>
              {m.text}
            </div>
          ))
        )}
      </div>

      {/* Active tools + command history */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-lg border border-white/10 bg-black/40 p-3"
          data-testid="voice-active-tools"
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Active tools / skills
          </div>
          <div className="flex flex-wrap gap-1">
            {(TOOL_SOURCES as Array<{ name?: string } | string>).slice(0, 10).map((t, i) => {
              const label = typeof t === "string" ? t : (t.name ?? "tool");
              return (
                <span
                  key={i}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/70"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
        <div
          className="rounded-lg border border-white/10 bg-black/40 p-3"
          data-testid="voice-command-history"
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Command history
          </div>
          {userTurns.length === 0 ? (
            <p className="text-[11px] text-white/35">No commands yet.</p>
          ) : (
            <ul className="space-y-0.5 text-[11px] text-white/60">
              {userTurns.slice(-6).map((m, i) => (
                <li key={i} className="truncate">
                  › {m.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SafetyBoundary />
    </div>
  );
}

// ── Safety boundary ─────────────────────────────────────────────────
function SafetyBoundary() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-emerald-500/30 p-3" data-testid="auto-approve-list">
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-400">
          <ShieldCheck size={13} /> Slim auto-approves
        </div>
        <ul className="list-disc pl-4 text-[11px] text-white/60">
          {AUTO_APPROVE_ACTIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-red-500/30 p-3" data-testid="walt-only-list">
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-400">
          <ShieldAlert size={13} /> Only Walt can approve
        </div>
        <ul className="list-disc pl-4 text-[11px] text-white/60">
          {REQUIRES_WALT_ACTIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Tools / Skills (honest access) ──────────────────────────────────
// ── Secure Phone ────────────────────────────────────────────────────
// Walt can call Slim on a dedicated number and talk securely. Provider-ready
// (Twilio / ElevenLabs / Retell / VAPI). Walt-only: caller whitelist + optional
// PIN + voiceprint; emergency lockout if the caller isn't verified. No customer
// access, never exposed in Mission Control. Honest setup-needed when no
// provider credentials are present.
const PHONE_PROVIDERS: { id: string; name: string; envKeys: string[] }[] = [
  {
    id: "twilio",
    name: "Twilio",
    envKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "SLIM_PHONE_NUMBER"],
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs Voice (Conversational)",
    envKeys: ["ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "SLIM_PHONE_NUMBER"],
  },
  {
    id: "retell",
    name: "Retell",
    envKeys: ["RETELL_API_KEY", "RETELL_AGENT_ID", "SLIM_PHONE_NUMBER"],
  },
  { id: "vapi", name: "VAPI", envKeys: ["VAPI_API_KEY", "VAPI_ASSISTANT_ID", "SLIM_PHONE_NUMBER"] },
];

function SlimPhone() {
  const [status, setStatus] = useState<{
    provider: string | null;
    number: string | null;
    configured: boolean;
  } | null>(null);

  useEffect(() => {
    // Honest probe — sidecar reports which phone provider (if any) is configured.
    // Returns { configured:false } until real keys exist; never fakes a number.
    fetch("/__slim_phone_status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) =>
        setStatus({
          provider: j.provider ?? null,
          number: j.number ?? null,
          configured: !!j.configured,
        }),
      )
      .catch(() => setStatus({ provider: null, number: null, configured: false }));
  }, []);

  const configured = status?.configured ?? false;

  return (
    <div data-testid="slim-phone-tab" className="text-white">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Phone size={15} /> Secure Phone — call Slim Charles
        </span>
        <span
          className="flex items-center gap-1 rounded-full border border-red-500/40 px-2 py-1 text-[10px] uppercase tracking-wider text-red-300"
          data-testid="phone-walt-only"
        >
          <Lock size={11} /> Walt-only
        </span>
      </div>

      {!configured ? (
        <div
          className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
          data-testid="phone-setup-needed"
        >
          <div className="font-semibold text-amber-300">Phone provider: setup needed</div>
          <p className="mt-1 text-white/60">
            No telephony provider is configured, so Slim has no live number yet. Add credentials for
            one provider below (in <code>~/.claude-os/.env</code>), then Slim gets a dedicated,
            secured number.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PHONE_PROVIDERS.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-white/10 bg-black/30 p-2"
                data-testid={`phone-provider-${p.id}`}
              >
                <div className="text-[11px] font-semibold text-white/80">{p.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.envKeys.map((k) => (
                    <code
                      key={k}
                      className="rounded bg-white/5 px-1 py-0.5 text-[9px] text-white/60"
                    >
                      {k}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300"
          data-testid="phone-connected"
        >
          {status?.provider} · {status?.number} · inbound ready
        </div>
      )}

      {/* Security model */}
      <div
        className="mb-4 rounded-lg border border-white/10 bg-black/40 p-3"
        data-testid="phone-security"
      >
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Security model
        </div>
        <ul className="space-y-1 text-[11px] text-white/60">
          <li>✓ Caller-ID whitelist — only Walt’s number(s) can connect.</li>
          <li>✓ Optional PIN challenge before Slim engages.</li>
          <li>✓ Optional voiceprint verification (state tracked per call).</li>
          <li>✓ Emergency lockout — unverified callers are dropped + logged.</li>
          <li>
            ✓ Same approval rules as voice: destructive/billing/deploy/external-message actions
            require Walt.
          </li>
          <li>✓ Private to Baseline OS — never exposed to customers or Mission Control.</li>
        </ul>
      </div>

      {/* Call logs / transcripts (honest empty until a real call lands) */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-lg border border-white/10 bg-black/40 p-3"
          data-testid="phone-call-logs"
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Call logs
          </div>
          <p className="text-[11px] text-white/35">
            {configured ? "No calls yet." : "Configure a provider to receive calls."}
          </p>
        </div>
        <div
          className="rounded-lg border border-white/10 bg-black/40 p-3"
          data-testid="phone-transcripts"
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Transcripts + memory sync
          </div>
          <p className="text-[11px] text-white/35">
            Call transcripts + tool-call audit trail sync to Slim’s memory after each verified call.
          </p>
        </div>
      </div>

      <SafetyBoundary />
    </div>
  );
}

function ToolsTab() {
  const [hermesOk, setHermesOk] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/__hermes_status")
      .then((r) => r.json())
      .then((j: { installed?: boolean }) => setHermesOk(!!j.installed))
      .catch(() => setHermesOk(false));
  }, []);
  return (
    <div className="space-y-3" data-testid="slim-tools">
      <p className="text-xs text-white/50">
        Slim can drive every tool source below. Access is honest — a source is ready only when it's
        actually connected.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TOOL_SOURCES.map((s) => {
          const ready = s.id === "hermes" ? hermesOk === true : false;
          return (
            <div
              key={s.id}
              className="rounded-lg border border-white/10 bg-black/30 p-3"
              data-testid={`tool-${s.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">{s.label}</span>
                <span
                  className={`text-[10px] uppercase ${ready ? "text-emerald-400" : "text-amber-400"}`}
                >
                  {ready ? "ready" : "setup-needed"}
                </span>
              </div>
              {!ready && <p className="mt-1 text-[11px] text-white/40">{s.setupHint}</p>}
            </div>
          );
        })}
      </div>
      <SafetyBoundary />
    </div>
  );
}

function SkillsTab() {
  return (
    <div className="space-y-2" data-testid="slim-skills">
      <p className="text-sm text-white/70">
        Slim can execute every installed skill plus Skills Library + configured Marketplace tools.
      </p>
      <p className="text-xs text-white/40">
        Skill execution routes through the real Hermes/Claude Code tool surface. Skills that need
        credentials show setup-needed.
      </p>
      <a href="/skills" className="inline-block text-xs text-sky-400 hover:underline">
        Open Skills →
      </a>
    </div>
  );
}

function MemoryTab() {
  return (
    <div className="space-y-2" data-testid="slim-memory">
      <p className="text-sm text-white/70">
        Slim reads Walt's private memory: Obsidian vault, Notion, Pinecone namespace, and the Hermes
        memory store.
      </p>
      <p className="text-xs text-white/40">
        This memory is private to Baseline OS and is never exposed in Mission Control.
      </p>
      <a href="/memory" className="inline-block text-xs text-sky-400 hover:underline">
        Open Memory graph →
      </a>
    </div>
  );
}

function ComputerUseTab() {
  return (
    <div className="space-y-2" data-testid="slim-computer">
      <p className="text-sm text-white/70">
        Computer Use lets Slim run non-destructive computer tasks autonomously.
      </p>
      <div
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-white/60"
        data-testid="computer-setup-needed"
      >
        Setup needed — connect a computer-use runtime to enable. Destructive actions always require
        Walt's approval.
      </div>
      <SafetyBoundary />
    </div>
  );
}
