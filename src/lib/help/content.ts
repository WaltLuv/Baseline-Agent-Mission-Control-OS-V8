/**
 * Mission Control — In-App Help Content
 *
 * Single source of truth for the help system. All user-facing guides are
 * derived from this module so the experience is consistent across the
 * help panel, contextual tooltips, the first-run tour, and exported docs.
 *
 * Authoring rules:
 *   • Plain English. No vector DB jargon, no orchestration framework names
 *     in business-owner facing surfaces.
 *   • Each step is actionable: it tells the operator what to do and where.
 *   • Sections are short. If a section exceeds ~120 words, split it.
 *   • Audience-tagged content lets us hide developer details from owners.
 */

export type Audience = 'owner' | 'operator' | 'developer' | 'enterprise'

export interface HelpStep {
  id: string
  title: string
  body: string
  /** Where in the app this action is performed. */
  cta?: { label: string; panel?: string; href?: string }
  audiences?: Audience[]
}

export interface HelpSection {
  id: string
  title: string
  intro?: string
  steps: HelpStep[]
}

export interface ChecklistItemDef {
  id: string
  label: string
  why: string
  actionLabel: string
  /** Internal panel name (resolved by panelHref → /app/<panel>). */
  panel: string
  /**
   * Optional absolute href used when the destination is outside the
   * panel router (e.g. /flight-deck, /marketplace). When set this wins
   * over panel.
   */
  href?: string
  /** Required vs optional — only required items count toward the 100% bar. */
  tier: 'required' | 'optional'
  /**
   * Weight inside the required tier (used to derive the 20/40/60/80/100
   * step model). Total of required weights must sum to 100. Ignored for
   * optional items.
   */
  weight?: number
}

export interface GlossaryTerm {
  term: string
  short: string
  long: string
}

export interface FAQItem {
  q: string
  a: string
}

export interface TroubleshootEntry {
  id: string
  symptom: string
  meaning: string
  likelyCause: string
  fix: string[]
  link?: { label: string; panel?: string; href?: string }
}

export interface TourStep {
  id: string
  title: string
  body: string
  /** CSS selector or data-testid to anchor the spotlight. Optional — falls back to centered modal. */
  anchorTestId?: string
  /** Panel to navigate to before showing this step. */
  panel?: string
}

// ---------------------------------------------------------------------------
// Getting Started — 10 steps
// ---------------------------------------------------------------------------
export const GETTING_STARTED: HelpStep[] = [
  {
    id: 'workspace',
    title: 'Step 1 — Create your workspace',
    body:
      'A workspace is your private command center. It holds your AI employees, your business memory, and the work they do for you. You created one when you first signed in. To check it, open Settings.',
    cta: { label: 'Open Settings', panel: 'settings' },
  },
  {
    id: 'template',
    title: 'Step 2 — Choose your business type',
    body:
      'Mission Control tunes itself to how you operate. Pick the closest match — CPA, law firm, property management, agency, or general — and the system pre-hires the right roles for you. You can change this later.',
    cta: { label: 'Open Onboarding', href: '/onboarding' },
  },
  {
    id: 'employees',
    title: 'Step 3 — Hire or activate AI Employees',
    body:
      'AI Employees do the work. Each one has a real role (e.g. "Bookkeeper", "Lease Specialist") and reports to you. The onboarding wizard hires a starter team. You can add more anytime from the Marketplace.',
    cta: { label: 'Browse Marketplace', href: '/marketplace' },
  },
  {
    id: 'skills',
    title: 'Step 4 — Install skills',
    body:
      'Skills are the capabilities your employees use — for example "Run payroll", "Draft engagement letter", "Send tenant notice". Install the skills you need; assign them to the employee who should own that work.',
    cta: { label: 'Open Skills', panel: 'skills' },
  },
  {
    id: 'memory',
    title: 'Step 5 — Connect memory sources',
    body:
      'Memory is how your AI workforce remembers how your business operates. Connect a markdown vault (Obsidian), a knowledge base (Notion), or a knowledge index — and every employee gains the right context.',
    cta: { label: 'Open Memory', panel: 'memory' },
  },
  {
    id: 'briefing',
    title: 'Step 6 — Review the Executive Briefing',
    body:
      'Open the Overview page each morning. The Executive Briefing tells you what your workforce did, what needs your attention, what value was created, and what to approve. One page. No spreadsheets.',
    cta: { label: 'Open Overview', panel: 'overview' },
  },
  {
    id: 'approvals',
    title: 'Step 7 — Approve, reject, or request changes',
    body:
      'Whenever an AI Employee finishes work that needs human sign-off, it shows up in the Approval Queue. You approve, reject, or send it back with a note. Your decisions feed back into the workforce.',
    cta: { label: 'Open Approvals', panel: 'exec-approvals' },
  },
  {
    id: 'roi',
    title: 'Step 8 — Track value, credits, and ROI',
    body:
      'Workforce Credits are how usage is billed. The ROI Leaderboard shows which skills and employees are saving you the most time and money. Open Billing to monitor cost; open Overview to see ROI.',
    cta: { label: 'Open Billing', panel: 'billing' },
  },
  {
    id: 'runtimes',
    title: 'Step 9 — Connect runtimes',
    body:
      'Runtimes are the engines that actually run the work — Hermes, OpenClaw, and Claude Code. Connect them so Mission Control can see what your employees are doing in real time. See the Runtime Setup Guide.',
    cta: { label: 'Runtime Setup', panel: 'help/runtime-setup' },
  },
  {
    id: 'first-run',
    title: 'Step 10 — Run your first real workflow',
    body:
      'Pick the starter task that was queued during onboarding. Watch an AI Employee pick it up, do the work, and ask for your approval. That is the loop. Once you trust it, scale it.',
    cta: { label: 'Open Tasks', panel: 'tasks' },
  },
]

