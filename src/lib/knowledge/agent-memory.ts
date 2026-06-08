/**
 * Shared agent memory access. Every agent reads from the shared brain layers by
 * scope/permission — no isolated silos unless intentionally scoped.
 */
import type { BrainLayerId } from './brain-layers'

export interface MemoryAgent {
  id: string
  label: string
  /** Brain layers this agent may query. */
  scopes: BrainLayerId[]
}

const ALL: BrainLayerId[] = ['obsidian', 'notion', 'pinecone', 'notebooklm']

export const MEMORY_AGENTS: MemoryAgent[] = [
  { id: 'pi-agent', label: 'PI Agent', scopes: ALL }, // CMO — full access
  { id: 'slim', label: 'Slim Voice Agent', scopes: ['obsidian', 'pinecone', 'notebooklm'] },
  { id: 'hermes', label: 'Hermes', scopes: ALL },
  { id: 'claude-code', label: 'Claude Code', scopes: ['obsidian', 'pinecone'] },
  { id: 'codex', label: 'Codex', scopes: ['obsidian', 'pinecone'] },
  { id: 'openclaw', label: 'OpenClaw', scopes: ['obsidian', 'pinecone'] },
  { id: 'antigravity', label: 'Antigravity', scopes: ['obsidian', 'pinecone'] },
  { id: 'gemini', label: 'Gemini', scopes: ['pinecone', 'notebooklm'] },
  { id: 'browser-use', label: 'Browser Use', scopes: ['pinecone'] },
  { id: 'notebooklm-agent', label: 'NotebookLM Agent', scopes: ['notebooklm', 'pinecone', 'obsidian'] },
  { id: 'oh-my-pi', label: 'Oh My Pi', scopes: ['obsidian', 'pinecone'] },
  { id: 'maestro', label: 'Maestro', scopes: ALL },
  { id: 'video-team', label: 'Video Editing Team', scopes: ['obsidian', 'pinecone', 'notebooklm'] },
  { id: 'workforce', label: 'Workforce Employees', scopes: ['obsidian', 'notion', 'pinecone'] },
]

export function canQueryLayer(agentId: string, layer: BrainLayerId): boolean {
  const a = MEMORY_AGENTS.find((m) => m.id === agentId)
  return !!a && a.scopes.includes(layer)
}

export function getMemoryAgent(id: string): MemoryAgent | undefined {
  return MEMORY_AGENTS.find((m) => m.id === id)
}
