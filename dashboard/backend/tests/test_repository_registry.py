# dashboard/backend/tests/test_repository_registry.py
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from service import RepositoryRegistry


class RepositoryRegistryTests(unittest.TestCase):
    def test_different_tenants_get_different_internal_data_dirs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root_dir = Path(tmp)
            registry = RepositoryRegistry(root_dir)
            repo_a = registry.get_for_tenant("tenant-a")
            repo_b = registry.get_for_tenant("tenant-b")
            self.assertNotEqual(repo_a.internal_data_dir, repo_b.internal_data_dir)
            self.assertIn("tenant-a", str(repo_a.internal_data_dir))
            self.assertIn("tenant-b", str(repo_b.internal_data_dir))

    def test_same_tenant_returns_cached_instance(self):
        with tempfile.TemporaryDirectory() as tmp:
            root_dir = Path(tmp)
            registry = RepositoryRegistry(root_dir)
            repo_1 = registry.get_for_tenant("tenant-a")
            repo_2 = registry.get_for_tenant("tenant-a")
            self.assertIs(repo_1, repo_2)

    def test_shared_analytics_db_path_across_tenants(self):
        with tempfile.TemporaryDirectory() as tmp:
            root_dir = Path(tmp)
            registry = RepositoryRegistry(root_dir)
            repo_a = registry.get_for_tenant("tenant-a")
            repo_b = registry.get_for_tenant("tenant-b")
            self.assertEqual(repo_a.analytics_db_path, repo_b.analytics_db_path)