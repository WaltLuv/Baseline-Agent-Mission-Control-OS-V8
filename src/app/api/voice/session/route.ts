import { NextResponse } from 'next/server'
import { detectVoiceProvider, SLIM_CHARLES } from '@/lib/voice/hermes-voice-stream'

/**
 * Slim Charles realtime voice session negotiation.
 *
 * This is the WebSocket bootstrap endpoint: the browser calls it to obtain an
 * ephemeral, short-lived session token before opening the persistent
 * bidirectional audio socket to the realtime provider. We NEVER return a
 * long-lived API key to the client.
 *
 * Truth-first: if no native speech-to-speech provider is configured, we return
 * `configured: false` with `setupNeeded: true` so the UI shows the honest
 * setup-needed state instead of pretending a voice session is live.
 */
export async function GET() {
  const provider = detectVoiceProvider(process.env)

  if (!provider) {
    return NextResponse.json(
      {
        configured: false,
        setupNeeded: true,
        voice: SLIM_CHARLES.voiceId,
        message:
          'No realtime voice provider configured. Add OPENAI_API_KEY (GPT-Realtime) or GEMINI_API_KEY (Gemini Live) for native speech-to-speech, or ELEVENLABS_API_KEY for fallback TTS.',
        // WebSocket URL the client will connect to once a provider is wired.
        wsUrl: null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Mint an ephemeral session against the configured provider. For OpenAI
  // Realtime this is POST /v1/realtime/sessions; the returned client_secret is
  // short-lived and safe to hand to the browser. If minting fails we report it
  // honestly rather than returning a fake token.
  let ephemeralToken: string | null = null
  let wsUrl: string | null = null
  try {
    if (provider.id === 'openai-realtime') {
      const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-realtime',
          voice: 'verse',
          instructions: SLIM_CHARLES.persona,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { client_secret?: { value?: string } }
        ephemeralToken = data.client_secret?.value ?? null
        wsUrl = 'wss://api.openai.com/v1/realtime'
      }
    }
  } catch {
    ephemeralToken = null
  }

  if (!ephemeralToken) {
    return NextResponse.json(
      {
        configured: true,
        setupNeeded: true,
        provider: provider.id,
        voice: SLIM_CHARLES.voiceId,
        message: `${provider.label} is configured but the realtime session could not be minted. Verify the key and provider availability.`,
        wsUrl: null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    {
      configured: true,
      setupNeeded: false,
      provider: provider.id,
      native: provider.native,
      latencyTargetMs: provider.latencyTargetMs,
      voice: SLIM_CHARLES.voiceId,
      ephemeralToken,
      wsUrl,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
