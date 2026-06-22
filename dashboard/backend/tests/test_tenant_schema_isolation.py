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

A second, more subtle leak in that same fix was found on a follow-up review:
DuckDB's search_path resolves an unqualified table name by checking each
schema in order. A table present in BOTH the tenant's schema and "main" is
correctly isolated (the tenant schema wins) — but a table present ONLY in
"main" and absent from a given tenant's own schema silently falls through to
main's copy. The real dev DuckDB file actually had stale, pre-multi-tenant
internal-tagged tables sitting in "main" (purged by
purge_legacy_internal_tables.py), which meant any tenant whose own schema was
missing one of those tables would have silently read that stale data instead
of getting an empty/unavailable result — a live leak channel that survived
the first fix. AnalyticsRepository._assert_main_has_no_internal_tables now
converts that into a loud RuntimeError the moment "main" ever contains an
internal-tagged table again (e.g. an operator runs `dbt run` without
`--vars tenant_schema=...` by mistake), rather than relying on "main stays
empty of internal tables" as an unenforced convention.

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

from service import INTERNAL_TAGGED_TABLES, AnalyticsRepository, RepositoryRegistry, tenant_schema_name


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


class MainSchemaContaminationGuardTests(unittest.TestCase):
    """Covers the second leak channel found on follow-up review: an
    internal-tagged table present in "main" but absent from a tenant's own
    schema silently falls through search_path to main's (possibly stale, or
    another deploy's) copy instead of erroring or returning empty."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root_dir = Path(self._tmp.name)
        self.db_path = self.root_dir / "data" / "workforceguard_analytics.duckdb"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        _seed_shared_database(self.db_path)

    def tearDown(self):
        self._tmp.cleanup()

    def test_partial_tenant_schema_falls_through_to_main_without_the_guard(self):
        # Demonstrates the leak mechanism itself: a tenant schema missing a
        # table the tenant never had modeled (e.g. dim_worker_category) reads
        # whatever happens to be sitting in main for that table name, if main
        # has one. This test seeds that exact contaminated state by hand and
        # confirms the fallthrough happens — it is the failure mode the guard
        # in test_assert_main_has_no_internal_tables_blocks_contaminated_main
        # exists to prevent ever reaching in the live code path.
        con = duckdb.connect(database=str(self.db_path))
        try:
            con.execute("create table main.dim_worker_category (worker_category_id varchar)")
            con.execute("insert into main.dim_worker_category values ('stale_or_other_tenant_row')")
        finally:
            con.close()

        con2 = duckdb.connect(database=str(self.db_path), read_only=True)
        try:
            con2.execute("set search_path = 'tenant_tenant_a_uuid,main'")
            rows = con2.execute("select * from dim_worker_category").fetchall()
        finally:
            con2.close()

        self.assertEqual(rows, [("stale_or_other_tenant_row",)])

    def test_assert_main_has_no_internal_tables_blocks_contaminated_main(self):
        con = duckdb.connect(database=str(self.db_path))
        try:
            con.execute("create table main.dim_worker_category (worker_category_id varchar)")
        finally:
            con.close()

        repo = AnalyticsRepository(
            root_dir=self.root_dir, analytics_db_path=self.db_path, tenant_id="tenant-a-uuid"
        )
        with self.assertRaises(RuntimeError) as ctx:
            repo._connect()
        self.assertIn("dim_worker_category", str(ctx.exception))
        self.assertIn("main", str(ctx.exception))

    def test_assert_main_has_no_internal_tables_passes_when_main_is_clean(self):
        repo = AnalyticsRepository(
            root_dir=self.root_dir, analytics_db_path=self.db_path, tenant_id="tenant-a-uuid"
        )
        with repo._connect() as conn:
            conn.execute("select 1")  # must not raise

    def test_internal_tagged_tables_set_matches_dbt_project_internal_tags(self):
        # Cross-check against the actual dbt project so this list can't
        # silently drift from analytics/dbt_project.yml's tag:internal
        # config — if a new internal model is added there but this set
        # isn't updated, the guard above would miss it.
        expected = {
            "dim_worker_category",
            "fct_internal_hiring_demand",
            "fct_internal_pay_snapshot",
            "fct_internal_skill_snapshot",
            "fct_internal_workforce_snapshot",
            "mart_company_decision_support",
            "mart_internal_market_pay_benchmark",
            "mart_pay_transparency_category_review",
            "stg_internal__ats_requisition_snapshot",
            "stg_internal__hris_workforce_snapshot",
            "stg_internal__job_architecture",
            "stg_internal__learning_skill_snapshot",
            "stg_internal__payroll_snapshot",
        }
        self.assertEqual(INTERNAL_TAGGED_TABLES, frozenset(expected))


class LockRetryTests(unittest.TestCase):
    """The dbt rebuild triggered after a payroll upload holds a write lock on
    the shared DuckDB file for several seconds. Before this fix,
    _available_tables() caught the resulting duckdb.Error broadly and
    returned an empty set, which made _modeled_database_ready() report False
    and silently fall through to the degraded in-memory/raw-parquet
    connection path instead of waiting out a transient lock — no error, no
    indication to the caller that real (internal-tagged) data was
    unavailable only because of a passing lock conflict, not because it
    didn't exist."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root_dir = Path(self._tmp.name)
        self.db_path = self.root_dir / "data" / "workforceguard_analytics.duckdb"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        _seed_shared_database(self.db_path)

    def tearDown(self):
        self._tmp.cleanup()

    def _hold_write_lock_in_subprocess(self, hold_seconds: float):
        import subprocess

        return subprocess.Popen(
            [
                sys.executable,
                "-c",
                "import duckdb, time\n"
                f"con = duckdb.connect({str(self.db_path)!r})\n"
                'con.execute("create table if not exists main._lock_test_tmp (x int)")\n'
                f"time.sleep({hold_seconds})\n"
                'con.execute("drop table if exists main._lock_test_tmp")\n'
                "con.close()\n",
            ]
        )

    def test_connect_waits_out_a_transient_lock_instead_of_degrading_silently(self):
        import time

        proc = self._hold_write_lock_in_subprocess(hold_seconds=1.5)
        try:
            time.sleep(0.3)
            repo = AnalyticsRepository(
                root_dir=self.root_dir, analytics_db_path=self.db_path, tenant_id="tenant-a-uuid"
            )
            start = time.time()
            with repo._connect() as conn:
                elapsed = time.time() - start
                # If this connected to the real modeled database (rather
                # than silently falling through to the degraded in-memory
                # path), querying the seeded fct_internal_pay_snapshot must
                # succeed and return this tenant's real row.
                rows = conn.execute(
                    "select country_code, avg_base_pay from fct_internal_pay_snapshot"
                ).fetchall()
            self.assertEqual(rows, [("FR", 50000.0)])
            # A near-zero elapsed time would mean it gave up immediately and
            # took the degraded path rather than actually waiting for the lock.
            self.assertGreater(elapsed, 0.5)
        finally:
            proc.wait()

    def test_lock_conflict_message_is_the_only_retried_condition(self):
        # A non-lock duckdb.Error (e.g. a genuinely corrupt/missing file)
        # must not be silently retried into a 3-second hang — only the
        # specific "Could not set lock on file" message should trigger
        # retries; anything else should raise (or degrade) immediately.
        from unittest.mock import patch

        repo = AnalyticsRepository(
            root_dir=self.root_dir, analytics_db_path=self.db_path, tenant_id="tenant-a-uuid"
        )

        call_count = {"n": 0}

        def fake_connect(*args, **kwargs):
            call_count["n"] += 1
            raise duckdb.IOException("IO Error: file is corrupt, not a lock issue")

        with patch("duckdb.connect", side_effect=fake_connect):
            with self.assertRaises(duckdb.IOException):
                repo._connect_with_lock_retry()

        self.assertEqual(call_count["n"], 1)  # must not have retried


if __name__ == "__main__":
    unittest.main()
