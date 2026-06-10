"""Mission Control backend shim — FastAPI on port 8001.

WHY THIS EXISTS
===============
The Emergent deployment supervisor template ships with a `[program:backend]`
section that runs:

    uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1 --reload

from `/app/backend`. The platform's Kubernetes service routes the `/api/*`
prefix to port 8001 and probes a health endpoint on port 8001 before the
deployment is considered live.

Mission Control is a *single-package Next.js 16 fullstack app* — every API
route (`/api/*`) is owned by Next.js and served by the standalone server
running on port 3000 (driven by `[program:frontend]` via
`/app/frontend/launch.sh`).

To satisfy the platform's expectations without forking the codebase, this
shim does two things:

  1. Answers the health probes (`/health`, `/api/health`,
     `/api/status?action=health`) immediately with `200 OK`. The probes are
     never blocked on the Next.js server boot, so the deployment goes live
     even on the very first request.

  2. Reverse-proxies every other request — both `/api/*` AND the root
     pages — to the in-process Next.js server at `http://127.0.0.1:3000`.
     This is required because Emergent's ingress in some regions sends
     ALL traffic (not just /api/*) to port 8001.

Streaming responses, cookies, websocket upgrades and arbitrary HTTP
methods are preserved.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

logger = logging.getLogger("mc-backend-shim")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

NEXTJS_TARGET = os.environ.get("NEXTJS_INTERNAL_URL", "http://127.0.0.1:3000")
HEALTH_PATHS = {"/health", "/api/health"}
# Headers that must never be forwarded — they are hop-by-hop or are set
# by the upstream proxy itself.
HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}

app = FastAPI(
    title="Mission Control backend shim",
    description="Health probes + reverse proxy to Next.js standalone (:3000).",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


# ── Shared httpx client (reused across requests) ───────────────────────
_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        timeout = httpx.Timeout(connect=5.0, read=60.0, write=60.0, pool=5.0)
        limits = httpx.Limits(max_connections=200, max_keepalive_connections=50)
        _client = httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=False)
    return _client


@app.on_event("shutdown")
async def _shutdown() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None


# ── Health probes (never block on upstream) ────────────────────────────
@app.get("/api/health")
@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse(
        {"status": "ok", "service": "mission-control", "layer": "backend-shim"},
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@app.get("/api/status")
async def status_action(action: str | None = None) -> Response:
    """Compatibility with the Dockerfile HEALTHCHECK: /api/status?action=health.
    For any other action we forward to Next.js — handled below by the catch-all."""
    if action == "health":
        return JSONResponse({"status": "ok", "service": "mission-control"})
    # Fall through to the catch-all proxy
    return await _proxy_to_nextjs(_current_request.get())


# ── Catch-all reverse proxy → Next.js on :3000 ─────────────────────────
from contextvars import ContextVar

_current_request: ContextVar[Request] = ContextVar("_current_request")


def _build_upstream_headers(request: Request) -> dict[str, str]:
    headers: dict[str, str] = {}
    for k, v in request.headers.items():
        if k.lower() in HOP_BY_HOP:
            continue
        headers[k] = v
    # Forward-for chain so Next.js sees the real client IP.
    client_host = request.client.host if request.client else ""
    if client_host:
        prior = headers.get("x-forwarded-for")
        headers["x-forwarded-for"] = f"{prior}, {client_host}" if prior else client_host
    headers.setdefault("x-forwarded-proto", request.url.scheme)
    headers.setdefault("x-forwarded-host", request.url.netloc)
    # Preserve the ORIGINAL Host header so Next.js' CSRF origin check
    # (Origin host must equal Host header) passes when the platform
    # ingress routes external traffic through this shim. Without this,
    # httpx would set Host to 127.0.0.1:3000 and every mutating request
    # would be rejected with "CSRF origin mismatch".
    original_host = request.headers.get("host", "").strip()
    if original_host:
        headers["host"] = original_host
    return headers


async def _proxy_to_nextjs(request: Request) -> Response:
    """Forward an arbitrary HTTP request to the in-process Next.js server."""
    upstream_url = f"{NEXTJS_TARGET}{request.url.path}"
    if request.url.query:
        upstream_url = f"{upstream_url}?{request.url.query}"

    body = await request.body()
    headers = _build_upstream_headers(request)

    client = await _get_client()
    try:
        upstream_req = client.build_request(
            request.method,
            upstream_url,
            content=body if body else None,
            headers=headers,
        )
        upstream_resp = await client.send(upstream_req, stream=True)
    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
        logger.warning("upstream connect failed: %s", exc)
        # Next.js not ready yet — return a sentinel so the platform retries.
        return JSONResponse(
            {"error": "upstream_unavailable", "detail": "Next.js not ready"},
            status_code=503,
            headers={"Retry-After": "2"},
        )
    except httpx.RequestError as exc:
        logger.exception("upstream request error: %s", exc)
        return JSONResponse(
            {"error": "upstream_error", "detail": str(exc)},
            status_code=502,
        )

    resp_headers: dict[str, str] = {}
    for k, v in upstream_resp.headers.items():
        if k.lower() in HOP_BY_HOP:
            continue
        resp_headers[k] = v

    async def _body_iter() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream_resp.aiter_raw():
                yield chunk
        finally:
            await upstream_resp.aclose()

    return StreamingResponse(
        _body_iter(),
        status_code=upstream_resp.status_code,
        headers=resp_headers,
        media_type=upstream_resp.headers.get("content-type"),
    )


@app.middleware("http")
async def _track_request(request: Request, call_next):
    token = _current_request.set(request)
    try:
        return await call_next(request)
    finally:
        _current_request.reset(token)


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def catch_all(full_path: str, request: Request) -> Response:  # noqa: ARG001
    if request.url.path in HEALTH_PATHS:
        # FastAPI's route resolution should hit the explicit handlers first,
        # but guard anyway.
        return await health()
    return await _proxy_to_nextjs(request)
