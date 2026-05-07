"""
Mission Control Sync -- sync agent state, tasks, and registry to Mission Control.

Communicates with Mission Control via REST API to:
- Register/update agent presence
- Report task completions
- Sync agent registry to SQLite
- Log events and health
"""

import asyncio
import json
import time
from typing import Optional, Any


class MissionControlSync:
    """Sync agent state to Mission Control's REST API."""

    def __init__(self, mc_url: Optional[str] = None, mc_api_key: Optional[str] = None):
        self._mc_url = mc_url
        self._mc_api_key = mc_api_key
        self._logs: list[str] = []

    def _log(self, message: str):
        """Store a log entry."""
        self._logs.append(f"[{time.time():.0f}] {message}")

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self._mc_api_key:
            headers["x-api-key"] = self._mc_api_key
        return headers

    async def _request(self, method: str, path: str, body: Optional[dict] = None) -> Any:
        """Make a request to Mission Control REST API."""
        if not self._mc_url:
            return None

        url = f"{self._mc_url}{path}"
        import aiohttp
        session_kwargs = {}
        timeout = aiohttp.ClientTimeout(total=10)

        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                kwargs: dict[str, Any] = {
                    "method": method,
                    "url": url,
                    "headers": self._headers(),
                }
                if body:
                    kwargs["json"] = body

                async with session.request(**kwargs) as resp:
                    text = await resp.text()
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        return {"raw": text, "status": resp.status}
        except Exception as e:
            self._log(f"MC request failed: {e}")
            return None

    async def register_agent(self, name: str, role: str, mcp_url: Optional[str] = None):
        """Register this agent with Mission Control."""
        if not self._mc_url:
            return

        try:
            await self._request("POST", "/api/agents", {
                "name": name,
                "role": role,
                "mcp_url": mcp_url,
                "status": "online",
            })
            self._log(f"Registered agent {name} (role: {role}) with Mission Control")
        except Exception as e:
            self._log(f"Failed to register agent {name}: {e}")

    async def update_agent_status(
        self,
        name: str,
        status: str,
        active_tasks: int = 0,
        activity: Optional[str] = None,
    ):
        """Update agent status in Mission Control."""
        if not self._mc_url:
            return

        try:
            await self._request("PATCH", f"/api/agents/{name}", {
                "status": status,
                "active_tasks": active_tasks,
                "activity": activity,
                "last_seen": int(time.time()),
            })
        except Exception as e:
            self._log(f"Failed to update agent status: {e}")

    async def report_task_completion(self, task):
        """Report a completed/failed task to Mission Control."""
        if not self._mc_url:
            return

        try:
            data = {
                "task_id": task.task_id,
                "name": task.name,
                "agent": task.agent,
                "status": task.status.value,
                "created_at": task.created_at,
                "completed_at": task.completed_at,
            }

            if task.result:
                data["result"] = task.result.data
                data["duration_seconds"] = task.result.duration_seconds
            if task.error:
                data["error"] = task.error.message
                data["error_code"] = task.error.error_code

            await self._request("POST", "/api/tasks/report", data)
        except Exception as e:
            self._log(f"Failed to report task completion: {e}")

    def get_logs(self) -> list[str]:
        """Get all local logs."""
        return self._logs
