# dashboard/backend/tests/test_auth_redirects.py
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

from auth.redirects import frontend_login_redirect


class FrontendLoginRedirectTests(unittest.TestCase):
    def test_returns_base_url_without_error(self):
        with patch.dict(os.environ, {"FRONTEND_URL": "https://example.com/app"}):
            self.assertEqual(frontend_login_redirect(), "https://example.com/app")

    def test_appends_auth_error_query_param(self):
        with patch.dict(os.environ, {"FRONTEND_URL": "https://example.com/app"}):
            self.assertEqual(
                frontend_login_redirect("cancelled"),
                "https://example.com/app?auth_error=cancelled",
            )


if __name__ == "__main__":
    unittest.main()