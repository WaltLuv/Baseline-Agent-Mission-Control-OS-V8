"""Backend tests for the Property Management Workforce one-click installer (Phase 5).

Covers:
  - GET /api/workforce/templates returns 8 templates: 1 ready (property-management) + 7 coming_soon
  - POST /api/workforce/install for property-management (idempotent: 201 then 200)
  - POST /api/workforce/install for coming-soon slug returns 400 status='unavailable'
  - POST /api/workforce/install unauthenticated returns 401
  - DB rows: 6 agents w/ source='workforce-template:property-management', 12 tasks w/ metadata
  - settings table has 12 ws.1.workforce.property-management.* rows incl .installed.
  - audit_log + activities each have an entry
"""
import os
import re
import sqlite3
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://mission-control-v8.preview.emergentagent.com"
).rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "admin12345"
UA = {"User-Agent": "Mozilla/5.0 (compatible; WorkforceInstallTest/1.0)"}

# Standalone DB lives at /app/.next/standalone/.data/mission-control.db per agent note
DB_PATH = "/app/.next/standalone/.data/mission-control.db"

COMING_SOON_SLUGS = [
    "general-contractor",
    "home-services",
    "real-estate",
    "mortgage",
    "cpa",
    "law-firm",
    "agency",
]
PM_SLUG = "property-management"
EXPECTED_PERSONAS = {"Tessa Reyes", "Marcus Doyle", "Rena Patel", "Owen Whitfield", "Vince Cardella", "Quinn Hartley"}


# ---------------- Sessions ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update(UA)
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def anon_session():
    s = requests.Session()
    s.headers.update(UA)
    return s


