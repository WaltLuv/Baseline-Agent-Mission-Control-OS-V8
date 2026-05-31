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
        self._agent_id: int | None = None

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
        # /api/agents/register validates the shape: name, role, framework,
        # capabilities. runtime_type is derived from framework on the server.
        body = {
            "name": self.cfg.gateway_name,
            "role": "agent",
            "framework": "opencode",  # closest match in MC's enum; gateway is a multiplexer
            "capabilities": ["mcp", "agent-gateway"] + list(self.cfg.enabled_agents),
        }
        try:
            r = await client.post("/api/agents/register", json=body)
            if r.status_code >= 400:
                log.warning("MC register failed: %s %s", r.status_code, r.text[:200])
                return
            try:
                payload = r.json()
                self._agent_id = payload.get("agent", {}).get("id")
            except Exception:
                self._agent_id = None
            self._registered = True
            log.info(
                "Registered with Mission Control as %s (agent_id=%s)",
                self.cfg.gateway_name,
                self._agent_id,
            )
        except Exception as e:
            log.warning("MC register error: %s", e)

    async def heartbeat(self) -> None:
        """Re-register to refresh last_seen on the MC agents row.

        The /api/agents/register handler is idempotent on (name, workspace_id)
        and bumps last_seen, status, runtime_type. Cheap, durable.
        """
        client = await self._ensure_client()
        if client is None:
            return
        body = {
            "name": self.cfg.gateway_name,
            "role": "agent",
            "framework": "opencode",
            "capabilities": ["mcp", "agent-gateway"] + list(self.cfg.enabled_agents),
        }
        try:
            r = await client.post("/api/agents/register", json=body)
            if r.status_code >= 400:
                log.debug("MC heartbeat re-register failed: %s", r.status_code)
                return
            self._registered = True
        except Exception:
            pass  # heartbeat failures are noisy — silent

    async def report_task(self, task_id: str, event: str, payload: dict[str, Any]) -> None:
        """Fire-and-forget task event. Uses the global activity feed via
        /api/agents/comms with kind='task_event' if the server accepts it;
        otherwise falls back silently. Failures must never block a task.
        """
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
            r = await client.post("/api/agents/comms", json=body)
            if r.status_code >= 400:
                log.debug("MC task_event %s ignored: %s", event, r.status_code)
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
