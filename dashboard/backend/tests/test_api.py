"""
HTTP contract tests for WorkforceGuard API routes added in the data strategy phase.

Covers:
  - GET  /api/egapro-benchmark
  - POST /api/upload/payroll  (MIME rejection, size limit, validation errors, happy path)

Runs with the backend .venv which has fastapi, duckdb, pandas, httpx, pyarrow.

Requires DATABASE_URL — authenticated test client seeds a Postgres session directly
(bypassing OAuth). Tests skip when DATABASE_URL is unset.
"""
from __future__ import annotations

import csv
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
ANALYTICS_DB_PATH = ROOT_DIR / "data" / "workforceguard_analytics.duckdb"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    import main as app_module
    from auth_test_helpers import authed_client

    if "DATABASE_URL" not in os.environ:
        raise RuntimeError("DATABASE_URL not set; required for authenticated test client")

    os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")
    _client = authed_client(app_module.app)
    _SKIP = False
    _SKIP_REASON = ""
except Exception as exc:  # pragma: no cover
    _client = None
    _SKIP = True
    _SKIP_REASON = str(exc)


def _make_payroll_csv(n: int = 15, country: str = "FR", gender: str = "female",
                      base_salary: int = 55000, snapshot_date: str = "2025-12-31",
                      job_code: str = "SE-IC-1") -> bytes:
    rows = [
        {
            "employee_id": f"emp-{i:03d}",
            "job_code": job_code,
            "country_code": country,
            "worker_category_id": "eng_ic",
            "gender": gender,
            "base_salary": base_salary + i,
            "currency": "EUR",
            "snapshot_date": snapshot_date,
        }
        for i in range(n)
    ]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode()


@unittest.skipIf(_SKIP, f"FastAPI app or httpx unavailable: {_SKIP_REASON}")
class EgaproBenchmarkRouteTests(unittest.TestCase):
    """GET /api/egapro-benchmark"""

    def test_returns_200_with_available_true_for_france(self):
        resp = _client.get("/api/egapro-benchmark?country=FR&sector=J")

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["available"])
        self.assertEqual(body["nace_section"], "J")
        self.assertIn("p50_score", body)
        self.assertIn("company_count", body)
        self.assertGreater(body["company_count"], 5)

    def test_defaults_to_france_sector_j(self):
        resp = _client.get("/api/egapro-benchmark")

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["available"])
        self.assertEqual(body["nace_section"], "J")

    def test_returns_unavailable_for_non_france_country(self):
        resp = _client.get("/api/egapro-benchmark?country=DE&sector=J")

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertFalse(body["available"])
        self.assertIn("France", body["note"])

    def test_sector_c_returns_nace_c_benchmark(self):
        resp = _client.get("/api/egapro-benchmark?country=FR&sector=C")

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["available"])
        self.assertEqual(body["nace_section"], "C")

    def test_response_includes_all_size_bands(self):
        resp = _client.get("/api/egapro-benchmark?country=FR&sector=J")

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("all_size_bands", body)
        self.assertGreater(len(body["all_size_bands"]), 1)

    def test_source_id_is_egapro(self):
        resp = _client.get("/api/egapro-benchmark?country=FR&sector=J")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["source_id"], "egapro")


def _drop_shared_client_tenant_schema() -> None:
    """Successful uploads via the shared module-level _client trigger a real
    (fire-and-forget) dbt run that creates that tenant's schema in the shared
    dev DuckDB file at ANALYTICS_DB_PATH. UploadPayrollRouteTests and
    OverviewEgaproBenchmarkIntegrationTests both rely on _client's tenant
    still having that modeled data, so this can only run once every test in
    this module is done — see tearDownModule below, not a per-class
    tearDown. The dbt subprocess holds a write lock while running, so retry
    briefly rather than failing the test run if it's still in flight."""
    tenant_id = getattr(_client, "tenant_id", None)
    if tenant_id is None:
        return

    import time

    import duckdb

    from service import tenant_schema_name

    schema = tenant_schema_name(tenant_id)
    for _ in range(20):
        try:
            with duckdb.connect(database=str(ANALYTICS_DB_PATH)) as conn:
                conn.execute(f'drop schema if exists "{schema}" cascade')
            return
        except duckdb.IOException:
            time.sleep(0.5)


def tearDownModule():
    if not _SKIP:
        _drop_shared_client_tenant_schema()


