/**
 * VoiceControls — drop-in voice IO for any agent chat surface.
 *
 *   <VoiceControls
 *     agentId="hermes"
 *     agentLabel="Hermes"
 *     onTranscript={(text) => setInput((prev) => (prev + " " + text).trim())}
 *     lastReply={lastAssistantMessage}        // auto-speaks when this changes (if autoplay on)
 *   />
 *
 * UI is a small pill cluster: mic toggle + voice picker dropdown + mute toggle.
 * Voice assignments persist per agent in localStorage; the ElevenLabs key lives
 * server-side (~/.claude-os/config.json → voice.elevenlabs_api_key).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, ChevronDown, RefreshCw } from "lucide-react";
import {
  getAssignedVoice, setAssignedVoice, speakAs, stopSpeaking,
  isMuted, setMuted, getAutoplay, setAutoplay,
  startListening, type SttHandle,
} from "@/lib/voice";

interface VoiceListResp { voices: Array<{ voice_id: string; name: string; labels?: Record<string,string> }>; note?: string }

interface Props {
  agentId: string;
  agentLabel: string;
  /** Called when the user finishes a spoken phrase. Append to input. */
  onTranscript: (text: string) => void;
  /** Most recent assistant reply. If autoplay is on, the component speaks it. */
  lastReply?: string | null;
  /** Tone color for active state */
  tone?: string;
}

