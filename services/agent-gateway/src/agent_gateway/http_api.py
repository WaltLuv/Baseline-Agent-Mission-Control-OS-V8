"""HTTP control plane mounted alongside the FastMCP server.

FastMCP exposes its protocol on `/mcp`. Mission Control's UI / proxy needs
plain JSON for `/health`, `/v1/tasks`, `/v1/tasks/{id}`, `/v1/logs/{id}` so
operators can inspect gateway state without speaking MCP.

Every `/v1/*` endpoint is gated by `MC_API_KEY` (sent as `x-api-key` or
`authorization: bearer`). `/health` is open so container/L7 probes can hit it
without any secret.
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse

from .config import Config
from .storage import TaskStore

log = logging.getLogger("agent_gateway.http_api")

_BOOT_TS = time.time()


def _extract_api_key(request: Request) -> str:
    direct = (request.headers.get("x-api-key") or "").strip()
    if direct:
        return direct
    auth = (request.headers.get("authorization") or "").strip()
    if not auth:
        return ""
    parts = auth.split()
    if len(parts) == 2 and parts[0].lower() in {"bearer", "apikey", "token"}:
        return parts[1].strip()
    return ""


def _auth_required(cfg: Config, request: Request) -> JSONResponse | None:
    """Return a 401 response if the request lacks the expected key, else None.

    When MC_API_KEY is unset on the gateway, all endpoints are open (single-
    operator local dev). This is intentional and documented in README.
    """
    expected = cfg.mc_api_key
    if not expected:
        return None
    provided = _extract_api_key(request)
    if not provided or provided != expected:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return None


def register_http_routes(mcp: FastMCP, cfg: Config, store: TaskStore) -> None:
    """Attach the HTTP control-plane routes to the FastMCP app."""

    @mcp.custom_route("/health", methods=["GET"])
    async def health(request: Request) -> JSONResponse:  # type: ignore[no-untyped-def]
        return JSONResponse({
            "status": "ok",
            "service": "baseline-agent-gateway",
            "name": cfg.gateway_name,
            "uptime_seconds": int(time.time() - _BOOT_TS),
            "enabled_agents": cfg.enabled_agents,
            "workspace_id": cfg.mc_workspace_id,
            "data_dir": str(cfg.data_dir),
            "mc_connected": bool(cfg.mc_url and cfg.mc_api_key),
        })

    @mcp.custom_route("/v1/tasks", methods=["GET"])
    async def list_tasks(request: Request) -> JSONResponse:  # type: ignore[no-untyped-def]
        unauth = _auth_required(cfg, request)
        if unauth is not None:
            return unauth
        limit = int(request.query_params.get("limit") or "50")
        limit = max(1, min(limit, 500))
        agent = request.query_params.get("agent") or None
        return JSONResponse({"tasks": store.list_recent(limit=limit, agent=agent)})

    @mcp.custom_route("/v1/tasks/{task_id}", methods=["GET"])
    async def get_task(request: Request) -> JSONResponse:  # type: ignore[no-untyped-def]
        unauth = _auth_required(cfg, request)
        if unauth is not None:
            return unauth
        task_id = request.path_params["task_id"]
        row = store.get(task_id)
        if not row:
            return JSONResponse({"error": "task not found", "task_id": task_id}, status_code=404)
        return JSONResponse({"task": row})

    @mcp.custom_route("/v1/logs/{task_id}", methods=["GET"])
    async def get_logs(request: Request) -> JSONResponse:  # type: ignore[no-untyped-def]
        unauth = _auth_required(cfg, request)
        if unauth is not None:
            return unauth
        task_id = request.path_params["task_id"]
        stream = (request.query_params.get("stream") or "stdout").lower()
        if stream not in {"stdout", "stderr"}:
            return JSONResponse({"error": "stream must be stdout|stderr"}, status_code=400)
        tail_bytes = int(request.query_params.get("tail_bytes") or "16384")
        tail_bytes = max(1, min(tail_bytes, 1024 * 1024))
        path = cfg.logs_dir() / f"{task_id}.{stream}"
        if not path.exists():
            return JSONResponse({"task_id": task_id, "stream": stream, "exists": False, "content": ""})
        with path.open("rb") as f:
            try:
                f.seek(-tail_bytes, 2)
            except OSError:
                f.seek(0)
            content = f.read().decode(errors="replace")
        return JSONResponse({"task_id": task_id, "stream": stream, "exists": True, "content": content})

    @mcp.custom_route("/v1/agents", methods=["GET"])
    async def list_agents(request: Request) -> JSONResponse:  # type: ignore[no-untyped-def]
        # Discovery — what does this gateway expose? Open by design so MC
        # can render the picker before the operator pastes their API key.
        return JSONResponse({
            "gateway": cfg.gateway_name,
            "enabled": cfg.enabled_agents,
            "tools": [
                "claude_run_task", "codex_run_task", "opencode_run_task",
                "hermes_delegate_task", "route_task",
                "agent_review_code", "agent_build_feature",
                "agent_status", "agent_logs",
            ],
        })

    log.info("HTTP control-plane routes attached: /health, /v1/agents, /v1/tasks, /v1/tasks/{id}, /v1/logs/{id}")
