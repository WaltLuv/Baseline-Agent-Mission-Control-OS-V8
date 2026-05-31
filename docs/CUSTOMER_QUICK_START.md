# Mission Control — Customer Quick Start

> Five minutes from signup to your first AI employee.

You don't need a developer for any of this.

---

## 1. Create your account

1. Go to **https://your-mission-control.example.com** (the production URL your operator gave you).
2. Click **"Start free"** on the homepage.
3. Fill in:
   - **Full name** — what should we call you?
   - **Company name** — used as your workspace name. You can rename it later.
   - **Business type** — pick the closest fit. This pre-installs the right AI employees.
   - **Email** + **Password** (minimum 12 characters).
4. Click **Create account**.

You'll be auto-signed-in and routed to the activation sequence (`/app/activate`) for an 8-second cinematic, then dropped into your dashboard (`/app/overview`).

### What got created
| Object | Where to see it |
|---|---|
| **Your workspace** (e.g. `acme-roofing`) | top-left workspace badge |
| **You** as the workspace owner (admin role) | `/app/settings/team` |
| **Pre-installed AI workforce** for your vertical | `/app/agents` |
| **Operator memory** (Obsidian connector) ready to wire | `/app/settings/baseline-os-memory` |

---

## 2. Read today's Executive Briefing

`/app/overview` — landing page. Numbers animate up on mount.

The Executive Briefing tells you in one screen:
- **Value created** this month (in dollars)
- **Hours saved**
- **Today's wins** (closed work)
- **Attention required** (blocked, waiting on approval)
- **Star AI employee** of the week
- **3 COO cards** — highest-ROI employee, overloaded employee, blocked approvals

Click any tile to deep-link into the source data.

---

## 3. Invite your team (optional)

`/app/settings/team` → **Invite member** → enter email + pick role:

| Role | Can do |
|---|---|
| **admin** | Everything you can do |
| **operator** | Day-to-day operations, approvals, runtime checks, no billing |
| **viewer** | Read-only access |

They get an email with a signed link valid for 7 days. They click → set a password → land in your workspace.

> **Workspace isolation is real.** A teammate added to your workspace can never see, query, or modify another workspace's data. Same domain, hard data boundary.

---

## 4. Connect a runtime (your AI employees actually running)

You have three paths depending on where your AI agents live:

### Path A — You don't run agents yet
Skip this step. The demo data + storylines work without runtimes. Your AI workforce is "supervised" in narrative mode until you connect a runtime.

### Path B — You have **OpenClaw / Hermes / Claude Code / Codex** installed somewhere
Mint a runtime API key inside Mission Control:

1. `/app/agents` → click an agent → **API keys** → **Create**.
2. Copy the `mca_…` value — it's shown ONCE.
3. On the machine where your agent runs:

   ```bash
   MC_URL=https://your-mission-control.example.com \
   MC_API_KEY=mca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
   RUNTIME_NAME=hermes-prod-1 \
   RUNTIME_TYPE=hermes \
   node /path/to/connect-runtime.mjs
   ```

   That's it. Mission Control sees the agent as **connected** within 30 seconds.

### Path C — Flight Deck (desktop app)
1. Go to `/flight-deck` on Mission Control.
2. Pick your OS. Follow the install instructions.
3. Open Flight Deck → paste your Mission Control URL → sign in.
4. Flight Deck auto-discovers local runtimes (`claude`, `codex`, etc.) and surfaces their status.

---

## 5. Buy credits (when you're ready)

`/app/billing` → pick a pack → checkout.

- In **test/mock mode** (no Stripe live keys): purchase fulfills instantly, no card charged. Useful for demos.
- In **live mode**: redirects to Stripe Checkout. Card on file required. Webhook fulfills credits within 10 seconds of payment confirmation.

**You'll never get accidentally double-charged.** The webhook idempotency key is signed by Stripe; a replayed webhook returns `replay:true`, balance unchanged.

Turn on **Auto-reload** (toggle on the billing overview) and your AI workforce never stops mid-task on a low-balance ceiling.

---

## 6. Day 2: come back tomorrow

You'll see:
- **Yesterday's wins** on the briefing
- **Memory citations** from your operator notes (if you wired Obsidian / Notion / Pinecone — see Memory Connectors below)
- **AI employee life signals**: which employee is working on what *right now*
- **Today's attention queue** sorted by impact

The product is built so the right people on your team can answer "what got done yesterday" in 4 seconds.

---

## 7. Get help

- **Troubleshooting:** `/docs` → "Troubleshooting Guide" (or `/app/help`).
- **Operator manual:** `/docs/operations/LAUNCH_OPERATOR_PACKAGE.md`.
- **Runtime setup:** `/docs/operations/RUNTIME_SETUP_GUIDE.md`.
- **Email:** your operator's support address (set in `RESEND_FROM`).
