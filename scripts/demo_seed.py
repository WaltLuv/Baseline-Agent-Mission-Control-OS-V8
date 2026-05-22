#!/usr/bin/env python3
"""
Baseline Automations Mission Control — Demo Workspace Seeder
Run this after starting the server to populate a clean demo workspace.

Usage: python3 demo_seed.py [BASE_URL] [API_KEY]
  BASE_URL:  default http://127.0.0.1:3000
  API_KEY:   from .env.local or environment

Requires: requests library (pip install requests)
"""

import requests
import json
import sys
import os

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MC_URL", "http://127.0.0.1:3000")
API_KEY = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("MC_API_KEY", "")
DEMO_ADMIN_USER = os.environ.get("MC_DEMO_USER", "demo")
DEMO_ADMIN_PASS = os.environ.get("MC_DEMO_PASS", "demo2026!")

H = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
}

def post(path: str, data: dict):
    r = requests.post(f"{BASE_URL}{path}", json=data, headers=H)
    if r.status_code not in (200, 201, 204):
        print(f"  ⚠ {r.status_code} {path}: {r.text[:200]}")
        return None
    try:
        return r.json()
    except:
        return {"ok": True}

def get(path: str):
    r = requests.get(f"{BASE_URL}{path}", headers=H)
    try:
        return r.json()
    except:
        return {"items": []}

def print_step(msg: str):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")

# ── 1. Agents ──────────────────────────────────────────────────
print_step("1. Seeding AI Agents")

AGENTS = [
    {"name": "Triage Agent", "soul": "Maintenance intake specialist — categorizes, prioritizes, and routes tenant maintenance requests to the correct workflow.", "gateway": "hermes"},
    {"name": "InspectBot", "soul": "VisionOps inspection analyst — processes property inspection photos, detects damage, auto-generates repair scopes.", "gateway": "hermes"},
    {"name": "OwnerComms", "soul": "Owner relations agent — generates financial reports, sends owner approval requests, answers owner questions.", "gateway": "hermes"},
    {"name": "Vendor Matcher", "soul": "Dispatch and vendor matching specialist — finds the right vendor for each job, negotiates pricing, tracks completion.", "gateway": "hermes"},
    {"name": "Saul — Revenue Agent", "soul": "Lead qualification and sales pipeline agent — manages CRM, scores leads, drafts outreach, tracks conversions.", "gateway": "hermes"},
    {"name": "Slim — Operations", "soul": "Primary operations commander — oversees all agents, approves workflows, escalates blocked tasks, generates daily briefings.", "gateway": "hermes"},
]

agent_ids = []
for a in AGENTS:
    print(f"  Creating agent: {a['name']}...")
    result = post("/api/agents", {
        "name": a["name"],
        "soul": a["soul"],
        "gateway": a["gateway"],
        "status": "active",
        "capacity": 3,
    })
    if result:
        aid = result.get("id") or result.get("agent", {}).get("id")
        agent_ids.append(aid)
        print(f"    ✓ Created (id: {aid})")

# ── 2. Tasks ───────────────────────────────────────────────────
print_step("2. Seeding Tasks")

TASKS = [
    ("Unit 4B Move-Out Inspection", "Process uploaded inspection photos for Unit 4B. Identify damages, auto-generate repair scope, estimate costs, queue for owner approval.", "inbox", "high", "InspectBot"),
    ("123 Oak St — Roof Leak", "Tenant reported ceiling leak. Classify urgency, assign priority, dispatch emergency vendor, notify owner.", "assigned", "urgent", "Triage Agent"),
    ("Monthly Owner Report — Portfolio A", "Generate monthly financial report: rent collected, maintenance spend, vacancy rates, owner distributions.", "review", "medium", "OwnerComms"),
    ("New Property Onboarding — 555 Elm", "Create 12 unit profiles, configure maintenance workflows, set vendor preferences, schedule first inspection.", "assigned", "high", "Vendor Matcher"),
    ("Lead Follow-up — Columbus PM", "Follow up with 3 inbound leads from Property Meld. Score each lead, draft personalized outreach email.", "done", "low", "Saul — Revenue Agent"),
    ("Weekly Standup Briefing", "Compile weekly agent activities: completed tasks, blocked items, cost summary, quality metrics, recommendations.", "inbox", "medium", "Slim — Operations"),
]

for title, desc, status, priority, agent_name in TASKS:
    print(f"  Creating task: {title}...")
    agent_id = None
    if agent_name and agent_ids:
        idx = next((i for i, a in enumerate(AGENTS) if a["name"] == agent_name), None)
        if idx is not None and idx < len(agent_ids):
            agent_id = agent_ids[idx]
    result = post("/api/tasks", {
        "title": title,
        "description": desc,
        "status": status,
        "priority": priority,
        "agent_id": agent_id,
        "workspace_id": "default",
    })
    if result:
        tid = result.get("id") or result.get("task", {}).get("id")
        print(f"    ✓ Created (id: {tid}, status: {status})")

# ── 3. Skills ──────────────────────────────────────────────────
print_step("3. Seeding Skills")

