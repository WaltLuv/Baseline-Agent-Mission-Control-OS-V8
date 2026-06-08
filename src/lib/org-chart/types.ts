/**
 * AI Org Chart — client-safe types, constants, and pure helpers.
 *
 * Kept separate from `store.ts` (which imports the sqlite db) so client
 * components can import these without pulling server-only modules into the
 * browser bundle.
 */
export interface OrgAgent {
  id: string
  name: string
  role: string
  department: string
  category: string
  managerId: string | null
  skills: string[]
  memoryAccess: string[]
  runtime: string
  permissions: string[]
  archived: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface OrgAgentInput {
  name: string
  role?: string
  department?: string
  category?: string
  managerId?: string | null
  skills?: string[]
  memoryAccess?: string[]
  runtime?: string
  permissions?: string[]
  sortOrder?: number
}

export const ORG_DEPARTMENTS = [
  'Leadership & Orchestration', 'PM Division', 'Mortgage Division',
  'Real Estate Division', 'Tax & Finance', 'Creative', 'Intelligence', 'Specialist Leads',
] as const

export interface OrgNode extends OrgAgent { reports: OrgNode[] }

/** Build the manager→reports hierarchy for display (pure). */
export function buildHierarchy(agents: OrgAgent[]): OrgNode[] {
  const byId = new Map<string, OrgNode>()
  agents.forEach((a) => byId.set(a.id, { ...a, reports: [] }))
  const roots: OrgNode[] = []
  byId.forEach((node) => {
    if (node.managerId && byId.has(node.managerId)) byId.get(node.managerId)!.reports.push(node)
    else roots.push(node)
  })
  return roots
}
