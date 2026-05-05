from __future__ import annotations

import shutil
import sys
import tempfile
import unittest
import json
from pathlib import Path

import duckdb
import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "dashboard" / "backend"
ANALYTICS_DB_PATH = ROOT_DIR / "data" / "workforceguard_analytics.duckdb"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from service import AnalyticsRepository  # noqa: E402

try:  # noqa: E402
    import main
except ModuleNotFoundError as error:  # pragma: no cover - environment-specific dependency gap
    main = None
    MAIN_IMPORT_ERROR = error
else:
    MAIN_IMPORT_ERROR = None


class AnalyticsRepositoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo = AnalyticsRepository(ROOT_DIR)

    def _copy_analytics_db(self, temp_dir: str) -> Path:
        db_path = Path(temp_dir) / "workforceguard_analytics.duckdb"
        shutil.copyfile(ANALYTICS_DB_PATH, db_path)
        return db_path

    def _write_internal_manifest(self, temp_dir: str, trusted: bool) -> Path:
        manifest_dir = Path(temp_dir) / "internal_meta"
        manifest_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = manifest_dir / "manifest.json"
        manifest_path.write_text(
            json.dumps(
                {
                    "generated_at": "2026-03-31T00:00:00+00:00",
                    "assets": [
                        {
                            "asset_type": "internal_payroll_snapshot",
                            "version": "local",
                            "record_count": 4,
                            "output": str((Path(temp_dir) / "internal" / "payroll_snapshot.parquet").resolve()),
                            "trusted_for_company_claims": trusted,
                        },
                        {
                            "asset_type": "internal_job_architecture",
                            "version": "local",
                            "record_count": 1,
                            "output": str((Path(temp_dir) / "internal" / "job_architecture.parquet").resolve()),
                            "trusted_for_company_claims": trusted,
                        },
                    ],
                    "missing_inputs": [],
                }
            ),
            encoding="utf-8",
        )
        return manifest_path

    def _copy_analytics_db_with_empty_internal_models(self, temp_dir: str) -> Path:
        db_path = self._copy_analytics_db(temp_dir)
        with duckdb.connect(str(db_path)) as connection:
            connection.execute("drop view if exists stg_internal__payroll_snapshot")
            connection.execute(
                """
                create table stg_internal__payroll_snapshot as
                select *
                from (
                    select
                        cast(null as varchar) as employee_id,
                        cast(null as varchar) as job_code,
                        cast(null as varchar) as job_title,
                        cast(null as varchar) as country_code,
                        cast(null as varchar) as worker_category_id,
                        cast(null as varchar) as gender,
                        cast(null as double) as base_pay_amount,
                        cast(null as varchar) as pay_currency,
                        cast(null as date) as snapshot_date,
                        cast(null as varchar) as employment_status,
                        cast(null as varchar) as source_version,
                        cast(null as varchar) as dataset_name
                ) where false
                """
            )
            connection.execute("drop view if exists stg_internal__job_architecture")
            connection.execute(
                """
                create table stg_internal__job_architecture as
                select *
                from (
                    select
                        cast(null as varchar) as job_code,
                        cast(null as varchar) as job_family,
                        cast(null as varchar) as job_level,
                        cast(null as varchar) as worker_category_id,
                        cast(null as varchar) as worker_category_label,
                        cast(null as varchar) as esco_uri,
                        cast(null as varchar) as nace_code,
                        cast(null as varchar) as source_version,
                        cast(null as varchar) as dataset_name
                ) where false
                """
            )
            connection.execute(
                """
                create or replace table fct_internal_pay_snapshot as
                select *
                from (
                    select
                        cast(null as varchar) as internal_pay_snapshot_id,
                        cast(null as varchar) as country_code,
                        cast(null as date) as snapshot_date,
                        cast(null as varchar) as worker_category_id,
                        cast(null as varchar) as nace_code,
                        cast(null as varchar) as esco_uri,
                        cast(null as varchar) as pay_currency,
                        cast(null as bigint) as headcount,
                        cast(null as bigint) as female_count,
                        cast(null as bigint) as male_count,
                        cast(null as double) as avg_base_pay,
                        cast(null as double) as female_avg_base_pay,
                        cast(null as double) as male_avg_base_pay,
                        cast(null as double) as internal_gender_pay_gap
                ) where false
                """
            )
            connection.execute(
                """
                create or replace table dim_worker_category as
                select *
                from (
                    select
                        cast(null as varchar) as worker_category_id,
                        cast(null as varchar) as worker_category_label,
                        cast(null as varchar) as primary_job_family,
                        cast(null as varchar) as representative_job_level,
                        cast(null as varchar) as representative_esco_uri,
                        cast(null as varchar) as representative_nace_code,
                        cast(null as bigint) as mapped_job_code_count
                ) where false
                """
            )
            connection.execute(
                """
                create or replace table mart_internal_market_pay_benchmark as
                select *
                from (
                    select
                        cast(null as varchar) as benchmark_row_id,
                        cast(null as varchar) as country_code,
                        cast(null as date) as snapshot_date,
                        cast(null as varchar) as worker_category_id,
                        cast(null as varchar) as worker_category_label,
                        cast(null as varchar) as primary_job_family,
                        cast(null as varchar) as representative_job_level,
                        cast(null as varchar) as representative_nace_code,
                        cast(null as bigint) as headcount,
                        cast(null as bigint) as female_count,
                        cast(null as bigint) as male_count,
                        cast(null as double) as internal_gender_pay_gap,
                        cast(null as varchar) as market_sector_id,
                        cast(null as varchar) as market_period_code,
                        cast(null as double) as market_gender_pay_gap,
                        cast(null as double) as gap_to_market,
                        cast(null as boolean) as market_benchmark_available
                ) where false
                """
            )
        return db_path

    def test_build_overview_returns_grounded_payload(self):
        overview = self.repo.build_overview()

        self.assertIn("metrics", overview)
        self.assertIn("comparisons", overview)
        self.assertIn("semantic_metrics", overview)
        self.assertIn("intelligence", overview)
        self.assertIn("governance", overview)
        self.assertIn("coverage", overview["charts"]["unemployment_trend"])
        self.assertGreaterEqual(len(overview["metrics"]), 4)
        self.assertGreaterEqual(len(overview["semantic_metrics"]), 4)

        first_metric = overview["metrics"][0]
        self.assertIn("provenance", first_metric)
        self.assertIn("evidence_bundle", first_metric)
        self.assertIn("source_id", first_metric["provenance"])
        self.assertIn("formula_version", first_metric["provenance"])
        self.assertIn("eu", first_metric["comparisons"])
        self.assertIn("prior_period", first_metric["comparisons"])

    def test_build_overview_exposes_phase2_comparison_contract(self):
        overview = self.repo.build_overview(geography="DE")

        self.assertEqual(overview["comparisons"]["default_benchmark"], "eu")
        self.assertTrue(overview["comparisons"]["benchmark_options"])
        self.assertTrue(overview["comparisons"]["peer_group"]["available"])
        self.assertIn("targets", overview["comparisons"])
        self.assertEqual(overview["comparisons"]["targets"]["market"]["status"], "needs_selection")
        market_option = next(
            option for option in overview["comparisons"]["benchmark_options"] if option["id"] == "market"
        )
        sector_option = next(
            option for option in overview["comparisons"]["benchmark_options"] if option["id"] == "sector"
        )
        self.assertEqual(market_option["benchmark_status"], "unavailable")
        self.assertEqual(sector_option["benchmark_status"], "unavailable")

        employment_metric = next(metric for metric in overview["metrics"] if metric["id"] == "employment_rate")
        eu_comparison = employment_metric["comparisons"]["eu"]
        peer_comparison = employment_metric["comparisons"]["peer"]
        prior_comparison = employment_metric["comparisons"]["prior_period"]

        self.assertTrue(eu_comparison["available"])
        self.assertEqual(eu_comparison["benchmark_status"], "proxy")
        self.assertIn("evidence_bundle", eu_comparison)
        self.assertTrue(peer_comparison["available"])
        self.assertEqual(peer_comparison["benchmark_status"], "proxy")
        self.assertTrue(prior_comparison["available"])
        self.assertEqual(prior_comparison["benchmark_status"], "official")

    def test_build_overview_supports_direct_market_comparison(self):
        overview = self.repo.build_overview(geography="DE", benchmark_geography="FR")

        self.assertEqual(overview["comparisons"]["default_benchmark"], "market")
        self.assertEqual(overview["comparisons"]["targets"]["market"]["selected"]["id"], "FR")

        employment_metric = next(metric for metric in overview["metrics"] if metric["id"] == "employment_rate")
        market_comparison = employment_metric["comparisons"]["market"]

        self.assertTrue(market_comparison["available"])
        self.assertEqual(market_comparison["benchmark_status"], "official")
        self.assertEqual(market_comparison["selected_target"]["id"], "FR")
        self.assertEqual(market_comparison["coverage_status"], "full")

    def test_build_overview_supports_direct_sector_comparison_with_metric_limits(self):
        overview = self.repo.build_overview(geography="DE", sector="C", benchmark_sector="F")

        self.assertEqual(overview["comparisons"]["default_benchmark"], "sector")
        self.assertEqual(overview["comparisons"]["targets"]["sector"]["selected"]["id"], "F")

        vacancy_metric = next(metric for metric in overview["metrics"] if metric["id"] == "vacancy_rate")
        employment_metric = next(metric for metric in overview["metrics"] if metric["id"] == "employment_rate")

        self.assertTrue(vacancy_metric["comparisons"]["sector"]["available"])
        self.assertEqual(vacancy_metric["comparisons"]["sector"]["selected_target"]["id"], "F")
        self.assertFalse(employment_metric["comparisons"]["sector"]["available"])
        self.assertIn("whole-market grain", employment_metric["comparisons"]["sector"]["explanation"])

    def test_selected_market_benchmark_shapes_intelligence_context(self):
        overview = self.repo.build_overview(geography="DE", benchmark_geography="FR")

        self.assertEqual(overview["comparisons"]["selected_benchmark"]["id"], "market")
        self.assertEqual(overview["intelligence"]["benchmark_context"]["target_label"], "France")
        benchmark_recommendation = next(
            recommendation
            for recommendation in overview["intelligence"]["recommendations"]
            if recommendation["id"] == "recommendation_benchmark"
        )
        self.assertIn("France", benchmark_recommendation["title"])
        self.assertIn("France", benchmark_recommendation["detail"])

    def test_selected_sector_benchmark_surfaces_partial_coverage(self):
        overview = self.repo.build_overview(geography="DE", sector="C", benchmark_sector="F")

        selected_benchmark = overview["comparisons"]["selected_benchmark"]
        self.assertEqual(selected_benchmark["id"], "sector")
        self.assertEqual(selected_benchmark["coverage_status"], "partial")
        self.assertEqual(selected_benchmark["applicable_metric_count"], 2)
        self.assertEqual(selected_benchmark["total_metric_count"], 4)
        self.assertTrue(
            any(item["title"] == "Employment rate" for item in selected_benchmark["unavailable_metrics"])
        )
        self.assertIn("2 of 4 observed metrics", overview["intelligence"]["benchmark_context"]["summary"])

    def test_answer_question_returns_evidence_backed_response(self):
        response = self.repo.answer_question("What should HR leaders do next?")

        self.assertEqual(response["category"], "action")
        self.assertIn("confidence", response)
        self.assertTrue(response["evidence"])
        self.assertTrue(response["provenance"])
        self.assertIn("applied_filters", response)

    def test_build_evidence_pack_collects_governance_payload(self):
        evidence_pack = self.repo.build_evidence_pack()

        self.assertIn("summary", evidence_pack)
        self.assertIn("metrics", evidence_pack)
        self.assertIn("semantic_metrics", evidence_pack)
        self.assertIn("recommendations", evidence_pack)
        self.assertIn("governance", evidence_pack)
        self.assertIn("internal_data", evidence_pack)
        self.assertIn("company_benchmark", evidence_pack)

    def test_build_overview_reports_internal_data_as_unavailable_by_default(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = self._copy_analytics_db_with_empty_internal_models(temp_dir)
            repo = AnalyticsRepository(ROOT_DIR, analytics_db_path=db_path)
            overview = repo.build_overview()

            self.assertIn("internal_data", overview)
            self.assertIn("company_benchmark", overview)
            self.assertFalse(overview["internal_data"]["available"])
            self.assertFalse(overview["company_benchmark"]["available"])

    def test_record_governance_event_persists_to_local_store(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            events_path = Path(temp_dir) / "governance_events.json"
            repo = AnalyticsRepository(ROOT_DIR, governance_events_path=events_path)

            created = repo.record_governance_event(
                {
                    "action_code": "overridden",
                    "target_type": "recommendation",
                    "target_id": "recommendation_benchmark",
                    "reason": "Validated a more appropriate market benchmark manually.",
                }
            )

            self.assertTrue(events_path.exists())
            reloaded = AnalyticsRepository(ROOT_DIR, governance_events_path=events_path)
            payload = reloaded.build_governance_payload()

            self.assertEqual(payload["recent_events"][0]["event_id"], created["event_id"])
            self.assertEqual(payload["recent_events"][0]["action_code"], "overridden")
            self.assertEqual(payload["recent_events"][0]["target_id"], "recommendation_benchmark")

    def test_build_overview_supports_company_benchmark_when_internal_benchmark_mart_has_rows(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = self._copy_analytics_db(temp_dir)
            with duckdb.connect(str(db_path)) as connection:
                connection.execute("drop view if exists stg_internal__payroll_snapshot")
                connection.execute(
                    """
                    create table stg_internal__payroll_snapshot as
                    select *
                    from (
                        values
                            ('emp-1', 'SE-1', 'Software Engineer', 'DE', 'eng_ic', 'female', 90000, 'EUR', '2026-03-31'::date, 'active', 'local', 'internal_payroll_snapshot'),
                            ('emp-2', 'SE-1', 'Software Engineer', 'DE', 'eng_ic', 'male', 110000, 'EUR', '2026-03-31'::date, 'active', 'local', 'internal_payroll_snapshot'),
                            ('emp-3', 'SE-1', 'Software Engineer', 'DE', 'eng_ic', 'female', 95000, 'EUR', '2026-03-31'::date, 'active', 'local', 'internal_payroll_snapshot'),
                            ('emp-4', 'SE-1', 'Software Engineer', 'DE', 'eng_ic', 'male', 115000, 'EUR', '2026-03-31'::date, 'active', 'local', 'internal_payroll_snapshot')
                    ) as seeded(
                        employee_id, job_code, job_title, country_code, worker_category_id, gender,
                        base_pay_amount, pay_currency, snapshot_date, employment_status, source_version, dataset_name
                    )
                    """
                )
                connection.execute("drop view if exists stg_internal__job_architecture")
                connection.execute(
                    """
                    create table stg_internal__job_architecture as
                    select *
                    from (
                        values
                            ('SE-1', 'Engineering', 'IC3', 'eng_ic', 'Engineering Individual Contributor', 'urn:esco:occupation:1', 'J62', 'local', 'internal_job_architecture')
                    ) as seeded(
                        job_code, job_family, job_level, worker_category_id, worker_category_label,
                        esco_uri, nace_code, source_version, dataset_name
                    )
                    """
                )
                connection.execute(
                    """
                    create or replace table fct_internal_pay_snapshot as
                    select *
                    from (
                        values
                            ('DE::eng_ic::2026-03-31', 'DE', '2026-03-31'::date, 'eng_ic', 'J62', 'urn:esco:occupation:1', 'EUR', 4, 2, 2, 102500, 92500, 112500, 17.8)
                    ) as seeded(
                        internal_pay_snapshot_id, country_code, snapshot_date, worker_category_id, nace_code,
                        esco_uri, pay_currency, headcount, female_count, male_count, avg_base_pay,
                        female_avg_base_pay, male_avg_base_pay, internal_gender_pay_gap
                    )
                    """
                )
                connection.execute(
                    """
                    create or replace table dim_worker_category as
                    select *
                    from (
                        values
                            ('eng_ic', 'Engineering Individual Contributor', 'Engineering', 'IC3', 'urn:esco:occupation:1', 'J62', 1)
                    ) as seeded(
                        worker_category_id, worker_category_label, primary_job_family, representative_job_level,
                        representative_esco_uri, representative_nace_code, mapped_job_code_count
                    )
                    """
                )
                connection.execute(
                    """
                    create or replace table mart_internal_market_pay_benchmark as
                    select *
                    from (
                        values
                            ('DE::eng_ic::2026-03-31', 'DE', '2026-03-31'::date, 'eng_ic', 'Engineering Individual Contributor', 'Engineering', 'IC3', 'J62', 4, 2, 2, 17.8, 'B-S', '2024', 18.0, -0.2, true)
                    ) as seeded(
                        benchmark_row_id, country_code, snapshot_date, worker_category_id, worker_category_label,
                        primary_job_family, representative_job_level, representative_nace_code, headcount,
                        female_count, male_count, internal_gender_pay_gap, market_sector_id, market_period_code,
                        market_gender_pay_gap, gap_to_market, market_benchmark_available
                    )
                    """
                )

            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True, exist_ok=True)
            self._write_internal_manifest(temp_dir, trusted=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir, analytics_db_path=db_path)
            overview = repo.build_overview(geography="DE")

            self.assertTrue(overview["internal_data"]["available"], overview["internal_data"])
            self.assertTrue(overview["company_benchmark"]["available"])
            self.assertEqual(overview["company_benchmark"]["evidence_basis"], "blended")
            self.assertEqual(overview["company_benchmark"]["worker_category"]["id"], "eng_ic")
            self.assertGreater(overview["company_benchmark"]["headcount"], 0)
            self.assertEqual(overview["company_benchmark"]["market_sector_id"], "B-S")

            answer = repo.answer_question("How does our pay compare with the market?", geography="DE")
            self.assertEqual(answer["category"], "company")
            self.assertNotIn("Benchmark basis", answer["answer"])
            self.assertTrue(answer["internal_data_available"])

    def test_local_sample_internal_rows_do_not_activate_company_claims_without_trust_manifest(self):
        overview = self.repo.build_overview(country="DE", geography="DE")

        self.assertFalse(overview["internal_data"]["available"])
        self.assertFalse(overview["company_benchmark"]["available"])
        self.assertIn("untrusted internal rows", overview["internal_data"]["note"])

    def test_real_internal_files_do_not_activate_company_benchmark_without_modeled_rows(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir)
            pd.DataFrame(
                [
                    {
                        "employee_id": "emp-1",
                        "job_code": "SE-1",
                        "job_title": "Software Engineer",
                        "country_code": "DE",
                        "worker_category_id": "eng_ic",
                        "gender": "female",
                        "base_pay_amount": 90000,
                        "pay_currency": "EUR",
                        "snapshot_date": "2026-03-31",
                        "employment_status": "active",
                        "version": "local",
                    }
                ]
            ).to_parquet(internal_dir / "payroll_snapshot.parquet", index=False)
            pd.DataFrame(
                [
                    {
                        "job_code": "SE-1",
                        "job_family": "Engineering",
                        "job_level": "IC3",
                        "worker_category_id": "eng_ic",
                        "worker_category_label": "Engineering Individual Contributor",
                        "esco_uri": "urn:esco:occupation:1",
                        "nace_code": "J62",
                        "version": "local",
                    }
                ]
            ).to_parquet(internal_dir / "job_architecture.parquet", index=False)

            db_path = self._copy_analytics_db_with_empty_internal_models(temp_dir)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir, analytics_db_path=db_path)
            overview = repo.build_overview(geography="DE")

            self.assertFalse(overview["internal_data"]["available"])
            self.assertFalse(overview["company_benchmark"]["available"])
            self.assertIn("modeled company benchmark mart", overview["internal_data"]["note"])

    def test_company_question_is_blocked_without_internal_assets(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = self._copy_analytics_db_with_empty_internal_models(temp_dir)
            repo = AnalyticsRepository(ROOT_DIR, analytics_db_path=db_path)
            response = repo.answer_question("How does our pay compare with the market?", geography="DE")

            self.assertEqual(response["category"], "company")
            self.assertFalse(response["internal_data_available"])
            self.assertEqual(response["evidence_basis"], "external")
            self.assertIn("cannot make a company-specific pay claim", response["answer"])
            self.assertNotIn("Benchmark basis", response["answer"])

    def test_sparse_geography_overview_degrades_gracefully(self):
        overview = self.repo.build_overview(country="ALL", geography="IT", sector="ALL", period="latest")

        self.assertIn("filters", overview)
        self.assertIn("intelligence", overview)
        self.assertIn("notes", overview["filters"])
        self.assertTrue(
            any("unavailable" in note.lower() for note in overview["filters"]["notes"])
        )

    def test_sparse_geography_questions_do_not_raise(self):
        response = self.repo.answer_question(
            "Give me the executive summary.",
            country="ALL",
            geography="IT",
            sector="ALL",
            period="latest",
        )
        self.assertEqual(response["category"], "summary")
        self.assertIn("answer", response)

    def test_answer_question_handles_benchmark_and_peer_queries(self):
        benchmark_response = self.repo.answer_question(
            "How does Germany compare to the EU benchmark?",
            geography="DE",
        )
        peer_response = self.repo.answer_question(
            "Which peer countries look most similar?",
            geography="DE",
        )

        self.assertEqual(benchmark_response["category"], "comparison")
        self.assertIn("Benchmark basis", benchmark_response["answer"])
        self.assertEqual(benchmark_response["benchmark_basis"]["id"], "eu")
        self.assertEqual(benchmark_response["coverage"]["status"], "partial")
        self.assertTrue(benchmark_response["limitations"])
        self.assertTrue(benchmark_response["evidence"])
        self.assertEqual(peer_response["category"], "comparison")
        self.assertEqual(peer_response["benchmark_basis"]["id"], "peer")
        self.assertTrue(peer_response["evidence"])

    def test_answer_question_handles_selected_market_benchmark_queries(self):
        response = self.repo.answer_question(
            "How does Germany compare with France?",
            geography="DE",
            benchmark_geography="FR",
        )

        self.assertEqual(response["category"], "comparison")
        self.assertIn("Selected market (France)", response["answer"])
        self.assertEqual(response["benchmark_basis"]["id"], "market")
        self.assertTrue(response["evidence"])

    def test_generic_comparison_question_uses_active_selected_benchmark(self):
        response = self.repo.answer_question(
            "How does this compare?",
            geography="DE",
            benchmark_geography="FR",
        )

        self.assertEqual(response["category"], "comparison")
        self.assertEqual(response["benchmark_basis"]["id"], "market")
        self.assertIn("Selected market (France)", response["answer"])

    def test_benchmark_confidence_question_uses_active_selected_benchmark(self):
        response = self.repo.answer_question(
            "How confident is this benchmark?",
            geography="DE",
            benchmark_geography="FR",
        )

        self.assertEqual(response["category"], "comparison")
        self.assertEqual(response["benchmark_basis"]["id"], "market")
        self.assertIn("confidence on Selected market (France) is high", response["answer"])
        self.assertTrue(response["evidence"])

    def test_compared_to_what_question_returns_active_benchmark_basis(self):
        response = self.repo.answer_question(
            "Compared to what?",
            geography="DE",
            benchmark_geography="FR",
        )

        self.assertEqual(response["category"], "comparison")
        self.assertEqual(response["benchmark_basis"]["id"], "market")
        self.assertIn("Selected market (France)", response["answer"])
        self.assertTrue(any(item["label"] == "Benchmark basis" for item in response["evidence"]))

    def test_comparison_limit_question_returns_excluded_metrics(self):
        response = self.repo.answer_question(
            "What limits this comparison?",
            geography="DE",
            sector="C",
            benchmark_sector="F",
        )

        self.assertEqual(response["category"], "comparison")
        self.assertEqual(response["benchmark_basis"]["id"], "sector")
        self.assertIn("Excluded metrics", response["answer"])
        self.assertTrue(any(item["label"] == "Excluded metrics" for item in response["evidence"]))

    def test_why_changed_question_returns_descriptive_driver_answer(self):
        response = self.repo.answer_question(
            "Why did this change?",
            geography="DE",
            benchmark_geography="FR",
        )

        self.assertEqual(response["category"], "comparison")
        self.assertEqual(response["benchmark_basis"]["id"], "prior_period")
        self.assertIn("descriptive read of concurrent observed metric moves", response["answer"])
        self.assertIn("does not infer underlying causes", " ".join(response["limitations"]))

    def test_why_worsening_question_returns_non_causal_driver_context(self):
        response = self.repo.answer_question(
            "Why is this worsening?",
            geography="DE",
            benchmark_geography="FR",
        )

        self.assertEqual(response["category"], "comparison")
        self.assertEqual(response["benchmark_basis"]["id"], "prior_period")
        self.assertIn("not a causal explanation", response["answer"])
        self.assertTrue(response["evidence"])

    def test_worsening_fastest_question_returns_prior_period_basis(self):
        response = self.repo.answer_question(
            "Which signal is worsening fastest?",
            geography="DE",
        )

        self.assertEqual(response["category"], "comparison")
        self.assertEqual(response["benchmark_basis"]["id"], "prior_period")
        self.assertIn("worsening fastest", response["answer"])
        self.assertTrue(response["evidence"])

    def test_eu_scope_falls_back_to_prior_period_comparison(self):
        overview = self.repo.build_overview(geography="EU27_AVG")

        self.assertEqual(overview["filters"]["applied"]["geography_label"], "EU27 proxy market average")
        self.assertEqual(overview["comparisons"]["default_benchmark"], "prior_period")
        eu_metric = next(metric for metric in overview["metrics"] if metric["id"] == "employment_rate")
        self.assertEqual(eu_metric["coverage"]["status"], "partial")
        self.assertIn("proxy average", eu_metric["coverage"]["notes"][0])
        self.assertEqual(overview["charts"]["unemployment_trend"]["coverage"]["status"], "partial")
        self.assertFalse(eu_metric["comparisons"]["eu"]["available"])
        self.assertTrue(eu_metric["comparisons"]["prior_period"]["available"])

    def test_governance_actions_enforce_reason_rules(self):
        with self.assertRaises(ValueError):
            self.repo.record_governance_event(
                {
                    "action_code": "overridden",
                    "target_type": "recommendation",
                    "target_id": "rec_001",
                }
            )

        event = self.repo.record_governance_event(
            {
                "action_code": "approved",
                "target_type": "recommendation",
                "target_id": "rec_001",
            }
        )
        self.assertEqual(event["action_code"], "approved")


@unittest.skipIf(main is None, f"FastAPI app unavailable in test env: {MAIN_IMPORT_ERROR}")
class MainContractTests(unittest.TestCase):
    def test_root_contract_exposes_supported_grains(self):
        payload = main.read_root()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("supported_grains", payload)
        self.assertIn("available_actions", payload)

    def test_health_contract_is_lightweight(self):
        payload = main.health_check()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["service"], "WorkforceGuard Analytics API")

    def test_overview_and_ask_endpoint_functions_return_dicts(self):
        overview = main.get_overview()
        answer = main.ask_dashboard(main.AskRequest(question="Which sector has the widest pay gap?"))

        self.assertIn("filters", overview)
        self.assertIn("category", answer)
        self.assertIn("answer", answer)


if __name__ == "__main__":
    unittest.main()