SKILLS = [
    {"name": "visionops-inspection", "description": "AI-powered property inspection analysis — damage detection, scope generation, cost estimation", "category": "property-management", "version": "1.0.0"},
    {"name": "maintenance-triage", "description": "Maintenance intake and priority classification — auto-routes tenant requests", "category": "property-management", "version": "1.0.0"},
    {"name": "owner-reporting", "description": "Automated financial reports for property owners — rent, expenses, distributions", "category": "property-management", "version": "1.0.0"},
    {"name": "vendor-dispatch", "description": "Vendor matching and dispatch — finds right vendor, negotiates, tracks completion", "category": "property-management", "version": "1.0.0"},
    {"name": "lead-scoring", "description": "CRM lead qualification and scoring — ranks prospects by fit and urgency", "category": "sales", "version": "1.0.0"},
    {"name": "security-scan", "description": "Skill security scanner — detects prompt injection, credential leaks, shell commands", "category": "security", "version": "1.0.0"},
]

for s in SKILLS:
    print(f"  Installing skill: {s['name']}...")
    result = post("/api/skills", {**s, "installed": True})
    if result:
        print(f"    ✓ Installed")

# ── 4. Quality Reviews ─────────────────────────────────────────
print_step("4. Seeding Quality Reviews")

for title, status in [("Unit 4B Damage Assessment Pass", "approved"), ("Owner Report Review — Needs Revision", "revision_requested"), ("Vendor Bid Comparison — Approved", "approved")]:
    print(f"  Creating quality review: {title}...")
    post("/api/quality-reviews", {
        "title": title,
        "status": status,
        "reviewer": "Slim — Operations",
        "notes": "Auto-generated quality gate review.",
    })
    print(f"    ✓ Created ({status})")

# ── 5. Cost Tracking ───────────────────────────────────────────
print_step("5. Seeding Cost Data")

cost_items = [
    {"action": "inspection_analysis", "agent": "InspectBot", "credits": 45, "model": "gemini-pro"},
    {"action": "triage_classification", "agent": "Triage Agent", "credits": 12, "model": "gpt-4o-mini"},
    {"action": "owner_report_generation", "agent": "OwnerComms", "credits": 180, "model": "claude-sonnet"},
    {"action": "vendor_matching", "agent": "Vendor Matcher", "credits": 30, "model": "gpt-4o-mini"},
    {"action": "lead_outreach_draft", "agent": "Saul — Revenue Agent", "credits": 25, "model": "gpt-4o-mini"},
    {"action": "daily_briefing", "agent": "Slim — Operations", "credits": 200, "model": "claude-sonnet"},
]

for ci in cost_items:
    print(f"  Recording cost: {ci['action']}...")
    post("/api/billing/charge", {**ci, "workspace_id": "default"})

# ── 6. Activity Feed ───────────────────────────────────────────
print_step("6. Seeding Activity Feed")

activities = [
    {"type": "agent.task_started", "agent": "InspectBot", "description": "Started inspection analysis for Unit 4B", "severity": "info"},
    {"type": "agent.task_completed", "agent": "Triage Agent", "description": "Completed triage for 123 Oak St — roof leak classified as URGENT", "severity": "info"},
    {"type": "quality.review_passed", "description": "Damage assessment approved by Slim", "severity": "info"},
    {"type": "security.scan_complete", "description": "Skill 'visionops-inspection' passed security scan — clean", "severity": "info"},
    {"type": "vendor.dispatched", "agent": "Vendor Matcher", "description": "Emergency roofer dispatched to 123 Oak St", "severity": "medium"},
    {"type": "billing.credits_added", "description": "5,000 AI Workforce Credits purchased (Growth Plan)", "severity": "info"},
]

for act in activities:
    print(f"  Logging activity: {act['type']}...")
    post("/api/activities", act)

# ── 7. Security Events ─────────────────────────────────────────
print_step("7. Seeding Security Events")

events = [
    {"event_type": "login_success", "detail": "demo user logged in", "severity": "low"},
    {"event_type": "skill_scan", "detail": "maintenance-triage scanned — clean", "severity": "info"},
    {"event_type": "api_key_generated", "detail": "New API key created for InspectBot agent", "severity": "medium"},
    {"event_type": "permission_change", "detail": "Agent 'Saul' assigned read access to workspace CRM", "severity": "low"},
]

for ev in events:
    print(f"  Logging security event: {ev['event_type']}...")
    post("/api/security-events", ev)

# ── 8. Workflows ───────────────────────────────────────────────
print_step("8. Seeding Workflows")

workflows = [
    {"name": "Inspection → Scope → Approval", "description": "Tenant submits inspection → VisionOps analyzes → auto-scope → owner approval → vendor dispatch", "status": "active"},
    {"name": "Maintenance Intake Pipeline", "description": "Tenant reports issue → Triage Agent classifies → auto-dispatch → completion tracking", "status": "active"},
    {"name": "Monthly Owner Reporting", "description": "End-of-month financial report generation → owner review → distribution", "status": "active"},
]

for wf in workflows:
    print(f"  Creating workflow: {wf['name']}...")
    post("/api/workflows", wf)

# ── Summary ────────────────────────────────────────────────────
print_step("✅ Demo workspace seeded successfully!")
print(f"""
Base URL: {BASE_URL}
Demo Credentials:
  Username: {DEMO_ADMIN_USER}
  Password: {DEMO_ADMIN_PASS}

What was created:
  • {len(AGENTS)} AI Agents
  • {len(TASKS)} Tasks (various statuses)
  • {len(SKILLS)} Skills installed
  • 3 Quality Reviews
  • {len(cost_items)} Cost entries
  • {len(activities)} Activity events
  • {len(events)} Security events
  • {len(workflows)} Workflows

This workspace demonstrates the full Mission Control
experience for prospects during demos.
""")
