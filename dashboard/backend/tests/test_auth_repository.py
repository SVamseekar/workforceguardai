# dashboard/backend/tests/test_auth_repository.py
from __future__ import annotations

import asyncio
import os
import sys
import unittest
import uuid
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from auth import db
from auth.repository import AuthRepository


def _require_db():
    if "DATABASE_URL" not in os.environ:
        raise unittest.SkipTest("DATABASE_URL not set; requires a live Postgres instance")


class AuthRepositoryTests(unittest.TestCase):
    def test_find_or_create_user_is_idempotent(self):
        _require_db()

        async def _run():
            pool = await db.get_pool()
            await db.run_migrations(pool)
            repo = AuthRepository(pool)
            email = f"test-{uuid.uuid4()}@example.com"
            first = await repo.find_or_create_user(email, "Test User")
            second = await repo.find_or_create_user(email, "Test User")
            return first, second

        first, second = asyncio.run(_run())
        self.assertEqual(first.id, second.id)
        self.assertEqual(first.email, email := first.email)