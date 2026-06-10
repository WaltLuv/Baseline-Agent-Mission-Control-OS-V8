/**
 * VoiceInput — browser-native Web Speech API mic button.
 * No API keys, no external services. Works in Chrome/Edge; gracefully
 * degrades in browsers that don't expose SpeechRecognition.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Web Speech API type stubs ────────────────────────────────────────────────
// TypeScript's default DOM lib omits SpeechRecognition (still spec-unstable).
// We declare the minimal shape we use so the code stays fully typed without
// depending on an external @types package.

interface SpeechRecognitionResultItem {
  readonly transcript: string;
}

interface SpeechRecognitionResultEntry {
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultListEntry {
  readonly length: number;
  item(index: number): SpeechRecognitionResultEntry;
  [index: number]: SpeechRecognitionResultEntry;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultListEntry;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  continuous?: boolean;
}

export interface UseVoiceInputReturn {
  listening: boolean;
  supported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useVoiceInput({
  onTranscript,
  continuous = false,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const supported =
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    // If already running, stop first then restart.
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const SpeechRecognitionImpl =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = continuous;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        parts.push(event.results[i][0].transcript);
      }
      const transcript = parts.join(" ").trim();
      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported, continuous, onTranscript]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  // Cleanup on unmount.
  useEffect(() => () => stop(), [stop]);

  return { listening, supported, start, stop, toggle };
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** Accent color for the active ring + icon. Defaults to Midnight Aubergine orange. */
  color?: string;
  className?: string;
}

export function VoiceInput({
  onTranscript,
  disabled = false,
  color = "#D97757",
  className,
}: VoiceInputProps) {
  const { listening, supported, toggle } = useVoiceInput({ onTranscript });

  const isDisabled = disabled || !supported;

  const title = !supported
    ? "Voice not supported in this browser"
    : listening
      ? "Stop recording"
      : "Start voice input";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Ripple wrapper */}
      <div className="relative flex items-center justify-center">
        {/* Animated ping ring when listening */}
        {listening && (
          <>
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-40"
              style={{ backgroundColor: color }}
            />
            <span
              className="absolute -inset-1.5 rounded-full animate-ping opacity-20 animation-delay-150"
              style={{ backgroundColor: color, animationDuration: "1.4s" }}
            />
          </>
        )}

        <button
          type="button"
          title={title}
          aria-label={title}
          disabled={isDisabled}
          onClick={toggle}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            listening
              ? "border-transparent shadow-lg"
              : isDisabled
                ? "border-border/40 bg-muted/30 cursor-not-allowed opacity-40"
                : "border-border/60 bg-card hover:border-border hover:bg-accent/60 active:scale-95",
          )}
          style={
            listening
              ? {
                  backgroundColor: color,
                  boxShadow: `0 0 0 1px ${color}, 0 4px 16px -4px ${color}80`,
                }
              : {}
          }
        >
          {supported ? (
            listening ? (
              <Mic
                className="h-4 w-4 transition-colors"
                style={{ color: "#fff" }}
              />
            ) : (
              <Mic
                className="h-4 w-4 transition-colors"
                style={{ color: isDisabled ? "currentColor" : color }}
              />
            )
          ) : (
            <MicOff className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* "Listening…" label */}
      <span
        className={cn(
          "flex items-center gap-1 text-xs font-medium transition-all duration-300",
          listening ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1 pointer-events-none",
        )}
        aria-live="polite"
        style={{ color }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: color }}
        />
        Listening…
      </span>
    </div>
  );
}
