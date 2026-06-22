# dashboard/backend/tests/test_auth_db.py
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import asyncio
from auth import db


class MigrationTests(unittest.TestCase):
    def test_run_migrations_creates_tables(self):
        if "DATABASE_URL" not in os.environ:
            self.skipTest("DATABASE_URL not set; requires a live Postgres instance")

        async def _run():
            pool = await db.get_pool()
            await db.run_migrations(pool)
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "select table_name from information_schema.tables where table_name = 'tenants'"
                )
                return row

        row = asyncio.run(_run())
        self.assertIsNotNone(row)