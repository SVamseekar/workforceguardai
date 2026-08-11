# dashboard/backend/tests/test_oauth.py
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from auth.oauth import (
    MicrosoftCodeIDToken,
    authorize_access_token_kwargs,
    is_valid_microsoft_issuer,
    parse_provider_profile,
)


class MicrosoftIssuerTests(unittest.TestCase):
    def test_accepts_tenant_guid_issuer(self):
        iss = "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0"
        self.assertTrue(is_valid_microsoft_issuer(iss))

    def test_rejects_discovery_template_issuer(self):
        self.assertFalse(
            is_valid_microsoft_issuer(
                "https://login.microsoftonline.com/{tenantid}/v2.0"
            )
        )

    def test_rejects_non_microsoft_issuer(self):
        self.assertFalse(is_valid_microsoft_issuer("https://accounts.google.com"))

    def test_microsoft_claims_cls_accepts_msa_issuer(self):
        iss = "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0"
        claims = MicrosoftCodeIDToken(
            {"iss": iss, "aud": "client", "exp": 9999999999, "iat": 1, "sub": "x"},
            {},
            {"iss": {"essential": True}},
            {"client_id": "client"},
        )
        claims.validate_iss()

    def test_authorize_kwargs_only_for_microsoft(self):
        self.assertEqual(authorize_access_token_kwargs("google"), {})
        ms = authorize_access_token_kwargs("microsoft")
        self.assertIs(ms["claims_cls"], MicrosoftCodeIDToken)
        self.assertIn("claims_options", ms)


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