// ---------------------------------------------------------------------------
// Setup Checklist — items + derivation rules
// ---------------------------------------------------------------------------
/**
 * Setup checklist — Walt's "finish line" mapped to deterministic per-row
 * truth predicates. Five required items, weighted 20/20/20/20/20 → 100%.
 * Optional items improve the experience but never block the 100% bar.
 *
 * Per Walt's P0: NO circular routes (was: template → overview, which is
 * THIS page). NO panel name that doesn't actually resolve. Every CTA
 * goes to either a real /app/<panel> route OR an explicit external href.
 */
export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  // ── Required (sum of weights = 100) ──────────────────────────────
  {
    id: 'workspace',
    label: 'Account created',
    why: 'You\'re signed in to Mission Control. This is the starting line.',
    actionLabel: 'Open Settings',
    panel: 'settings',
    tier: 'required',
    weight: 20,
  },
  {
    id: 'template',
    label: 'Workforce template installed',
    why: 'Property Management, Insurance, or AI Product Launch Team — pick the one that fits your business.',
    actionLabel: 'Choose a template',
    panel: 'activate',
    tier: 'required',
    weight: 20,
  },
  {
    id: 'credentials',
    label: 'Credentials or credits configured',
    why: 'Either save your own API keys (BYOK) or top up Mission Control credits so your workforce can run paid work.',
    actionLabel: 'Open Credentials',
    panel: 'credentials',
    tier: 'required',
    weight: 20,
  },
  {
    id: 'runtime',
    label: 'Runtime connected',
    why: 'Claude Code, Codex, Hermes, OpenClaw — at least one runtime needs to claim work.',
    actionLabel: 'Connect a runtime',
    panel: 'runtimes',
    tier: 'required',
    weight: 20,
  },
  {
    id: 'task',
    label: 'First task queued',
    why: 'Hand your workforce something real. The installed template seeds starter tasks automatically.',
    actionLabel: 'Open Tasks',
    panel: 'tasks',
    tier: 'required',
    weight: 20,
  },
  // ── Optional (do not count toward 100%) ──────────────────────────
  {
    id: 'team',
    label: 'Invite a teammate',
    why: 'Bring in operators and admins so the platform is more than a personal tool.',
    actionLabel: 'Open Team',
    panel: 'team',
    tier: 'optional',
  },
  {
    id: 'google',
    label: 'Connect Google (Drive / Gmail / Calendar)',
    why: 'Lets your workforce read documents and post follow-ups without you forwarding emails.',
    actionLabel: 'Connect Google',
    panel: 'credentials',
    tier: 'optional',
  },
  {
    id: 'flightdeck',
    label: 'Install Flight Deck (desktop terminal)',
    why: 'Native desktop window for either deployment mode. Optional — browser-only is fine.',
    actionLabel: 'Open Flight Deck',
    panel: 'overview',
    href: '/flight-deck',
    tier: 'optional',
  },
  {
    id: 'marketplace',
    label: 'Add a marketplace skill',
    why: 'Premium skills and workflows extend what your workforce can ship.',
    actionLabel: 'Browse Marketplace',
    panel: 'overview',
    href: '/marketplace',
    tier: 'optional',
  },
  {
    id: 'briefing',
    label: 'Daily Brief configured',
    why: 'Your one-page workforce digest — runs automatically once configured.',
    actionLabel: 'Open Overview',
    panel: 'overview',
    tier: 'optional',
  },
]

