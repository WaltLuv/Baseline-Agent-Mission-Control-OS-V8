/**
 * Mission Control CLI inventory.
 *
 * Mirrors the namespaces shown by `mc --help` (see scripts/mc-cli.cjs).
 * The page at `/app/cli` consumes this list to render an honest catalogue
 * of operator commands. Status flags ('working' / 'stubbed' / 'planned')
 * reflect the same labels the CLI prints — when a command is wired and
 * returning a real response, it is `working`; when the backend route
 * isn't implemented yet, it is `stubbed` or `planned`.
 *
 * This file is the source of truth for the page. When you add a new
 * top-level group or action to `scripts/mc-cli.cjs`, mirror the change
 * here so the inventory stays accurate.
 */

export type CliStatus = 'working' | 'stubbed' | 'planned'

export interface CliNamespace {
  group: string
  description: string
  actions: string
  status: CliStatus
  notes?: string
}

export const CLI_NAMESPACES: CliNamespace[] = [
  { group: 'auth', description: 'Authenticate the CLI against this Mission Control instance.', actions: 'login / logout / whoami', status: 'working' },
  { group: 'config', description: 'Manage CLI profiles (URL + API key + workspace).', actions: 'set-url / set-key / set-workspace / current / profiles', status: 'working' },
  { group: 'status', description: 'Service health, gateway status, model availability.', actions: 'health / overview / dashboard / gateway / models', status: 'working' },
  { group: 'agent', description: 'Inspect agents, costs, attribution; mint runtime keys.', actions: 'list / get / heartbeat / wake / diagnostics / attribution / costs / keys / mint-key (--yes)', status: 'working' },
  { group: 'task', description: 'Work with tasks: list, create, update, comment, broadcast.', actions: 'list / get / create / update / comment / comments / broadcast', status: 'working' },
  { group: 'queue', description: 'Agent-side task polling.', actions: 'poll --agent', status: 'working' },
  { group: 'run', description: 'List and inspect agent runs with provenance.', actions: 'list / get / create / update / provenance', status: 'working' },
  { group: 'eval', description: 'Attach evals to runs; aggregate the leaderboard.', actions: 'attach --run-id / leaderboard', status: 'working' },
  { group: 'session', description: 'Conversation sessions: list, continue, control, transcript.', actions: 'list / continue / control (--yes) / transcript', status: 'working' },
  { group: 'memory', description: 'Per-agent memory read/write/clear.', actions: 'read --id / write --id (--yes) / clear --id (--yes)', status: 'working' },
  { group: 'soul', description: 'Persona/soul template management.', actions: 'read --id / write --id (--yes) / templates --id', status: 'working' },
  { group: 'knowledge', description: 'Search + maintain the workspace knowledge graph.', actions: 'search / read-file / write-file (--yes) / health / gaps / consolidate (--yes) / rebuild-index (--yes)', status: 'working' },
  { group: 'runtime', description: 'Connect and inspect remote agent runtimes.', actions: 'list / connect <kind> / heartbeat / logs / doctor', status: 'working', notes: 'kinds: hermes | openclaw | opencode | claude | codex' },
  { group: 'gateway', description: 'Inspect the agent gateway: tasks, routes, logs.', actions: 'health / agents / tasks / task <id> / logs / route', status: 'working' },
  { group: 'workspace', description: 'List or switch the active workspace.', actions: 'list / use <id> / current', status: 'working' },
  { group: 'team', description: 'Manage team members + invitations.', actions: 'list / invite --email --role / revoke <id>', status: 'working' },
  { group: 'employee', description: 'Browse, install, and remove AI employees.', actions: 'list / inspect / install (--yes) / remove', status: 'working' },
  { group: 'skill', description: 'Browse, install, and remove paid skills.', actions: 'list / inspect / install (--yes) / remove', status: 'working' },
  { group: 'billing', description: 'Credit balance + usage + ledger.', actions: 'status / credits / usage / ledger', status: 'working' },
  { group: 'deploy', description: 'Production deploy checks + rollback advisories.', actions: 'check / health / preflight / env-check / rollback (--yes, advisory)', status: 'working' },
  { group: 'flightdeck', description: 'Flight Deck (desktop) release inventory + tag flow.', actions: 'status / downloads / doctor / release', status: 'working' },
]

export const CLI_LEGACY_GROUPS: CliNamespace[] = [
  { group: 'agents', description: 'Legacy alias retained for compatibility.', actions: 'list/get/create/update/delete/wake/diagnostics/heartbeat/memory get|set|clear/soul get|set|templates/attribution', status: 'working' },
  { group: 'tasks', description: 'Legacy alias retained for compatibility.', actions: 'list/get/create/update/delete/queue/comments/broadcast', status: 'working' },
  { group: 'sessions', description: 'Legacy alias retained for compatibility.', actions: 'list/control/continue/transcript', status: 'working' },
  { group: 'connect', description: 'Manage runtime connections.', actions: 'register/list/disconnect', status: 'working' },
  { group: 'tokens', description: 'Token usage and cost breakdowns.', actions: 'list/stats/by-agent/agent-costs/task-costs/export/rotate', status: 'working' },
  { group: 'skills', description: 'Skill registry CRUD (legacy alias of `skill`).', actions: 'list/content/upsert/delete/check', status: 'working' },
  { group: 'cron', description: 'Cron jobs CRUD + manual fire.', actions: 'list/create/update/pause/resume/remove/run', status: 'working' },
  { group: 'events', description: 'Stream events from the gateway.', actions: 'watch', status: 'working' },
  { group: 'workflows', description: 'Workflow CRUD.', actions: 'list/get/create/delete', status: 'working' },
  { group: 'export', description: 'Bulk exports for audit/tasks/activities/pipelines.', actions: 'audit/tasks/activities/pipelines', status: 'working' },
  { group: 'raw', description: 'Raw request fallback (advanced).', actions: 'request', status: 'working' },
]

export const CLI_COMMON_FLAGS = [
  { flag: '--profile <name>', description: 'profile name (default: default)' },
  { flag: '--url <base_url>', description: 'override profile URL' },
  { flag: '--api-key <key>', description: 'override profile API key' },
  { flag: '--workspace <id>', description: 'override active workspace' },
  { flag: '--json', description: 'JSON output (NDJSON for streams)' },
  { flag: '--timeout-ms <n>', description: 'request timeout (default 20000)' },
  { flag: '--help', description: 'show help' },
]

export const CLI_TOP_LEVEL_SHORTCUTS = [
  { shortcut: 'login', expands_to: 'auth login' },
  { shortcut: 'logout', expands_to: 'auth logout' },
  { shortcut: 'whoami', expands_to: 'auth whoami' },
  { shortcut: 'health', expands_to: 'status health' },
  { shortcut: 'dashboard', expands_to: 'status dashboard' },
  { shortcut: 'version', expands_to: 'print CLI + Mission Control build info' },
]