@unittest.skipIf(_SKIP, f"FastAPI app or httpx unavailable: {_SKIP_REASON}")
class UploadPayrollRouteTests(unittest.TestCase):
    """POST /api/upload/payroll"""

    def test_valid_csv_returns_accepted(self):
        csv_bytes = _make_payroll_csv(15)
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("payroll.csv", csv_bytes, "text/csv")},
        )

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "accepted")
        self.assertEqual(body["record_count"], 15)
        self.assertTrue(body["validation"]["passed"])
        self.assertIn("dbt_run", body)

    def test_rejects_non_csv_mime_type(self):
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("data.xlsx", b"fake excel bytes", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("CSV", resp.json()["detail"])

    def test_rejects_oversized_file(self):
        oversized = b"x" * (10 * 1024 * 1024 + 1)
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("big.csv", oversized, "text/csv")},
        )

        self.assertEqual(resp.status_code, 413)
        self.assertIn("10MB", resp.json()["detail"])

    def test_rejects_missing_columns_with_400(self):
        bad_csv = b"employee_id,name\nemp-001,Alice\n"
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("bad.csv", bad_csv, "text/csv")},
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("Missing required columns", resp.json()["detail"])

    def test_rejects_invalid_gender_with_400(self):
        csv_bytes = _make_payroll_csv(10, gender="alien")
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("payroll.csv", csv_bytes, "text/csv")},
        )

        self.assertEqual(resp.status_code, 400)
        detail = resp.json()["detail"]
        self.assertIn("gender", detail.lower())

    def test_rejects_fewer_than_10_rows_with_400(self):
        csv_bytes = _make_payroll_csv(9)
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("payroll.csv", csv_bytes, "text/csv")},
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("10 employees", resp.json()["detail"])

    def test_rejects_future_snapshot_date_with_400(self):
        csv_bytes = _make_payroll_csv(10, snapshot_date="2099-01-01")
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("payroll.csv", csv_bytes, "text/csv")},
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("future", resp.json()["detail"])

    def test_snapshot_date_present_in_accepted_response(self):
        csv_bytes = _make_payroll_csv(15, snapshot_date="2025-06-30")
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("payroll.csv", csv_bytes, "text/csv")},
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["snapshot_date"], "2025-06-30")

    def test_accepts_application_csv_mime_type(self):
        csv_bytes = _make_payroll_csv(10)
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("payroll.csv", csv_bytes, "application/csv")},
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "accepted")

    def test_dbt_run_field_present_in_response(self):
        csv_bytes = _make_payroll_csv(10)
        resp = _client.post(
            "/api/upload/payroll",
            files={"file": ("payroll.csv", csv_bytes, "text/csv")},
        )

        self.assertEqual(resp.status_code, 200)
        # dbt is either triggered or reports not found — never absent
        self.assertIn("dbt_run", resp.json())
        self.assertIn(resp.json()["dbt_run"], ["triggered", "dbt not found in PATH — run manually"])


def _make_job_architecture_csv(n: int = 3) -> bytes:
    rows = [
        {
            "job_code": f"JOB-{i:03d}",
            "job_family": "Engineering",
            "job_level": str(i + 1),
            "worker_category_id": "eng_ic",
            "worker_category_label": "Engineering IC",
            "esco_uri": f"http://data.europa.eu/esco/occupation/{i}",
            "nace_code": "K64",
        }
        for i in range(n)
    ]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode()


@unittest.skipIf(_SKIP, f"FastAPI app or httpx unavailable: {_SKIP_REASON}")
class UploadJobArchitectureRouteTests(unittest.TestCase):
    """POST /api/upload/job-architecture"""

    def test_valid_csv_returns_accepted(self):
        csv_bytes = _make_job_architecture_csv(3)
        resp = _client.post(
            "/api/upload/job-architecture",
            files={"file": ("job_architecture.csv", csv_bytes, "text/csv")},
        )

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "accepted")
        self.assertEqual(body["record_count"], 3)
        self.assertTrue(body["validation"]["passed"])
        self.assertIn("dbt_run", body)

    def test_rejects_missing_columns_with_400(self):
        bad_csv = b"job_code,job_family\nJOB-001,Engineering\n"
        resp = _client.post(
            "/api/upload/job-architecture",
            files={"file": ("bad.csv", bad_csv, "text/csv")},
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("Missing required columns", resp.json()["detail"])

    def test_rejects_empty_file_with_400(self):
        empty_csv = (
            "job_code,job_family,job_level,worker_category_id,"
            "worker_category_label,esco_uri,nace_code\n"
        ).encode()
        resp = _client.post(
            "/api/upload/job-architecture",
            files={"file": ("empty.csv", empty_csv, "text/csv")},
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("at least 1 job code", resp.json()["detail"])


@unittest.skipIf(_SKIP, f"FastAPI app or httpx unavailable: {_SKIP_REASON}")
class OverviewEgaproBenchmarkIntegrationTests(unittest.TestCase):
    """Verifies egapro_peer_benchmark key is correctly shaped in the full overview response."""

    def test_overview_includes_egapro_benchmark_key_for_france(self):
        resp = _client.get("/api/overview?country=FR&geography=FR&sector=J&period=latest")

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("egapro_peer_benchmark", body)
        eb = body["egapro_peer_benchmark"]
        self.assertTrue(eb["available"])
        self.assertIn("year", eb)
        self.assertIn("p25_score", eb)
        self.assertIn("p50_score", eb)
        self.assertIn("p75_score", eb)
        self.assertIn("company_count", eb)
        self.assertIn("source_id", eb)
        self.assertIn("note", eb)
        self.assertIn("all_size_bands", eb)

    def test_overview_egapro_benchmark_unavailable_for_non_france(self):
        resp = _client.get("/api/overview?country=DE&geography=DE&sector=J&period=latest")

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("egapro_peer_benchmark", body)
        self.assertFalse(body["egapro_peer_benchmark"]["available"])

    def test_overview_egapro_benchmark_scores_are_realistic(self):
        resp = _client.get("/api/overview?country=FR&geography=FR&sector=J&period=latest")

        self.assertEqual(resp.status_code, 200)
        eb = resp.json()["egapro_peer_benchmark"]
        self.assertGreaterEqual(eb["p50_score"], 70)
        self.assertLessEqual(eb["p50_score"], 100)
        self.assertLessEqual(eb["p25_score"], eb["p50_score"])
        self.assertLessEqual(eb["p50_score"], eb["p75_score"])


if __name__ == "__main__":
    unittest.main()
