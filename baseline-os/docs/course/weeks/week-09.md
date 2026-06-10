# Week 9 — The Hermes MCP Loop

> **Outcome:** Your Claude Desktop talks to a local Hermes Agent through an OAuth-protected tunnel. The full loop is live: Brain → Bridge → Hands.

## Why this week matters

This is the architecture 99% of AI users don't have. It's three layers:

```
Layer 1: The Brain        Claude (planning, decision-making)
                            ↓ delegates
Layer 2: The Bridge       Hermes MCP (OAuth-protected pipeline)
                            ↓ calls
Layer 3: The Hands        Hermes Agent (runs on your machine)
                            └─ browses web, sends email, schedules cron
```

Claude becomes your CEO. Hermes Agent becomes your hands. Hermes MCP is the missing pipe.

## Pre-class reading (~40 min)

- The Hermes MCP repo README at https://github.com/mlennie/hermes-mcp
- The 8-step setup guide on the Hermes MCP page in the dashboard

## Live lecture outline (90 min — extended)

**0:00 — The 3-layer architecture (15 min)** — Whiteboard the loop. Where each layer runs (cloud vs local). Why a *bridge* is necessary (MCP enforces auth + scoping).

**0:15 — OAuth device flow walkthrough (15 min)** — Cloudflared tunnel → mint client → Claude Desktop adds custom connector → handshake.

**0:30 — Live setup, from scratch (40 min)**

Following the 8 steps in `Hermes MCP` page in the dashboard:

```bash
# 1. Install
pipx install hermes-mcp

# 2. Mint OAuth client
hermes-mcp mint-client
# → save OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET

# 3. Tunnel
cloudflared tunnel --url http://127.0.0.1:8765
# → grab the trycloudflare.com URL

# 4. Env vars
export OAUTH_CLIENT_ID=<from step 2>
export OAUTH_CLIENT_SECRET=<from step 2>
export OAUTH_ISSUER_URL=<your tunnel URL>
export MCP_ALLOWED_HOSTS=<your tunnel hostname>
export HERMES_API_KEY=$(grep HERMES_API_KEY ~/.hermes/.env | cut -d= -f2)

# 5. Doctor
hermes-mcp doctor

# 6. Serve
hermes-mcp serve

# 7. Connect Claude Desktop
# Settings → Connectors → Add Custom Connector
#   URL: https://<tunnel>/mcp
#   Client ID: <step 2>
#   Client Secret: <step 2>

# 8. Test prompt:
"Use Hermes to schedule a daily cron job that emails me a summary of my
inbox at 8am."
```

If Claude *executes* (not just describes) the task — loop is live.

**1:10 — Permanent setup (15 min)** — Named Cloudflare tunnel (survives reboot). Systemd unit for `hermes-mcp serve`.

**1:25 — Q&A (5 min)**

## Hands-on lab (3 hours — extended)

Walk through all 8 steps live. Get to a working tunnel URL + connected Claude Desktop. Run the canonical test prompt. Verify the cron job lands in `~/.hermes/cron/`.

## Self-study (2 hours)

- Read the Hermes MCP threat model. Understand what OAuth + `MCP_ALLOWED_HOSTS` is protecting you from.
- Set up the permanent tunnel + systemd unit.

## Deliverable

- ✅ Screenshot of Claude Desktop with Hermes connector showing "Connected"
- ✅ Test prompt transcript: Claude actually executed
- ✅ Hermes cron `list` output showing your scheduled job

## Common issues

- **`hermes-mcp doctor` says gateway unreachable** → Hermes isn't running. `hermes status` first.
- **Doctor says 401** → `HERMES_API_KEY` mismatch with `~/.hermes/.env`. Re-export.
- **Tunnel URL changes on every restart** → expected with quick tunnels. Use named tunnel for permanence.
- **Claude Desktop rejects the connector** → make sure tunnel URL is HTTPS, not HTTP.
