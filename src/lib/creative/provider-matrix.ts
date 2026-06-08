/**
 * Creative Provider Matrix — the canonical, provider-sovereign view of every
 * creative rendering engine Mission Control can drive. Each provider is a
 * compute layer; assets/proofs/jobs are owned by Mission Control / Baseline OS,
 * never the provider.
 *
 * P2: this matrix adds a COST ESTIMATE and a PROOF EXPECTATION per provider, on
 * top of honest capability + status. Truth-first: no fake "connected" state, no
 * invented prices — costs are published unit rates, clearly labeled estimates.
 */
import type { Risk } from './higgsfield'

export type Modality = 'image' | 'video' | 'audio' | 'render' | 'text'

export type ProviderStatus =
  | 'ready' // credential present + reachable
  | 'credentials_missing'
  | 'runtime_required' // needs a paired render/worker runtime (e.g. ffmpeg)
  | 'setup_needed'

export interface ProviderCost {
  /** Unit the price is measured in. */
  unit: 'image' | 'second_of_video' | 'minute_of_audio' | 'render_minute' | '1k_tokens'
  /** USD per unit (published rate; labeled an estimate in the UI). */
  usdPerUnit: number
  /** Credits per unit (platform currency), derived from usd at display time. */
  note?: string
}

export interface CreativeProvider {
  id: string
  label: string
  modalities: Modality[]
  /** Credential env keys required for cloud use. */
  requiredCredentials: string[]
  /** Whether it needs a paired worker/render runtime (cloud can't run it directly). */
  needsRuntime: boolean
  approval: Risk
  cost: ProviderCost
  proofExpectation: string
  /** Short capability summary. */
  capabilities: string[]
}

export const CREATIVE_PROVIDERS: CreativeProvider[] = [
  {
    id: 'higgsfield', label: 'Higgsfield', modalities: ['image', 'video'],
    requiredCredentials: ['HIGGSFIELD_API_KEY_ID', 'HIGGSFIELD_API_KEY_SECRET'], needsRuntime: false, approval: 'medium',
    cost: { unit: 'image', usdPerUnit: 0.06, note: 'GPT Image 2 / Seedance / Soul; video billed per second' },
    proofExpectation: 'asset URI + model + prompt in the shared asset library',
    capabilities: ['Soul ID identity', 'Product photoshoot', 'Marketplace cards', 'Kling/Seedance video'],
  },
  {
    id: 'hyperframes', label: 'HyperFrames', modalities: ['video', 'render'],
    requiredCredentials: ['HEYGEN_API_KEY'], needsRuntime: true, approval: 'medium',
    cost: { unit: 'render_minute', usdPerUnit: 0.40, note: 'HTML→MP4 render; local ffmpeg worker or HeyGen cloud' },
    proofExpectation: 'rendered MP4 URI + scene manifest + word-timestamp track',
    capabilities: ['HTML→MP4', 'Word-level captions', 'Avatar video (HeyGen)'],
  },
  {
    id: 'runway', label: 'Runway', modalities: ['video', 'image'],
    requiredCredentials: ['RUNWAY_API_KEY'], needsRuntime: false, approval: 'medium',
    cost: { unit: 'second_of_video', usdPerUnit: 0.05, note: 'Gen-3 video' },
    proofExpectation: 'video URI + generation id in the shared asset library',
    capabilities: ['Gen-3 text/image→video', 'Video-to-video'],
  },
  {
    id: 'pika', label: 'Pika', modalities: ['video'],
    requiredCredentials: ['PIKA_API_KEY'], needsRuntime: false, approval: 'medium',
    cost: { unit: 'second_of_video', usdPerUnit: 0.04, note: 'Pika video' },
    proofExpectation: 'video URI + generation id',
    capabilities: ['Text→video', 'Image→video'],
  },
  {
    id: 'minimax', label: 'MiniMax', modalities: ['video', 'audio', 'text'],
    requiredCredentials: ['MINIMAX_API_KEY'], needsRuntime: false, approval: 'medium',
    cost: { unit: 'second_of_video', usdPerUnit: 0.03, note: 'Hailuo video; TTS billed per minute' },
    proofExpectation: 'asset URI + model + prompt',
    capabilities: ['Hailuo video', 'TTS / voice', 'Chat'],
  },
  {
    id: 'heygen', label: 'HeyGen', modalities: ['video'],
    requiredCredentials: ['HEYGEN_API_KEY'], needsRuntime: false, approval: 'high',
    cost: { unit: 'second_of_video', usdPerUnit: 0.10, note: 'Avatar/spokesperson video' },
    proofExpectation: 'avatar video URI + consent record (high approval)',
    capabilities: ['Avatar video', 'Spokesperson', 'Translation'],
  },
  {
    id: 'elevenlabs', label: 'ElevenLabs', modalities: ['audio'],
    requiredCredentials: ['ELEVENLABS_API_KEY'], needsRuntime: false, approval: 'medium',
    cost: { unit: 'minute_of_audio', usdPerUnit: 0.30, note: 'TTS / voice cloning' },
    proofExpectation: 'audio URI + voice id + transcript',
    capabilities: ['TTS', 'Voice cloning', 'Dubbing'],
  },
  {
    id: 'remotion', label: 'Remotion', modalities: ['video', 'render'],
    requiredCredentials: [], needsRuntime: true, approval: 'low',
    cost: { unit: 'render_minute', usdPerUnit: 0.10, note: 'Programmatic React→MP4; render worker required' },
    proofExpectation: 'rendered MP4 URI + composition props',
    capabilities: ['React→MP4', 'Data-driven video', 'Deterministic render'],
  },
  {
    id: 'gemini', label: 'Gemini', modalities: ['image', 'text'],
    requiredCredentials: ['GEMINI_API_KEY'], needsRuntime: false, approval: 'low',
    cost: { unit: '1k_tokens', usdPerUnit: 0.002, note: 'Imagen / multimodal' },
    proofExpectation: 'asset/text URI + model + prompt',
    capabilities: ['Imagen', 'Multimodal reasoning'],
  },
  {
    id: 'openai', label: 'OpenAI', modalities: ['image', 'audio', 'text'],
    requiredCredentials: ['OPENAI_API_KEY'], needsRuntime: false, approval: 'low',
    cost: { unit: 'image', usdPerUnit: 0.04, note: 'gpt-image-1 / TTS / Whisper' },
    proofExpectation: 'asset URI + model + prompt',
    capabilities: ['gpt-image-1', 'TTS', 'Whisper transcription'],
  },
]

