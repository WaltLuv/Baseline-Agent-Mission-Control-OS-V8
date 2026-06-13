/**
 * PI Agent sub-agent registry.
 *
 * These are the specialized EXECUTION workers PI routes to. PI wraps them; it
 * does NOT replace Hermes, Claude Code, Codex, or the workflow agents.
 */
import type { SubAgentExecutor, SubAgentResult, SubAgentInput } from './harness'

export interface SubAgentDef {
  id: string
  label: string
  /** The runtime that actually executes this worker (PI wraps it). */
  runtime: 'hermes' | 'claude-code' | 'codex' | 'workflow'
  description: string
}

export const SUB_AGENTS: SubAgentDef[] = [
  { id: 'hermes', label: 'Hermes', runtime: 'hermes', description: 'General long-running orchestration runtime.' },
  { id: 'claude-code', label: 'Claude Code', runtime: 'claude-code', description: 'Code review, refactors, builds, PRs.' },
  { id: 'codex', label: 'Codex', runtime: 'codex', description: 'OpenAI codex execution.' },
  { id: 'maintenance-dispatcher', label: 'Maintenance Dispatcher', runtime: 'workflow', description: 'Triages work orders and dispatches vendors.' },
  { id: 'vendor-coordinator', label: 'Vendor Coordinator', runtime: 'workflow', description: 'Vendor matching + dispatch.' },
  { id: 'owner-approvals', label: 'Owner Approvals', runtime: 'workflow', description: 'Owner approval inbox + decisions.' },
  { id: 'inspection-analyst', label: 'Inspection Analyst', runtime: 'workflow', description: 'Inspection review + evidence.' },
  { id: 'research', label: 'Research / Market Swarm', runtime: 'workflow', description: 'Market research swarm.' },
  { id: 'voice-intake', label: 'Voice Intake', runtime: 'workflow', description: 'Realtime voice intake.' },
]

export function getSubAgent(id: string): SubAgentDef | undefined {
  return SUB_AGENTS.find((s) => s.id === id)
}

/**
 * Default executor used by the API route. It represents the handoff to the
 * specialized runtime: PI has assembled + injected context and routed here.
 * It returns an HONEST structured handoff (no fabricated LLM output) — the
 * heavy execution runs in the named runtime, which PI wraps. Callers/tests can
 * pass their own executor to perform real specialized work.
 */
export const defaultSubAgentExecutor: SubAgentExecutor = async (input: SubAgentInput): Promise<SubAgentResult> => {
  const def = getSubAgent(input.agent)
  return {
    output: {
      handled_by: input.agent,
      runtime: def?.runtime ?? 'hermes',
      received_context: {
        graph_nodes: input.context.graph.nodes.length,
        graph_available: input.context.graph.available,
        memory_hits: input.context.memory.hits.length,
        workspace_agents: input.context.workspaceKnowledge.agents,
      },
      note: `PI assembled context and routed to ${def?.label ?? input.agent} (${def?.runtime ?? 'hermes'}). Execution proceeds in that runtime.`,
    },
    status: 'completed',
  }
}
