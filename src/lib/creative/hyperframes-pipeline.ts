/**
 * HyperFrames pipeline — HTML → MP4 render with word-level captions.
 *
 * Cloud Mission Control cannot run ffmpeg/Chromium directly; the pipeline runs
 * on a paired render runtime (local Baseline OS / Flight Deck, or a HeyGen
 * cloud render). This module models the pipeline stages + cost honestly so the
 * UI can show real progress/state — it never fakes a completed render.
 */
import { getProvider, estimateCost } from './provider-matrix'

export type StageStatus = 'pending' | 'running' | 'done' | 'blocked'

export interface PipelineStage {
  id: string
  label: string
  description: string
  /** Requires a paired render runtime (ffmpeg/Chromium). */
  needsRuntime: boolean
}

export const HYPERFRAMES_STAGES: PipelineStage[] = [
  { id: 'storyboard', label: 'Storyboard / HTML', description: 'Compose scenes as HTML/CSS templates (data-driven).', needsRuntime: false },
  { id: 'rasterize', label: 'Rasterize frames', description: 'Render each scene to frames via headless Chromium.', needsRuntime: true },
  { id: 'encode', label: 'Encode MP4', description: 'Encode frames to MP4 via ffmpeg at target fps/resolution.', needsRuntime: true },
  { id: 'transcribe', label: 'Transcribe (word timestamps)', description: 'Whisper word-level timestamps for captions.', needsRuntime: true },
  { id: 'caption', label: 'Burn captions', description: 'Overlay word-synced captions onto the MP4.', needsRuntime: true },
  { id: 'proof', label: 'Proof + store', description: 'Write proof manifest + store the MP4 in the shared asset library.', needsRuntime: false },
]

export interface PipelineSignals {
  /** A render runtime (ffmpeg/Chromium worker) is paired + reachable. */
  renderRuntimePaired?: boolean
}

/** Honest stage status — runtime stages are blocked until a render runtime pairs. */
export function deriveStageStatus(stage: PipelineStage, s: PipelineSignals): StageStatus {
  if (stage.needsRuntime && !s.renderRuntimePaired) return 'blocked'
  return 'pending'
}

export function pipelineReady(s: PipelineSignals): boolean {
  return !!s.renderRuntimePaired
}

/** Estimate render cost for a video of `seconds` length at `fps`. */
export function estimateRenderCost(seconds: number) {
  const hf = getProvider('hyperframes')!
  const renderMinutes = Math.max(1, Math.ceil(seconds / 60))
  return estimateCost(hf, renderMinutes)
}
