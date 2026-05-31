"""Mission Control telemetry — registers the gateway as a runtime and reports
task lifecycle events. Fire-and-forget: telemetry failures never block a task.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from .config import Config

log = logging.getLogger("agent_gateway.telemetry")


class MissionControlTelemetry:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._client: httpx.AsyncClient | None = None
        self._registered = False

    async def _ensure_client(self) -> httpx.AsyncClient | None:
        if not self.cfg.mc_url or not self.cfg.mc_api_key:
            return None
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.cfg.mc_url,
                timeout=10.0,
                headers={
                    "authorization": f"Bearer {self.cfg.mc_api_key}",
                    "x-api-key": self.cfg.mc_api_key,
                    "content-type": "application/json",
                },
            )
        return self._client

    async def register(self) -> None:
        client = await self._ensure_client()
        if client is None:
            log.info("MC_URL / MC_API_KEY not set — running in offline mode")
            return
        body = {
            "name": self.cfg.gateway_name,
            "runtime_type": "agent-gateway",
            "workspace_id": self.cfg.mc_workspace_id,
            "capabilities": ["mcp", "claude", "codex", "opencode", "hermes"],
            "metadata": {"enabled_agents": self.cfg.enabled_agents},
        }
        try:
            r = await client.post("/api/agents/register", json=body)
            if r.status_code >= 400:
                log.warning("MC register failed: %s %s", r.status_code, r.text[:200])
                return
            self._registered = True
            log.info("Registered with Mission Control as %s", self.cfg.gateway_name)
        except Exception as e:
            log.warning("MC register error: %s", e)

    async def heartbeat(self) -> None:
        client = await self._ensure_client()
        if client is None or not self._registered:
            return
        try:
            await client.post("/api/agents/comms", json={
                "name": self.cfg.gateway_name,
                "kind": "heartbeat",
                "probe": "alive",
            })
        except Exception:
            pass  # heartbeat failures are noisy — silent

    async def report_task(self, task_id: str, event: str, payload: dict[str, Any]) -> None:
        client = await self._ensure_client()
        if client is None or not self._registered:
            return
        body = {
            "name": self.cfg.gateway_name,
            "kind": "task_event",
            "task_id": task_id,
            "event": event,
            "payload": payload,
        }
        try:
            await client.post("/api/agents/comms", json=body)
        except Exception as e:
            log.debug("MC task_event %s send failed: %s", event, e)

    async def heartbeat_loop(self) -> None:
        while True:
            await asyncio.sleep(self.cfg.mc_report_interval_secs)
            await self.heartbeat()

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