export function VoiceControls({ agentId, agentLabel, onTranscript, lastReply, tone = "#22d3ee" }: Props) {
  const [listening, setListening] = useState(false);
  const sttRef = useRef<SttHandle | null>(null);
  const [voices, setVoices] = useState<VoiceListResp["voices"]>([]);
  const [voicesNote, setVoicesNote] = useState<string | null>(null);
  const [voiceId, setVoiceIdState] = useState<string | null>(() => getAssignedVoice(agentId));
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [autoplay, setAutoplayState] = useState<boolean>(() => getAutoplay());
  const [picking, setPicking] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const lastSpokenRef = useRef<string | null>(null);

  const loadVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      const r = await fetch("/__voice_voices");
      const j = await r.json() as VoiceListResp;
      setVoices(j.voices); setVoicesNote(j.note ?? null);
    } catch (e) {
      setVoicesNote((e as any)?.message ?? "voice list unavailable");
    }
    setLoadingVoices(false);
  }, []);

  useEffect(() => { void loadVoices(); }, [loadVoices]);

  // Autoplay last reply
  useEffect(() => {
    if (!autoplay || muted || !voiceId || !lastReply) return;
    if (lastReply === lastSpokenRef.current) return;
    lastSpokenRef.current = lastReply;
    void speakAs(agentId, lastReply);
  }, [lastReply, autoplay, muted, voiceId, agentId]);

  function toggleListen() {
    if (listening) {
      sttRef.current?.stop();
      sttRef.current = null;
      setListening(false);
      return;
    }
    const handle = startListening({
      onFinal: (t) => { onTranscript(t.trim()); setListening(false); sttRef.current = null; },
      onInterim: (_t) => { /* visual feedback could go here */ },
      onError: () => { setListening(false); sttRef.current = null; },
    });
    if (!handle) { alert("This browser doesn't support voice input. Try Chrome or Safari."); return; }
    sttRef.current = handle;
    setListening(true);
  }

  function pickVoice(v: string | null) {
    setVoiceIdState(v);
    setAssignedVoice(agentId, v);
    setPicking(false);
    if (v) void speakAs(agentId, `Hi, this is ${agentLabel}.`);
  }

  function toggleMute() {
    const next = !muted;
    setMutedState(next); setMuted(next);
    if (next) stopSpeaking();
  }
  function toggleAutoplay() {
    const next = !autoplay;
    setAutoplayState(next); setAutoplay(next);
  }

  const currentVoice = voices.find((v) => v.voice_id === voiceId);

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {/* Mic */}
      <button
        onClick={toggleListen}
        title={listening ? "Stop listening" : "Hold or click to speak"}
        className="p-1.5 rounded-md transition"
        style={{
          background: listening ? `${tone}28` : "rgba(255,255,255,0.04)",
          border: `1px solid ${listening ? `${tone}66` : "var(--panel-border)"}`,
          color: listening ? tone : "var(--fg-dim)",
        }}
      >
        {listening ? <Mic size={13} className="animate-pulse" /> : <MicOff size={13} />}
      </button>

      {/* Voice picker */}
      <button
        onClick={() => setPicking((p) => !p)}
        title={currentVoice ? `Voice: ${currentVoice.name}` : "Pick a voice"}
        className="px-2 py-1.5 rounded-md text-[10.5px] uppercase tracking-widest font-semibold transition flex items-center gap-1"
        style={{
          background: voiceId ? `${tone}18` : "rgba(255,255,255,0.04)",
          border: `1px solid ${voiceId ? `${tone}44` : "var(--panel-border)"}`,
          color: voiceId ? tone : "var(--fg-dim)",
        }}
      >
        {currentVoice ? currentVoice.name : "Voice"}
        <ChevronDown size={10} />
      </button>

      {/* Mute */}
      <button
        onClick={toggleMute}
        title={muted ? "Unmute voice output" : "Mute voice output"}
        className="p-1.5 rounded-md transition"
        style={{
          background: muted ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${muted ? "rgba(239,68,68,0.4)" : "var(--panel-border)"}`,
          color: muted ? "#fca5a5" : "var(--fg-dim)",
        }}
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>

      {/* Autoplay toggle */}
      <button
        onClick={toggleAutoplay}
        title={autoplay ? "Stop reading replies aloud automatically" : "Read replies aloud automatically"}
        className="px-2 py-1.5 rounded-md text-[10.5px] uppercase tracking-widest font-semibold transition"
        style={{
          background: autoplay ? `${tone}18` : "rgba(255,255,255,0.04)",
          border: `1px solid ${autoplay ? `${tone}44` : "var(--panel-border)"}`,
          color: autoplay ? tone : "var(--fg-dim)",
        }}
      >
        Auto
      </button>

      {/* Picker dropdown */}
      {picking && (
        <div className="absolute right-0 top-full mt-2 rounded-lg border shadow-2xl z-50" style={{ background: "rgba(15,15,15,0.96)", borderColor: "var(--panel-border)", minWidth: 280, backdropFilter: "blur(6px)" }}>
          <div className="flex items-center justify-between p-2.5 border-b" style={{ borderColor: "var(--panel-border)" }}>
            <span className="text-[10.5px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Voice for {agentLabel}</span>
            <button onClick={loadVoices} className="p-1 rounded transition" title="Refresh" style={{ color: "var(--fg-dim)" }}>
              <RefreshCw size={10} className={loadingVoices ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-1 scroll">
            {voices.length === 0 && (
              <div className="text-[11px] p-3" style={{ color: "var(--fg-dimmer)" }}>
                {voicesNote ?? "Loading…"}
                <div className="mt-2 text-[10.5px]" style={{ color: "var(--fg-dimmer)" }}>
                  Set <code style={{ color: tone }}>voice.elevenlabs_api_key</code> in <code>~/.claude-os/config.json</code> to enable.
                </div>
              </div>
            )}
            {voices.map((v) => {
              const active = voiceId === v.voice_id;
              return (
                <button key={v.voice_id} onClick={() => pickVoice(v.voice_id)} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-left text-[12px] transition"
                  style={{ background: active ? `${tone}18` : "transparent", color: active ? "#fff" : "var(--fg-dim)" }}>
                  <span className="truncate">{v.name}</span>
                  {v.labels?.gender && <span className="text-[9px] uppercase tracking-widest" style={{ color: "var(--fg-dimmer)" }}>{v.labels.gender}</span>}
                </button>
              );
            })}
            {voiceId && (
              <button onClick={() => pickVoice(null)} className="w-full text-left text-[11px] px-2.5 py-2 mt-1 rounded-md" style={{ color: "#fca5a5", background: "rgba(239,68,68,0.06)" }}>
                Clear voice for {agentLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
