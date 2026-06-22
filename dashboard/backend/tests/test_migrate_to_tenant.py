# dashboard/backend/tests/test_migrate_to_tenant.py
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from migrate_to_tenant import migrate


class MigrateToTenantTests(unittest.TestCase):
    def test_moves_existing_internal_data_under_bootstrap_tenant(self):
        if "DATABASE_URL" not in os.environ:
            self.skipTest("DATABASE_URL not set; requires a live Postgres instance")

        with tempfile.TemporaryDirectory() as tmp:
            root_dir = Path(tmp)
            internal_dir = root_dir / "data" / "internal"
            internal_dir.mkdir(parents=True)
            (internal_dir / "payroll_snapshot.parquet").write_bytes(b"fake-parquet-bytes")

            tenant_id = asyncio.run(
                migrate(root_dir, "admin@bootstrap.example.com", "Bootstrap Admin", "Bootstrap Co")
            )

            migrated_file = root_dir / "data" / "tenants" / tenant_id / "internal" / "payroll_snapshot.parquet"
            self.assertTrue(migrated_file.exists())
            self.assertFalse(internal_dir.exists())