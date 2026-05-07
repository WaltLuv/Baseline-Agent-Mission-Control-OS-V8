from fastmcp import FastMCP
from typing import Any, Optional
import time
import uuid
import asyncio
import json

# Import local modules
from .task_protocol import (
    TaskProtocol, TaskStatus, TaskResult, TaskError,
    TaskDispatch, TaskProgress
)
from .registry import AgentRegistry, AgentEndpoint
from .mc_sync import MissionControlSync


class AgentBase:
    """
    Agent Server Base Class -- every agent inherits from this.
    Auto-registers itself as a FastMCP server with common lifecycle,
    task protocol support, and Mission Control integration.
    """

    def __init__(
        self,
        name: str,
        role: str,
        mcp_url: Optional[str] = None,
        mc_url: Optional[str] = None,
        mc_api_key: Optional[str] = None,
        max_concurrency: int = 5,
        heartbeat_interval: int = 30,
    ):
        self.agent_name = name
        self.agent_role = role
        self.agent_id = f"{name}-{uuid.uuid4().hex[:8]}"
        self._mcp_url = mcp_url  # This agent's own MCP endpoint URL
        self._max_concurrency = max_concurrency
        self._heartbeat_interval = heartbeat_interval
        self._active_tasks: dict[str, TaskDispatch] = {}
        self._task_semaphore = asyncio.Semaphore(max_concurrency)

        # FastMCP server instance
        self.server = FastMCP(name)

        # Task protocol
        self.task_protocol = TaskProtocol(self, self.server)

        # Registry for discovery
        self.registry = AgentRegistry(self.server)

        # Mission Control sync
        self.mc_sync = MissionControlSync(mc_url=mc_url, mc_api_key=mc_api_key)

        # Register built-in self-inspection tools
        self._register_builtin_tools()

    def tool(self, *args, **kwargs):
        """Decorator to expose a method as an MCP tool."""
        def decorator(fn):
            return self.server.tool(*args, **kwargs)(fn)
        if args and callable(args[0]):
            return self.server.tool()(args[0])
        return decorator

    def _register_builtin_tools(self):
        """Register self-inspection and health tools."""

        # Store reference to self for closures
        agent = self

        @self.server.tool
        async def agent_status() -> dict[str, Any]:
            """Return this agent's status, loaded tools, and active tasks."""
            tools = await self._get_registered_tools()
            return {
                "agent_id": agent.agent_id,
                "name": agent.agent_name,
                "role": agent.agent_role,
                "mcp_url": agent._mcp_url,
                "max_concurrency": agent._max_concurrency,
                "active_task_count": len(agent._active_tasks),
                "active_tasks": list(agent._active_tasks.keys()),
                "registered_tools": tools,
                "timestamp": time.time(),
            }

        @self.server.tool
        async def agent_health() -> dict[str, Any]:
            """Health check -- returns uptime, memory, and task queue depth."""
            import os
            try:
                import resource
                mem = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # MB
            except ImportError:
                mem = 0
            return {
                "status": "healthy",
                "agent_name": agent.agent_name,
                "agent_id": agent.agent_id,
                "uptime": time.monotonic(),
                "memory_mb": round(mem, 1),
                "active_tasks": len(agent._active_tasks),
                "max_concurrency": agent._max_concurrency,
            }

        @self.server.tool
        async def agent_mount(namespace: str, target_url: str) -> str:
            """Mount another agent's MCP server under a namespace prefix.
            
            After mounting, that agent's tools are available as `namespace.tool_name`.
            Uses FastMCP's built-in server mounting for transparent composition.
            """
            try:
                from fastmcp import Client
                # Register the remote agent in our registry
                await self.registry.register_remote_agent(
                    name=namespace,
                    url=target_url,
                    role="remote-worker",
                )
                return f"Mounted {namespace} -> {target_url}. Tools accessible as {namespace}.*"
            except Exception as e:
                return f"Failed to mount {namespace}: {e}"

        @self.server.tool
        async def agent_list_mounted() -> list[dict[str, Any]]:
            """List all mounted/namespaced agents and their available tools."""
            return await self.registry.list_all_agents()

    async def _get_registered_tools(self) -> list[dict[str, Any]]:
        """Get list of all registered tool names."""
        # FastMCP stores tools in its internal tool manager
        try:
            tools = self.server._tool_manager._tools  # internal access
            return [
                {"name": name, "description": tool.description or ""}
                for name, tool in tools.items()
            ]
        except AttributeError:
            return [{"name": "unknown", "description": "Could not enumerate tools"}]

    def run(self, transport: str = "streamable-http", port: int = 8000, mount: Optional[dict] = None):
        """
        Start the agent's MCP server.
        
        Args:
            transport: "streamable-http", "sse", or "stdio"
            port: Port to listen on
            mount: Optional dict of namespace -> FastMCP server to mount
        """
        if mount:
            for namespace, target_server in mount.items():
                self.server.mount(namespace, target_server)
                self.mc_sync._log(f"Mounted {namespace} server")

        self.mc_sync._log(f"Starting agent {self.agent_name} on {transport} port {port}")
        self.server.run(transport=transport, port=port)

    async def start_async(self, transport: str = "streamable-http", port: int = 8000, mount: Optional[dict] = None):
        """Start the agent server async (for running alongside other tasks)."""
        if mount:
            for namespace, target_server in mount.items():
                self.server.mount(namespace, target_server)

        # Register with Mission Control
        await self.mc_sync.register_agent(
            name=self.agent_name,
            role=self.agent_role,
            mcp_url=self._mcp_url,
        )

        # Start heartbeat
        asyncio.create_task(self._heartbeat_loop())

    async def _heartbeat_loop(self):
        """Periodically report heartbeat to Mission Control."""
        while True:
            try:
                await self.mc_sync.update_agent_status(
                    name=self.agent_name,
                    status="idle",
                    active_tasks=len(self._active_tasks),
                )
            except Exception as e:
                self.mc_sync._log(f"Heartbeat error: {e}")
            await asyncio.sleep(self._heartbeat_interval)
