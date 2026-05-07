"""
Agent Mesh -- FastMCP-based multi-agent communication layer.

Provides:
1. Agent Server Base Class -- every agent inherits, auto-registers as FastMCP server
2. Task Delegation Protocol -- async task dispatch, polling, results, error handling
3. Agent Registry/Discovery -- orchestrator can find and connect to any agent dynamically
4. Server Mounting Layer -- transparent tool sharing between agents via namespace prefixes

All built on FastMCP v3.2.4, backed by the official MCP Python SDK.
"""

from .agent_base import AgentBase
from .task_protocol import TaskProtocol, TaskStatus, TaskDispatch, TaskResult, TaskError, TaskProgress
from .registry import AgentRegistry, AgentEndpoint
from .orchestrator import Orchestrator
from .workers import create_rehab_agent, create_dispatch_agent, create_estimator_agent

__all__ = [
    "AgentBase",
    "TaskProtocol",
    "TaskStatus",
    "TaskDispatch",
    "TaskResult",
    "TaskError",
    "TaskProgress",
    "AgentRegistry",
    "AgentEndpoint",
    "Orchestrator",
    "create_rehab_agent",
    "create_dispatch_agent",
    "create_estimator_agent",
]
