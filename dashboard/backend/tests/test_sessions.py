# dashboard/backend/tests/test_sessions.py
from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")

from auth import sessions


class SessionTokenTests(unittest.TestCase):
    def test_round_trip(self):
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        token = sessions.create_session_token("session-abc", expires)
        self.assertEqual(sessions.verify_session_token(token), "session-abc")

    def test_expired_token_is_rejected(self):
        expires = datetime.now(timezone.utc) - timedelta(hours=1)
        token = sessions.create_session_token("session-abc", expires)
        self.assertIsNone(sessions.verify_session_token(token))

    def test_tampered_token_is_rejected(self):
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        token = sessions.create_session_token("session-abc", expires)
        tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
        self.assertIsNone(sessions.verify_session_token(tampered))