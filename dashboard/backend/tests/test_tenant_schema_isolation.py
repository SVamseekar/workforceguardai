"""
Regression test for a critical cross-tenant data leak found during code
review of the multi-tenant auth implementation.

The bug: AnalyticsRepository.internal_data_dir (raw payroll/job-architecture
parquet files) was correctly scoped per tenant by RepositoryRegistry, but the
dbt project that models those files into queryable tables
(fct_internal_pay_snapshot, etc.) wrote into a single shared DuckDB schema —
analytics_db_path is deliberately one shared file across all tenants (it
holds EU/reference/public_company data too). The moment a second tenant
uploaded payroll, dbt would model it into that same shared schema, and every
tenant's dashboard read whichever tenant's data happened to be there last.

The fix: internal-tagged dbt models are routed into a schema named
tenant_<tenant_id> via analytics/macros/tenant_schema.sql's
generate_schema_name override, driven by the `tenant_schema` dbt var.
AnalyticsRepository._connect() sets DuckDB's search_path to put a tenant's
own schema first, so unqualified references to internal-tagged tables
resolve to that tenant's data — while EU/reference/public_company tables
(which live in the default "main" schema) stay visible to every tenant.

This test exercises the read side of that mechanism directly against a real
(temp-file) DuckDB database with two tenant schemas seeded by hand — it does
not invoke a real dbt run (that's covered manually; dbt takes several
seconds and needs to be on PATH, which would make this test slow and
environment-dependent for what is otherwise a fast unit-test suite).
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import duckdb

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from service import AnalyticsRepository, RepositoryRegistry, tenant_schema_name


def _seed_shared_database(db_path: Path) -> None:
    """Build a minimal DuckDB file shaped like the real shared analytics
    warehouse: the global tables _modeled_database_ready() checks for, plus
    two tenants' own fct_internal_pay_snapshot tables in their own schemas
    with different data, to prove isolation."""
    con = duckdb.connect(database=str(db_path))
    try:
        con.execute("create table dim_geography (geo_id varchar)")
        con.execute("create table dim_sector (sector_id varchar)")
        con.execute("create table fct_labour_market_region_sector (id varchar)")
        con.execute("create table mart_workforce_command_center (id varchar)")

        for tenant_id, country, avg_pay in [
            ("tenant-a-uuid", "FR", 50000.0),
            ("tenant-b-uuid", "DE", 90000.0),
        ]:
            schema = tenant_schema_name(tenant_id)
            con.execute(f"create schema {schema}")
            con.execute(
                f"create table {schema}.fct_internal_pay_snapshot "
                f"(country_code varchar, avg_base_pay double)"
            )
            con.execute(
                f"insert into {schema}.fct_internal_pay_snapshot values (?, ?)",
                [country, avg_pay],
            )
    finally:
        con.close()


class TenantSchemaIsolationTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root_dir = Path(self._tmp.name)
        self.db_path = self.root_dir / "data" / "workforceguard_analytics.duckdb"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        _seed_shared_database(self.db_path)

    def tearDown(self):
        self._tmp.cleanup()

    def test_each_tenant_sees_only_its_own_internal_pay_snapshot(self):
        # Construct each tenant's repository directly (the same way
        # RepositoryRegistry does), pointed at the same shared
        # analytics_db_path every tenant intentionally shares.
        # way RepositoryRegistry does for the real one (it never overrides
        # analytics_db_path — every tenant intentionally shares that file).
        repo_a = AnalyticsRepository(
            root_dir=self.root_dir, analytics_db_path=self.db_path, tenant_id="tenant-a-uuid"
        )
        repo_b = AnalyticsRepository(
            root_dir=self.root_dir, analytics_db_path=self.db_path, tenant_id="tenant-b-uuid"
        )

        with repo_a._connect() as conn_a:
            rows_a = conn_a.execute(
                "select country_code, avg_base_pay from fct_internal_pay_snapshot"
            ).fetchall()
        with repo_b._connect() as conn_b:
            rows_b = conn_b.execute(
                "select country_code, avg_base_pay from fct_internal_pay_snapshot"
            ).fetchall()

        self.assertEqual(rows_a, [("FR", 50000.0)])
        self.assertEqual(rows_b, [("DE", 90000.0)])
        # The actual leak this test guards against: neither tenant's result
        # should ever contain the other tenant's row.
        self.assertNotIn(("DE", 90000.0), rows_a)
        self.assertNotIn(("FR", 50000.0), rows_b)

    def test_shared_global_tables_remain_visible_to_every_tenant(self):
        repo_a = AnalyticsRepository(
            root_dir=self.root_dir, analytics_db_path=self.db_path, tenant_id="tenant-a-uuid"
        )
        with repo_a._connect() as conn:
            # dim_geography lives in the default "main" schema, not any
            # tenant schema — setting search_path to put the tenant schema
            # first must not hide tables that only exist in "main".
            conn.execute("select * from dim_geography")  # must not raise

    def test_tenant_with_no_schema_yet_falls_back_to_main_without_crashing(self):
        # A brand-new tenant that hasn't uploaded payroll yet has no schema
        # in the shared DuckDB file at all. SET search_path to a schema that
        # doesn't exist raises a DuckDB CatalogException — _connect() must
        # detect this and skip setting search_path rather than crash every
        # request for a tenant with no data yet.
        repo_new = AnalyticsRepository(
            root_dir=self.root_dir, analytics_db_path=self.db_path, tenant_id="brand-new-tenant"
        )
        with repo_new._connect() as conn:
            conn.execute("select * from dim_geography")  # must not raise

    def test_repository_registry_passes_tenant_id_through(self):
        registry = RepositoryRegistry(self.root_dir)
        repo = registry.get_for_tenant("tenant-a-uuid")
        self.assertEqual(repo.tenant_id, "tenant-a-uuid")
        self.assertEqual(repo.tenant_schema, tenant_schema_name("tenant-a-uuid"))

    def test_public_repository_has_no_tenant_schema(self):
        registry = RepositoryRegistry(self.root_dir)
        self.assertIsNone(registry.public_repository.tenant_schema)


class TenantSchemaNameTests(unittest.TestCase):
    def test_sanitizes_uuid_hyphens(self):
        self.assertEqual(
            tenant_schema_name("650dc913-0595-4980-9b55-ac1f0446e1aa"),
            "tenant_650dc913_0595_4980_9b55_ac1f0446e1aa",
        )

    def test_rejects_sql_metacharacters_by_stripping_them(self):
        # tenant_id should always be a UUID from Postgres, never raw user
        # input, but the sanitizer is a defense-in-depth backstop against
        # ever interpolating something unsafe into a SQL identifier.
        malicious = "x'; drop table users; --"
        schema = tenant_schema_name(malicious)
        self.assertNotIn("'", schema)
        self.assertNotIn(";", schema)
        self.assertNotIn(" ", schema)
        self.assertNotIn("-", schema)


if __name__ == "__main__":
    unittest.main()