# ---------------- Helpers ----------------
def _fetch_templates(session):
    """GET /api/workforce/templates → assert 200 and return the templates list."""
    r = session.get(f"{BASE_URL}/api/workforce/templates", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    templates = body.get("templates") if isinstance(body, dict) else body
    assert isinstance(templates, list), f"unexpected shape: {body}"
    return templates


# ---------------- Templates GET ----------------
class TestTemplatesList:
    def test_returns_exactly_8_templates(self, admin_session):
        templates = _fetch_templates(admin_session)
        assert len(templates) == 8, f"expected 8 templates, got {len(templates)}"

    def test_one_ready_template_is_property_management(self, admin_session):
        templates = _fetch_templates(admin_session)
        ready = [t for t in templates if t.get("status") == "ready"]
        assert len(ready) == 1, f"expected 1 ready, got {len(ready)}: {[t.get('slug') for t in ready]}"
        assert ready[0].get("slug") == PM_SLUG

    def test_seven_coming_soon_templates(self, admin_session):
        templates = _fetch_templates(admin_session)
        coming = [t for t in templates if t.get("status") == "coming_soon"]
        assert len(coming) == 7, f"expected 7 coming_soon, got {len(coming)}"

    @pytest.mark.parametrize("expected_slug", COMING_SOON_SLUGS)
    def test_coming_soon_slug_present(self, admin_session, expected_slug):
        templates = _fetch_templates(admin_session)
        coming_slugs = {t.get("slug") for t in templates if t.get("status") == "coming_soon"}
        assert expected_slug in coming_slugs, f"missing coming-soon slug: {expected_slug}"


# ---------------- Install Auth Gating ----------------
class TestInstallAuthGating:
    def test_install_requires_auth_401(self, anon_session):
        r = anon_session.post(
            f"{BASE_URL}/api/workforce/install",
            json={"template": PM_SLUG},
            timeout=30,
        )
        assert r.status_code == 401, f"expected 401 unauth, got {r.status_code}: {r.text}"


# ---------------- Install: coming-soon refuses ----------------
class TestInstallComingSoon:
    @pytest.mark.parametrize("slug", COMING_SOON_SLUGS)
    def test_coming_soon_returns_400_unavailable(self, admin_session, slug):
        r = admin_session.post(
            f"{BASE_URL}/api/workforce/install",
            json={"template": slug},
            timeout=30,
        )
        assert r.status_code == 400, f"{slug}: expected 400, got {r.status_code}: {r.text}"
        body = r.json()
        # accept either {status:'unavailable'} or {error:{status:'unavailable'}}
        flat_status = body.get("status") if isinstance(body, dict) else None
        nested_status = body.get("error", {}).get("status") if isinstance(body.get("error"), dict) else None
        assert flat_status == "unavailable" or nested_status == "unavailable" or "unavailable" in str(body).lower(), (
            f"{slug}: expected status=unavailable, body={body}"
        )


def _install_pm(session):
    """POST /api/workforce/install for PM and return (status_code, body)."""
    r = session.post(
        f"{BASE_URL}/api/workforce/install",
        json={"template": PM_SLUG},
        timeout=60,
    )
    return r.status_code, r.json() if r.headers.get("content-type", "").startswith("application/json") else {}


def _install_counts(body):
    """Pull (personas, workflows, tools) out of an install response body."""
    personas = body.get("personas") or body.get("agents") or []
    workflows = body.get("tasks") or body.get("workflows") or []
    tools = body.get("tools") or []
    return personas, workflows, tools


# ---------------- Install: property-management happy + idempotency ----------------
class TestInstallPropertyManagement:
    def test_first_install_returns_2xx(self, admin_session):
        status, _ = _install_pm(admin_session)
        assert status in (200, 201), f"first install: {status}"

    def test_first_install_returns_six_personas(self, admin_session):
        _, body = _install_pm(admin_session)
        personas, _, _ = _install_counts(body)
        assert len(personas) == 6, f"expected 6 personas, got {len(personas)}: {personas}"

    def test_first_install_returns_twelve_workflows(self, admin_session):
        _, body = _install_pm(admin_session)
        _, workflows, _ = _install_counts(body)
        assert len(workflows) == 12, f"expected 12 workflows/tasks, got {len(workflows)}"

    def test_first_install_returns_eleven_tools(self, admin_session):
        _, body = _install_pm(admin_session)
        _, _, tools = _install_counts(body)
        assert len(tools) == 11, f"expected 11 tools, got {len(tools)}"

    def test_reinstall_returns_200(self, admin_session):
        # ensure installed first
        _install_pm(admin_session)
        status, _ = _install_pm(admin_session)
        assert status == 200, f"second install: {status}"

    def test_reinstall_status_is_already_installed(self, admin_session):
        _install_pm(admin_session)
        _, body = _install_pm(admin_session)
        status_field = body.get("status") or body.get("state")
        assert status_field in ("already_installed", "installed", "ok"), f"unexpected status on reinstall: {body}"

    def test_reinstall_counts_stable(self, admin_session):
        _install_pm(admin_session)
        _, body = _install_pm(admin_session)
        personas, workflows, tools = _install_counts(body)
        if personas:
            assert len(personas) == 6
        if workflows:
            assert len(workflows) == 12
        if tools:
            assert len(tools) == 11


# ---------------- DB-level assertions ----------------
@pytest.mark.usefixtures("admin_session")
class TestInstallDbState:
    def _connect(self):
        if not os.path.exists(DB_PATH):
            pytest.skip(f"DB not present at {DB_PATH}")
        return sqlite3.connect(DB_PATH)

    def test_agents_table_has_6_workforce_rows(self, admin_session):
        # ensure install ran
        admin_session.post(f"{BASE_URL}/api/workforce/install", json={"template": PM_SLUG}, timeout=60)
        conn = self._connect()
        try:
            cur = conn.execute(
                "SELECT name FROM agents WHERE source = ? AND workspace_id = 1",
                (f"workforce-template:{PM_SLUG}",),
            )
            names = {row[0] for row in cur.fetchall()}
            assert len(names) == 6, f"expected 6 workforce agents, got {len(names)}: {names}"
            # all 6 expected personas present
            missing = EXPECTED_PERSONAS - names
            assert not missing, f"missing personas: {missing}; got: {names}"
        finally:
            conn.close()

    def test_tasks_table_has_12_workforce_rows(self, admin_session):
        admin_session.post(f"{BASE_URL}/api/workforce/install", json={"template": PM_SLUG}, timeout=60)
        conn = self._connect()
        try:
            cur = conn.execute(
                "SELECT metadata FROM tasks WHERE metadata LIKE ? AND workspace_id = 1",
                (f"%workforce_template%{PM_SLUG}%",),
            )
            rows = cur.fetchall()
            assert len(rows) == 12, f"expected 12 workforce tasks, got {len(rows)}"
            for (md,) in rows:
                assert "workforce_template" in md
                assert "workforce_workflow_slug" in md
        finally:
            conn.close()

    def test_settings_table_has_12_pm_rows(self, admin_session):
        """12 ws.1.workforce.* settings rows for PM slug: 11 tool entries + 1 installed marker."""
        admin_session.post(f"{BASE_URL}/api/workforce/install", json={"template": PM_SLUG}, timeout=60)
        conn = self._connect()
        try:
            # All workforce keys touching the PM slug — installed marker uses
            # ws.<wsId>.workforce.installed.<slug> and tools use ws.<wsId>.workforce.<slug>.tool.*
            cur = conn.execute(
                "SELECT key FROM settings WHERE key LIKE ? OR key = ? ORDER BY key",
                (f"ws.1.workforce.{PM_SLUG}.%", f"ws.1.workforce.installed.{PM_SLUG}"),
            )
            keys = [row[0] for row in cur.fetchall()]
            assert len(keys) == 12, f"expected 12 PM workforce settings rows, got {len(keys)}: {keys}"
            assert any("installed" in k for k in keys), f"expected .installed. settings key, got: {keys}"
            tool_keys = [k for k in keys if ".tool." in k]
            assert len(tool_keys) == 11, f"expected 11 tool settings rows, got {len(tool_keys)}"
        finally:
            conn.close()

    def test_audit_log_and_activities_have_entries(self, admin_session):
        admin_session.post(f"{BASE_URL}/api/workforce/install", json={"template": PM_SLUG}, timeout=60)
        conn = self._connect()
        try:
            cur = conn.execute(
                "SELECT COUNT(*) FROM audit_log WHERE action LIKE 'workforce_template%' AND detail LIKE ?",
                (f"%{PM_SLUG}%",),
            )
            assert cur.fetchone()[0] >= 1, "audit_log has no workforce install entry"

            cur2 = conn.execute(
                "SELECT COUNT(*) FROM activities WHERE type LIKE 'workforce_template%' AND (data LIKE ? OR description LIKE ?)",
                (f"%{PM_SLUG}%", f"%{PM_SLUG}%"),
            )
            assert cur2.fetchone()[0] >= 1, "activities table has no workforce install entry"
        finally:
            conn.close()

    def test_reinstall_does_not_duplicate(self, admin_session):
        # call twice more, verify counts stable
        admin_session.post(f"{BASE_URL}/api/workforce/install", json={"template": PM_SLUG}, timeout=60)
        admin_session.post(f"{BASE_URL}/api/workforce/install", json={"template": PM_SLUG}, timeout=60)
        conn = self._connect()
        try:
            cur = conn.execute(
                "SELECT COUNT(*) FROM agents WHERE source = ? AND workspace_id = 1",
                (f"workforce-template:{PM_SLUG}",),
            )
            assert cur.fetchone()[0] == 6
            cur2 = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE metadata LIKE ? AND workspace_id = 1",
                (f"%workforce_template%{PM_SLUG}%",),
            )
            assert cur2.fetchone()[0] == 12
            # reinstall audit entries: should be >=2 events for PM
            cur3 = conn.execute(
                "SELECT COUNT(*) FROM audit_log WHERE action LIKE 'workforce_template%' AND detail LIKE ?",
                (f"%{PM_SLUG}%",),
            )
            assert cur3.fetchone()[0] >= 2, "expected >=2 audit entries after re-installs"
        finally:
            conn.close()
