"""
Task Delegation Protocol -- Async task dispatch, polling, results, and error handling.

This module provides the core async task primitives for agent-to-agent communication:
- TaskDispatch: A structured task request with unique ID, deadline, and priority
- TaskResult: Success payload with timing metadata
- TaskError: Structured error with error codes and recovery hints
- TaskProgress: Incremental progress reports during long-running tasks
- TaskProtocol: Manages lifecycle (dispatch → track → poll → complete/fail)
"""

import asyncio
import time
import uuid
from typing import Any, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum
from fastmcp import FastMCP


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


@dataclass
class TaskDispatch:
    """A dispatched async task request."""
    task_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    name: str = ""
    agent: str = ""
    handler: str = ""  # Registered handler name
    payload: dict = field(default_factory=dict)
    priority: str = "medium"  # low, medium, high, urgent
    timeout_seconds: int = 300
    status: TaskStatus = TaskStatus.PENDING
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional["TaskResult"] = None
    error: Optional["TaskError"] = None
    progress: Optional["TaskProgress"] = None


@dataclass
class TaskResult:
    """Result of a completed task."""
    task_id: str
    data: dict
    duration_seconds: float
    metadata: dict = field(default_factory=dict)


@dataclass
class TaskError:
    """Structured error from a failed task."""
    task_id: str
    error_code: str  # e.g., "TIMEOUT", "HANDLER_NOT_FOUND", "INVALID_INPUT"
    message: str
    details: dict = field(default_factory=dict)
    recoverable: bool = False  # Can the caller retry with different params?


@dataclass
class TaskProgress:
    """Incremental progress report during long-running tasks."""
    task_id: str
    percent: float  # 0.0 to 100.0
    message: str
    step: str = ""  # Current step name
    details: dict = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


