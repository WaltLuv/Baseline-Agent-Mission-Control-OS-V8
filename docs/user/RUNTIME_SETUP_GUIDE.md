# Runtime Setup Guide

Runtimes are the engines that actually run the work and report telemetry back to Mission Control.

## Hermes (Python / JavaScript)

Native runtime hook. Installs in your project; streams telemetry.

1. **Get the hook.** Settings → Integrations → Hermes and copy the install command.
2. **Install in your runtime.**
   - Python: `pip install mc-hermes`
   - Node: `npm install @mc/hermes`
3. **Configure.** Set `MC_BASE_URL` to your Mission Control URL and `MC_API_KEY` to your workspace key.
4. **Verify handshake.** Run any task. Mission Control will show "Hermes connected" in the runtime panel.
5. **Verify heartbeat.** A green dot appears next to Hermes within 30 seconds.
6. **Send a test skill event.** `POST /api/skills/event` with your skill id.
7. **View the trace.** Open the employee that ran the work; the trace shows the event.

## OpenClaw / Open Code

Browser and tool runtime hook (JavaScript).

1. **Get the JS hook.** Settings → Integrations → OpenClaw. Copy the hook snippet.
2. **Install in the runtime.** Drop the snippet into your runtime entry. It self-registers on first call.
3. **Configure.** Pass `MC_BASE_URL` and `MC_SESSION_TOKEN`.
4. **Verify handshake.** A handshake event appears in the Activity Feed within seconds of first call.
5. **Verify action telemetry.** Run any browser action; it appears in the Activity Feed.
6. **Verify outcome reporting.** Outcomes (success / partial / failed) appear next to each action.

## Claude Code

Reporting layer for repository work.

1. **Set up reporting.** Add the reporting script from Settings → Integrations → Claude Code to your repo root.
2. **Configure repo task reporting.** Set the project id in the reporting config.
3. **Report files changed.** The hook reports modified file paths after every task completion.
4. **Report tests run.** Wire your test command. Pass / fail counts appear on the task card.
5. **Report outcome.** Tasks resolve as success / partial / failed.
6. **Report token / cost (optional).** If your runtime exposes token counts, the hook forwards them.

## Verifying

Open the **Runtime Connections** panel. Each runtime shows:
- Status (green = connected, amber = stale, grey = off)
- Last handshake time
- Last heartbeat time
- Recent events
