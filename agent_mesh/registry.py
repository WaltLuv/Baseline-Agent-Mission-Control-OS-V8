"""
Agent Registry/Discovery -- Orchestrator can find and connect to any agent dynamically.

Provides:
- In-memory registry of known agents (name, role, URL, capabilities)
- Self-registration when an agent starts
- Dynamic discovery via MCP tool listing
- Remote agent mounting support
"""

import time
from typing import Any, Optional
from dataclasses import dataclass, field
from fastmcp import FastMCP


@dataclass
class AgentEndpoint:
    """Represents a single agent's endpoint and capabilities."""
    name: str
    role: str
    url: str  # MCP endpoint URL
    transport: str = "streamable-http"
    status: str = "unknown"  # online, offline, busy, error
    capabilities: list[str] = field(default_factory=list)  # tool names
    metadata: dict = field(default_factory=dict)
    last_seen: Optional[float] = None
    registered_at: float = field(default_factory=time.time)


class AgentRegistry:
    """
    Registry of known agents with discovery capabilities.
    
    Each agent creates its own registry instance, which:
    1. Self-registers on startup
    2. Accepts remote agent registrations
    3. Provides MCP tools for discovery and lookup
    """

    def __init__(self, server: FastMCP):
        self._agents: dict[str, AgentEndpoint] = {}
        self._server = server
        self._register_discovery_tools()

    async def register_self(self, name: str, role: str, url: str, transport: str = "streamable-http"):
        """Register this agent in the registry."""
        # Enumerate our own tools
        tool_names = []
        try:
            tools = self._server._tool_manager._tools
            tool_names = list(tools.keys())
        except AttributeError:
            pass

        self._agents[name] = AgentEndpoint(
            name=name,
            role=role,
            url=url,
            transport=transport,
            status="online",
            capabilities=tool_names,
            last_seen=time.time(),
        )

    async def register_remote_agent(self, name: str, url: str, role: str = "worker", transport: str = "streamable-http") -> dict[str, Any]:
        """Register a remote agent's endpoint."""
        try:
            from fastmcp import Client
            # Probe the remote agent to auto-discover its tools
            async with Client(url) as session:
                tools = await session.list_tools()
                capability_names = [t.name for t in tools]

                self._agents[name] = AgentEndpoint(
                    name=name,
                    role=role,
                    url=url,
                    transport=transport,
                    status="online",
                    capabilities=capability_names,
                    last_seen=time.time(),
                )

                return {
                    "registered": True,
                    "name": name,
                    "role": role,
                    "url": url,
                    "discovered_tools": capability_names,
                }

        except Exception as e:
            # Register with unknown capabilities
            self._agents[name] = AgentEndpoint(
                name=name,
                role=role,
                url=url,
                transport=transport,
                status="error",
                capabilities=[],
                last_seen=None,
                metadata={"error": str(e)},
            )
            return {
                "registered": True,
                "name": name,
                "role": role,
                "url": url,
                "discovered_tools": [],
                "probe_error": str(e),
            }

    async def get_agent(self, name: str) -> Optional[AgentEndpoint]:
        """Get info about a specific agent."""
        return self._agents.get(name)

    async def list_agents(self, role: Optional[str] = None, status: Optional[str] = None) -> list[dict[str, Any]]:
        """List all registered agents, optionally filtered."""
        agents = []
        for ep in self._agents.values():
            if role and ep.role != role:
                continue
            if status and ep.status != status:
                continue
            agents.append({
                "name": ep.name,
                "role": ep.role,
                "url": ep.url,
                "transport": ep.transport,
                "status": ep.status,
                "capabilities": ep.capabilities,
                "last_seen": ep.last_seen,
            })
        return agents

    async def list_all_agents(self) -> list[dict[str, Any]]:
        """Full detail list of all agents."""
        return await self.list_agents()

    async def find_agents_by_capability(self, tool_name: str) -> list[dict[str, Any]]:
        """Find all agents that expose a specific tool/capability."""
        matches = []
        for ep in self._agents.values():
            if tool_name in ep.capabilities or tool_name in ep.role.lower():
                matches.append({
                    "name": ep.name,
                    "role": ep.role,
                    "url": ep.url,
                    "status": ep.status,
                })
        return matches

    async def lookup_tool(self, tool_name: str) -> Optional[dict[str, Any]]:
        """Find which agent provides a specific tool."""
        for ep in self._agents.values():
            if tool_name in ep.capabilities:
                return {
                    "agent_name": ep.name,
                    "agent_url": ep.url,
                    "tool_name": tool_name,
                }
        return None

    def unregister(self, name: str):
        """Remove an agent from the registry."""
        self._agents.pop(name, None)

    def _register_discovery_tools(self):
        """Register registry discovery as MCP tools."""
        registry = self

        @self._server.tool
        async def list_agents() -> list[dict[str, Any]]:
            """List all known agents in the mesh with their capabilities."""
            return await registry.list_agents()

        @self._server.tool
        async def find_agent_by_tool(tool_name: str) -> dict:
            """Find which agent provides a specific tool."""
            result = await registry.lookup_tool(tool_name)
            if result:
                return result
            return {"error": f"No agent provides tool '{tool_name}'"}

        @self._server.tool
        async def register_agent(name: str, url: str, role: str = "worker") -> dict:
            """Register a new agent endpoint in the mesh."""
            return await registry.register_remote_agent(name, url, role)

        @self._server.tool
        async def agent_capabilities(agent_name: str) -> dict:
            """Get the full capability list for a specific agent."""
            ep = await registry.get_agent(agent_name)
            if not ep:
                return {"error": f"Agent '{agent_name}' not found"}
            return {
                "name": ep.name,
                "role": ep.role,
                "url": ep.url,
                "status": ep.status,
                "capabilities": ep.capabilities,
                "last_seen": ep.last_seen,
            }
