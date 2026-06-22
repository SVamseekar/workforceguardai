"""
Tests for two startup-time guards added after code review flagged them as
open gaps:

  - migrate_to_tenant.py is a manual, unenforced step. If an operator forgets
    to run it before restarting the app on a deploy with existing data, the
    app would previously start up fine and silently serve empty tenant
    directories while real data sits orphaned at the legacy global path —
    no error, no warning. _assert_legacy_data_already_migrated() makes this
    fail loudly at import time instead.

  - The CORS allowlist guard previously only rejected the literal string
    "*". An operator setting CORS_ALLOWED_ORIGINS to a wildcard pattern
    (e.g. "https://*.vercel.app") would pass that check, but
    Starlette's CORSMiddleware treats allow_origins entries as exact
    strings, not patterns — so the entry would just silently never match,
    breaking CORS for legitimate traffic without any error. The new
    _VALID_ORIGIN_PATTERN check rejects any origin that isn't an exact
    https:// origin (or http://localhost[:port] for local dev).

These exercise the two checks directly rather than importing `main` (which
runs them as side effects at module scope and can't be re-run safely within
one process), so each test is isolated and doesn't depend on import order or
process state from other test modules.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class LegacyMigrationGuardTests(unittest.TestCase):
    def setUp(self):
        import os

        os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")
        os.environ.setdefault("DATABASE_URL", "postgresql://localhost/workforceguard_test")
        os.environ["WORKFORCEGUARD_SKIP_MIGRATION_CHECK"] = "1"
        global main
        import main  # noqa: F401  (imported once with the guard skipped)

    def test_raises_when_legacy_internal_dir_has_real_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            internal_dir = root / "data" / "internal"
            internal_dir.mkdir(parents=True)
            (internal_dir / "payroll_snapshot.parquet").write_bytes(b"fake-parquet")

            with self.assertRaises(RuntimeError) as ctx:
                main._assert_legacy_data_already_migrated(root)
            self.assertIn(str(internal_dir), str(ctx.exception))
            self.assertIn("migrate_to_tenant.py", str(ctx.exception))

    def test_raises_when_legacy_governance_sqlite_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "data").mkdir(parents=True)
            (root / "data" / "governance_events.sqlite").write_bytes(b"fake-sqlite")

            with self.assertRaises(RuntimeError):
                main._assert_legacy_data_already_migrated(root)

    def test_raises_when_legacy_automation_schedules_json_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "data").mkdir(parents=True)
            (root / "data" / "automation_schedules.json").write_text("[]")

            with self.assertRaises(RuntimeError):
                main._assert_legacy_data_already_migrated(root)

    def test_does_not_raise_for_gitkeep_only_internal_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            internal_dir = root / "data" / "internal"
            internal_dir.mkdir(parents=True)
            (internal_dir / ".gitkeep").write_text("")

            main._assert_legacy_data_already_migrated(root)  # should not raise

    def test_does_not_raise_when_nothing_legacy_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            main._assert_legacy_data_already_migrated(root)  # should not raise


class CorsOriginValidationTests(unittest.TestCase):
    def setUp(self):
        import os

        os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")
        os.environ.setdefault("DATABASE_URL", "postgresql://localhost/workforceguard_test")
        os.environ["WORKFORCEGUARD_SKIP_MIGRATION_CHECK"] = "1"
        global main
        import main  # noqa: F401

    def test_accepts_exact_https_origin(self):
        self.assertTrue(main._VALID_ORIGIN_PATTERN.match("https://app.vercel.app"))

    def test_accepts_localhost_with_port(self):
        self.assertTrue(main._VALID_ORIGIN_PATTERN.match("http://localhost:5173"))

    def test_accepts_localhost_without_port(self):
        self.assertTrue(main._VALID_ORIGIN_PATTERN.match("http://localhost"))

    def test_rejects_wildcard_subdomain(self):
        self.assertIsNone(main._VALID_ORIGIN_PATTERN.match("https://*.vercel.app"))

    def test_rejects_literal_star(self):
        self.assertIsNone(main._VALID_ORIGIN_PATTERN.match("*"))

    def test_rejects_non_https_scheme(self):
        self.assertIsNone(main._VALID_ORIGIN_PATTERN.match("ftp://evil.com"))

    def test_rejects_trailing_slash(self):
        self.assertIsNone(main._VALID_ORIGIN_PATTERN.match("https://app.vercel.app/"))

    def test_rejects_non_localhost_http(self):
        self.assertIsNone(main._VALID_ORIGIN_PATTERN.match("http://app.vercel.app"))


if __name__ == "__main__":
    unittest.main()
