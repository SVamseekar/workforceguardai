"""
Regression tests for two issues found during code review of the multi-tenant
auth implementation:

  - GET /  must never construct its own AnalyticsRepository pointed at the
    legacy global data path (the bug: read_root() built a fresh
    AnalyticsRepository(root_dir) per request with default — i.e. legacy
    global — paths, rather than using RepositoryRegistry's public_repository,
    which points at a dedicated, always-empty location). The route's response
    only ever serializes "available_actions" today, so this was not a live
    HTTP data leak in the current code, but it was the single place the
    registry's tenant-isolation chokepoint was bypassed, and any future
    change to read_root() that returns more of build_governance_payload()
    (which does include real "recent_events"/"events"/"integrity") would
    immediately leak unscoped tenant data with zero auth. This test locks in
    both the absence of those keys today and the fact that seeding the
    legacy path doesn't make the route start reflecting tenant data.
  - GET /api/automation/schedules/{schedule_id}/run must require the admin
    role, matching its sibling POST /api/automation/schedules — a member
    must not be able to read generated schedule output (which can include
    compliance evidence-pack content).

Requires DATABASE_URL — tests skip when it's unset, same as test_api.py.
"""
from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
LEGACY_GOVERNANCE_PATH = ROOT_DIR / "data" / "governance_events.sqlite"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    import main as app_module
    from auth_test_helpers import authed_client

    if "DATABASE_URL" not in os.environ:
        raise RuntimeError("DATABASE_URL not set; required for authenticated test client")

    os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")
    _SKIP = False
    _SKIP_REASON = ""
except Exception as exc:  # pragma: no cover
    _SKIP = True
    _SKIP_REASON = str(exc)


class PublicRootRouteTests(unittest.TestCase):
    def setUp(self):
        if _SKIP:
            self.skipTest(_SKIP_REASON)

    def test_root_route_requires_no_session(self):
        client = authed_client(app_module.app)
        # Deliberately drop the session cookie to prove this route is reachable
        # without authentication, as intended.
        client.cookies.clear()
        resp = client.get("/")
        self.assertEqual(resp.status_code, 200)

    def test_root_route_uses_the_registry_public_repository_not_the_legacy_global_path(self):
        # The bug: read_root() built its own `AnalyticsRepository(root_dir)`
        # with no path overrides, which defaults to the legacy global
        # governance_events.sqlite — bypassing RepositoryRegistry entirely,
        # the single chokepoint every other route goes through for tenant
        # isolation. The fix routes it through
        # repository_registry.public_repository instead, which points at a
        # dedicated, always-empty `_public` location. Assert the route's data
        # source is provably NOT the legacy global path: seed real data at
        # the legacy path directly, then confirm the registry's public
        # repository (what the fixed route actually reads) is unaffected.
        from service import AnalyticsRepository

        legacy_repo = AnalyticsRepository(
            root_dir=ROOT_DIR, governance_events_path=LEGACY_GOVERNANCE_PATH
        )
        legacy_repo.record_governance_event(
            {
                "action_code": "approved",
                "target_type": "automation_schedule",
                "target_id": "leaked-target",
                "reason": "should never be public",
            }
        )

        try:
            public_repo = app_module.repository_registry.public_repository
            self.assertNotEqual(public_repo.governance_events_path, LEGACY_GOVERNANCE_PATH)

            public_payload = public_repo.build_governance_payload()
            self.assertEqual(public_payload["events"], [])
            self.assertNotIn("leaked-target", json.dumps(public_payload))

            anon_client = authed_client(app_module.app)
            anon_client.cookies.clear()
            resp = anon_client.get("/")
            self.assertEqual(resp.status_code, 200)
            body = resp.json()
            self.assertIn("available_actions", body)
            self.assertIn("supported_grains", body)
            self.assertNotIn("leaked-target", json.dumps(body))
        finally:
            LEGACY_GOVERNANCE_PATH.unlink(missing_ok=True)


class ScheduleRunRouteAuthorizationTests(unittest.TestCase):
    """
    Authorization is checked via FastAPI's Depends() resolution, which runs
    before the route body executes. Using a nonexistent schedule_id lets these
    tests assert the role/session boundary in isolation, without depending on
    build_overview()'s DuckDB/parquet fixture data (a separate, unrelated local
    data-availability concern covered by test_service.py / test_api.py).
    """

    def setUp(self):
        if _SKIP:
            self.skipTest(_SKIP_REASON)

    def test_member_cannot_read_schedule_output(self):
        member_client = authed_client(app_module.app, role="member")
        resp = member_client.get("/api/automation/schedules/nonexistent-id/run")
        self.assertEqual(resp.status_code, 403)

    def test_admin_passes_the_role_check(self):
        admin_client = authed_client(app_module.app, role="admin")
        resp = admin_client.get("/api/automation/schedules/nonexistent-id/run")
        # Role check passes; the 400 below comes from the route body reporting
        # the schedule doesn't exist, proving admin got past Depends(require_role).
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Unknown automation schedule", resp.text)

    def test_unauthenticated_request_is_rejected_not_just_unauthorized(self):
        anon_client = authed_client(app_module.app)
        anon_client.cookies.clear()
        resp = anon_client.get("/api/automation/schedules/nonexistent-id/run")
        self.assertEqual(resp.status_code, 401)


if __name__ == "__main__":
    unittest.main()
