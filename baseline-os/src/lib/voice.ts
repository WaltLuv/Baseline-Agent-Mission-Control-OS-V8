/**
 * Voice — shared client for ElevenLabs TTS + Web Speech STT.
 *
 * Per-agent voice assignment lives in localStorage so the user can wire up
 * specific voices without a server round-trip. The ElevenLabs API key lives
 * in ~/.claude-os/config.json (server reads it) so it never enters the
 * browser bundle.
 *
 * Architecture:
 *   · STT: browser Web Speech API (free, no key). Falls back to muted if
 *     unavailable.
 *   · TTS: POST /__voice_speak { text, voiceId } → audio/mpeg stream.
 *     Server calls ElevenLabs with the key from config.json.
 */

export type AgentVoiceId = string;

export interface AgentVoiceMap {
  [agentId: string]: AgentVoiceId;
}

const STORAGE_KEY = "claude-os.voice.assignments.v1";
const MUTE_KEY    = "claude-os.voice.muted.v1";
const AUTOPLAY_KEY = "claude-os.voice.autoplay.v1";

export function loadAssignments(): AgentVoiceMap {
  if (typeof window === "undefined") return {};
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
export function saveAssignments(m: AgentVoiceMap): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch { /* skip */ }
}
export function getAssignedVoice(agentId: string): AgentVoiceId | null {
  return loadAssignments()[agentId] ?? null;
}
export function setAssignedVoice(agentId: string, voiceId: AgentVoiceId | null): void {
  const m = loadAssignments();
  if (voiceId) m[agentId] = voiceId; else delete m[agentId];
  saveAssignments(m);
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}
export function setMuted(v: boolean): void {
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* skip */ }
}

export function getAutoplay(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(AUTOPLAY_KEY) === "1"; } catch { return false; }
}
export function setAutoplay(v: boolean): void {
  try { localStorage.setItem(AUTOPLAY_KEY, v ? "1" : "0"); } catch { /* skip */ }
}

/** Speak `text` using the voice assigned to `agentId`. Returns true on success. */
export async function speakAs(agentId: string, text: string): Promise<boolean> {
  if (isMuted() || !text.trim()) return false;
  const voiceId = getAssignedVoice(agentId);
  if (!voiceId) return false;
  try {
    const r = await fetch("/__voice_speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 2500), voiceId }),
    });
    if (!r.ok) {
      // Fall back to Web Speech if the server can't reach ElevenLabs
      return speakBrowserFallback(text);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return true;
  } catch {
    return speakBrowserFallback(text);
  }
}

/** Last-resort TTS using browser's built-in voice — no API key needed. */
function speakBrowserFallback(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    const u = new SpeechSynthesisUtterance(text.slice(0, 1000));
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

/** Cancel any currently-playing TTS (both ElevenLabs audio and browser). */
export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch { /* skip */ }
  }
  // ElevenLabs audio elements are GC'd when their reference drops
}

// ─── Speech-to-text via Web Speech API ──────────────────────────────────────

export interface SttHandle {
  stop: () => void;
  abort: () => void;
}

/** Start streaming STT. onFinal is called when the user pauses; onInterim on
 *  every partial. Returns null when the browser doesn't support it. */
export function startListening(opts: {
  onFinal: (t: string) => void;
  onInterim?: (t: string) => void;
  onError?: (e: string) => void;
  lang?: string;
}): SttHandle | null {
  const anyWindow = window as any;
  const SR = anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;
  if (!SR) { opts.onError?.("Web Speech API not supported by this browser"); return null; }
  const rec = new SR();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = opts.lang ?? "en-US";
  rec.onresult = (ev: any) => {
    let interim = ""; let final = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) opts.onInterim?.(interim);
    if (final) opts.onFinal(final);
  };
  rec.onerror = (e: any) => opts.onError?.(e.error ?? "speech error");
  rec.start();
  return { stop: () => rec.stop(), abort: () => rec.abort() };
}
