# dashboard/backend/tests/test_session_cookie.py
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

from auth.sessions import session_cookie_secure


class SessionCookieSecureTests(unittest.TestCase):
    def test_https_redirect_base_enables_secure(self):
        with patch.dict(
            os.environ,
            {"OAUTH_REDIRECT_BASE_URL": "https://workforceguardai.souravamseekar.com"},
            clear=False,
        ):
            os.environ.pop("SESSION_COOKIE_SECURE", None)
            self.assertTrue(session_cookie_secure())

    def test_http_redirect_base_disables_secure(self):
        with patch.dict(
            os.environ,
            {"OAUTH_REDIRECT_BASE_URL": "http://localhost:5173"},
            clear=False,
        ):
            os.environ.pop("SESSION_COOKIE_SECURE", None)
            self.assertFalse(session_cookie_secure())

    def test_explicit_override(self):
        with patch.dict(os.environ, {"SESSION_COOKIE_SECURE": "0"}, clear=False):
            self.assertFalse(session_cookie_secure())
        with patch.dict(os.environ, {"SESSION_COOKIE_SECURE": "1"}, clear=False):
            self.assertTrue(session_cookie_secure())


if __name__ == "__main__":
    unittest.main()
