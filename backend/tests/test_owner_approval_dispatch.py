"""Owner-approval "oh shit" moment — real approve → dispatch chain tests.

Covers the six required scenarios against a FRESH signup workspace (the PM
first-run demo seeds exactly one pending owner approval):

 1. approve action updates the work order (status → dry_run_dispatch here,
    'dispatched' in prod with Twilio creds)
 2. dispatch is triggered (dispatch.status + comms_id returned)
 3. proof entry created (comms_log count +1)
 4. replay link visible (work_order.replay_id present, replay has the
    'Owner approved' event)
 5. success-sequence data present in the API response (the UI sequence is
    driven 1:1 by these fields; rendering itself is covered by the vitest
    component test + browser verification)
 6. no duplicate dispatch on repeated approve (409-style error, comms count
    unchanged)

Run: cd /app/backend && /root/.venv/bin/python -m pytest tests/test_owner_approval_dispatch.py -v
"""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    "https://c5bbdf3d-0d20-4a28-9767-ef9f129a4142.preview.emergentagent.com"


@pytest.fixture(scope="module")
def user_session():
    """Fresh signup → session cookie + auto-provisioned PM demo workspace."""
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Origin": BASE_URL,
    })
    email = f"approve.flow.{int(time.time())}@baselinetest.com"
    r = s.post(f"{BASE_URL}/api/auth/signup", json={
        "email": email,
        "password": "DemoPassword123!",
        "full_name": "Approve Flow",
        "company_name": f"Approve Flow PM {int(time.time())}",
        "business_type": "pm",
    }, timeout=60)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("demo", {}).get("demo_seeded") is True
    return s


@pytest.fixture(scope="module")
def state():
    """Shared mutable state across the ordered tests in this module."""
    return {}


def _comms_count(s) -> int:
    r = s.get(f"{BASE_URL}/api/demo/seed", timeout=30)
    assert r.status_code == 200
    return r.json()["status"]["messages"]


def test_pending_approval_seeded(user_session, state):
    r = user_session.get(f"{BASE_URL}/api/approvals/owner", timeout=30)
    assert r.status_code == 200
    pending = r.json()["approvals"]
    assert len(pending) == 1, f"expected exactly 1 pending approval, got {len(pending)}"
    state["approval"] = pending[0]
    state["comms_before"] = _comms_count(user_session)


def test_approve_updates_work_order_and_triggers_dispatch(user_session, state):
    a = state["approval"]
    r = user_session.post(f"{BASE_URL}/api/approvals/owner", json={
        "id": a["id"], "decision": "approved", "note": "pytest approval",
    }, timeout=30)
    assert r.status_code == 200
    j = r.json()
    state["decision_response"] = j

    # 1. approval accepted
    assert j["ok"] is True
    assert j["approval"]["status"] == "approved"

    # 2. dispatch triggered (dry-run here — no Twilio creds — honest status)
    assert j["dispatch"]["status"] in ("dispatched", "dry_run_dispatch")

    # work order status changed accordingly
    assert j["work_order"]["id"] == a["work_order_id"]
    assert j["work_order"]["status"] == j["dispatch"]["status"]


def test_proof_entry_created(user_session, state):
    j = state["decision_response"]
    # 3. proof/comms entry created and referenced
    assert j["dispatch"].get("comms_id"), "dispatch must return the comms_log id"
    assert _comms_count(user_session) == state["comms_before"] + 1


def test_replay_link_visible(user_session, state):
    j = state["decision_response"]
    # 4. replay id surfaced for the UI link
    replay_id = j["work_order"]["replay_id"]
    assert replay_id, "work_order.replay_id must be present"

    r = user_session.get(f"{BASE_URL}/api/replay", timeout=30)
    assert r.status_code == 200
    replays = r.json()["replays"]
    target = next((x for x in replays if x["id"] == replay_id), None)
    assert target is not None, "replay for the approved work order must exist"
    labels = " | ".join(e.get("label", "") for e in target.get("events", []))
    assert "Owner approved" in labels, f"replay missing approval event: {labels[:300]}"
    assert "dispatch" in labels.lower(), f"replay missing dispatch event: {labels[:300]}"


def test_agent_activity_updated(user_session, state):
    # Agent Activity feed received both real events
    r = user_session.get(f"{BASE_URL}/api/activities?limit=20", timeout=30)
    assert r.status_code == 200
    acts = r.json().get("activities", r.json())
    if isinstance(acts, dict):
        acts = acts.get("activities", [])
    types = [a.get("type") for a in acts]
    assert "owner_approval_decided" in types
    assert "work_order_dispatched" in types


def test_success_sequence_fields_present(state):
    # 5. the UI success sequence is driven by exactly these response fields
    j = state["decision_response"]
    assert j["dispatch"]["status"]
    assert j["dispatch"]["comms_id"]
    assert j["work_order"]["replay_id"]
    assert j["work_order"]["status"]


def test_no_duplicate_dispatch_on_repeated_approve(user_session, state):
    a = state["approval"]
    before = _comms_count(user_session)
    r = user_session.post(f"{BASE_URL}/api/approvals/owner", json={
        "id": a["id"], "decision": "approved", "note": "duplicate attempt",
    }, timeout=30)
    j = r.json()
    # 6. second approve is rejected and does NOT re-dispatch
    assert j.get("ok") is not True
    assert "already" in (j.get("error") or "")
    assert _comms_count(user_session) == before, "duplicate approve must not create another dispatch/comms entry"
