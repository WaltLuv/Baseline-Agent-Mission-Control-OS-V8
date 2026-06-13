# Browser / API Execution Modes

For each ecosystem app, agents execute in one of three modes:

1. **API Mode** — preferred, stable; authenticated API/webhooks.
2. **Browser/Iframe Mode** — controlled fallback when API is missing/incomplete
   or faster; the agent drives the embedded UI via a Browser-Use / Computer-Use
   / Flight Deck runtime. Proof/replay required; sensitive actions approval-gated.
3. **Visible Only** — app can be viewed/opened; no execution yet.

Mode resolution (`resolveExecutionMode`): **API → Browser → Visible Only**.

## Browser Action Registry
Source: `src/lib/ecosystem/browser-actions.ts`. Each action defines: app ·
action_id · description · allowed_url_pattern · required_role ·
required_permission · selector/NL task · approval_required · expected_result ·
proof_capture · replay_event.

`checkBrowserAction()` enforces, for every action:
- **allowlisted URL only** (blocks cross-domain navigation)
- **least-privilege role + permission**
- **approval gate** for sensitive/outbound/payment/destructive actions
- proof capture + replay event on execution
- PI context package injected **before** execution

## Honest failure states
- No browser runtime → **“Browser automation setup needed.”**
- iframe blocked by X-Frame-Options/CSP → **“Open in controlled browser runtime.”**
Never claim iframe execution works unless a runtime is connected + tested.
