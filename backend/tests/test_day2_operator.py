"""
Phase 5D — Day-2 Operator Experience polish — backend tests.

Covers:
  - GET /api/operator/notifications (Day-2 aggregator, severity sort)
  - GET /api/approvals/email-link (HMAC-signed, no token / bad token / valid)
  - GET /api/flight-deck/manifest (release_url + per-artifact fallback)
"""
import os
import hmac
import hashlib
import base64
import pytest
import requests

BASE_URL = "https://token-monetization.preview.emergentagent.com"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin12345"},
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


# ── /api/operator/notifications ─────────────────────────────────────
class TestOperatorNotifications:
    def test_feed_shape(self, session):
        r = session.get(f"{BASE_URL}/api/operator/notifications")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "unread_count" in data and "total_count" in data
        assert "workspace_id" in data and data["workspace_id"] == 1
        assert isinstance(data["items"], list)

    def test_seeded_five_items(self, session):
        r = session.get(f"{BASE_URL}/api/operator/notifications")
        data = r.json()
        # Seeded: 1 critical task, 1 failed exec, 1 blocked, 1 stale approval, 1 fresh approval
        assert data["total_count"] >= 5, f"Expected >=5 seeded items, got {data['total_count']}"
        assert data["unread_count"] == data["total_count"]

    def test_severity_sort_order(self, session):
        r = session.get(f"{BASE_URL}/api/operator/notifications")
        data = r.json()
        rank = {"critical": 0, "warn": 1, "info": 2}
        prev = -1
        for it in data["items"]:
            cur = rank[it["severity"]]
            assert cur >= prev, f"severity out of order: {it}"
            prev = cur

    def test_kinds_present(self, session):
        r = session.get(f"{BASE_URL}/api/operator/notifications")
        data = r.json()
        kinds = {it["kind"] for it in data["items"]}
        # Required kinds per seeded data
        for needed in {"critical_task", "failed_execution", "blocked_action", "approval_pending"}:
            assert needed in kinds, f"missing kind: {needed} in {kinds}"

    def test_item_fields(self, session):
        r = session.get(f"{BASE_URL}/api/operator/notifications")
        for it in r.json()["items"]:
            for k in ("id", "kind", "title", "severity", "url", "created_at_iso"):
                assert k in it, f"missing {k} in {it}"
            assert it["severity"] in {"info", "warn", "critical"}

    def test_unauthenticated_blocked(self):
        r = requests.get(f"{BASE_URL}/api/operator/notifications")
        # Without auth cookie, should reject (any non-200)
        assert r.status_code in (401, 403)


# ── /api/approvals/email-link ───────────────────────────────────────
class TestEmailLinkApproval:
    def test_missing_token_returns_400(self):
        r = requests.get(f"{BASE_URL}/api/approvals/email-link")
        assert r.status_code == 400
        assert "Missing token" in r.text or "incomplete" in r.text

    def test_bad_token_returns_403(self):
        r = requests.get(f"{BASE_URL}/api/approvals/email-link?token=garbage")
        assert r.status_code == 403

    def test_random_b64_token_returns_403(self):
        # well-formed base64url but bad HMAC
        body = "9999.approve.9999999999"
        bad_sig = "00" * 32
        token = base64.urlsafe_b64encode(
            f"{body}.{bad_sig}".encode()
        ).decode().rstrip("=")
        r = requests.get(f"{BASE_URL}/api/approvals/email-link?token={token}")
        assert r.status_code == 403

    def test_valid_token_with_auth_secret(self):
        """Only runs if TEST_AUTH_SECRET is exported and matches server's AUTH_SECRET."""
        secret = os.environ.get("TEST_AUTH_SECRET")
        if not secret:
            pytest.skip("TEST_AUTH_SECRET not set — cannot generate matching HMAC token")
        # Try a nonexistent task → should be 404
        expires = 9999999999
        body = f"99999.approve.{expires}"
        sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        token = base64.urlsafe_b64encode(f"{body}.{sig}".encode()).decode().rstrip("=")
        r = requests.get(f"{BASE_URL}/api/approvals/email-link?token={token}")
        assert r.status_code == 404, f"expected 404, got {r.status_code}"


# ── /api/flight-deck/manifest ───────────────────────────────────────
class TestFlightDeckManifest:
    def test_status_and_release_url(self):
        r = requests.get(f"{BASE_URL}/api/flight-deck/manifest")
        assert r.status_code == 200
        data = r.json()
        assert data["release_url"] == (
            "https://github.com/WaltLuv/baseline-agent-os/releases/tag/flight-deck-v0.1.0"
        )
        assert data["version"] == "v0.1.0"

    def test_each_artifact_has_download_url(self):
        r = requests.get(f"{BASE_URL}/api/flight-deck/manifest")
        data = r.json()
        assert len(data["artifacts"]) >= 1
        for a in data["artifacts"]:
            assert a["download_url"], f"missing download_url for {a['filename']}"
            # Either local /api/flight-deck/download/... or GitHub Releases URL
            assert (
                a["download_url"].startswith("/api/flight-deck/download/")
                or "github.com/WaltLuv/baseline-agent-os/releases/download" in a["download_url"]
            ), f"bad download_url: {a['download_url']}"

    def test_github_fallback_for_missing_local(self):
        r = requests.get(f"{BASE_URL}/api/flight-deck/manifest")
        data = r.json()
        # At least one artifact should be falling back to GitHub Releases (the linux-x86_64,
        # macos, windows ones aren't built locally)
        gh_fallbacks = [
            a for a in data["artifacts"]
            if "github.com" in (a["download_url"] or "")
        ]
        assert len(gh_fallbacks) >= 1, "expected at least 1 GitHub-Releases fallback"
