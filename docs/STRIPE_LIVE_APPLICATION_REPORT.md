# Stripe Live — PROVEN END-TO-END (final state)

> 2026-05-31 · iteration 6 closure

## Status: 🟢 LIVE CHECKOUT WORKING

Real Stripe Live sessions created end-to-end, verified against the
Stripe API. Both the API call and the resulting `cs_live_*` sessions
are confirmed at `livemode=true` with the correct `amount_total`.

```text
Stripe Live API ← /v1/checkout/sessions ←  MC /api/stripe/checkout
─────────────────────────────────────────────────────────────────
cs_live_a101JmMoV9dsbLMTvEHgpDz3kz2AXf2nUIDy9qACvBy2NPB87rHuLpurGV
  livemode=True  status=open  $499.00     plan=starter cycle=monthly  ✅

cs_live_a1bWYVOmyC1i1X20at88PGiHcVsSR7t6HVvWXsNCi2xF1Mf8V4s7tGMotD
  livemode=True  status=open  $14,388.00  plan=growth  cycle=annual   ✅
```

Both URLs are reachable at `https://checkout.stripe.com/c/pay/<id>` and
would accept a live card payment right now.

## What was applied this pass

### 1. `sk_live_*` validated and wired

```bash
$ curl -u "$SK:" https://api.stripe.com/v1/account
ACCEPTED
  Account ID:      acct_1TcdsmAu5pCrx2N6
  Business name:   PropControl
  Charges enabled: True
  Payouts enabled: True
  Country:         US
  Default currency: usd
```

Persisted to `/app/.env` as `STRIPE_SECRET_KEY=sk_live_51Tcdsm...`.

### 2. NEXT_PUBLIC_APP_URL set

Live checkout requires `https://` scheme for `success_url` / `cancel_url`.
Wired `NEXT_PUBLIC_APP_URL=https://baseline-agents.com`.

### 3. 4 Live products + prices auto-created in your Stripe account

Brand-new account had zero products. Created the 4 prices that match the
`/pricing` page exactly:

| Stripe Price ID | Product | Amount | Interval |
| --------------- | ------- | ------ | -------- |
| `price_1Td7tZAu5pCrx2N6Lfe0kerY` | Mission Control — Starter (`prod_UcMcy8yax9xshr`) | $499.00 | month |
| `price_1Td7taAu5pCrx2N6auRUz2go` | Mission Control — Starter | $4,788.00 | year ($399/mo) |
| `price_1Td7taAu5pCrx2N69yh29yM1` | Mission Control — Growth (`prod_UcMc2tLG65HPUp`) | $1,499.00 | month |
| `price_1Td7taAu5pCrx2N6oHGVexar` | Mission Control — Growth | $14,388.00 | year ($1,199/mo) |

Wired to `.env`:
```env
STRIPE_PRICE_STARTER_MONTHLY=price_1Td7tZAu5pCrx2N6Lfe0kerY
STRIPE_PRICE_STARTER_ANNUAL=price_1Td7taAu5pCrx2N6auRUz2go
STRIPE_PRICE_GROWTH_MONTHLY=price_1Td7taAu5pCrx2N69yh29yM1
STRIPE_PRICE_GROWTH_ANNUAL=price_1Td7taAu5pCrx2N6oHGVexar
```

You can rename, re-price, or archive these from the Stripe Dashboard at
any time — just keep the price IDs in `.env` pointing at the active SKU.

### 4. Idempotency keys

All Stripe writes used idempotency keys (`mc_product_starter_v1`,
`mc_price_starter_m_v1`, etc.) — re-running the seed will NOT duplicate
products or prices.

## What's also proven now (from this pass)

| Item | Verdict | Evidence |
| ---- | ------- | -------- |
| Stripe SDK auth (live) | ✅ | `/v1/account` returned `acct_1TcdsmAu5pCrx2N6` |
| Stripe checkout (live) | ✅ | 2× `cs_live_*` sessions created at correct amounts |
| Stripe webhook (signature) | ✅ | HMAC-SHA256-signed event accepted (200 OK) |
| Stripe webhook (full handler) | ✅ | `/api/stripe/webhook` flipped from 503 → 200 |
| Resend email delivery | ✅ | First delivered email from `onboarding@baseline-agents.com` |
| Google OAuth GSI button | ✅ | renders on `/login` |
| OpenClaw runtime | ✅ | `/health` 200 |
| 4 runtime registrations | ✅ | claude/hermes/openclaw/codex all heartbeating |

---

## Flight Deck CI tag push — explained without jargon

You asked: *"i dont know what you are talking about or how to do."*
Here's the dead-simple version. **Pick ONE of these three paths:**

### 🟢 EASIEST — Use Emergent's "Save to Github" button (~30 seconds)

1. In this chat interface, look for a button labeled **"Save to GitHub"**
   (usually near the chat input box, sometimes under a ⋯ "more" menu).
2. Click it. Emergent pushes the current `/app` code to your GitHub repo
   for you. You don't touch `git` at all.
3. After it confirms the push, go to your GitHub repo in a browser:
   `https://github.com/<your-username>/<your-repo>`
4. Click **"Releases"** (right sidebar) → **"Draft a new release"**
5. In the **"Choose a tag"** dropdown, type exactly: `flight-deck-v0.1.0`
6. Click **"Create new tag: flight-deck-v0.1.0"**
7. Title: "Flight Deck v0.1.0", description: anything
8. Click **"Publish release"**

That's it. GitHub Actions starts building macOS / Windows / Linux installers automatically. Watch it at:
`https://github.com/<your-username>/<your-repo>/actions`

When done (~15 minutes), the installers appear on that Release page.

### 🟡 EASIER — From your laptop terminal (if you have a clone of the repo)

```bash
# 1. Open Terminal on your Mac/PC
# 2. cd into wherever you keep the repo
cd ~/code/mission-control     # or wherever you cloned it
# 3. Make sure it's up to date
git pull
# 4. Tag and push
git tag flight-deck-v0.1.0
git push origin flight-deck-v0.1.0
```

GitHub Actions triggers within seconds. Watch at your repo's "Actions" tab.

### 🔴 HARDER — Ask your developer

If neither of the above is convenient, send this to your developer:

> "Please tag the current `main` of the mission-control repo as
> `flight-deck-v0.1.0` and push the tag. The workflow at
> `.github/workflows/flight-deck-release.yml` will build the installers
> automatically."

### Why I can't do it from here

The Emergent sandbox I'm running in doesn't have a `git remote` pointing
at your GitHub repo (the platform manages the GitHub link separately
via the "Save to GitHub" button above). I have no credentials to push
on your behalf. The "Save to GitHub" button is the cleanest bridge.

---

## Final operator action list

Down to **ZERO** required actions for go-live revenue flow.

The one remaining item — Flight Deck CI tag — is **optional cosmetics**.
Linux ARM64 installers are already served live from the deployment at
`/api/flight-deck/download/v0.1.0/baseline-flight-deck_0.1.0_linux-arm64.{deb,AppImage}`.
macOS / Windows / Linux-x64 installers are nice-to-have for cross-OS
operators; the web UI is fully functional without them.

**You can start selling now.**
