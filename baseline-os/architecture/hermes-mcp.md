# SOP: Hermes MCP — The Hermes MCP Loop™

## What It Is
Hermes MCP is the bridge layer between Claude (the brain) and Hermes Agent (the hands).
Without it, Claude can think but cannot act on your machine.
With it, Claude can delegate real-world tasks — email, web browsing, file creation, cron scheduling — to Hermes.

## The 3-Layer Architecture
```
Claude (brain) → hermes-mcp bridge → Hermes Agent (hands)
```

| Layer | Component | Role |
|---|---|---|
| 1 | Claude | Thinks, plans, delegates |
| 2 | Hermes MCP | Routes commands (the bridge) |
| 3 | Hermes Agent | Executes real-world tasks |

## Installation Steps

```bash
# 1. Install the MCP bridge
pipx install hermes-mcp

# 2. Create OAuth credentials
hermes-mcp mint-client
# → prints OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET

# 3. Create Cloudflare tunnel (quick)
cloudflared tunnel --url http://127.0.0.1:8765
# → prints https://random-words.trycloudflare.com

# 4. Set env vars
export OAUTH_CLIENT_ID=<from step 2>
export OAUTH_CLIENT_SECRET=<from step 2>
export OAUTH_ISSUER_URL=https://your-tunnel.trycloudflare.com
export MCP_ALLOWED_HOSTS=your-tunnel.trycloudflare.com
export HERMES_API_KEY=<from ~/.hermes/.env>

# 5. Health check
hermes-mcp doctor

# 6. Start bridge
hermes-mcp serve
```

## Claude Desktop Connection
Settings → Connectors → Add Custom Connector
- URL: `https://your-tunnel.trycloudflare.com/mcp`
- Client ID: `<OAUTH_CLIENT_ID>`
- Client Secret: `<OAUTH_CLIENT_SECRET>`

## Permanent Setup (Named Tunnel)
```bash
cloudflared tunnel login
cloudflared tunnel create hermes
cloudflared tunnel route dns hermes hermes.your-domain.com
# Write ~/.cloudflared/config.yml (see page for template)
systemctl --user enable --now cloudflared.service
```

## Detection
- `/__hermes_mcp_status` → `{ mcpInstalled, gatewayReachable }`
- Checks PATH + common install locations
- Probes http://127.0.0.1:8642/health for Hermes gateway

## GitHub
https://github.com/mlennie/hermes-mcp

## After Reboot
Tokens are in-memory only. After restart:
Claude Desktop → Settings → Connectors → Disconnect → Reconnect (3 seconds)
