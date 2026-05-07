"""
Orchestrator -- Agent that mounts worker agents as namespace-prefixed servers.

This is the "killer feature": transparent composition. The orchestrator mounts
worker agents under namespace prefixes, so their tools become available as
`rehab.scope_property`, `dispatch.send_workorder`, etc. No manual routing code.

The orchestrator also provides:
- Unified task dispatch across all mounted agents
- Cross-agent workflow execution
- Dynamic capability discovery
- Task progress tracking with aggregation
"""

import asyncio
import time
import uuid
from typing import Any, Optional
from fastmcp import FastMCP, Client

from .agent_base import AgentBase
from .task_protocol import TaskProtocol, TaskStatus


class Orchestrator:
    """
    Orchestrator agent -- mounts worker agents under namespace prefixes,
    composes their capabilities, and exposes unified dispatch tools.
    """

    def __init__(
        self,
        name: str = "Orchestrator",
        mc_url: Optional[str] = None,
        mc_api_key: Optional[str] = None,
    ):
        self.name = name
        self.server = FastMCP(name)
        self._mounted_agents: dict[str, FastMCP] = {}  # namespace -> server instance
        self._remote_agents: dict[str, str] = {}  # namespace -> URL
        self._task_store: dict[str, dict] = {}

        # Registry
        from .registry import AgentRegistry
        self.registry = AgentRegistry(self.server)

        # Mission Control sync
        from .mc_sync import MissionControlSync
        self.mc_sync = MissionControlSync(mc_url=mc_url, mc_api_key=mc_api_key)

        # Register orchestrator-level tools
        self._register_orchestrator_tools()

    def mount(self, namespace: str, agent: FastMCP | AgentBase) -> str:
        """
        Mount an agent's server under a namespace prefix.
        
        All tools from that agent become available as `namespace.tool_name`.
        This is FastMCP's server composition -- no manual routing needed.
        """
        if isinstance(agent, AgentBase):
            server = agent.server
            name = agent.agent_name
            role = agent.agent_role
        else:
            server = agent
            name = namespace
            role = "worker"

        self.server.mount(namespace, server)
        self._mounted_agents[namespace] = server

        # Update registry
        self.registry._agents[namespace] = type(
            'AgentEndpoint', (),
            {
                'name': namespace,
                'role': role,
                'url': f"mounted://{namespace}",
                'transport': 'local',
                'status': 'online',
                'capabilities': list(server._tool_manager._tools.keys()) if hasattr(server, '_tool_manager') else [],
                'metadata': {},
                'last_seen': time.time(),
                'registered_at': time.time(),
            }
        )()

        return f"Mounted {namespace} -- tools available as {namespace}.*"

    def mount_remote(self, namespace: str, url: str, role: str = "worker") -> str:
        """Register a remote agent URL for direct Client connections."""
        self._remote_agents[namespace] = url
        return f"Registered remote {namespace} -> {url}"

    async def call_remote_tool(self, namespace: str, tool_name: str, **kwargs) -> dict:
        """Call a tool on a remote agent by namespace."""
        url = self._remote_agents.get(namespace)
        if not url:
            return {"error": f"No remote agent registered for namespace '{namespace}'"}

        try:
            async with Client(url) as session:
                result = await session.call_tool(tool_name, kwargs)
                return {"status": "success", "result": result}
        except Exception as e:
            return {"error": str(e)}

    async def discover_tools(self, namespace: Optional[str] = None) -> dict[str, list[str]]:
        """Discover all available tools, optionally scoped to a namespace."""
        discovered = {}
        
        # Local mounted agents
        for ns, server in self._mounted_agents.items():
            if namespace and ns != namespace:
                continue
            try:
                tools = server._tool_manager._tools
                discovered[f"{ns}"] = list(tools.keys())
            except AttributeError:
                discovered[f"{ns}"] = ["<unavailable>"]

        # Remote agents
        for ns, url in self._remote_agents.items():
            if namespace and ns != namespace:
                continue
            try:
                async with Client(url) as session:
                    tools = await session.list_tools()
                    discovered[f"{ns}"] = [t.name for t in tools]
            except Exception as e:
                discovered[f"{ns}"] = [f"error: {e}"]

        return discovered

    async def dispatch_work(self, namespace: str, task_name: str, payload: dict, timeout: int = 300) -> dict:
        """Dispatch work to a specific agent namespace. Returns task_id for polling."""
        task_id = uuid.uuid4().hex
        self._task_store[task_id] = {
            "task_id": task_id,
            "namespace": namespace,
            "name": task_name,
            "payload": payload,
            "status": "dispatched",
            "created_at": time.time(),
        }

        # Start execution in background
        asyncio.create_task(self._execute_remote(task_id, namespace, task_name, payload, timeout))

        return {
            "task_id": task_id,
            "namespace": namespace,
            "status": "dispatched",
            "message": "Task dispatched -- poll get_task_status for updates",
        }

    async def _execute_remote(self, task_id: str, namespace: str, task_name: str, payload: dict, timeout: int):
        """Execute a dispatched task on a remote agent."""
        task = self._task_store[task_id]

        url = self._remote_agents.get(namespace)
        mounted = self._mounted_agents.get(namespace)

        try:
            if url:
                # Remote agent -- use Client
                async with Client(url) as session:
                    result = await session.call_tool(task_name, payload)
                    task["status"] = "completed"
                    task["result"] = result
                    task["completed_at"] = time.time()
            elif mounted:
                # Local mounted -- call through the server's tool manager
                tool_fn = mounted._tool_manager._tools.get(task_name)
                if tool_fn:
                    result = await tool_fn(**payload)
                    task["status"] = "completed"
                    task["result"] = result
                    task["completed_at"] = time.time()
                else:
                    task["status"] = "failed"
                    task["error"] = f"Tool '{task_name}' not found on {namespace}"
            else:
                task["status"] = "failed"
                task["error"] = f"No agent registered for namespace '{namespace}'"

        except asyncio.TimeoutError:
            task["status"] = "timeout"
            task["error"] = f"Task timed out after {timeout}s"
        except Exception as e:
            task["status"] = "failed"
            task["error"] = str(e)
            task["completed_at"] = time.time()

    def _register_orchestrator_tools(self):
        """Register orchestrator-level MCP tools."""
        orch = self

        @self.server.tool
        async def list_agents() -> list[dict]:
            """List all mounted and registered agents with their capabilities."""
            return await orch.registry.list_agents()

        @self.server.tool
        async def discover_tools(namespace: str = "") -> dict:
            """Discover all available tools across mounted agents.
            
            Optionally specify a namespace to discover only that agent's tools.
            """
            ns = namespace if namespace else None
            return await orch.discover_tools(ns)

        @self.server.tool
        async def orchestrate_workflow(steps: list[dict]) -> dict:
            """Execute a multi-step workflow across agents.
            
            Each step: {"namespace": "rehab", "tool": "scope_property", "payload": {...}}
            Steps execute sequentially. Use step results in subsequent step payloads
            via the special "__prev__" key which maps to the previous step's result.
            
            Returns: {"status": "completed|failed", "steps": [...], "final_result": ...}
            """
            workflow_id = uuid.uuid4().hex[:12]
            results = []
            prev_result = None

            for i, step in enumerate(steps):
                ns = step.get("namespace", "")
                tool = step.get("tool", "")
                payload = step.get("payload", {})

                # Replace __prev__ references
                if isinstance(payload, dict):
                    for key, val in payload.items():
                        if val == "__prev__" and prev_result:
                            payload[key] = prev_result

                step_start = time.time()
                try:
                    if ns in orch._remote_agents:
                        result = await orch.call_remote_tool(ns, tool, **payload)
                    elif ns in orch._mounted_agents:
                        server = orch._mounted_agents[ns]
                        tool_fn = server._tool_manager._tools.get(tool)
                        if tool_fn:
                            raw = await tool_fn(**payload)
                            result = {"status": "success", "result": raw}
                        else:
                            result = {"error": f"Tool '{tool}' not found on {ns}"}
                    else:
                        result = {"error": f"Namespace '{ns}' not found"}

                    step_result = {
                        "step": i + 1,
                        "namespace": ns,
                        "tool": tool,
                        "status": "completed" if "error" not in result else "failed",
                        "duration": time.time() - step_start,
                        "result": result.get("result", result),
                    }
                except Exception as e:
                    step_result = {
                        "step": i + 1,
                        "namespace": ns,
                        "tool": tool,
                        "status": "failed",
                        "duration": time.time() - step_start,
                        "error": str(e),
                    }

                results.append(step_result)
                if step_result["status"] == "completed":
                    prev_result = step_result.get("result", prev_result)
                else:
                    return {
                        "workflow_id": workflow_id,
                        "status": "failed",
                        "failed_at_step": i + 1,
                        "steps": results,
                    }

            return {
                "workflow_id": workflow_id,
                "status": "completed",
                "total_steps": len(steps),
                "total_duration": sum(s.get("duration", 0) for s in results),
                "steps": results,
                "final_result": prev_result,
            }

        @self.server.tool
        async def get_task_status(task_id: str) -> dict:
            """Get the status of a task dispatched via the orchestrator."""
            task = orch._task_store.get(task_id)
            if not task:
                return {"error": f"Task {task_id} not found"}
            return task