class TaskProtocol:
    """
    Async Task Protocol -- manages the lifecycle of delegated tasks.
    
    Attached to every agent via AgentBase. Provides:
    - dispatch_task(): Queue a task for async execution
    - get_task_status(): Poll task status (MCP tool)
    - get_task_result(): Get completed result or error
    - cancel_task(): Cancel a running task
    - list_tasks(): List all active/past tasks
    - Internal task runner: pulls from queue, executes with semaphores, reports results
    """

    def __init__(self, agent_instance, server: FastMCP):
        self.agent = agent_instance
        self.server = server
        self._task_queue: asyncio.Queue[TaskDispatch] = asyncio.Queue()
        self._task_store: dict[str, TaskDispatch] = {}
        self._cancellation_events: dict[str, asyncio.Event] = {}
        self._handlers: dict[str, Callable[..., Awaitable[dict]]] = {}
        self._runner_task: Optional[asyncio.Task] = None
        self._report_callbacks: list[Callable[[TaskDispatch], None]] = []

    def register_handler(self, name: str, handler: Callable[..., Awaitable[dict]]):
        """Register a named handler that can be called via dispatch_task."""
        self._handlers[name] = handler

    def on_task_complete(self, callback: Callable[[TaskDispatch], None]):
        """Register a callback for task completion events."""
        self._report_callbacks.append(callback)

    async def dispatch_task(
        self,
        handler: str,
        payload: dict,
        priority: str = "medium",
        timeout_seconds: int = 300,
        name: str = "",
    ) -> str:
        """
        Dispatch an async task for background execution.
        Returns the task_id. The caller can poll status and collect the result.
        """
        task = TaskDispatch(
            handler=handler,
            payload=payload,
            priority=priority,
            timeout_seconds=timeout_seconds,
            name=name or f"{handler}-{uuid.uuid4().hex[:6]}",
            agent=self.agent.agent_name,
        )

        self._task_store[task.task_id] = task
        self._cancellation_events[task.task_id] = asyncio.Event()
        await self._task_queue.put(task)

        # Start runner if not running
        if not self._runner_task or self._runner_task.done():
            self._runner_task = asyncio.create_task(self._run_loop())

        return task.task_id

    async def _run_loop(self):
        """Background loop: pulls tasks from queue, executes with concurrency control."""
        import traceback
        while True:
            task = await self._task_queue.get()

            # Check if cancelled while in queue
            if task.task_id in self._cancellation_events:
                if self._cancellation_events[task.task_id].is_set():
                    task.status = TaskStatus.CANCELLED
                    task.completed_at = time.time()
                    task.error = TaskError(
                        task_id=task.task_id,
                        error_code="CANCELLED",
                        message="Task was cancelled before execution",
                        recoverable=False,
                    )
                    self._report_completion(task)
                    continue

            async with self.agent._task_semaphore:
                handler = self._handlers.get(task.handler)
                if not handler:
                    task.status = TaskStatus.FAILED
                    task.completed_at = time.time()
                    task.error = TaskError(
                        task_id=task.task_id,
                        error_code="HANDLER_NOT_FOUND",
                        message=f"No handler registered for '{task.handler}'",
                        details={"available_handlers": list(self._handlers.keys())},
                        recoverable=True,
                    )
                    self._report_completion(task)
                    continue

                task.status = TaskStatus.RUNNING
                task.started_at = time.time()

                try:
                    # Execute with timeout
                    result = await asyncio.wait_for(
                        handler(**task.payload),
                        timeout=task.timeout_seconds,
                    )
                    task.status = TaskStatus.COMPLETED
                    task.completed_at = time.time()
                    task.result = TaskResult(
                        task_id=task.task_id,
                        data=result if isinstance(result, dict) else {"output": str(result)},
                        duration_seconds=task.completed_at - task.started_at,
                    )
                except asyncio.TimeoutError:
                    task.status = TaskStatus.TIMEOUT
                    task.completed_at = time.time()
                    task.error = TaskError(
                        task_id=task.task_id,
                        error_code="TIMEOUT",
                        message=f"Task timed out after {task.timeout_seconds}s",
                        recoverable=False,
                    )
                except asyncio.CancelledError:
                    task.status = TaskStatus.CANCELLED
                    task.completed_at = time.time()
                    task.error = TaskError(
                        task_id=task.task_id,
                        error_code="CANCELLED",
                        message="Task was cancelled during execution",
                        recoverable=False,
                    )
                except Exception as e:
                    task.status = TaskStatus.FAILED
                    task.completed_at = time.time()
                    task.error = TaskError(
                        task_id=task.task_id,
                        error_code="HANDLER_EXCEPTION",
                        message=str(e),
                        details={"traceback": traceback.format_exc()},
                        recoverable=True,
                    )

                self._report_completion(task)

    def _report_completion(self, task: TaskDispatch):
        """Report task completion to callbacks and Mission Control."""
        for callback in self._report_callbacks:
            try:
                callback(task)
            except Exception:
                pass

        # Report to Mission Control
        import asyncio
        try:
            asyncio.create_task(
                self.agent.mc_sync.report_task_completion(task)
            )
        except Exception:
            pass

    # ─── MCP Tools ────────────────────────────────────────────────

    def register_tools(self):
        """Register task protocol MCP tools on this agent's server."""
        proto = self

        @self.server.tool
        async def get_task_status(task_id: str) -> dict:
            """Check the current status of a dispatched async task."""
            task = proto._task_store.get(task_id)
            if not task:
                return {"error": f"Task {task_id} not found"}
            
            response = {
                "task_id": task.task_id,
                "name": task.name,
                "agent": task.agent,
                "handler": task.handler,
                "status": task.status.value,
                "priority": task.priority,
                "created_at": task.created_at,
                "started_at": task.started_at,
                "completed_at": task.completed_at,
            }

            if task.progress:
                response["progress"] = {
                    "percent": task.progress.percent,
                    "message": task.progress.message,
                    "step": task.progress.step,
                }

            if task.result:
                response["result"] = task.result.data
                response["duration_seconds"] = task.result.duration_seconds

            if task.error:
                response["error"] = {
                    "code": task.error.error_code,
                    "message": task.error.message,
                    "recoverable": task.error.recoverable,
                    "details": task.error.details,
                }

            return response

        @self.server.tool
        async def get_task_result(task_id: str) -> dict:
            """Get the result of a completed task, or error if it failed."""
            task = proto._task_store.get(task_id)
            if not task:
                return {"error": f"Task {task_id} not found"}
            
            if task.status == TaskStatus.COMPLETED:
                return {
                    "status": "completed",
                    "task_id": task_id,
                    "result": task.result.data,
                    "duration_seconds": task.result.duration_seconds,
                    "metadata": task.result.metadata,
                }
            elif task.status == TaskStatus.FAILED:
                return {
                    "status": "failed",
                    "task_id": task_id,
                    "error": task.error.message,
                    "error_code": task.error.error_code,
                    "details": task.error.details,
                    "recoverable": task.error.recoverable,
                }
            else:
                return {
                    "status": task.status.value,
                    "task_id": task_id,
                    "message": f"Task is {task.status.value}, not yet complete",
                }

        @self.server.tool
        async def cancel_task(task_id: str) -> dict:
            """Cancel a pending or running task."""
            event = proto._cancellation_events.get(task_id)
            if event:
                event.set()
                return {"status": "cancelled", "task_id": task_id}
            return {"error": f"Cannot cancel -- task {task_id} not found or already finished"}

        @self.server.tool
        async def list_tasks(status_filter: str = "all", limit: int = 50) -> list[dict]:
            """List all tasks, optionally filtered by status.
            
            status_filter: all, pending, running, completed, failed, cancelled, timeout
            """
            tasks = []
            for task_id, task in proto._task_store.items():
                if status_filter != "all" and task.status.value != status_filter:
                    continue
                tasks.append({
                    "task_id": task.task_id,
                    "name": task.name,
                    "handler": task.handler,
                    "status": task.status.value,
                    "priority": task.priority,
                    "created_at": task.created_at,
                    "duration": (task.completed_at - task.started_at) if task.started_at and task.completed_at else None,
                })

            # Sort by created_at desc, take top N
            tasks.sort(key=lambda t: t["created_at"], reverse=True)
            return tasks[:limit]
