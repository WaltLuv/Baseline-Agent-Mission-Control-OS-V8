# Workspace Capability Matrix

The single source of truth for **why** something can or cannot execute in a
workspace. Source: `src/lib/workspace/capability-matrix.ts` ·
API: `GET /api/workspace/capabilities`. Workspace-scoped. No fake green states.

## Capabilities tracked
Core (MC Native Workflows, PI Agent Harness, Graphify, Knowledge OS) · Runtimes
(Hermes, Claude Code, Codex, OpenClaw, Opencode, Browser Automation, Computer
Use, Flight Deck) · Integrations (Twilio, Email, Stripe, Pinecone, Google OAuth)
· Ecosystem (PropControl, VisionOps, VoiceOps, PropControl Empire).

## Each row shows
`status · blocker · fixAction · link · lastChecked · workspaceId`.

Statuses: `Ready · Connected · Workflow Ready · API Connected · Browser
Automation Ready · Visible Only · Needs Credentials · Needs Runtime · Setup
Needed · Offline`.

## How it's used
When a customer asks "why isn't my AI employee working?", the matrix answers
directly — e.g. *"VoiceOps is not connected and the Claude Code runtime is
offline."* Surfaced on the PI Agent page; reused by Agent Readiness. Credential
rows read the real encrypted store; runtimes default to honest **Needs Runtime**
until a runtime/Flight Deck device connects.
