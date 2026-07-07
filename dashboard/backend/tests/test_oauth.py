# dashboard/backend/tests/test_oauth.py
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from auth.oauth import parse_provider_profile


class ProviderProfileTests(unittest.TestCase):
    def test_google_profile(self):
        userinfo = {"sub": "google-123", "email": "a@example.com", "name": "Ada Lovelace"}
        subject, email, name = parse_provider_profile("google", userinfo)
        self.assertEqual((subject, email, name), ("google-123", "a@example.com", "Ada Lovelace"))

    def test_microsoft_profile(self):
        userinfo = {"sub": "ms-456", "email": "b@example.com", "name": "Grace Hopper"}
        subject, email, name = parse_provider_profile("microsoft", userinfo)
        self.assertEqual((subject, email, name), ("ms-456", "b@example.com", "Grace Hopper"))

    def test_microsoft_profile_prefers_preferred_username(self):
        userinfo = {"sub": "ms-789", "preferred_username": "c@contoso.com", "name": "Contoso User"}
        subject, email, name = parse_provider_profile("microsoft", userinfo)
        self.assertEqual((subject, email, name), ("ms-789", "c@contoso.com", "Contoso User"))

    def test_microsoft_profile_falls_back_to_upn(self):
        userinfo = {"sub": "ms-101", "upn": "d@fabrikam.com"}
        subject, email, name = parse_provider_profile("microsoft", userinfo)
        self.assertEqual((subject, email, name), ("ms-101", "d@fabrikam.com", "d@fabrikam.com"))

    def test_missing_email_raises(self):
        with self.assertRaises(ValueError):
            parse_provider_profile("google", {"sub": "google-999"})

    def test_unknown_provider_raises(self):
        with self.assertRaises(ValueError):
            parse_provider_profile("github", {})
