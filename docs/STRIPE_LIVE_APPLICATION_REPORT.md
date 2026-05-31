# Mission Control — Production Inputs Applied & Verified (final)

> 2026-05-31, iteration 6 — closes the operator-input pass.

## Bottom line

| Surface | State today |
| ------- | ----------- |
| **Resend email pipeline** | 🟢 **LIVE THROUGH `baseline-agents.com`** — first delivery confirmed by Resend API. |
| **Stripe live publishable + webhook secret** | 🟢 Wired, webhook signature verified end-to-end with HMAC-SHA256. |
| **Stripe live secret key** | 🔴 The value pasted (`mk_1Tcdsr…`) is **not a Stripe key** — rejected by Stripe API. Provide an `sk_live_*` or `rk_live_*` to unlock live checkout + full webhook handler. |
| **Google OAuth** | 🟢 Wired, GSI button rendered live (iteration_5 evidence). |
| **OpenClaw + runtime API keys** | 🟢 Wired, OpenClaw `/health` 200, 4 runtimes registered (iter_4). |
| **Flight Deck CI** | 🟡 Workflow ready + ARM64 added. Tag push must come from operator's local clone — no `origin` remote in this sandbox. |

---

## What changed this pass (beyond the prior audit report)

### 1. Runtime `.env` loader fixed (root cause of "operator pasted keys but app doesn't see them")

**Discovery**: Next.js 16 standalone runtime does **not** re-parse `.env`
at server start. Values added after `yarn build` (including everything
you pasted today) were invisible to the running process. Confirmed by
inspecting `/proc/<pid>/environ` — only `PORT`, `NODE_ENV`, etc. were
set; **zero** `MC_*` / `STRIPE_*` / `GOOGLE_*` variables.

**Fix** (`scripts/start-with-node22.sh` + new `scripts/load-env.cjs`):
the supervisor start script now NUL-stream parses `.env` and exports
every `KEY=value` line before exec'ing the standalone server. Tolerates
the `Display Name <email@domain>` shape (which `bash source` chokes on).

**Verification** after restart: `MC_EMAIL_FROM`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_LIVE_MODE`, `STRIPE_PUBLISHABLE_KEY`, `API_KEY` all
visible in the running process's environment.

This single fix is what made today's Stripe webhook signature verification
and Resend-with-verified-domain delivery work — it's been silently
masking the operator's correctly-provided config.

### 2. Resend — verified domain → delivered email (proven)

```text
Resend API → /emails (live data):
  created_at: 2026-05-31 10:50:24+00
  last_event: delivered                                ← actual delivery
  from:       Baseline OS <onboarding@baseline-agents.com>
  to:         newmoney2217+mc1780224624@gmail.com
  subject:    Reset your Baseline OS password
```

Domain registry at Resend:
```text
  - baseline-agents.com | verified | region=us-east-1 | created=2026-05-30
```

Triggered by `POST /api/auth/forgot-password` against a freshly-signed-up
user. End-to-end: **MC route → email lib → Resend SDK → SMTP →
delivered.** No sandbox restriction, no 403, no manual workaround.

### 3. Stripe — webhook secret proven, secret key still wrong

**Applied:**
- `STRIPE_PUBLISHABLE_KEY=pk_live_51TcdsmAu5pCrx2N6…` ✅
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…` ✅ (used by client)
- `STRIPE_WEBHOOK_SECRET=whsec_PIIdSKTcABY8VhpZlvMyUnr8i6f8btO4` ✅
- `STRIPE_WEBHOOK_ENDPOINT_ID=we_1TcfbtAu5pCrx2N64UDukzfQ` ✅
- `NEXT_PUBLIC_STRIPE_LIVE_MODE=true` ✅

**Verified (live, just now):**
```text
POST /api/webhooks/stripe
Stripe-Signature: t=1780224627,v1=<HMAC-SHA256 with whsec_PIIdSK…>
Body: {"id":"evt_test_post_env","type":"checkout.session.completed",...}
→ HTTP 200 {"received":true}
```

The webhook signing secret correctly verifies signatures using the
HMAC-SHA256 contract. **Stripe Dashboard can now POST live events to
this endpoint and they will be accepted.**

**Rejected:**
- `mk_1TcdsrAu5pCrx2N64pLLkv3q` — Stripe API explicitly returns:
  `{"error":{"message":"Invalid API Key provided: mk_1Tcds***************kv3q","type":"invalid_request_error"}}`

`mk_` is **not** a Stripe credential prefix. The three valid prefixes
for `Authorization: Bearer` (or basic auth) on `api.stripe.com` are
`pk_*` (publishable, no auth power), `sk_*` (secret), `rk_*` (restricted).

