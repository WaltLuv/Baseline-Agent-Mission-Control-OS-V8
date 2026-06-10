#!/usr/bin/env python3
"""HTTP compatibility server for the app's /__browser_use proxy.

The current browser-use package exposes CLI/MCP entry points, while this app
expects a small HTTP service on :8000 with /health and /run.
"""

from __future__ import annotations

import asyncio
import os
import time
import traceback
from typing import Any

from dotenv import load_dotenv
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from browser_use import Agent, BrowserProfile, ChatOpenAI


load_dotenv(".env.local")
load_dotenv()


def cors_headers() -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }


def json(data: dict[str, Any], status_code: int = 200) -> JSONResponse:
    return JSONResponse(data, status_code=status_code, headers=cors_headers())


async def options(_: Request) -> Response:
    return Response(status_code=204, headers=cors_headers())


async def health(_: Request) -> JSONResponse:
    return json(
        {
            "ok": True,
            "service": "browser-use-http",
            "provider": "openrouter" if os.getenv("OPENROUTER_API_KEY") else "openai",
            "model": os.getenv("BROWSER_USE_MODEL", os.getenv("OPENAI_MODEL", "gpt-4.1-mini")),
        }
    )


def make_llm() -> ChatOpenAI:
    if os.getenv("OPENROUTER_API_KEY") and not os.getenv("OPENAI_API_KEY"):
        return ChatOpenAI(
            model=os.getenv("BROWSER_USE_MODEL", os.getenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini")),
            api_key=os.environ["OPENROUTER_API_KEY"],
            base_url="https://openrouter.ai/api/v1",
        )

    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY or OPENROUTER_API_KEY must be set")

    return ChatOpenAI(
        model=os.getenv("BROWSER_USE_MODEL", os.getenv("OPENAI_MODEL", "gpt-4.1-mini")),
        api_key=os.environ["OPENAI_API_KEY"],
    )


async def run_task(request: Request) -> JSONResponse:
    started = time.time()
    try:
        payload = await request.json()
        task = str(payload.get("task", "")).strip()
        max_steps = int(payload.get("max_steps", 25))
        if not task:
            return json({"ok": False, "error": "task required"}, 400)

        llm = make_llm()
        profile = BrowserProfile(headless=payload.get("headless", False))
        agent = Agent(
            task=task,
            llm=llm,
            browser_profile=profile,
            use_vision=payload.get("use_vision", True),
            enable_signal_handler=False,
        )
        history = await agent.run(max_steps=max_steps)

        return json(
            {
                "ok": True,
                "task": task,
                "steps": len(history),
                "done": history.is_done(),
                "success": history.is_successful(),
                "final_result": history.final_result(),
                "extracted_content": history.extracted_content(),
                "urls": history.urls(),
                "errors": [error for error in history.errors() if error],
                "duration_seconds": round(time.time() - started, 2),
            }
        )
    except Exception as exc:
        return json(
            {
                "ok": False,
                "error": str(exc),
                "traceback": traceback.format_exc(limit=8),
                "duration_seconds": round(time.time() - started, 2),
            },
            500,
        )


app = Starlette(
    routes=[
        Route("/health", health, methods=["GET"]),
        Route("/run", run_task, methods=["POST"]),
        Route("/{path:path}", options, methods=["OPTIONS"]),
    ]
)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
