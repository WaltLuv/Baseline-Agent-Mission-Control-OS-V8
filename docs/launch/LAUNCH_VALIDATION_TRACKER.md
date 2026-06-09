# Launch Validation Tracker — Mission Control (Operator Mode)

**Mode:** Launch Validation (feature-frozen). Judged on reliability, onboarding, demo success, adoption, stability — not feature count.
Status: ✅ done · 🟡 in progress · ⏳ pending · ❌ blocked

## Provider / infra validation (local)
| Item | Status | Evidence (2026-06-09) |
|---|---|---|
| Production deployment | ⏳ pending | builds standalone; not yet deployed to a host (see PRODUCTION_DEPLOY_CHECKLIST) |
| Twilio | ✅ verified | account active (Full); both numbers SMS-capable; default +17076905241 |
| Email delivery (Resend) | ✅ verified | API key valid; 1 domain; comms mode → email LIVE |
| Stripe | 🟡 key live | `sk_live` validated (livemode, USD); **charge flow / webhooks not wired** |
| Local Mission Control | ✅ up | http://127.0.0.1:3000 (/api/health 200) |
| Local Baseline OS | ✅ up | http://127.0.0.1:5173 (200) |
| Admin login (Walt) | ✅ works | newmoney2217@gmail.com → 200, admin, session set |
| Comms mode | ✅ LIVE | SMS + email both live; demo/auto paths forced dry-run (safety) |

## Customer validation
| Item | Status | Notes |
|---|---|---|
| Live Customer Zero smoke | ✅ passed | seed + maintenance run → WO/triage/vendor/approval/replay; 0 real messages sent |
| Design-partner demos | ⏳ pending | demo script + handoff package ready |
| Pilot count | ⏳ 0 | |

## Bugs
| Date | Bug | Status |
|---|---|---|
| 2026-06-09 | Demo/auto paths hit live providers (fake recipients → blocked, no real send) | ✅ fixed — forceDryRun guard on demo/auto sends |
| 2026-06-09 | New admin not seeded (seed skips when users exist) | ✅ fixed — admin created with app's scrypt hashing |

## Security risk register
| Risk | Status | Disposition |
|---|---|---|
| Previously exposed Stripe/OpenAI keys in GitHub history — HEAD scrubbed, rotation recommended before paid production | 🟡 known | **Accepted risk for local testing** (operator decision, 2026-06-09). **BLOCKING for paid production.** |

No secrets are printed, committed, logged, screenshotted, or written into docs/MEMORY. Live keys exist only in gitignored `.env.local` (0600). HEAD is clean (0 secret values in tracked files); exposure is in prior history only.

## Production rule (hard gate before any paid launch)
- [ ] Stripe live key rotated · old key revoked
- [ ] OpenAI key rotated · old key revoked
- [ ] GitHub history exposure documented (this file)
- [ ] Final secret scan passes (history + HEAD)

## Launch blockers (to paid production)
1. ⏳ Verified production deployment + smoke pass.
2. 🟡 Stripe charge flow / webhooks (key is live; capture not wired) — see STRIPE_CHARGE_FLOW_READINESS.md.
3. 🟡 Key rotation (accepted-risk for local; blocking for paid prod — see risk register).
4. (Comms + auth + demo path: cleared.)

## Decision
**GO for demos + design-partner pilot now** (local fully wired, comms live, safety guards on; key exposure accepted for local). **Conditional-GO for paid production** on blockers 1–3.
