'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

// Customer Success Center — searchable, single-page help index.
//
// Intentionally NOT a CMS. The articles are inline so they ship with the
// build and are reviewable in code. Search is client-side and works
// against title + body + tag tokens.

type Article = {
  id: string
  category: 'getting-started' | 'runtimes' | 'flight-deck' | 'team' | 'billing' | 'troubleshooting'
  title: string
  tags: string[]
  body: string // plain text / markdown-lite
}

const CATEGORIES: Array<{ id: Article['category']; label: string }> = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'runtimes', label: 'Runtime Setup' },
  { id: 'flight-deck', label: 'Flight Deck' },
  { id: 'team', label: 'Invite Team' },
  { id: 'billing', label: 'Billing' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
]

const ARTICLES: Article[] = [
  {
    id: 'first-10-minutes',
    category: 'getting-started',
    title: 'Your first 10 minutes',
    tags: ['onboarding', 'welcome', 'start'],
    body: `Mission Control already pre-configured your workspace at signup — AI employees, skills, and a starter task are queued.

Three steps to activate:
1. Open /app/activate (it's already loaded after signup).
2. Connect a runtime — pick Claude, Codex, OpenClaw, or Hermes and paste the generated command on the host where the runtime runs.
3. Invite one teammate by email.

That's it. You can return to /app/activate at any time to resume skipped steps.`,
  },
  {
    id: 'what-is-a-runtime',
    category: 'runtimes',
    title: 'What is a "runtime" and why do I need one?',
    tags: ['runtime', 'claude', 'codex', 'hermes', 'openclaw'],
    body: `A runtime is the actual AI worker that does the work. Mission Control supervises runtimes; it does not contain them.

Supported runtimes:
- Claude Code — Anthropic's coding agent. Best for thoughtful refactors, PR drafting, code review.
- Codex — OpenAI's coding agent. Fast code generation, migrations.
- OpenClaw / OpenCode — self-hosted execution runtime. Run on your own infrastructure.
- Hermes — orchestration runtime. Drives scheduled pipelines and memory/knowledge ops.

You don't have to pick one forever. Start with whatever's installed on your laptop or server today, connect it via /app/activate, and add more later.`,
  },
  {
    id: 'connect-runtime',
    category: 'runtimes',
    title: 'Connect a runtime (Claude / Codex / OpenClaw / Hermes)',
    tags: ['runtime', 'connect', 'api-key'],
    body: `1. Sign in to Mission Control.
2. Open /app/activate.
3. Click "Connect a runtime" and pick the runtime type.
4. Click "Generate API key + command".
5. Mission Control creates a one-time API key bound to a fresh agent record. Copy the command shown.
6. SSH or open a terminal on the host where the runtime runs. Paste the command.
7. Within ~30 seconds, the wizard's status flips from "Waiting for heartbeat" to "Connected — heartbeat received."

The API key is shown ONCE. Save it now; you can mint a new one any time if lost.

Per-runtime daemon notes:
- The command is identical for all 4 runtimes — only RUNTIME_TYPE changes.
- Wrap it in systemd / supervisor / pm2 to keep it running across reboots.
- See docs/RUNTIME_SETUP_GUIDE.md for production deployment templates.`,
  },
  {
    id: 'flight-deck-install',
    category: 'flight-deck',
    title: 'Install Flight Deck (optional desktop wrapper)',
    tags: ['flight-deck', 'install', 'desktop', 'tauri'],
    body: `Flight Deck is the optional desktop wrapper for Mission Control. Operators who don't want to type the URL each time can use it as a native bookmark + window.

1. Visit /flight-deck while signed in.
2. Find your OS + arch in the "Platform status" list.
3. If your platform shows AVAILABLE → click Download. Otherwise the page tells you how to build locally or push the release tag.
4. Install:
   - Linux .deb:     sudo dpkg -i baseline-flight-deck_0.1.0_linux-<arch>.deb
   - Linux .AppImage: chmod +x baseline-flight-deck_0.1.0_linux-<arch>.AppImage && ./baseline-flight-deck_*.AppImage
   - macOS .dmg:     double-click → drag to Applications. First launch: right-click → Open (unsigned dev build).
   - Windows .msi:   double-click. SmartScreen "More info → Run anyway" (unsigned dev build).

Configure on first launch:
- Mission Control URL: https://baseline-agents.com (or your deployment URL)
- Sign in via the embedded browser window
- Choose default workspace from the dropdown

Settings persist across restarts. If your settings don't stick, see Troubleshooting → "Flight Deck won't save settings."`,
  },
  {
    id: 'invite-team',
    category: 'team',
    title: 'Invite a teammate',
    tags: ['team', 'invite', 'role'],
    body: `From /app/activate (or any time later from /app/team):
1. Enter your teammate's email.
2. Pick a role:
   - Operator — day-to-day. Tasks, agents, billing read.
   - Admin — invite, billing change, mint API keys.
   - Viewer — read-only.
3. Click "Send invite". They receive an email with a one-click join link, valid for 7 days.

You can revoke an unaccepted invite any time from /app/team. Accepted invites become full members and can only be removed by an admin.`,
  },
  {
    id: 'plain-english-billing',
    category: 'billing',
    title: 'What you pay and what you get',
    tags: ['billing', 'plan', 'starter', 'growth', 'pricing'],
    body: `Two paid plans plus an annual discount.

Starter — $499 per month, or $399/month when billed annually.
- Up to 3 AI employees
- 1 workspace
- ~5,000 credits per month (enough for ~150 customer-facing AI runs at typical sizes)
- Email + Help Center support
- Best for: owner-operators, agencies of 1–3 people.

Growth — $1,499 per month, or $1,199/month when billed annually.
- Up to 15 AI employees
- 5 workspaces
- ~25,000 credits per month
- Priority support
- Best for: teams of 5–25, multiple business lines.

What is a "credit"? It's the underlying token cost for AI work, abstracted into a flat number so you don't have to track GPT vs Claude pricing. One credit ≈ ~$0.005 of AI inference at retail rates. We add a fixed margin and pass through everything else.

Credits do not expire month-over-month if you stay subscribed. If you cancel, unused credits roll for 60 days then expire.

Annual customers get 20% off and lock pricing for the year. Cancel any time, no penalty — we refund the unused months at the monthly rate.

Enterprise pricing is custom — book a call from /pricing.`,
  },
  {
    id: 'first-task-not-running',
    category: 'troubleshooting',
    title: "My starter task isn't running",
    tags: ['troubleshoot', 'task', 'starter'],
    body: `The starter task is queued in your workspace but won't execute until at least one runtime is connected.

Check:
1. /app/activate — is "Connect a runtime" marked done? If not, connect one.
2. /app/agents — is at least one AI employee status "active"?
3. /app/team — are you on the correct workspace?

If all three look correct and the task still hasn't moved after 5 minutes, run \`mc runtime doctor\` from the CLI (or visit /app/agents/diagnostics) to surface the exact reason.`,
  },
  {
    id: 'flight-deck-no-save',
    category: 'troubleshooting',
    title: "Flight Deck won't save my settings",
    tags: ['flight-deck', 'settings', 'config'],
    body: `Flight Deck persists settings to your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service).

If settings don't stick:
- macOS — make sure Flight Deck has Keychain access. System Settings → Privacy & Security → Keychain → enable.
- Linux — install \`libsecret\` and \`gnome-keyring\` (\`sudo apt install libsecret-1-0 gnome-keyring\`).
- Windows — if running inside a Citrix or RDS session, Credential Manager may be locked; talk to your IT admin.

Last resort: delete the Flight Deck config file (\`~/.config/baseline-flight-deck/\` on Linux, \`~/Library/Application Support/baseline-flight-deck/\` on macOS) and re-configure.`,
  },
  {
    id: 'stripe-failed',
    category: 'troubleshooting',
    title: 'Checkout failed / payment declined',
    tags: ['stripe', 'billing', 'payment'],
    body: `Stripe handles payment processing. If checkout fails:
1. The error message in the checkout page is the verbatim Stripe response — that's the authoritative reason.
2. Most common: insufficient funds, card requires 3D Secure, or country mismatch.
3. Retry with a different card from /pricing → "Get Started".
4. If you keep hitting a wall, email hello@baseline-agents.com with the time of the attempt and the email on your Mission Control account. We can look up the Stripe attempt by metadata.`,
  },
]

