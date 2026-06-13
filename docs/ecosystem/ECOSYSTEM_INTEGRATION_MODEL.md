# Ecosystem Integration Model

Baseline Automations apps Mission Control agents can view and execute against:
**PropControl, VisionOps, VoiceOps, PropControl Empire**. We embed/link — we do
NOT rebuild them.

Source: `src/lib/ecosystem/apps.ts` · API: `GET /api/ecosystem`.

## Per-app model
`iframe_url · api_base_url · allowed_domains · execution_modes_available
(api|browser|visible_only) · default_execution_mode · available_actions ·
browser_action_selectors · required_credentials · approval_required_actions ·
proof_supported · replay_supported · agent_access · setup_status`.

## Statuses
`Visible Only · Browser Automation Ready · API Connected · Workflow Ready ·
Needs Credentials · Blocked by iframe policy · Setup Needed`.

No app is "connected" by default — status is derived from configured URLs +
credentials. VoiceOps has no URL yet → **Setup Needed**.

## PropControl Empire
The gamified real-estate **strategy simulator** (replaces the old Office page).
It teaches users to build/operate a portfolio by playing — it is **not** an
operations app. Embedded via iframe with open-in-new-tab + a blocked-iframe
fallback. Agent automation is Visible Only / Browser mode (future work).
