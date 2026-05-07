"""
Worker agents -- Example implementation agents that demonstrate the mesh architecture.

These are reference implementations showing how to build agents using AgentBase:
- Rehab Agent: Property analysis and scope generation
- Dispatch Agent: Vendor dispatch and work order management
- Estimator Agent: Cost estimation and budgeting

Each agent demonstrates:
- Inheriting from AgentBase
- Registering tools with @agent.tool
- Registering async task handlers
- Self-registration with the mesh registry
"""

import asyncio
import time
import random
from typing import Any

from .agent_base import AgentBase


def create_rehab_agent(
    mc_url: str = None,
    mc_api_key: str = None,
    port: int = 8001,
) -> AgentBase:
    """Create a rehab scoring agent."""
    agent = AgentBase(
        name="rehab-scorer",
        role="rehab-analysis",
        mcp_url=f"http://127.0.0.1:{port}/mcp",
        mc_url=mc_url,
        mc_api_key=mc_api_key,
    )

    @agent.tool
    async def scope_property(address: str, photos: list[str] = None) -> dict[str, Any]:
        """Analyze a property and generate a rehab scope of work.
        
        Args:
            address: Full property address
            photos: Optional list of photo URLs for visual analysis
        """
        return {
            "address": address,
            "scope_generated": True,
            "categories": {
                "flooring": {"items": ["Replace laminate in living areas", "New carpet in bedrooms"], "confidence": 0.92},
                "paint": {"items": ["Interior full repaint - 2 coat", "Exterior trim touch-up"], "confidence": 0.88},
                "kitchen": {"items": ["Cabinet refinish", "Countertop replacement", "New backsplash"], "confidence": 0.85},
                "bathroom": {"items": ["Vanity replacement", "Tile regrout", "Fixture upgrade"], "confidence": 0.90},
                "hvac": {"items": ["Filter replacement", "Duct cleaning"], "confidence": 0.78},
            },
            "total_items": 11,
            "confidence": 0.87,
            "photos_analyzed": len(photos or []),
        }

    @agent.tool
    async def classify_severity(scope: dict) -> dict[str, Any]:
        """Classify rehab items by severity: cosmetic, functional, critical."""
        categories = scope.get("categories", {})
        classified = {"cosmetic": [], "functional": [], "critical": []}

        for cat, data in categories.items():
            confidence = data.get("confidence", 0.5)
            items = data.get("items", [])
            if confidence > 0.9:
                classified["critical"].extend(items)
            elif confidence > 0.75:
                classified["functional"].extend(items)
            else:
                classified["cosmetic"].extend(items)

        return classified

    # Register async task handlers
    agent.task_protocol.register_handler("full_scope", _full_scope_handler)
    agent.task_protocol.register_handler("photo_analysis", _photo_analysis_handler)

    return agent


async def _full_scope_handler(address: str, depth: str = "standard", **kwargs) -> dict:
    """Async handler for full property scope generation task."""
    stages = [
        "Analyzing property records",
        f"Comparing similar properties in area",
        "Reviewing condition factors",
        "Generating scope items",
        "Calculating confidence scores",
    ]
    # Simulate staged processing
    for i, stage in enumerate(stages):
        await asyncio.sleep(0.3)

    return {
        "address": address,
        "depth": depth,
        "scope_items": 15,
        "estimated_days": random.randint(7, 21),
        "priority_items": 4,
    }


async def _photo_analysis_handler(photo_urls: list[str], analysis_type: str = "full") -> dict:
    """Async handler for photo analysis task."""
    return {
        "photos_analyzed": len(photo_urls),
        "analysis_type": analysis_type,
        "findings": [
            {"area": "exterior", "condition": "fair", "recommended_action": "paint and minor repairs"},
            {"area": "interior", "condition": "good", "recommended_action": "cosmetic updates only"},
        ],
    }