export default function HelpCenterPage() {
  const [query, setQuery] = useState('')
  const [openCategory, setOpenCategory] = useState<Article['category'] | 'all'>('all')
  const [openArticle, setOpenArticle] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ARTICLES.filter((a) => {
      if (openCategory !== 'all' && a.category !== openCategory) return false
      if (!q) return true
      const hay = `${a.title} ${a.body} ${a.tags.join(' ')}`.toLowerCase()
      return q.split(/\s+/).every((tok) => hay.includes(tok))
    })
  }, [query, openCategory])

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased" data-testid="help-center">
      <header className="border-b border-white/[0.06] backdrop-blur-xl bg-[#09090b]/70">
        <div className="mx-auto max-w-screen-lg px-6 h-16 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <span>Baseline Mission Control</span>
          </Link>
          <nav className="flex gap-5 text-sm text-white/55">
            <Link href="/app/activate" className="hover:text-white" data-testid="help-nav-activate">Activation</Link>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/flight-deck" className="hover:text-white">Flight Deck</Link>
            <a href="mailto:hello@baseline-agents.com" className="hover:text-white">Email us</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-screen-lg px-6 py-12 md:py-16">
        <section className="mb-10">
          <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono mb-2">Customer Success Center</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">How can we help?</h1>
          <p className="mt-3 text-white/55 max-w-2xl leading-relaxed">
            Setup guides, runtime connection steps, Flight Deck installation, team invites, billing in plain English, and a troubleshooting bench.
          </p>
        </section>

        <section className="mb-8">
          <input
            type="search"
            data-testid="help-search"
            placeholder="Search the help center…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 px-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-400/40"
          />
        </section>

        <section className="mb-6 flex flex-wrap gap-2" data-testid="help-categories">
          <button
            type="button"
            onClick={() => setOpenCategory('all')}
            data-testid="help-cat-all"
            className={`text-xs uppercase tracking-wider font-mono px-3 py-1.5 rounded-full border transition-colors ${
              openCategory === 'all'
                ? 'border-violet-400/40 bg-violet-500/10 text-violet-200'
                : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:text-white'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setOpenCategory(c.id)}
              data-testid={`help-cat-${c.id}`}
              className={`text-xs uppercase tracking-wider font-mono px-3 py-1.5 rounded-full border transition-colors ${
                openCategory === c.id
                  ? 'border-violet-400/40 bg-violet-500/10 text-violet-200'
                  : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </section>

        <section className="space-y-3" data-testid="help-articles">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-white/55">
              Nothing matches "{query}". Email <a className="text-violet-300 hover:text-violet-200" href="mailto:hello@baseline-agents.com">hello@baseline-agents.com</a> and we'll write the article.
            </div>
          )}
          {filtered.map((a) => {
            const open = openArticle === a.id
            return (
              <article
                key={a.id}
                data-testid={`help-article-${a.id}`}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenArticle(open ? null : a.id)}
                  data-testid={`help-toggle-${a.id}`}
                  className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-white/[0.02]"
                >
                  <div>
                    <h3 className="text-base font-semibold text-white">{a.title}</h3>
                    <p className="text-xs uppercase tracking-wider font-mono text-white/45 mt-0.5">
                      {CATEGORIES.find((c) => c.id === a.category)?.label}
                    </p>
                  </div>
                  <span className={`text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
                </button>
                {open && (
                  <div className="px-4 pb-4">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-white/80 font-sans">
                      {a.body}
                    </pre>
                  </div>
                )}
              </article>
            )
          })}
        </section>

        <section className="mt-12 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <p className="text-white/55">Still stuck? Email us at{' '}
            <a href="mailto:hello@baseline-agents.com" className="text-violet-300 hover:text-violet-200">
              hello@baseline-agents.com
            </a>{' '}
            — we reply within one business day, US-Eastern.
          </p>
        </section>
      </main>
    </div>
  )
}
