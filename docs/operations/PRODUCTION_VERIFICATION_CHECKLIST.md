# Production Verification Checklist

> Run **immediately after** the first successful App Platform
> deployment. Every check is one command. Every check has an
> expected output. Don't post the launch link until every box
> is green.

Time budget: **15 minutes**.

Set this once at the top of your terminal:

```bash
export MC_HOST="mission.baselineautomations.com"
export AUTH_USER="admin"
export AUTH_PASS="<the production password>"
```

---

## ✅ Tier 1 — Foundation (must pass)

### T1.1 — DNS resolves to DO

```bash
dig +short "$MC_HOST"
# Expect: <something>.ondigitalocean.app   OR   the DO static IP
```
- [ ] Resolves to a `*.ondigitalocean.app` host

### T1.2 — TLS cert is valid

```bash
echo | openssl s_client -servername "$MC_HOST" -connect "$MC_HOST:443" 2>/dev/null \
  | openssl x509 -noout -subject -dates -issuer
# Expect: Let's Encrypt issuer, notAfter > 60 days from now
```
- [ ] Cert issued by Let's Encrypt, not expired

### T1.3 — Health endpoint reports `healthy`

```bash
curl -fsS "https://$MC_HOST/api/status?action=health" | python3 -m json.tool
# Expect: "status": "healthy", "checks": [...all healthy or warning, none critical]
```
- [ ] `status` is `healthy`
- [ ] `Database` check is `healthy`
- [ ] `Process Memory` is not `critical`

### T1.4 — HSTS + secure-cookie headers

```bash
curl -sI "https://$MC_HOST/" | grep -iE 'strict-transport|set-cookie|content-security'
# Expect:
#   Strict-Transport-Security: max-age=31536000; includeSubDomains
#   Content-Security-Policy: ...
```
- [ ] HSTS header present
- [ ] CSP header present

---

## ✅ Tier 2 — Auth & login

### T2.1 — Login round-trip

```bash
rm -f /tmp/c.txt
curl -s -c /tmp/c.txt -X POST "https://$MC_HOST/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$AUTH_USER\",\"password\":\"$AUTH_PASS\"}" \
  -w '\nHTTP %{http_code}\n'
# Expect: HTTP 200, Set-Cookie with Secure; SameSite=Strict
```
- [ ] HTTP 200
- [ ] Cookie is `Secure` and `SameSite=Strict`

### T2.2 — Session works

```bash
curl -s -b /tmp/c.txt "https://$MC_HOST/api/auth/me" | python3 -m json.tool
# Expect: "user": { "username": "admin", "role": "admin", ... }
```
- [ ] Returns an admin user

### T2.3 — Bad password is rejected

```bash
curl -s -X POST "https://$MC_HOST/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$AUTH_USER\",\"password\":\"wrong\"}" \
  -w '\nHTTP %{http_code}\n'
# Expect: HTTP 401, generic error (no user enumeration)
```
- [ ] HTTP 401

---

## ✅ Tier 3 — Demo share + watermark

### T3.1 — Mint a signed demo link as the operator

```bash
TOKEN=$(curl -s -b /tmp/c.txt -X POST "https://$MC_HOST/api/demo-share" \
  -H 'Content-Type: application/json' \
  -d '{"vertical":"cpa","ttlDays":1,"prospect":"Acme & Co.","hours":8,"tour":true,"watermark":true}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "Token (first 40 chars): ${TOKEN:0:40}…"
```
- [ ] Token is a 3-part HMAC string (header.payload.sig)

### T3.2 — Redeem URL hands out a guest cookie

```bash
curl -s -i "https://$MC_HOST/api/demo-share/redeem?token=$TOKEN" | head -20
# Expect: HTTP 302 → /app?demo=cpa, Set-Cookie: mc_demo_guest=…; HttpOnly; Secure; SameSite=Lax
```
- [ ] Redirects to `/app?demo=cpa`
- [ ] `mc_demo_guest` cookie set, `Secure`, `HttpOnly`

### T3.3 — Invalid token redirects to expired page

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://$MC_HOST/api/demo-share/redeem?token=invalid.invalid.invalid"
# Expect: 302 https://…/demo/expired?reason=bad-signature
```
- [ ] Redirects to `/demo/expired?reason=…`

### T3.4 — Visually verify watermark interpolation (incognito)

Open `https://<the redeem URL from T3.1>` in a clean incognito window.
- [ ] No `/login` redirect
- [ ] Guided Demo opens automatically
- [ ] Watermark reads `DEMO WORKSPACE FOR ACME & CO. · BASELINE OS · NO LIVE CUSTOMER DATA`

---

## ✅ Tier 4 — Memory & narratives

### T4.1 — All 9 verticals load via signed link

```bash
for V in pm gc home-services real-estate mortgage cpa law-firm marketing-agency ai-agency; do
  RES=$(curl -s -b /tmp/c.txt -X POST "https://$MC_HOST/api/demo-share" \
    -H 'Content-Type: application/json' -d "{\"vertical\":\"$V\",\"ttlDays\":1}")
  printf "%-20s %s\n" "$V" "$(echo "$RES" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("OK" if d.get("ok") else "FAIL: "+str(d))')"
done
# Expect: every line ends with OK
```
- [ ] 9/9 verticals mint successfully

### T4.2 — Memory citations render on at least one vertical

Open one redeem URL in a fresh incognito session and confirm at least
one AI employee card shows an **Obsidian** or **Notion** citation
under "Memory:".
- [ ] At least one memory citation visible