// ---------------------------------------------------------------------------
// User Guide — sections A through I
// ---------------------------------------------------------------------------
export const USER_GUIDE: HelpSection[] = [
  {
    id: 'basics',
    title: 'A. Mission Control Basics',
    intro: 'The dashboard is built for one thing — operating a calm, productive AI workforce.',
    steps: [
      { id: 'dashboard', title: 'What the dashboard shows', body: 'Overview is your morning page. Top: identity strip and Executive Briefing. Middle: AI Employees and active skills. Bottom: workforce health.' },
      { id: 'briefing', title: 'How to read the Executive Briefing', body: 'It answers four questions: What happened? What needs me? What did we make? What should we do next? If a line has a "review" button, click it.' },
      { id: 'health', title: 'How to use Workforce Health', body: 'A calm signal that tells you whether your workforce is on shift, blocked, or off-shift. Drill in only when something turns yellow.' },
      { id: 'activity', title: 'How to use the Activity Feed', body: 'A live but unhurried log of what each employee is doing. Use it to audit, not to micromanage.' },
      { id: 'tasks', title: 'How to use the Task Board', body: 'Drag work between Inbox, In Progress, Review, and Done. Or let the workforce pull from Inbox automatically.' },
      { id: 'approvals', title: 'How to use the Approval Queue', body: 'Everything that needs your sign-off lands here. Approve, reject, or request changes — with a note.' },
    ],
  },
  {
    id: 'employees',
    title: 'B. AI Employees',
    steps: [
      { id: 'what', title: 'What an AI Employee is', body: 'A named, persistent worker with a role, a set of skills, a memory, and a track record. Not a chatbot — an employee.' },
      { id: 'hire', title: 'How to hire one', body: 'Open Marketplace → choose a role → click Hire. The employee is added to your roster with starter skills attached.' },
      { id: 'trace', title: 'How to read its trace', body: 'Each employee has a trace showing recent work, memory used, and outcomes. The trace is your audit trail.' },
      { id: 'life-signals', title: 'What life signals mean', body: 'A small breathing dot next to each employee. Green = on shift. Amber = waiting on you or a runtime. Grey = off shift.' },
      { id: 'trust', title: 'What trust trajectory means', body: 'A rolling score from approvals, rejections, and outcomes. Trust goes up when work is approved without changes; down when it gets rejected.' },
      { id: 'working-on', title: 'What "working on" means', body: 'The single most recent active task. A short, plain-English sentence. If empty, the employee is idle.' },
      { id: 'escalation', title: 'What escalation means', body: 'When an employee hits a question only you can answer, it escalates. Escalations appear in the Approval Queue and the Briefing.' },
    ],
  },
  {
    id: 'skills',
    title: 'C. Skills',
    steps: [
      { id: 'what', title: 'What skills are', body: 'Reusable, named capabilities — "Send invoice", "Draft engagement letter", "Run payroll". Skills get installed once and attached to employees.' },
      { id: 'install', title: 'How to install skills', body: 'Open Skills or Marketplace → Install. The skill becomes available across your workspace.' },
      { id: 'attach', title: 'How skills attach to employees', body: 'Open an employee → attach skills. Only attached skills appear in that employee\'s trace.' },
      { id: 'roi', title: 'How Skill ROI works', body: 'Each skill earns ROI from real outcomes — time saved, value created, fewer rejections. The leaderboard shows the top earners.' },
      { id: 'status', title: 'What active / warning / inactive mean', body: 'Active = the skill is being used. Warning = it has installed but no work is flowing. Inactive = installed but unused for 14+ days.' },
      { id: 'proven', title: 'What Proven Capability means', body: 'A skill becomes "proven" once it has produced approved outcomes more than once. Proven skills are safer to scale.' },
    ],
  },
  {
    id: 'memory',
    title: 'D. Memory',
    steps: [
      { id: 'operator', title: 'What Operator Memory is', body: 'Notes and decisions you make as the human in charge. Private to you. Used to remember what you have already approved.' },
      { id: 'kb', title: 'What the Business Knowledge Base is', body: 'Your shared knowledge — SOPs, policies, contracts, playbooks. Connected from Notion or Obsidian. Used to brief every employee.' },
      { id: 'intel', title: 'What Knowledge Intelligence is', body: 'A deeper memory used by employees to find relevant past work, decisions, and references. Set up server-side; no jargon required.' },
      { id: 'obsidian', title: 'How Obsidian works', body: 'Point Mission Control at your vault path. Markdown files become memory. Click any citation to open the original note.' },
      { id: 'notion', title: 'How Notion works', body: 'Add a Notion integration token, share pages or a database with it. Mission Control reads those into memory and keeps them in sync.' },
      { id: 'kb-intel', title: 'How Knowledge Intelligence is configured', body: 'Add credentials in Settings → Integrations. Nothing else is exposed to you. The system handles indexing in the background.' },
      { id: 'citations', title: 'What citations mean', body: 'When an AI employee uses memory, the answer shows the source. Click the citation to open the note or page that informed the decision.' },
      { id: 'privacy', title: 'How to protect private memory', body: 'Operator Memory is workspace-scoped and never shared across organizations. Memory connectors honor your source-level permissions.' },
    ],
  },
  {
    id: 'approvals',
    title: 'E. Approvals',
    steps: [
      { id: 'queue', title: 'How the approval queue works', body: 'New items appear at the top. Each item shows what work was done, what memory was used, and what the employee thinks should happen.' },
      { id: 'approve', title: 'Approve work', body: 'Confirms the output is good. The work proceeds. Trust goes up.' },
      { id: 'reject', title: 'Reject output', body: 'Marks the output as wrong. The employee learns from it. Trust goes down.' },
      { id: 'changes', title: 'Request changes', body: 'Send the work back with a note. The employee revises and resubmits. Trust holds.' },
      { id: 'rationale', title: 'Why memory rationale appears', body: 'Memory rationale shows which notes or policies the employee used. It exists so your decision is informed, not opaque.' },
      { id: 'effects', title: 'How approvals affect trust and outcomes', body: 'Every approval, change, or rejection updates the employee\'s trust trajectory and the skill\'s ROI.' },
    ],
  },
  {
    id: 'billing',
    title: 'F. Billing & Workforce Credits',
    steps: [
      { id: 'what', title: 'What Workforce Credits are', body: 'The unit of usage. Credits cover compute, model calls, and runtime time. They are pre-purchased so cost is predictable.' },
      { id: 'charge', title: 'How credits are charged', body: 'Each task, skill event, and runtime second draws a small number of credits. The exact draw is shown next to each event.' },
      { id: 'map', title: 'How AI employee usage maps to billing', body: 'Each employee has a credit footprint. Top employees by credit use are visible in Billing.' },
      { id: 'roi', title: 'How skill events affect value / ROI', body: 'Approved outcomes raise ROI; rejections lower it. ROI is reported per skill and per employee.' },
      { id: 'monitor', title: 'How to monitor cost', body: 'Billing shows balance, recent draws, and projected runway. Set a low-balance alert.' },
    ],
  },
  {
    id: 'runtimes',
    title: 'G. Runtime Connections',
    steps: [
      { id: 'hermes', title: 'Hermes', body: 'Native runtime for Python and JavaScript work. Installs a small hook that streams telemetry back to Mission Control.' },
      { id: 'openclaw', title: 'OpenClaw / Open Code', body: 'Browser and tool runtime. Same hook pattern — installed once, reports actions and outcomes.' },
      { id: 'claude', title: 'Claude Code', body: 'Reporting layer for repo work — files changed, tests run, outcomes, and optional token cost.' },
      { id: 'handshake', title: 'What handshake means', body: 'A first-time exchange between a runtime and Mission Control. After handshake, the runtime is trusted and reports normally.' },
      { id: 'heartbeat', title: 'What heartbeat means', body: 'A periodic "I am alive" signal from the runtime. A missed heartbeat shows as amber. Three missed heartbeats turn the employee off-shift.' },
    ],
  },
  {
    id: 'marketplace',
    title: 'H. Marketplace',
    steps: [
      { id: 'hire', title: 'Hire AI Employees', body: 'Pick a role from the catalog. Hiring adds the employee to your roster with sensible starter skills.' },
      { id: 'install-skills', title: 'Install skills', body: 'Browse skills by category. Install with one click. Then attach to an employee.' },
      { id: 'teams', title: 'Deploy teams', body: 'A team is a pre-built bundle — for example "Bookkeeping team". Deploys multiple employees and skills together.' },
      { id: 'attach', title: 'Attach skills to employees', body: 'After install, open the employee and attach the skill. Only attached skills appear in that employee\'s trace.' },
      { id: 'operational', title: 'How marketplace installs become operational assets', body: 'Every install is a real asset — visible in Skills, billable, and measurable. Nothing in the marketplace is decorative.' },
    ],
  },
  {
    id: 'security',
    title: 'I. Security & Trust',
    steps: [
      { id: 'isolation', title: 'Workspace isolation', body: 'Each workspace runs in its own scope. Memory, employees, skills, and approvals never cross workspaces.' },
      { id: 'memory-priv', title: 'Memory privacy', body: 'Memory connectors honor source permissions. Operator Memory is private to the operator who wrote it.' },
      { id: 'signed-share', title: 'Signed share links', body: 'When you share a briefing externally, the link is signed and time-limited. The recipient sees a read-only snapshot.' },
      { id: 'audit', title: 'Audit trail', body: 'Every approval, change, and runtime event is logged. Audit is available to admins from the Audit panel.' },
      { id: 'no-fake', title: 'No fake live activity', body: 'In live mode, only real telemetry is shown. Demo mode is clearly labeled. We never blend the two.' },
      { id: 'modes', title: 'Demo mode vs live mode', body: 'Demo mode shows realistic example data so you can explore. Live mode shows your real workforce. The toggle is in the header.' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Runtime Setup
// ---------------------------------------------------------------------------
export const RUNTIME_SETUP: HelpSection[] = [
  {
    id: 'hermes',
    title: 'Hermes (Python / JavaScript)',
    intro: 'Native runtime hook. Installs in your project; streams telemetry.',
    steps: [
      { id: 'get', title: '1. Get the hook', body: 'Open Settings → Integrations → Hermes and copy the install command.', audiences: ['developer'] },
      { id: 'install', title: '2. Install in your runtime', body: 'For Python: `pip install mc-hermes`. For Node: `npm install @mc/hermes`.', audiences: ['developer'] },
      { id: 'configure', title: '3. Configure', body: 'Set MC_BASE_URL to your Mission Control URL and MC_API_KEY to your workspace key.', audiences: ['developer'] },
      { id: 'handshake', title: '4. Verify handshake', body: 'Run any task. Mission Control will show "Hermes connected" in the runtime panel.', audiences: ['developer'] },
      { id: 'heartbeat', title: '5. Verify heartbeat', body: 'A green dot appears next to Hermes within 30 seconds. If it stays grey, check API key and base URL.', audiences: ['developer'] },
      { id: 'event', title: '6. Send a test skill event', body: 'POST any skill event to /api/skills/event with your skill id. Confirm it appears in the Skills panel.', audiences: ['developer'] },
      { id: 'trace', title: '7. View the trace', body: 'Open the employee that ran the work. The trace shows the event and the resulting outcome.', audiences: ['developer'] },
    ],
  },
  {
    id: 'openclaw',
    title: 'OpenClaw / Open Code',
    intro: 'Browser and tool runtime hook (JavaScript).',
    steps: [
      { id: 'get', title: '1. Get the JS hook', body: 'Settings → Integrations → OpenClaw. Copy the hook snippet.', audiences: ['developer'] },
      { id: 'install', title: '2. Install in the runtime', body: 'Drop the snippet into your runtime entry. It self-registers on first call.', audiences: ['developer'] },
      { id: 'configure', title: '3. Configure', body: 'Pass MC_BASE_URL and MC_SESSION_TOKEN. Both come from the Integrations panel.', audiences: ['developer'] },
      { id: 'handshake', title: '4. Verify handshake', body: 'A handshake event appears in the Activity Feed within seconds of first call.', audiences: ['developer'] },
      { id: 'action', title: '5. Verify action telemetry', body: 'Run any browser action. The action shows in the Activity Feed with timestamps and outcome.', audiences: ['developer'] },
      { id: 'outcome', title: '6. Verify outcome reporting', body: 'Outcomes (success / partial / failed) appear next to each action and feed into employee trust.', audiences: ['developer'] },
    ],
  },
  {
    id: 'claude',
    title: 'Claude Code',
    intro: 'Reporting layer for repository work.',
    steps: [
      { id: 'setup', title: '1. Set up reporting', body: 'Add the reporting script from Settings → Integrations → Claude Code to your repo root.', audiences: ['developer'] },
      { id: 'repo', title: '2. Configure repo task reporting', body: 'Set the project id in the reporting config so each task is attributed to the right workspace.', audiences: ['developer'] },
      { id: 'files', title: '3. Report files changed', body: 'The hook reports modified file paths after every task completion.', audiences: ['developer'] },
      { id: 'tests', title: '4. Report tests run', body: 'Wire your test command. Pass / fail counts and runtime appear on the task card.', audiences: ['developer'] },
      { id: 'outcome', title: '5. Report outcome', body: 'Tasks resolve as success / partial / failed. The result feeds trust and ROI.', audiences: ['developer'] },
      { id: 'cost', title: '6. Report token / cost (optional)', body: 'If your runtime exposes token counts, the hook forwards them so Billing reflects true cost.', audiences: ['developer'] },
    ],
  },
]

// ---------------------------------------------------------------------------
// Memory Setup
// ---------------------------------------------------------------------------
export const MEMORY_SETUP: HelpSection[] = [
  {
    id: 'obsidian',
    title: 'Obsidian',
    intro: 'Use your existing markdown vault as workforce memory.',
    steps: [
      { id: 'path', title: '1. Choose vault path', body: 'Settings → Integrations → Obsidian. Set the absolute path to your vault.' },
      { id: 'sync', title: '2. Sync markdown', body: 'Click Sync. Mission Control reads your vault and surfaces its notes as Business Knowledge.' },
      { id: 'citations', title: '3. View citations', body: 'When an employee uses a note, the answer shows the file path as a citation.' },
      { id: 'open', title: '4. Open source notes', body: 'Click any citation to open the original markdown file in Obsidian.' },
      { id: 'privacy', title: '5. Privacy rules', body: 'Vault contents stay on disk. Mission Control reads them; it never re-publishes them outside your workspace.' },
    ],
  },
  {
    id: 'notion',
    title: 'Notion',
    intro: 'Connect your Notion workspace as Business Knowledge.',
    steps: [
      { id: 'create', title: '1. Create the Notion integration', body: 'In Notion: Settings → Integrations → New integration. Capture the secret.' },
      { id: 'share', title: '2. Share pages / database', body: 'In Notion, share the pages or database you want Mission Control to read with your new integration.' },
      { id: 'token', title: '3. Add the token', body: 'In Mission Control: Settings → Integrations → Notion. Paste the secret.' },
      { id: 'sync', title: '4. Sync', body: 'Click Sync. Pages appear in your Business Knowledge Base. Delta sync runs in the background.' },
      { id: 'citations', title: '5. View citations', body: 'Employees cite Notion pages by title. Click to open in Notion.' },
      { id: 'disconnect', title: '6. Disconnect', body: 'Settings → Integrations → Notion → Disconnect. Memory references are preserved but no new pages are read.' },
    ],
  },
  {
    id: 'kb-intelligence',
    title: 'Knowledge Intelligence',
    intro: 'A deeper memory layer your workforce uses to find relevant past work.',
    steps: [
      { id: 'key', title: '1. Add the API key', body: 'Settings → Integrations → Knowledge Intelligence. Paste the provider key.' },
      { id: 'namespace', title: '2. Choose index / namespace (server-side)', body: 'Configured by Mission Control automatically. No vector jargon exposed to operators.' },
      { id: 'sync', title: '3. Sync knowledge', body: 'Click Sync. The index hydrates in the background. You will see "Ready" when complete.' },
      { id: 'view', title: '4. View as Knowledge Intelligence', body: 'Memory appears under Knowledge Intelligence — not under any vendor name.' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Troubleshooting
// ---------------------------------------------------------------------------
export const TROUBLESHOOTING: TroubleshootEntry[] = [
  { id: 'no-runtime', symptom: 'Runtime not connected', meaning: 'No runtime hook has reported in.', likelyCause: 'Hook is not installed or env vars are missing.', fix: ['Verify the install command ran without errors.', 'Confirm MC_BASE_URL and MC_API_KEY are set.', 'Re-run the runtime once to trigger a handshake.'], link: { label: 'Runtime Setup', panel: 'help/runtime-setup' } },
  { id: 'no-heartbeat', symptom: 'No heartbeat showing', meaning: 'The runtime registered but stopped sending heartbeats.', likelyCause: 'Network change, process restart, or sleeping container.', fix: ['Restart the runtime process.', 'Check outbound HTTPS access to Mission Control.', 'Confirm the heartbeat task is enabled in the runtime config.'] },
  { id: 'skills-inactive', symptom: 'Skills installed but inactive', meaning: 'No work is flowing to those skills.', likelyCause: 'Skill is not attached to any employee, or no tasks match its trigger.', fix: ['Attach the skill to at least one employee.', 'Create a test task that matches the skill.', 'Check Activity Feed for matching events.'] },
  { id: 'memory-stuck', symptom: 'Memory not syncing', meaning: 'Connector ran but no new memory appeared.', likelyCause: 'Connector token is invalid or no documents are shared with it.', fix: ['Re-validate the token in Settings → Integrations.', 'In the source app, share at least one page with the integration.', 'Re-run Sync.'], link: { label: 'Memory Setup', panel: 'help/memory-setup' } },
  { id: 'briefing-empty', symptom: 'No Executive Briefing data', meaning: 'Briefing has nothing to summarize.', likelyCause: 'No employees have done work yet, or you are in live mode with no live activity.', fix: ['Run the starter task seeded during onboarding.', 'Switch to Demo mode to see example briefings.', 'Confirm at least one runtime is connected.'] },
  { id: 'approvals-empty', symptom: 'Approval queue is empty', meaning: 'No work has been submitted for sign-off.', likelyCause: 'No active workflows yet, or all work was auto-approved.', fix: ['Open Tasks and verify recent tasks completed.', 'Check workflow settings — auto-approve may be on.'] },
  { id: 'credits-stale', symptom: 'Billing credits not updating', meaning: 'Credit balance appears stale.', likelyCause: 'No telemetry has been received recently, or balance fetch is cached.', fix: ['Refresh the Billing panel.', 'Confirm runtimes are reporting (see Activity Feed).', 'Contact support if balance has not moved in 24 h.'] },
  { id: 'demo-vs-live', symptom: 'Demo mode confusion', meaning: 'You are unsure whether data is real or example.', likelyCause: 'Demo mode is active.', fix: ['Look at the demo badge in the header.', 'Switch to Live mode from the header menu.'], link: { label: 'Demo vs Live', panel: 'help/demo-vs-live' } },
  { id: 'no-share', symptom: 'Email / Slack share not configured', meaning: 'Sharing a briefing produced no recipient.', likelyCause: 'Channel credentials are missing.', fix: ['Settings → Integrations → Email or Slack.', 'Add the credentials and re-share.'] },
  { id: 'notion-setup', symptom: 'Notion shows "Setup required"', meaning: 'Integration token missing or invalid.', likelyCause: 'Token not entered, expired, or revoked in Notion.', fix: ['Generate a fresh token in Notion.', 'Paste it into Settings → Integrations → Notion.', 'Click Sync.'], link: { label: 'Memory Setup', panel: 'help/memory-setup' } },
  { id: 'kb-setup', symptom: 'Knowledge Intelligence shows "Setup required"', meaning: 'Provider key missing.', likelyCause: 'You have not added the provider key yet.', fix: ['Settings → Integrations → Knowledge Intelligence.', 'Paste the key and click Sync.'], link: { label: 'Memory Setup', panel: 'help/memory-setup' } },
  { id: 'obsidian-open', symptom: 'Obsidian file cannot open', meaning: 'Citation click did not open the source note.', likelyCause: 'Obsidian is not installed, or the obsidian:// handler is blocked.', fix: ['Install Obsidian if not present.', 'Open the vault once so the handler is registered.', 'Try the citation again.'] },
  { id: 'no-activity-live', symptom: 'No activity in live mode', meaning: 'Live mode is on but nothing is moving.', likelyCause: 'No runtimes connected, or no active work.', fix: ['Confirm a runtime is connected.', 'Run a task to generate activity.', 'Switch to Demo mode if you only want to explore.'] },
]

// ---------------------------------------------------------------------------
// Demo vs Live
// ---------------------------------------------------------------------------
export const DEMO_VS_LIVE = {
  demo: [
    'Realistic example data that mirrors how the system behaves in production.',
    'Safe to explore — no real work is performed, no real money is spent.',
    'Useful for training new operators and walking customers through the product.',
    'Clearly labeled in the header. Demo data never leaks into Live mode.',
  ],
  live: [
    'Real workspace data drawn directly from your runtimes.',
    'Real telemetry — heartbeats, skill events, approvals, outcomes.',
    'Real billing — credits draw down with each event.',
    'Real approvals — your decisions are saved and audit-logged.',
    'No fake activity. If a panel is empty, it is genuinely empty.',
  ],
}

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------
export const GLOSSARY: GlossaryTerm[] = [
  { term: 'Mission Control', short: 'Your AI workforce dashboard.', long: 'The supervision layer where you observe, approve, and steer your AI Employees and their work.' },
  { term: 'Baseline OS', short: 'The brain of the workforce.', long: 'The intelligence layer that holds memory, derives operational truth, and connects skills to employees.' },
  { term: 'AI Employee', short: 'A named worker with a role.', long: 'A persistent worker — not a chatbot — with a real role, a set of skills, a memory, and a track record.' },
  { term: 'Skill', short: 'A reusable capability.', long: 'A named, attachable capability — for example "Send invoice" or "Draft engagement letter".' },
  { term: 'Workforce Credits', short: 'The unit of usage.', long: 'Pre-purchased credits that cover compute, model calls, and runtime time. Drawn down as work is performed.' },
  { term: 'Operator Memory', short: 'Notes only you see.', long: 'Decisions and notes you make as the human operator. Private to your workspace.' },
  { term: 'Business Knowledge Base', short: 'Your shared knowledge.', long: 'SOPs, policies, contracts, and playbooks connected from Notion or Obsidian. Brief every employee.' },
  { term: 'Knowledge Intelligence', short: 'A deeper memory.', long: 'A backing memory that employees use to find relevant past work and decisions. Configured server-side.' },
  { term: 'Runtime', short: 'An execution engine.', long: 'The engine that actually runs the work and reports telemetry — Hermes, OpenClaw, or Claude Code.' },
  { term: 'Hermes', short: 'Python / JS runtime.', long: 'A native runtime hook for Python and JavaScript work. Installs in your project; streams telemetry.' },
  { term: 'OpenClaw', short: 'Browser / tool runtime.', long: 'A runtime hook for browser and tool actions. Reports actions, outcomes, and timing.' },
  { term: 'Open Code', short: 'OpenClaw, in the editor.', long: 'OpenClaw used inside a code editor context. Same hook, same telemetry.' },
  { term: 'Claude Code', short: 'Repository work reporter.', long: 'A reporting layer for repo work — files changed, tests run, outcomes, and optional cost.' },
  { term: 'Heartbeat', short: 'An "I am alive" ping.', long: 'A periodic signal from a runtime. Three missed heartbeats mark the runtime off-shift.' },
  { term: 'Handshake', short: 'First-time check-in.', long: 'The first exchange between a runtime and Mission Control. After handshake, the runtime is trusted.' },
  { term: 'Trace', short: 'An employee\'s record.', long: 'A chronological log of an employee\'s recent work, memory used, and outcomes.' },
  { term: 'Approval Queue', short: 'Where you sign off.', long: 'A queue of work items waiting for human approval, rejection, or change requests.' },
  { term: 'Skill ROI', short: 'Value per skill.', long: 'A leaderboard of skills ranked by approved outcomes, time saved, and value created.' },
  { term: 'Proven Capability', short: 'A trusted skill.', long: 'A skill with more than one approved outcome. Safer to scale.' },
  { term: 'Demo Mode', short: 'Example data.', long: 'A mode that shows realistic example data so you can explore without real work being performed.' },
  { term: 'Live Mode', short: 'Real data.', long: 'A mode that shows real workspace data — your runtimes, your approvals, your billing.' },
]

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------
export const FAQ: FAQItem[] = [
  { q: 'Is my data private?', a: 'Yes. Each workspace is isolated. Memory connectors honor source permissions, and Operator Memory never leaves your workspace.' },
  { q: 'What happens if I run out of credits?', a: 'Your workforce pauses gracefully. No tasks are lost; runtimes resume when credits are topped up.' },
  { q: 'Can I run Mission Control on my own server?', a: 'Yes. Mission Control is self-hostable. See the Deployment guide.' },
  { q: 'Do I have to be technical to use this?', a: 'No. The business owner experience is plain-English. Technical setup is only needed for runtimes and integrations.' },
  { q: 'How is this different from a chatbot?', a: 'A chatbot answers questions. An AI Employee does work, remembers decisions, asks for approval, and is measured on outcomes.' },
  { q: 'Why are some skills "warning" or "inactive"?', a: 'Warning means installed but unused; inactive means unused for 14+ days. Attach the skill to an employee or remove it.' },
  { q: 'Why are there citations on every answer?', a: 'So your decisions are informed, not opaque. Click any citation to open the source.' },
  { q: 'Can I see what an AI Employee did last week?', a: 'Yes. Open the employee and view its trace. The audit trail covers every action, approval, and outcome.' },
  { q: 'How do I switch between Demo and Live?', a: 'Toggle is in the header. The badge always tells you which mode you are in.' },
]

// ---------------------------------------------------------------------------
// First-run tour
// ---------------------------------------------------------------------------
export const TOUR_STEPS: TourStep[] = [
  { id: 'briefing', title: 'This is your Executive Briefing', body: 'A morning summary of what your workforce did and what needs your attention.', anchorTestId: 'executive-briefing', panel: 'overview' },
  { id: 'employees', title: 'These are your AI Employees', body: 'Each one has a role, skills, memory, and a trust score. Click any employee to see its trace.', anchorTestId: 'ai-employee-life-roster' },
  { id: 'working-on', title: 'This is what they are working on', body: 'A single, plain-English sentence per employee. Empty means idle. Amber means waiting on you.', anchorTestId: 'ai-employee-life-roster' },
  { id: 'approvals', title: 'This is your approval queue', body: 'Everything that needs human sign-off lands here. Approve, reject, or request changes.', panel: 'exec-approvals' },
  { id: 'memory', title: 'This is how memory influences decisions', body: 'Every answer carries citations. Click any to open the source note or page.', panel: 'memory' },
  { id: 'roi', title: 'This is your Skill ROI', body: 'The leaderboard shows which skills are creating the most value.', anchorTestId: 'skills-active-inventory', panel: 'overview' },
  { id: 'credits', title: 'This is your Workforce Credits', body: 'Credits power the workforce. Top up to keep your team on shift.', panel: 'billing' },
  { id: 'marketplace', title: 'This is where you hire more employees', body: 'Browse roles and teams. Hire with one click.', panel: 'overview' },
  { id: 'runtimes', title: 'This is where you connect runtimes', body: 'Connect Hermes, OpenClaw, or Claude Code so real work flows in.', panel: 'help/runtime-setup' },
  { id: 'value', title: 'This is where you track value created', body: 'Value is reported per skill, per employee, and per workspace. No fake numbers.', panel: 'overview' },
]

// ---------------------------------------------------------------------------
// Contextual help blocks (used by HelpTooltip)
// ---------------------------------------------------------------------------
export interface ContextualHelp {
  what: string
  why: string
  next: string
  link?: { label: string; panel?: string }
}

export const CONTEXTUAL_HELP: Record<string, ContextualHelp> = {
  'executive-briefing': {
    what: 'A morning summary of what your workforce did and what needs your attention.',
    why: 'One page replaces a stack of reports. It is the only screen you must read each day.',
    next: 'Skim the four lines. Click any "review" link to act on what needs you.',
    link: { label: 'Mission Control basics', panel: 'help/user-guide' },
  },
  'workforce-health': {
    what: 'A calm signal — on shift, blocked, or off-shift — for the whole workforce.',
    why: 'It tells you when you need to look, not what to look at.',
    next: 'If a line turns amber, click it to drill in.',
    link: { label: 'Read more', panel: 'help/user-guide' },
  },
  'ai-employee-card': {
    what: 'A named worker with a role, skills, memory, and a trust trajectory.',
    why: 'An employee — not a chatbot — is responsible for outcomes you measure.',
    next: 'Click to open its trace, attach a skill, or send work.',
    link: { label: 'About AI Employees', panel: 'help/user-guide' },
  },
  'employee-trace': {
    what: 'A chronological log of one employee\'s recent work, memory used, and outcomes.',
    why: 'It is the audit trail. Every decision is traceable.',
    next: 'Scroll the trace. Click any citation to open the source.',
  },
  'skill-roi': {
    what: 'A leaderboard of skills ranked by approved outcomes and time saved.',
    why: 'It tells you what is creating value so you can scale the right capabilities.',
    next: 'Look at the top three. Attach those skills to more employees if it makes sense.',
  },
  'skills-active-inventory': {
    what: 'All skills installed in your workspace and how they are doing.',
    why: 'Inactive skills are dead weight. Active skills are running your business.',
    next: 'Promote, attach, or remove based on status.',
  },
  'collaboration-graph': {
    what: 'How your AI Employees hand off work to each other.',
    why: 'Healthy collaboration means work flows; isolated employees usually means a missing skill or memory.',
    next: 'Look for orphan employees. Attach a skill to bring them into the workflow.',
  },
  'approval-queue': {
    what: 'Work items waiting for human sign-off.',
    why: 'Approvals are the loop that builds trust and keeps you in control.',
    next: 'Approve, reject, or request changes. Each decision feeds back.',
  },
  'memory-feed': {
    what: 'Recent additions to your workforce memory — notes, decisions, citations.',
    why: 'It is how you confirm that the right knowledge is reaching the right employees.',
    next: 'Click any item to open its source.',
  },
  'memory-settings': {
    what: 'Where you connect Obsidian, Notion, and Knowledge Intelligence.',
    why: 'Without connected memory, your workforce works blind.',
    next: 'Connect at least one source.',
    link: { label: 'Memory setup', panel: 'help/memory-setup' },
  },
  'billing': {
    what: 'Workforce Credits — balance, recent draws, projected runway.',
    why: 'Credits keep the workforce on shift. Visibility prevents surprises.',
    next: 'Set a low-balance alert. Top up if runway is short.',
  },
  'runtime-connections': {
    what: 'The engines that actually run the work — Hermes, OpenClaw, Claude Code.',
    why: 'Without a runtime connected, nothing executes.',
    next: 'Open the Runtime Setup Guide and connect one.',
    link: { label: 'Runtime setup', panel: 'help/runtime-setup' },
  },
  'marketplace': {
    what: 'Hire AI Employees, install skills, and deploy teams.',
    why: 'Everything here becomes a real, billable asset in your workforce.',
    next: 'Hire one role. Install one skill. Attach.',
  },
}

// ---------------------------------------------------------------------------
// Help index / search corpus
// ---------------------------------------------------------------------------
export interface HelpIndexEntry {
  id: string
  title: string
  panel: string
  keywords: string
}

export const HELP_INDEX: HelpIndexEntry[] = [
  { id: 'getting-started', title: 'Getting Started', panel: 'help/getting-started', keywords: 'setup workspace hire employees skills memory approve roi credits runtime first task onboarding' },
  { id: 'user-guide', title: 'User Guide', panel: 'help/user-guide', keywords: 'briefing health activity tasks approvals employees skills memory billing runtimes marketplace security' },
  { id: 'runtime-setup', title: 'Runtime Setup', panel: 'help/runtime-setup', keywords: 'hermes openclaw claude code hook install handshake heartbeat telemetry' },
  { id: 'memory-setup', title: 'Memory Setup', panel: 'help/memory-setup', keywords: 'obsidian notion knowledge intelligence vault token sync citation' },
  { id: 'demo-vs-live', title: 'Demo vs Live Mode', panel: 'help/demo-vs-live', keywords: 'demo live mode example real data billing safe explore' },
  { id: 'troubleshooting', title: 'Troubleshooting', panel: 'help/troubleshooting', keywords: 'no heartbeat runtime not connected skill inactive memory not syncing briefing empty credits stale' },
  { id: 'glossary', title: 'Glossary', panel: 'help/glossary', keywords: 'definition mission control baseline os ai employee skill credits memory runtime hermes openclaw claude' },
  { id: 'faq', title: 'FAQ', panel: 'help/faq', keywords: 'privacy data credits self host technical chatbot warning inactive citation trace switch' },
]