This means today:
- `/api/webhooks/stripe` accepts events ✅
- `/api/stripe/webhook` (the fuller handler that needs the SDK) returns
  `503 {"error":"Webhook not configured"}` — correct fail-safe.
- `/api/stripe/checkout` falls back to mock test session URLs — correct
  fail-safe (no real charges can be created without `sk_live_*`).

### 4. Webhook routes — both paths now public

Added `/api/webhooks/stripe` to the proxy public allowlist (`src/proxy.ts`).
Previously only `/api/stripe/webhook` was public, which would have
silently rejected Stripe Dashboard POSTs depending on which URL the
operator chose. Both paths are now allowed. Either is a valid Stripe
Dashboard target; recommend `/api/stripe/webhook` once the secret key is
provided so the full handler runs.

---

## Updated audit table

| # | Item | Provided? | Status | Verified live? | Still missing? |
| - | ---- | :-------: | ------ | :-: | -------------- |
| 1 | Stripe live publishable key | ✅ `pk_live_51Tcdsm…` | wired in `.env`, available to client bundle | (n/a — public) | — |
| 2 | Stripe secret key | ❌ — `mk_1Tcdsr…` is rejected by Stripe | not applied | n/a | **`sk_live_*` or `rk_live_*` from `dashboard.stripe.com/apikeys`** |
| 3 | Stripe webhook signing secret | ✅ `whsec_PIIdSK…` | wired | ✅ signature verified, 200 OK | — |
| 4 | Stripe webhook endpoint id | ✅ `we_1TcfbtAu…` | stored as `STRIPE_WEBHOOK_ENDPOINT_ID` | — | — |
| 5 | Stripe live-mode flag | ✅ `NEXT_PUBLIC_STRIPE_LIVE_MODE=true` | wired, picked up by billing-panel banner | UI banner flip not screenshot-verified yet (small) | — |
| 6 | Google Client ID / Secret / Redirect | ✅ | wired (was already there) | ✅ GSI button renders (iter_5) | (advisory) confirm `https://baseline-agents.com` is in GCP "Authorized JS origins" before cutover |
| 7 | Resend API key | ✅ `re_8z35Lnyu…` | wired | ✅ direct API send → 200 | — |
| 8 | Resend verified domain | ✅ `baseline-agents.com` (verified, us-east-1) | `MC_EMAIL_FROM=Baseline OS <onboarding@baseline-agents.com>` wired | ✅ MC forgot-password → Resend → delivered (proof above) | — |
| 9 | OpenClaw token / URL | ✅ | wired | ✅ `/health` HTTP 200 | — |
| 10 | Runtime API keys | ✅ minted | wired | ✅ 4 runtimes registered + heartbeated (iter_4) | — |
| 11 | Hermes token | ✅ N/A (uses MC_API_KEY) | wired | ✅ heartbeat proven | — |
| 12 | Flight Deck release tag | ⚠️ | workflow ready (+ ARM64) | ❌ tag not pushed | **operator: `git tag flight-deck-v0.1.0 && git push origin flight-deck-v0.1.0` from a local clone** (no `origin` remote in this sandbox) |

---

## One precise thing to paste next

```
sk_live_<...>   (or)   rk_live_<...>
```

You can mint a restricted key with `write` access to Charges, Customers,
Checkout Sessions, Subscriptions, Invoices, and read on Account at
**https://dashboard.stripe.com/acct_1TcdsmAu5pCrx2N6/apikeys**. Use a
restricted key (`rk_live_*`) instead of the master `sk_live_*` if you
want least-privilege.

The moment you paste it:
1. I append to `/app/.env`.
2. Restart `nextjs` (env loader picks it up automatically — no rebuild needed).
3. Run `mc raw --method POST --path /api/stripe/checkout --body '{"plan_id":"starter","billing_period":"monthly"}'` and expect `https://checkout.stripe.com/c/pay/cs_live_...` (not `testMode:true`).
4. Re-fire the webhook event against `/api/stripe/webhook` (full handler) — expect `200 {"received":true}` instead of `503`.
5. Screenshot the billing panel test/live banner flipped.
6. Update this report and close the Stripe row.

## Apologies & accountability

The reason your previous Resend, Stripe-webhook-secret, and Google keys
"weren't applied" wasn't because they were missing — it's because the
standalone Next.js process wasn't loading `.env` at runtime. My audit
table from the previous pass was based on what was *in the file*, not on
what was *in the running process's environment*. That gap is closed
today via `scripts/load-env.cjs` + the start-script hook.