---

## ✅ Tier 5 — Runtime contract (Hermes / OpenClaw / Claude Code)

### T5.1 — Run the harness against production

```bash
./scripts/runtime-validate.sh \
  --base-url "https://$MC_HOST" \
  --auth-user "$AUTH_USER" --auth-pass "$AUTH_PASS" \
  --runtime hermes
# Expect, in order:
#   PASS  login as admin
#   PASS  register agent → id=<n>
#   PASS  heartbeat 200
#   PASS  task transitions ...
#   PASS  billing idempotent (1st=200, 2nd=200|409)
#   PASS  telemetry session:start / session:end
#   PASS  cleanup agent <n>
```
Repeat for `openclaw` and `claude`.
- [ ] Hermes: every stage PASS
- [ ] OpenClaw: every stage PASS
- [ ] Claude Code: every stage PASS

Capture the output to `docs/operations/proofs/runtime-validation-prod-<date>.txt`.

### T5.2 — Runtime Validation panel mirrors reality

Browser → `https://$MC_HOST/app/runtime-validation` (logged in).
- [ ] At least one runtime band is `healthy` after T5.1

---

## ✅ Tier 6 — Billing (only if Stripe live)

If `STRIPE_SECRET_KEY` is `sk_test_...`, skip this tier.

### T6.1 — Webhook endpoint accepts a signed event

```bash
# In the Stripe Dashboard → Webhooks → Your endpoint → "Send test webhook"
# Pick: checkout.session.completed
# Expect: 200 response from MC
```
- [ ] Stripe shows `200` for the test event

### T6.2 — Real $1 purchase posts a credit

Walk through Billing → buy the smallest pack ($1 in production). Verify:
- [ ] Stripe shows `succeeded`
- [ ] Mission Control Billing panel shows the credited tokens
- [ ] Sending the **same** webhook again does NOT credit twice

---

## ✅ Tier 7 — Flight Deck

### T7.1 — Desktop shell connects to production

Local dev machine with Rust + Node installed:

```bash
cd desktop && yarn install && cd .. && pnpm desktop:dev
# In the Flight Deck window:
#   1. Click "Production" mode card
#   2. Connection pill turns green ("Connected")
#   3. Click "Open Mission Control"
#   4. Webview navigates to MC, login page renders
```
- [ ] Connection pill turns green on Production mode
- [ ] Mission Control opens inside the desktop window
- [ ] Login flow completes inside the desktop window

### T7.2 — Allowlist rejects an off-list URL

In the **Custom Mission Control URL** field, paste `https://attacker.example.com`, click Save & use.
- [ ] Pill shows `URL NOT ALLOWLISTED`
- [ ] No navigation occurs

---

## ✅ Tier 8 — Marketplace & Workforce

### T8.1 — Marketplace catalog returns bundles + skills + employees

```bash
curl -s -b /tmp/c.txt "https://$MC_HOST/api/marketplace/catalog" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'bundles={len(d.get(\"bundles\",[]))} skills={len(d.get(\"skills\",[]))} employees={len(d.get(\"employees\",[]))}')"
# Expect: bundles>=7  skills>=8  employees>=8
```
- [ ] Catalog returns ≥ 7 bundles, ≥ 8 skills, ≥ 8 employees

### T8.2 — Workforce Dashboard renders

Browser → `https://$MC_HOST/app/workforce`.
- [ ] 4 outcome KPI cards
- [ ] 8 departments
- [ ] 10 AI employees
- [ ] 10 vertical templates (incl. cigar-retail)
- [ ] 10 skill packs

---

## ✅ Tier 9 — Onboarding readiness

### T9.1 — `/docs` and `/onboarding` reachable

```bash
for p in /docs /onboarding /app/help /app/docs; do
  printf '%-20s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://$MC_HOST$p")"
done
# Expect: every path returns 200
```
- [ ] `/docs` returns 200
- [ ] `/onboarding` returns 200
- [ ] `/app/help` returns 200
- [ ] `/app/docs` returns 200

### T9.2 — In-app help checklist API responds

```bash
curl -s -b /tmp/c.txt "https://$MC_HOST/api/help/checklist" | python3 -m json.tool | head
# Expect: a checklist with items + statuses
```
- [ ] Help checklist returns structured JSON

---

## ✅ Tier 10 — Definition of Done (the seven-checkbox gate)

Open `https://$MC_HOST/` in an incognito window — no cookies, no
saved sessions — and verify the full prospect journey:

1. [ ] Land on the marketing site (Hero says "AI Workforce OS")
2. [ ] Click `Book a Demo` → reaches login or the booking surface
3. [ ] Receive a signed demo link (mint via `/app/share` and email
       to your own throwaway address; click the link from the inbox)
4. [ ] Watch the guided demo end-to-end without re-auth
5. [ ] See AI employees with memory citations
6. [ ] See ROI counters (hours saved, value created)
7. [ ] CTA to "Start a Pilot" leads to the pilot onboarding surface

**If every box is green, post the launch link.**

If any one is red, capture the failure (curl output / screenshot)
and:

- Tier 1–4 red → rollback per `docs/operations/DIGITALOCEAN_EXECUTION.md` § 7
- Tier 5 red → fix the runtime config first, then retry
- Tier 6 red → re-create the Stripe webhook, retry
- Tier 7 red → rebuild Flight Deck with the production host in the allowlist
- Tier 8–9 red → file a P0 issue, deploy is not launch-blocking
