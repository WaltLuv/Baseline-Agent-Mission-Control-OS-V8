/**
 * AI Agent Workforce Setup — the spec / sales / factory system surfaced inside
 * Mission Control. A repeatable factory for building client AI agents, AI
 * employees, AI teams, skills, and workflow packages.
 *
 * Data only. Customer-safe: no Walt-private secrets, no private personal-
 * assistant identities. The GitHub repos are the public build/spec sources.
 */

export interface ServiceOffer {
  id: string
  name: string
  price: string
  timeline: string
  outcome: string
}

export interface StrategicPillar {
  id: string
  name: string
  role: string
}

export interface BuildStep {
  step: number
  name: string
  detail: string
}

export interface RepoRef {
  name: string
  url: string
  purpose: string
}

/** Three productized service offers. */
export const SERVICE_OFFERS: ServiceOffer[] = [
  { id: 'audit', name: 'AI Agent Readiness Audit', price: '$500–$1,000', timeline: '3–5 days', outcome: 'Opportunity map + agent/workflow recommendations + prioritized roadmap.' },
  { id: 'hermes-setup', name: 'Hermes Agent Setup', price: '$3,000–$5,000', timeline: '10–14 days', outcome: 'A working orchestrator agent + core skills wired to the client’s stack.' },
  { id: 'full-buildout', name: 'Full AI Workforce Buildout', price: '$8,000–$15,000+', timeline: '30–60 days', outcome: 'A complete AI employee team: agents, skills, workflows, proofs, handoff + maintenance.' },
]

/** The 5-pillar strategic model. */
export const STRATEGIC_PILLARS: StrategicPillar[] = [
  { id: 'services', name: 'Services', role: 'Create cash — $3K–$15K setup + $500–$1K/mo maintenance.' },
  { id: 'marketplace', name: 'Marketplace', role: 'Create leverage — every client build becomes a reusable product.' },
  { id: 'propcontrol', name: 'PropControl', role: 'Prove vertical depth — 24 pipelines, voice, vision, messaging.' },
  { id: 'boardroom', name: 'Boardroom', role: 'Show the future — multi-agent visual planning.' },
  { id: 'voiceops-visionops', name: 'VoiceOps / VisionOps', role: 'Expand capability — voice intake + field-media inspection.' },
]

/** Spec-driven build process: Constitution → … → Maintain. */
export const BUILD_PROCESS: BuildStep[] = [
  { step: 1, name: 'Constitution', detail: '14 principles governing all builds.' },
  { step: 2, name: 'Spec', detail: 'Feature specification per agent/workflow.' },
  { step: 3, name: 'Clarify', detail: 'Ambiguity analysis — resolve unknowns before planning.' },
  { step: 4, name: 'Plan', detail: 'Technical implementation plan.' },
  { step: 5, name: 'Tasks', detail: 'Numbered micro-tasks.' },
  { step: 6, name: 'Implement', detail: 'Build the agent/skill/workflow.' },
  { step: 7, name: 'Test', detail: 'Prove behavior against the spec.' },
  { step: 8, name: 'Package', detail: 'Marketplace listing + manifests + handoff packet.' },
  { step: 9, name: 'Maintain', detail: 'Monthly maintenance schedule + improvements.' },
]

/** Public build/spec source repositories. */
export const WORKFORCE_REPOS: RepoRef[] = [
  { name: 'agent-workforce-setup', url: 'https://github.com/WaltLuv/agent-workforce-setup.git', purpose: 'Spec Kit + sales framework + factory process.' },
  { name: 'the-real-prop-control-saas', url: 'https://github.com/WaltLuv/the-real-prop-control-saas.git', purpose: 'PropControl — property ops SaaS (pipelines, voice, vision, messaging).' },
  { name: 'the-real-voice-ops', url: 'https://github.com/WaltLuv/the-real-voice-ops.git', purpose: 'VoiceOps — inbound call intake → intent → dispatch/escalation.' },
  { name: 'Vision-Ops-production', url: 'https://github.com/WaltLuv/Vision-Ops-production.git', purpose: 'VisionOps — field media → AI inspection → owner-ready proof.' },
]

export const POSITIONING =
  'We build AI agent workforces for businesses — orchestrator agents, Claude Code agents, operator agents, skills, workflows, and AI employee teams that help execute real work.'

export function getOffer(id: string): ServiceOffer | undefined {
  return SERVICE_OFFERS.find((o) => o.id === id)
}