def create_dispatch_agent(
    mc_url: str = None,
    mc_api_key: str = None,
    port: int = 8002,
) -> AgentBase:
    """Create a vendor dispatch agent."""
    agent = AgentBase(
        name="dispatch-agent",
        role="vendor-dispatch",
        mcp_url=f"http://127.0.0.1:{port}/mcp",
        mc_url=mc_url,
        mc_api_key=mc_api_key,
    )

    @agent.tool
    async def find_vendor(service_type: str, zip_code: str, max_distance_miles: int = 25) -> dict:
        """Find the best matching vendor for a service type and location."""
        vendors = {
            "plumbing": {"name": "ProFlow Plumbing", "rating": 4.8, "eta_hours": 2},
            "electrical": {"name": "Spark Electric Co", "rating": 4.6, "eta_hours": 4},
            "flooring": {"name": "FloorCraft Pro", "rating": 4.9, "eta_hours": 24},
            "painting": {"name": "Prime & Shine", "rating": 4.7, "eta_hours": 48},
            "hvac": {"name": "Climate Control Inc", "rating": 4.5, "eta_hours": 3},
        }
        vendor = vendors.get(service_type.lower(), {"name": "General Contractor", "rating": 4.0, "eta_hours": 24})
        vendor["zip_code"] = zip_code
        vendor["within_distance"] = max_distance_miles
        return vendor

    @agent.tool
    async def send_workorder(
        vendor_name: str,
        scope: dict,
        priority: str = "medium",
        owner_approval: bool = True,
    ) -> dict:
        """Send a work order to a vendor. Requires owner approval for jobs >$500."""
        return {
            "workorder_sent": True,
            "vendor": vendor_name,
            "priority": priority,
            "owner_approval": owner_approval,
            "estimated_start": "2026-05-10",
            "tracking_id": f"WO-{time.time():.0f}",
        }

    @agent.tool
    async def check_vendor_availability(vendor_name: str, date: str = None) -> dict:
        """Check if a vendor is available on a given date."""
        return {
            "vendor": vendor_name,
            "available": True,
            "next_opening": "2026-05-12",
            "booked_through": "2026-05-10" if date else None,
        }

    agent.task_protocol.register_handler("bulk_dispatch", _bulk_dispatch_handler)

    return agent


async def _bulk_dispatch_handler(work_orders: list[dict], **kwargs) -> dict:
    """Async handler for bulk dispatch task."""
    results = []
    for i, wo in enumerate(work_orders):
        results.append({
            "work_order": wo,
            "dispatched": True,
            "tracking_id": f"WO-{time.time():.0f}-{i}",
        })
    return {"total_dispatched": len(results), "results": results}


def create_estimator_agent(
    mc_url: str = None,
    mc_api_key: str = None,
    port: int = 8003,
) -> AgentBase:
    """Create a cost estimation agent."""
    agent = AgentBase(
        name="estimator",
        role="cost-estimation",
        mcp_url=f"http://127.0.0.1:{port}/mcp",
        mc_url=mc_url,
        mc_api_key=mc_api_key,
    )

    @agent.tool
    async def estimate_scope(scope: dict, region: str = "default") -> dict:
        """Generate cost estimate from a rehab scope."""
        categories = scope.get("categories", {})
        pricing = {
            "flooring": {"per_unit": 8, "unit": "sqft"},
            "paint": {"per_unit": 3, "unit": "sqft"},
            "kitchen": {"base": 8000},
            "bathroom": {"base": 5000},
            "hvac": {"base": 2500},
        }

        line_items = []
        total = 0

        for cat in categories:
            price = pricing.get(cat, {"base": 1000})
            cost = price.get("base", random.randint(1000, 5000))
            line_items.append({
                "category": cat,
                "cost": cost,
                "confidence": categories[cat].get("confidence", 0.5),
            })
            total += cost

        return {
            "line_items": line_items,
            "subtotal": total,
            "contingency_pct": 15,
            "contingency": total * 0.15,
            "total": total * 1.15,
            "region_multipler": 1.0,
        }

    @agent.tool
    async def compare_estimates(estimates: list[dict]) -> dict:
        """Compare multiple estimates and find the best value."""
        if not estimates:
            return {"error": "No estimates provided"}

        totals = [{"index": i, "total": e.get("total", 0)} for i, e in enumerate(estimates)]
        totals.sort(key=lambda x: x["total"])

        return {
            "best_value": totals[0],
            "total_compared": len(estimates),
            "savings_vs_highest": totals[-1]["total"] - totals[0]["total"],
        }

    @agent.tool
    async def check_budget(total: float, budget_limit: float) -> dict:
        """Check if an estimate is within budget and suggest adjustments."""
        within = total <= budget_limit
        overage = total - budget_limit if not within else 0
        return {
            "within_budget": within,
            "total": total,
            "budget_limit": budget_limit,
            "overage": overage if not within else 0,
            "headroom": budget_limit - total if within else 0,
        }

    agent.task_protocol.register_handler("multi_property_estimate", _multi_property_handler)

    return agent


async def _multi_property_handler(properties: list[dict], **kwargs) -> dict:
    """Async handler for multi-property estimation."""
    estimates = []
    for prop in properties:
        estimate = {
            "address": prop.get("address", "unknown"),
            "total": random.randint(15000, 45000),
            "breakdown": {"flooring": 5000, "paint": 3000, "kitchen": 12000, "bathroom": 8000},
        }
        estimates.append(estimate)

    return {"properties": len(estimates), "grand_total": sum(e["total"] for e in estimates), "estimates": estimates}
