from __future__ import annotations

import os
import shutil
import sys
import tempfile
import unittest
import json
from pathlib import Path

os.environ.setdefault("SESSION_SECRET", "test-secret-not-for-production-use-only")

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
        self.assertIn("copilot", overview)
        self.assertIn("brief", overview)
        self.assertIn("automation", overview)
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
        self.assertIn("pay_transparency", evidence_pack)
        self.assertIn("copilot", evidence_pack)
        self.assertIn("brief", evidence_pack)
        self.assertIn("automation", evidence_pack)

    def test_phase5_copilot_briefs_and_workflows_are_governed(self):
        overview = self.repo.build_overview(geography="DE")

        self.assertEqual(overview["copilot"]["status"], "live")
        self.assertEqual(overview["copilot"]["mode"], "retrieval_bounded")
        self.assertIn("evidence", overview["copilot"]["answer_requirements"])
        self.assertFalse(overview["automation"]["policy"]["autonomous_decisions_allowed"])
        self.assertTrue(overview["automation"]["policy"]["sensitive_actions_require_human_approval"])
        self.assertGreaterEqual(len(overview["brief"]["cadence_options"]), 2)
        self.assertTrue(overview["brief"]["evidence"])
        self.assertTrue(overview["automation"]["scheduled_briefs"])
        self.assertTrue(overview["automation"]["handoffs"])

        response = self.repo.answer_question("What alerts and workflow handoffs are active?", geography="DE")

        self.assertEqual(response["category"], "automation")
        self.assertIn("human-approved mode", response["answer"])
        self.assertTrue(response["evidence"])

    def test_phase5_automation_schedule_persists_and_generates_output(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            schedules_path = Path(temp_dir) / "automation_schedules.json"
            events_path = Path(temp_dir) / "governance_events.json"
            repo = AnalyticsRepository(
                ROOT_DIR,
                governance_events_path=events_path,
                automation_schedules_path=schedules_path,
            )

            schedule = repo.configure_automation_schedule(
                {
                    "template_id": "weekly_executive_update",
                    "geography": "DE",
                    "approved": True,
                    "actor": "people_analytics_lead",
                }
            )

            self.assertTrue(schedules_path.exists())
            self.assertEqual(schedule["status"], "active")
            self.assertEqual(schedule["filters"]["geography"], "DE")

            reloaded = AnalyticsRepository(
                ROOT_DIR,
                governance_events_path=events_path,
                automation_schedules_path=schedules_path,
            )
            overview = reloaded.build_overview(geography="DE")
            self.assertEqual(len(overview["automation"]["configured_schedules"]), 1)

            scheduled_output = reloaded.build_scheduled_output(schedule["schedule_id"])
            self.assertEqual(scheduled_output["output_type"], "brief")
            self.assertIn("summary", scheduled_output["output"])
            self.assertTrue(scheduled_output["governance"]["integrity"]["verified"])

    def test_phase5_compliance_schedule_requires_approval(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            repo = AnalyticsRepository(
                ROOT_DIR,
                governance_events_path=Path(temp_dir) / "governance_events.json",
                automation_schedules_path=Path(temp_dir) / "automation_schedules.json",
            )

            with self.assertRaises(ValueError):
                repo.configure_automation_schedule(
                    {
                        "template_id": "monthly_compliance_evidence_pack",
                        "geography": "DE",
                        "approved": False,
                    }
                )

    def test_build_overview_reports_internal_data_as_unavailable_by_default(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = self._copy_analytics_db_with_empty_internal_models(temp_dir)
            repo = AnalyticsRepository(ROOT_DIR, analytics_db_path=db_path)
            overview = repo.build_overview()

            self.assertIn("internal_data", overview)
            self.assertIn("company_benchmark", overview)
            self.assertIn("pay_transparency", overview)
            self.assertFalse(overview["internal_data"]["available"])
            self.assertFalse(overview["company_benchmark"]["available"])
            self.assertFalse(overview["pay_transparency"]["available"])

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

    def test_record_governance_event_persists_to_sqlite_store(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            events_path = Path(temp_dir) / "governance_events.sqlite"
            repo = AnalyticsRepository(ROOT_DIR, governance_events_path=events_path)

            created = repo.record_governance_event(
                {
                    "action_code": "exported",
                    "target_type": "evidence_pack",
                    "target_id": "phase4_pack",
                    "actor": "compliance_lead",
                    "context": {"scope": "DE"},
                }
            )

            self.assertTrue(events_path.exists())
            self.assertEqual(created["actor"], "compliance_lead")

            reloaded = AnalyticsRepository(ROOT_DIR, governance_events_path=events_path)
            payload = reloaded.build_governance_payload()

            self.assertTrue(payload["integrity"]["verified"])
            self.assertTrue(payload["export"]["includes_hash_chain"])
            self.assertEqual(payload["events"][0]["target_id"], "phase4_pack")
            self.assertEqual(payload["events"][0]["actor"], "compliance_lead")

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
            events_path = Path(temp_dir) / "governance_events.json"
            repo = AnalyticsRepository(
                ROOT_DIR,
                governance_events_path=events_path,
                internal_data_dir=internal_dir,
                analytics_db_path=db_path,
            )
            overview = repo.build_overview(geography="DE")

            self.assertTrue(overview["internal_data"]["available"], overview["internal_data"])
            self.assertTrue(overview["company_benchmark"]["available"])
            self.assertEqual(overview["company_benchmark"]["evidence_basis"], "blended")
            self.assertEqual(overview["company_benchmark"]["worker_category"]["id"], "eng_ic")
            self.assertGreater(overview["company_benchmark"]["headcount"], 0)
            self.assertEqual(overview["company_benchmark"]["market_sector_id"], "B-S")
            self.assertTrue(overview["pay_transparency"]["available"])
            self.assertEqual(overview["pay_transparency"]["evidence_basis"], "blended")
            self.assertEqual(overview["pay_transparency"]["summary"]["category_count"], 1)
            self.assertEqual(overview["pay_transparency"]["summary"]["unresolved_review_item_count"], 1)
            self.assertEqual(
                overview["pay_transparency"]["top_review_items"][0]["review_state"],
                "unresolved_review_item",
            )
            self.assertEqual(
                overview["pay_transparency"]["governance_target"]["target_type"],
                "compliance_simulation",
            )
            category_target = overview["pay_transparency"]["review_items"][0]["governance_target"]
            self.assertEqual(category_target["target_type"], "pay_transparency_category")
            self.assertEqual(
                overview["pay_transparency"]["review_items"][0]["human_review"]["state"],
                "pending_review",
            )

            repo.record_governance_event(
                {
                    "action_code": "approved",
                    "target_type": category_target["target_type"],
                    "target_id": category_target["target_id"],
                }
            )
            reviewed_overview = repo.build_overview(geography="DE")
            self.assertEqual(reviewed_overview["pay_transparency"]["summary"]["approved_count"], 1)
            self.assertEqual(reviewed_overview["pay_transparency"]["summary"]["pending_review_count"], 0)
            self.assertEqual(
                reviewed_overview["pay_transparency"]["review_items"][0]["human_review"]["state"],
                "approved",
            )

            answer = repo.answer_question("How does our pay compare with the market?", geography="DE")
            self.assertEqual(answer["category"], "company")
            self.assertNotIn("Benchmark basis", answer["answer"])
            self.assertTrue(answer["internal_data_available"])

            compliance_answer = repo.answer_question("Run the pay transparency compliance simulation", geography="DE")
            self.assertEqual(compliance_answer["category"], "compliance")
            self.assertEqual(compliance_answer["evidence_basis"], "blended")
            self.assertIn("unresolved review items", compliance_answer["answer"])

    def test_local_sample_internal_rows_do_not_activate_company_claims_without_trust_manifest(self):
        # Uses an isolated repo pointing at the real analytics DB (which has mart rows)
        # but with a manifest explicitly marked untrusted, so the shared class-level
        # repo (which has a trusted demo manifest) is not affected.
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            self._write_internal_manifest(temp_dir, trusted=False)
            db_path = self._copy_analytics_db(temp_dir)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir, analytics_db_path=db_path)
            overview = repo.build_overview(country="FR", geography="FR")

            self.assertFalse(overview["internal_data"]["available"])
            self.assertFalse(overview["company_benchmark"]["available"])
            self.assertFalse(overview["pay_transparency"]["available"])
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

    def test_pay_transparency_question_is_blocked_without_trusted_internal_data(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = self._copy_analytics_db_with_empty_internal_models(temp_dir)
            repo = AnalyticsRepository(ROOT_DIR, analytics_db_path=db_path)
            response = repo.answer_question("Run the pay transparency compliance simulation", geography="DE")

            self.assertEqual(response["category"], "compliance")
            self.assertFalse(response["internal_data_available"])
            self.assertEqual(response["evidence_basis"], "external")
            self.assertIn("not active", response["answer"])

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
        with tempfile.TemporaryDirectory() as temp_dir:
            events_path = Path(temp_dir) / "events.json"
            repo = AnalyticsRepository(ROOT_DIR, governance_events_path=events_path)

            with self.assertRaises(ValueError):
                repo.record_governance_event(
                    {
                        "action_code": "overridden",
                        "target_type": "recommendation",
                        "target_id": "rec_001",
                    }
                )

            event = repo.record_governance_event(
                {
                    "action_code": "approved",
                    "target_type": "recommendation",
                    "target_id": "rec_001",
                }
            )
            self.assertEqual(event["action_code"], "approved")
            self.assertEqual(event["previous_hash"], "GENESIS")
            self.assertIn("event_hash", event)

            second_event = repo.record_governance_event(
                {
                    "action_code": "overridden",
                    "target_type": "recommendation",
                    "target_id": "rec_001",
                    "reason": "Documented legal exception.",
                }
            )
            self.assertEqual(second_event["previous_hash"], event["event_hash"])
            payload = repo.build_governance_payload()
            self.assertTrue(payload["integrity"]["verified"])
            self.assertEqual(payload["integrity"]["event_count"], 2)

    def test_evidence_pack_exposes_phase4_compliance_export_contract(self):
        evidence_pack = self.repo.build_evidence_pack()

        self.assertEqual(evidence_pack["pack_type"], "workforceguard_compliance_evidence_pack")
        self.assertEqual(evidence_pack["pack_version"], "phase-4-v1")
        self.assertIn("compliance_review", evidence_pack)
        self.assertIn("export_contract", evidence_pack["compliance_review"])
        self.assertFalse(evidence_pack["compliance_review"]["export_contract"]["contains_person_level_data"])
        self.assertIn("governance_integrity", evidence_pack["compliance_review"])


class EgaproPeerBenchmarkTests(unittest.TestCase):
    """Tests for _build_egapro_peer_benchmark."""

    @classmethod
    def setUpClass(cls):
        cls.repo = AnalyticsRepository(ROOT_DIR)

    def _fr_filters(self, sector: str = "J"):
        filters, _ = self.repo.resolve_filters(country="FR", geography="FR", sector=sector, period="latest")
        return filters

    def _non_fr_filters(self):
        filters, _ = self.repo.resolve_filters(country="DE", geography="DE", sector="ALL", period="latest")
        return filters

    def test_returns_available_for_france_with_mart_present(self):
        result = self.repo._build_egapro_peer_benchmark(self._fr_filters(sector="J"))

        self.assertTrue(result["available"])
        self.assertEqual(result["nace_section"], "J")
        self.assertIn("year", result)
        self.assertIn("p25_score", result)
        self.assertIn("p50_score", result)
        self.assertIn("p75_score", result)
        self.assertIn("company_count", result)
        self.assertGreater(result["company_count"], 5)
        self.assertGreaterEqual(result["p50_score"], 70)
        self.assertLessEqual(result["p50_score"], 100)
        self.assertEqual(result["source_id"], "egapro")

    def test_returns_all_size_bands(self):
        result = self.repo._build_egapro_peer_benchmark(self._fr_filters(sector="J"))

        self.assertIn("all_size_bands", result)
        self.assertGreater(len(result["all_size_bands"]), 1)
        size_bands = {row["size_band"] for row in result["all_size_bands"]}
        self.assertTrue(size_bands.issubset({"50-250", "251-999", "1000+"}))

    def test_note_describes_source(self):
        result = self.repo._build_egapro_peer_benchmark(self._fr_filters(sector="J"))

        self.assertIn("French companies", result["note"])
        self.assertIn("Égapro", result["note"])

    def test_unavailable_for_non_france_country(self):
        result = self.repo._build_egapro_peer_benchmark(self._non_fr_filters())

        self.assertFalse(result["available"])
        self.assertIn("note", result)
        self.assertIn("France", result["note"])

    def test_nace_section_derived_from_sector_filter(self):
        result_j = self.repo._build_egapro_peer_benchmark(self._fr_filters(sector="J"))
        result_c = self.repo._build_egapro_peer_benchmark(self._fr_filters(sector="C"))

        self.assertTrue(result_j["available"])
        self.assertEqual(result_j["nace_section"], "J")
        self.assertTrue(result_c["available"])
        self.assertEqual(result_c["nace_section"], "C")

    def test_egapro_benchmark_present_in_overview_for_france(self):
        overview = self.repo.build_overview(country="FR", geography="FR", sector="J", period="latest")

        self.assertIn("egapro_peer_benchmark", overview)
        self.assertTrue(overview["egapro_peer_benchmark"]["available"])

    def test_egapro_benchmark_unavailable_in_overview_for_non_france(self):
        overview = self.repo.build_overview(country="DE", geography="DE", sector="J", period="latest")

        self.assertIn("egapro_peer_benchmark", overview)
        self.assertFalse(overview["egapro_peer_benchmark"]["available"])

    def test_unavailable_when_mart_missing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = self._copy_analytics_db_without_egapro_mart(temp_dir)
            repo = AnalyticsRepository(ROOT_DIR, analytics_db_path=db_path)
            filters, _ = repo.resolve_filters(country="FR", geography="FR", sector="J", period="latest")
            result = repo._build_egapro_peer_benchmark(filters)

            self.assertFalse(result["available"])
            self.assertIn("mart not yet built", result["note"])

    def _copy_analytics_db_without_egapro_mart(self, temp_dir: str) -> Path:
        db_path = Path(temp_dir) / "workforceguard_analytics.duckdb"
        shutil.copyfile(ANALYTICS_DB_PATH, db_path)
        with duckdb.connect(str(db_path)) as con:
            con.execute("drop table if exists mart_egapro_sector_benchmark")
        return db_path


class IngestUploadedPayrollTests(unittest.TestCase):
    """Tests for ingest_uploaded_payroll."""

    @classmethod
    def setUpClass(cls):
        cls.repo = AnalyticsRepository(ROOT_DIR)

    def _make_csv(self, rows: list[dict]) -> bytes:
        import csv, io
        if not rows:
            return b""
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
        return buf.getvalue().encode()

    def _valid_rows(self, n: int = 15, country: str = "FR") -> list[dict]:
        return [
            {
                "employee_id": f"emp-{i:03d}",
                "job_code": "SE-IC-1",
                "country_code": country,
                "worker_category_id": "eng_ic",
                "gender": "female",
                "base_salary": 55000 + i * 100,
                "currency": "EUR",
                "snapshot_date": "2025-12-31",
            }
            for i in range(n)
        ]

    def test_valid_upload_returns_accepted(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)

            result = repo.ingest_uploaded_payroll(self._make_csv(self._valid_rows(15)))

            self.assertEqual(result["status"], "accepted")
            self.assertEqual(result["record_count"], 15)
            self.assertEqual(result["snapshot_date"], "2025-12-31")
            self.assertTrue(result["validation"]["passed"])
            self.assertEqual(result["validation"]["warnings"], [])

    def test_output_parquet_written_to_internal_dir(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)

            repo.ingest_uploaded_payroll(self._make_csv(self._valid_rows(10)))

            self.assertTrue((internal_dir / "payroll_snapshot.parquet").exists())
            df = pd.read_parquet(internal_dir / "payroll_snapshot.parquet")
            self.assertEqual(len(df), 10)
            self.assertIn("base_pay_amount", df.columns)

    def test_manifest_updated_with_trusted_flag(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)

            repo.ingest_uploaded_payroll(self._make_csv(self._valid_rows(10)))

            manifest_path = internal_dir.parent / "internal_meta" / "manifest.json"
            self.assertTrue(manifest_path.exists())
            manifest = json.loads(manifest_path.read_text())
            payroll_asset = next(
                a for a in manifest["assets"] if a["asset_type"] == "internal_payroll_snapshot"
            )
            self.assertTrue(payroll_asset["trusted_for_company_claims"])
            self.assertEqual(payroll_asset["record_count"], 10)

    def test_rejects_upload_with_fewer_than_10_rows(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)

            with self.assertRaises(ValueError) as ctx:
                repo.ingest_uploaded_payroll(self._make_csv(self._valid_rows(9)))
            self.assertIn("10 employees", str(ctx.exception))

    def test_rejects_missing_required_columns(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)
            bad_csv = b"employee_id,name\nemp-001,Alice\n"

            with self.assertRaises(ValueError) as ctx:
                repo.ingest_uploaded_payroll(bad_csv)
            self.assertIn("Missing required columns", str(ctx.exception))

    def test_rejects_invalid_gender_values(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)
            rows = self._valid_rows(10)
            rows[0]["gender"] = "unknown"

            with self.assertRaises(ValueError) as ctx:
                repo.ingest_uploaded_payroll(self._make_csv(rows))
            self.assertIn("gender", str(ctx.exception).lower())

    def test_rejects_zero_and_negative_salary(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)
            rows = self._valid_rows(10)
            rows[0]["base_salary"] = 0

            with self.assertRaises(ValueError) as ctx:
                repo.ingest_uploaded_payroll(self._make_csv(rows))
            self.assertIn("base_salary", str(ctx.exception))

    def test_rejects_future_snapshot_date(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)
            rows = self._valid_rows(10)
            for row in rows:
                row["snapshot_date"] = "2099-01-01"

            with self.assertRaises(ValueError) as ctx:
                repo.ingest_uploaded_payroll(self._make_csv(rows))
            self.assertIn("future", str(ctx.exception))

    def test_rejects_invalid_country_code(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)
            rows = self._valid_rows(10, country="FRANCE")

            with self.assertRaises(ValueError) as ctx:
                repo.ingest_uploaded_payroll(self._make_csv(rows))
            self.assertIn("country_code", str(ctx.exception))

    def test_warns_on_unknown_job_codes(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            # Copy job architecture so the warning check has something to compare against
            shutil.copyfile(
                ROOT_DIR / "data" / "internal" / "job_architecture.parquet",
                internal_dir / "job_architecture.parquet",
            )
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)
            rows = self._valid_rows(10)
            for row in rows:
                row["job_code"] = "UNKNOWN-XYZ"

            result = repo.ingest_uploaded_payroll(self._make_csv(rows))

            self.assertEqual(result["status"], "accepted")
            self.assertTrue(result["validation"]["passed"])
            self.assertTrue(len(result["validation"]["warnings"]) > 0)
            self.assertIn("job_codes not in job architecture", result["validation"]["warnings"][0])

    def test_accepts_non_binary_gender(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)
            rows = self._valid_rows(10)
            rows[0]["gender"] = "non_binary"

            result = repo.ingest_uploaded_payroll(self._make_csv(rows))
            self.assertEqual(result["status"], "accepted")

    def test_rejects_invalid_csv_content(self):
        # A file with no recognisable columns raises a validation error.
        with tempfile.TemporaryDirectory() as temp_dir:
            internal_dir = Path(temp_dir) / "internal"
            internal_dir.mkdir(parents=True)
            repo = AnalyticsRepository(ROOT_DIR, internal_data_dir=internal_dir)

            with self.assertRaises(ValueError):
                repo.ingest_uploaded_payroll(b"not,a,payroll,file\n1,2,3,4\n")


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
        repo = main.repository_registry.get_for_tenant("test-contract-tenant")
        overview = main.get_overview(repo=repo)
        answer = main.ask_dashboard(
            main.AskRequest(question="Which sector has the widest pay gap?"),
            repo=repo,
        )

        self.assertIn("filters", overview)
        self.assertIn("category", answer)
        self.assertIn("answer", answer)


if __name__ == "__main__":
    unittest.main()
