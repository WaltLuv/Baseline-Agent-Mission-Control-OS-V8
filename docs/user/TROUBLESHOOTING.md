# Troubleshooting

Each entry tells you what it means, why it usually happens, and how to fix it.

### Runtime not connected
- **Meaning.** No runtime hook has reported in.
- **Cause.** Hook is not installed or env vars are missing.
- **Fix.** Verify the install command ran. Confirm `MC_BASE_URL` and `MC_API_KEY` are set. Re-run the runtime to trigger a handshake.

### No heartbeat showing
- **Meaning.** The runtime registered but stopped sending heartbeats.
- **Cause.** Network change, process restart, or sleeping container.
- **Fix.** Restart the runtime. Check outbound HTTPS. Confirm the heartbeat task is enabled.

### Skills installed but inactive
- **Meaning.** No work is flowing to those skills.
- **Cause.** Skill is not attached to any employee, or no tasks match its trigger.
- **Fix.** Attach the skill to an employee. Create a test task. Check Activity Feed.

### Memory not syncing
- **Meaning.** Connector ran but no new memory appeared.
- **Cause.** Connector token invalid, or no documents shared.
- **Fix.** Re-validate the token. Share at least one page with the integration. Re-run Sync.

### No Executive Briefing data
- **Meaning.** Briefing has nothing to summarize.
- **Cause.** No employees have done work yet, or live mode with no live activity.
- **Fix.** Run the starter task. Switch to Demo mode to see examples. Confirm a runtime is connected.

### Approval queue is empty
- **Meaning.** No work submitted for sign-off.
- **Cause.** No active workflows or all work was auto-approved.
- **Fix.** Check Tasks. Review workflow auto-approve settings.

### Billing credits not updating
- **Meaning.** Credit balance appears stale.
- **Cause.** No telemetry recently, or balance fetch is cached.
- **Fix.** Refresh Billing. Confirm runtimes are reporting. Contact support if balance has not moved in 24 h.

### Demo mode confusion
- **Meaning.** Unsure whether data is real or example.
- **Cause.** Demo mode is active.
- **Fix.** Check the demo badge in the header. Switch to Live mode.

### Email / Slack share not configured
- **Meaning.** Sharing a briefing produced no recipient.
- **Cause.** Channel credentials missing.
- **Fix.** Settings → Integrations → Email or Slack. Add credentials.

### Notion shows "Setup required"
- **Meaning.** Integration token missing or invalid.
- **Fix.** Generate a fresh token in Notion. Paste into Settings → Integrations → Notion. Click Sync.

### Knowledge Intelligence shows "Setup required"
- **Meaning.** Provider key missing.
- **Fix.** Settings → Integrations → Knowledge Intelligence. Paste the key and Sync.

### Obsidian file cannot open
- **Meaning.** Citation click did not open the source note.
- **Fix.** Install Obsidian. Open the vault once so the `obsidian://` handler is registered.

### No activity in live mode
- **Meaning.** Live mode is on but nothing is moving.
- **Fix.** Confirm a runtime is connected. Run a task. Or switch to Demo mode to explore.
