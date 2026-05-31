# Mission Control — Troubleshooting Guide

The 12 issues a customer is most likely to hit, with root cause + fix +
how to verify the fix landed.

---

## 1. "I can't sign up — 'Too many registration attempts'"

**Cause:** the signup endpoint rate-limits at 5/min per IP. You probably
hit a typo loop.

**Fix:** wait 60 seconds. Try again. Your previous attempts didn't create
any partial account state.

**Verify:** the response body changes from `429` (rate-limited) to either
`200` (success) or `400` (e.g. password too short — 12 char minimum).

---

## 2. "Forgot-password says 'Too many attempts' on my first try"

**Status:** **Fixed.** Forgot-password and reset-password now use their own
limiters (5/min and 10/min respectively), independent of signup.

If you still see it after this fix is deployed: you've genuinely retried
5 times in 60s. Wait, then try again.

---

## 3. "Google sign-in popup says 'invalid response'"

**Cause:** your Mission Control origin is not in the OAuth client's
**Authorized JavaScript origins** in Google Cloud Console.

**Fix (operator action):**
1. Google Cloud Console → APIs & Services → Credentials.
2. Open the OAuth 2.0 Client used by Mission Control.
3. Add your origin (e.g. `https://mission.your-company.com`) to
   **Authorized JavaScript origins**.
4. Save. Effect is instant on Google's side.

**Verify:** refresh `/login` → the GSI popup should now complete with a
real credential.

---

## 4. "Runtime shows `disconnected` but my daemon is running"

**Cause:** one of three:

| Sub-cause | Check | Fix |
|---|---|---|
| Daemon's last heartbeat > 90s ago | `seconds_since_heartbeat` in `/api/agent-runtimes` | Restart the connector |
| Daemon registered in wrong workspace | Key was minted by wrong admin | Re-mint the key from the right workspace's admin account |
| Daemon's IP changed mid-session | Heartbeat IP is logged, not the registration IP | Restart connector |

**Fix:** restart the connector. The connector re-registers (idempotent)
and `connection_status` returns to `connected` within 30s.

**Verify:**
```bash
curl -s -H "x-api-key: $MC_API_KEY" \
  https://<mc>/api/agent-runtimes | jq '.registered[] | {name, connection_status, seconds_since_heartbeat}'
```

---

## 5. "Stripe purchase succeeded but no credits show up"

**Cause:** either (a) you're in test/mock mode and the auto-fulfill
already credited you (refresh), or (b) the webhook endpoint isn't reachable
from Stripe.

**Fix:**

- Test mode → refresh `/app/billing`. Mock fulfillment is synchronous; the
  balance updates immediately.
- Live mode →
  1. Stripe Dashboard → Developers → Webhooks → look for failed deliveries
     to `/api/stripe/webhook`.
  2. If failing: check `STRIPE_WEBHOOK_SECRET` matches the secret shown in
     the dashboard for that endpoint.
  3. Retry the event from the Stripe Dashboard → check Mission Control's
     audit log for `webhook.signature_invalid` or `webhook.replay_blocked`.

**Verify:** `/app/billing` shows the new credits and ledger shows a
`credit.grant` entry stamped with `idempotency_key: stripe_<event_id>`.

---

## 6. "My team sees data from another workspace"

**They don't.** Every API path that returns workspace-scoped data filters
on `workspace_id`. What you're probably seeing:

- The **header workspace switcher** lets a user with memberships in multiple
  workspaces toggle between them. If they're seeing data from workspace A
  while logged in as a member of workspace B, that's because they have a
  membership in workspace A too.

**Verify**: `/api/workspaces` returns the workspaces THAT user can access.
Anything outside that list is a hard 403/401 — there is no path to read
its data.

If you're convinced this is wrong, file with audit-trail evidence: the
exact API call, the exact response, the user's `/api/auth/me`. We treat
cross-workspace data leak as P0.

---

## 7. "I accidentally revoked my own admin role"

**You can't, by design.** The role-change endpoint refuses to demote the
last admin of a workspace (atomic check + decrement). If you have a
co-admin, they can promote you back.

If you somehow get into a state with zero admins (e.g. SQL-level edit), the
fix requires the host operator to run:

```bash
sqlite3 /app/.data/mission-control.db \
  "UPDATE workspace_members SET role='admin' WHERE workspace_id=<id> AND user_id=<your_user_id>;"
```

---

## 8. "Mission Control feels slow / I see refresh jitter"

**Cause:** you're on an old build. Iteration 11 throttled every panel
poller from 5–30s to 120–180s and removed `router.refresh()` from demo
switching.

**Fix:** hard refresh once (Cmd-Shift-R / Ctrl-Shift-R). The header should
show **● Auto · 2m** + a **🔄 Refresh** button — that means you're on
the new build.

**Verify:** open dev tools → Network tab → filter on `/api/`. You should
see at most one request per 120s per panel, plus user-triggered refreshes
when you click the button.

---

## 9. "Demo mode shows fake activity in my real workspace"

**Cause:** the URL has `?demo=cpa` (or another vertical).

**Fix:** remove `?demo=…` from the URL or use the **Demo mode** switcher
in the header to go back to **Live**.

**Verify:** the Executive Briefing headline returns to your real value
(e.g. `$0` if you're a fresh customer with no activity) instead of a
templated demo headline.

---

## 10. "Activation sequence loops / I can't get to the dashboard"

**Cause:** the activation page (`/app/activate`) hit an error rendering one
of its 5 steps. Probably a one-off race; the route is idempotent.

**Fix:** click **Skip activation →** (top-right pill) or press **Escape**.
You go straight to `/app/overview`.

**Verify:** `/app/overview` renders. The activation flow is purely
cosmetic; nothing in your account requires it.

---

## 11. "Email invite never arrived"

**Cause:** no email provider configured on the host.

**Fix:** look at the invite-creation response. It includes the field
`email_status`. If it's `"not_sent"`, you're in fallback mode — the
`accept_url` in that same response is the link you should manually
forward to your teammate.

**Operator fix:** set ONE of `RESEND_API_KEY`, `SENDGRID_API_KEY`, or
the SMTP block (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`).
Restart Mission Control.

**Verify:** create a new invite → `email_status: "sent"`, `email_provider: "resend"|"sendgrid"|"smtp"`.

---

## 12. "Flight Deck won't download"

**Status:** the binaries are not built yet on most deployments. The
`/flight-deck` page shows an amber banner explaining this.

**Fix (operator):** push the release tag:

```bash
cd <mission-control-repo>
git tag flight-deck-v0.1.0
git push origin flight-deck-v0.1.0
```

The CI matrix runs ≈18 min and publishes the macOS/Windows/Linux
installers to GitHub Releases. The `/flight-deck` page then flips
`releaseStatus` to `available` and Download buttons activate.

**Customer fix (right now):** follow Path B in
`/docs/FLIGHT_DECK_INSTALLATION_GUIDE.md` and build from source. Takes
about 8 minutes per platform.

---

## Anything else?

1. Reproduce the issue. Note the exact URL + the exact response body.
2. Open `/app/audit-trail` and grab the audit row for the failing action.
3. Send both to your operator. Audit log + response body is enough to
   triage 95% of issues without further back-and-forth.
