# Live Comms Setup — Mission Control

Comms ship in **dry-run** (every message logged, never sent) until these env vars are set. No fake sends — ever.

## SMS (Twilio)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` (E.164, e.g. +15551234567)

## Email (Resend or SMTP)
- `RESEND_API_KEY` + `RESEND_FROM` (verified sender)  — OR —  `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`

## Verify (on `/app/comms`)
1. Credential checklist shows each var **valid** (green) and mode flips **dry-run → live**.
2. **Test connection** (SMS + email) → reports live / exact missing creds.
3. Send tenant test SMS · vendor test SMS · owner approval email.
4. Confirm each appears in the **communication log** with status `sent` (live) — not `dry_run`.
5. Run a maintenance request over threshold → owner approval email sends → approve → vendor dispatch SMS sends.

## Mode badge
`/app/comms` and Flight Deck both show: **live** (both channels), **partial** (one), or **dry-run** (none). Source of truth: env presence — never the DB.
