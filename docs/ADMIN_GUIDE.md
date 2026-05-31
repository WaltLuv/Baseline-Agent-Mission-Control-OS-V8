# Mission Control — Admin Guide

What every workspace admin needs to know.

---

## You are an admin if…

`/app/auth/me` returns `role: "admin"`. Workspace owners are minted as admin
on signup. Invited admins are minted as admin when you choose `role: admin`
on the invite.

There are 3 roles:
- **admin** — everything in the workspace
- **operator** — daily ops, approvals, runtimes, no billing changes
- **viewer** — read-only

---

## Managing your team

### Invite

`/app/settings/team` → **Invite member** → email + role.

The system issues a signed URL valid 7 days, hashes its token, and (if a
provider is configured) emails the invitee via Resend / SendGrid / SMTP.
The email body is plain — operators see the same recipient/data their
audit log records.

If no email provider is configured, the API response includes the
`accept_url` and `email_status: "not_sent"` so you can hand-deliver the link.

### Revoke

Same panel → **Revoke** on any pending invite. Acts immediately on the next
accept attempt.

### Change a member's role

Same panel → click member → **Change role**. Takes effect on their next
request.

### Remove a member

Same panel → click member → **Remove**. Sessions tied to that user are
destroyed (`destroyAllUserSessions`) within the next request cycle.

---

## API keys for AI runtimes

`/app/agents` → click agent → **API keys** → **Create**.

- Used by external daemons (Hermes / OpenClaw / Claude Code / Codex) to
  authenticate without a browser cookie.
- Scopes: `viewer`, `operator`, `admin`, `agent:self`, `agent:heartbeat`,
  `agent:messages`, `agent:diagnostics`, `agent:attribution`.
- Default scopes when minting: `viewer` + `agent:self` (least privilege).
- For a heartbeat-only daemon use: `operator` + `agent:self` + `agent:heartbeat`.
- The full `mca_…` value is shown ONCE — copy it.

Operator details: `/docs/operations/RUNTIME_API_KEYS.md`.

---

## Billing

`/app/billing`.

### Test / Mock mode (current state on most environments)

- An amber **"Stripe test/mock mode active"** banner is visible.
- Purchases auto-fulfill instantly. No card is charged. Useful for demos.
- Mock-mode credits are real credits — your workforce executes against them.

### Going live

The host operator must set, on Mission Control's environment:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_LIVE_MODE=true
```

…and add the webhook endpoint
`https://<your-mission-control>/api/stripe/webhook` to your Stripe dashboard
for events `checkout.session.completed` and
`checkout.session.async_payment_succeeded`.

Restart Mission Control. The amber banner disappears. Purchases now redirect
to a real Stripe Checkout page. Webhooks fulfill credits within 10s of
payment confirmation.

### Auto-reload

`/app/billing` → toggle **Auto-reload**.

When ON: if your balance falls below the recommended pack's threshold, MC
auto-purchases the recommended pack (subject to a hard monthly cap, default
$50). Off by default.

### Ledger integrity

`/app/billing` → **AI Workforce Health Score** → "Ledger Verified" indicator.

Mission Control re-computes `balance` from the sum of `ledger entries` every
time the value is displayed. If your displayed balance ever diverges from
the ledger sum, the indicator flips and the workspace freezes new charges
until a daily `recalculateBalance` cron clears it.

---

## Workforce health

`/app/overview` → **AI Workforce Health Score** (8 sub-dimensions, 0–100,
band + reason + fix).

The 8 sub-dimensions:
- execution-health
- responsiveness
- workload-balance
- cost-efficiency
- quality
- memory-continuity
- automation-reliability
- customer-experience

Hover the score for the explanation. Click any sub-dimension for the
"why-changed" trail.

---

## Memory connectors

`/app/settings/baseline-os-memory` — connect Obsidian (operator memory),
Pinecone (semantic knowledge), Notion (business knowledge base).

| Layer | What it gives the AI workforce |
|---|---|
| **Obsidian** | Daily operator notes — "Based on your notes from yesterday…" |
| **Pinecone** | Long-range semantic recall — "similar matters / similar customers" |
| **Notion** | SOPs + doctrine — "according to your Q1 outreach cadence" |

Each connector ingests + chunks + redacts (6 secret patterns: OpenAI /
Anthropic / Stripe / AWS / GitHub PAT / JWT) before writing to MC's local
`workforce_memory` table.

Idempotent. Re-sync drops prior rows for that connector and re-inserts.

---

## Approvals queue

`/app/approvals` — every attention item that needs operator action before
work continues. Surfaced from agent escalations + Baseline OS optimization
signals.

Each row deep-links to the agent that raised it + the memory entry that
explains the rationale.

---

## Audit log

`/app/audit-trail` — every meaningful action: login, signup, invite, role
change, key mint, key revoke, billing event, runtime register, runtime
disconnect, memory connector activity. Append-only, 90-day retention by
default.

---

## Daily routine

A 4-minute admin check (the same one we recommend customers do every morning):

1. `/app/overview` — read briefing. Any attention items?
2. `/app/approvals` — clear anything blocking work.
3. `/app/billing` — balance OK? auto-reload on?
4. `/app/runtime-validation` — all runtimes `connected`?

If those four are clean, your AI workforce is operating without you.

---

## When things go wrong

See `/docs/TROUBLESHOOTING_GUIDE.md`. It covers:
- "I can't log in"
- "Runtime shows disconnected but it's running"
- "Stripe webhook isn't firing"
- "My team can see another workspace's data"  *(spoiler: they can't, that's a misread of the UI)*
- "Mission Control feels slow"
- "I accidentally revoked my own admin role"
