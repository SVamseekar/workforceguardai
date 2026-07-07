# dashboard/backend/tests/test_auth_oauth_routes.py
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/workforceguard_test")
os.environ["WORKFORCEGUARD_SKIP_MIGRATION_CHECK"] = "1"

from fastapi.testclient import TestClient

import main as app_module


class AuthOAuthRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app_module.app)

    def test_unsupported_provider_redirects_to_login(self):
        response = self.client.get("/api/auth/login/github", follow_redirects=False)
        self.assertIn(response.status_code, (302, 303, 307))
        self.assertIn("auth_error=unsupported_provider", response.headers["location"])

    def test_callback_provider_error_redirects(self):
        response = self.client.get(
            "/api/auth/callback/google?error=access_denied",
            follow_redirects=False,
        )
        self.assertIn(response.status_code, (302, 303, 307))
        self.assertIn("auth_error=cancelled", response.headers["location"])

    def test_google_login_redirects_when_oauth_misconfigured(self):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "", "GOOGLE_CLIENT_SECRET": ""}):
            response = self.client.get("/api/auth/login/google", follow_redirects=False)
            self.assertIn(response.status_code, (302, 303, 307))
            location = response.headers["location"]
            self.assertTrue(
                "auth_error=sign_in_unavailable" in location or "accounts.google.com" in location,
                location,
            )


if __name__ == "__main__":
    unittest.main()