export interface ProviderSignals {
  credentialPresent?: boolean
  runtimePaired?: boolean
}

export function deriveProviderStatus(p: CreativeProvider, s: ProviderSignals): ProviderStatus {
  if (p.requiredCredentials.length > 0 && !s.credentialPresent) return 'credentials_missing'
  if (p.needsRuntime && !s.runtimePaired) return 'runtime_required'
  if (p.requiredCredentials.length === 0 && p.needsRuntime && !s.runtimePaired) return 'runtime_required'
  return s.credentialPresent || p.requiredCredentials.length === 0 ? 'ready' : 'setup_needed'
}

export const PROVIDER_STATUS_LABEL: Record<ProviderStatus, string> = {
  ready: 'Ready',
  credentials_missing: 'Credentials missing',
  runtime_required: 'Render runtime required',
  setup_needed: 'Setup needed',
}

const UNIT_LABEL: Record<ProviderCost['unit'], string> = {
  image: 'image',
  second_of_video: 'sec of video',
  minute_of_audio: 'min of audio',
  render_minute: 'render min',
  '1k_tokens': '1K tokens',
}

/** USD→credits conversion mirrors the platform rate (1 credit = $0.001). */
export function usdToCredits(usd: number): number {
  return Math.max(1, Math.round(usd * 1000))
}

/** Human-readable cost estimate for N units, labeled as an estimate. */
export function estimateCost(p: CreativeProvider, units: number): { usd: number; credits: number; label: string } {
  const usd = p.cost.usdPerUnit * units
  const credits = usdToCredits(usd)
  return {
    usd,
    credits,
    label: `~${credits.toLocaleString()} credits ($${usd.toFixed(2)}) for ${units} ${UNIT_LABEL[p.cost.unit]}${units === 1 ? '' : 's'}`,
  }
}

export function getProvider(id: string): CreativeProvider | undefined {
  return CREATIVE_PROVIDERS.find((p) => p.id === id)
}
