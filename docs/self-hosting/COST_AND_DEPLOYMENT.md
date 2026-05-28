# Self-Hosting & Cost Clarity

> Audience: prospective buyers and procurement asking "what runs where, and
> what does it actually cost?"

## TL;DR

**Mission Control runs on your infra. Token costs come from the AI
employees, not the dashboard.**

| Component | Where it runs | Token cost |
| --- | --- | --- |
| Mission Control (dashboard, billing, briefing, marketplace, settings) | Your VPS / on-prem / desktop | **$0 — zero LLM tokens consumed** |
| Baseline OS (intelligence layer that powers Daily Optimization, Workforce Health Score, AI Employee identity, Memory Graph) | Same process as Mission Control | $0 itself; ~$0.001–$0.05 per recommendation only when it calls an embedding model on your behalf |
| AI Employees (Hermes brain, OpenClaw operator, Claude Code engineer, framework adapters) | Wherever you want — same VPS, separate VPS, desktop, edge | **Their** LLM calls — passed through `POST /api/tokens` so Mission Control can show retail-marked-up usage and credit-deduct your workspace |

## What this means for pricing conversations

- **"What if I get hit with a massive bill?"** You won't from Mission
  Control itself — it does not call an LLM in any of its UI surfaces.
  Every paid call is initiated by an AI Employee you deployed, against a
  workspace credit balance with a configurable hard cap.
- **"Can I self-host?"** Yes. Mission Control is Next.js 16 + SQLite. It
  ships as a single container. No managed cloud dependency is required.
  See `/app/EMERGENT_HANDOFF.md` for the production runbook.
- **"What needs cloud?"** Only the integrations you opt into: Stripe (live
  payments), Pinecone (Knowledge Intelligence), Notion (Business
  Knowledge Base), Slack/Email (briefing share). All are optional.

## Architecture diagram (text form)

```
┌─────────────────────────────────────────────────────────────────────┐
│  YOUR VPS / DESKTOP                                                 │
│                                                                     │
│  ┌─────────────────────┐         ┌──────────────────────┐           │
│  │  Mission Control    │ ◀────── │  Baseline OS         │           │
│  │  (Next.js + SQLite) │         │  (intelligence)      │           │
│  │  ZERO TOKEN COST    │         │  ~$0 unless embed    │           │
│  └──────────┬──────────┘         └──────────────────────┘           │
│             │                                                       │
│             │ workspace-scoped phone-home API                       │
│             ▼                                                       │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              │ ─── any infra you want ───
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AI EMPLOYEES (Hermes · OpenClaw · Claude Code · adapters)          │
│  These call LLMs · they report cost back via /api/tokens            │
└─────────────────────────────────────────────────────────────────────┘
```

## Self-hosted quickstart

```
git clone https://github.com/WaltLuv/baseline-united-mission-control
cd baseline-united-mission-control
cp .env.example .env.local                   # set AUTH_USER + AUTH_PASS
pnpm install
pnpm tsx scripts/seed-billing-data.ts        # one-time
pnpm tsx scripts/seed-demo-workspace.ts --all
pnpm dev                                     # localhost:3000
```

Go to **Settings → Baseline OS Memory** to optionally connect Pinecone,
Notion, or Obsidian. Each is independently optional.

## Production go-live checklist

Same as Mission Control's existing go-live runbook:

1. Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` +
   `NEXT_PUBLIC_STRIPE_LIVE_MODE=true` (or leave unset to stay in safe
   mock mode).
2. Add the Stripe webhook URL `https://<host>/api/stripe/webhook`.
3. Set `SHARE_SIGNING_SECRET` (long random) so signed briefing shares are
   tamper-proof.
4. (Optional) connect Pinecone / Notion / Obsidian if you want Baseline
   OS to draw on those layers.
5. Deploy AI Employees on whatever infra suits each role.

Mission Control will keep running, displaying live cost, even if every
external connector is disabled. It's the dashboard. It doesn't depend on
clouds to keep showing you your workforce.
