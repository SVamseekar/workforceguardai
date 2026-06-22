from __future__ import annotations

import csv
import hashlib
import json
import math
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import duckdb


AGGREGATE_SECTORS = {
    "A-S",
    "B-E",
    "B-F",
    "B-N",
    "B-S",
    "B-S_X_O",
    "G-I",
    "G-N",
    "M_N",
    "O-Q",
    "O-S",
    "R_S",
}

OBSERVED_METRIC_CONFIG = {
    "vacancy_rate": {
        "title": "Average job vacancy rate",
        "signal_name": "job_vacancy_rate",
        "unit": "%",
        "source_id": "eurostat_jvs",
        "formula_version": "observed-v1",
        "default_sector": "A-S",
        "desired_direction": "down",
        "definition": "Latest observed job vacancy rate for the selected geography and sector scope.",
        "human_review_required": False,
    },
    "unemployment_rate": {
        "title": "Unemployment rate",
        "signal_name": "unemployment_rate",
        "unit": "%",
        "source_id": "eurostat_lfs",
        "formula_version": "observed-v1",
        "default_sector": None,
        "desired_direction": "down",
        "definition": "Latest observed unemployment rate for the selected geography.",
        "human_review_required": False,
    },
    "employment_rate": {
        "title": "Employment rate",
        "signal_name": "employment_rate",
        "unit": "%",
        "source_id": "eurostat_lfs",
        "formula_version": "observed-v1",
        "default_sector": None,
        "desired_direction": "up",
        "definition": "Latest observed employment rate for the selected geography.",
        "human_review_required": False,
    },
    "gender_pay_gap": {
        "title": "Gender pay gap",
        "signal_name": "gender_pay_gap",
        "unit": "%",
        "source_id": "eurostat_lfs",
        "formula_version": "observed-v1",
        "default_sector": "B-S",
        "desired_direction": "down",
        "definition": "Latest observed market gender pay gap for the selected geography and sector scope.",
        "human_review_required": True,
    },
}

OBSERVED_METRIC_IDS = [
    "vacancy_rate",
    "unemployment_rate",
    "employment_rate",
    "gender_pay_gap",
]

COMPARISON_BENCHMARKS = {
    "eu": {
        "label": "EU27 proxy average",
        "benchmark_status": "proxy",
    },
    "peer": {
        "label": "Peer-country basket",
        "benchmark_status": "proxy",
    },
    "prior_period": {
        "label": "Prior period",
        "benchmark_status": "official",
    },
    "market": {
        "label": "Selected market",
        "benchmark_status": "official",
    },
    "sector": {
        "label": "Selected sector",
        "benchmark_status": "official",
    },
}

SUGGESTED_QUESTIONS = [
    "How does this market compare to the EU benchmark?",
    "Which peer countries look most similar?",
    "What changed versus the prior period?",
    "Which signal is worsening fastest?",
    "Compared to what?",
    "Why did this change?",
    "How confident is this benchmark?",
    "What limits this comparison?",
]


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def parse_bool(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes"}


def escape_path(path: Path) -> str:
    return str(path.resolve()).replace("'", "''")


def period_sort_key(period_code: str) -> tuple:
    if "-Q" in period_code:
        year, quarter = period_code.split("-Q", 1)
        return (int(year), int(quarter))
    return (int(period_code), 0)


def format_signed_delta(delta: Optional[float], unit: str = "%") -> str:
    if delta is None:
        return "Unavailable"
    sign = "+" if delta > 0 else ""
    suffix = " pts" if unit == "%" else ""
    return f"{sign}{delta:.1f}{suffix}"


@dataclass
class FilterState:
    country: str
    geography: str
    geography_label: str
    sector: str
    sector_label: str
    period: str


class AnalyticsRepository:
    def __init__(
        self,
        root_dir: Path,
        governance_events_path: Optional[Path] = None,
        automation_schedules_path: Optional[Path] = None,
        internal_data_dir: Optional[Path] = None,
        analytics_db_path: Optional[Path] = None,
    ):
        self.root_dir = root_dir
        self.data_dir = (root_dir / "data" / "eu_raw").resolve()
        self.analytics_db_path = (
            analytics_db_path.resolve()
            if analytics_db_path is not None
            else (root_dir / "data" / "workforceguard_analytics.duckdb").resolve()
        )
        self.internal_data_dir = (
            internal_data_dir.resolve()
            if internal_data_dir is not None
            else (root_dir / "data" / "internal").resolve()
        )
        self.analytics_dir = (root_dir / "analytics").resolve()
        self.seed_dir = self.analytics_dir / "seeds"
        self.governance_events_path = (
            governance_events_path.resolve()
            if governance_events_path is not None
            else (root_dir / "data" / "governance_events.sqlite").resolve()
        )
        self.automation_schedules_path = (
            automation_schedules_path.resolve()
            if automation_schedules_path is not None
            else (root_dir / "data" / "automation_schedules.json").resolve()
        )
        self.metric_registry = {
            row["metric_id"]: row
            for row in self._read_seed_csv(self.seed_dir / "reference" / "ref_metric_registry.csv")
        }
        self.data_sources = {
            row["source_id"]: row
            for row in self._read_seed_csv(self.seed_dir / "reference" / "ref_data_sources.csv")
        }
        self.governance_actions = {
            row["action_code"]: {
                **row,
                "requires_reason": parse_bool(row.get("requires_reason")),
            }
            for row in self._read_seed_csv(self.seed_dir / "governance" / "ref_governance_actions.csv")
        }
        self.governance_events: List[Dict[str, Any]] = self._load_governance_events()
        self.automation_schedules: List[Dict[str, Any]] = self._load_automation_schedules()

    def _read_seed_csv(self, path: Path) -> List[Dict[str, str]]:
        if not path.exists():
            return []

        with path.open("r", encoding="utf-8") as handle:
            return list(csv.DictReader(handle))

    def _load_governance_events(self) -> List[Dict[str, Any]]:
        if self.governance_events_path.suffix == ".json":
            return self._load_json_governance_events()

        return self._load_sqlite_governance_events()

    def _load_json_governance_events(self) -> List[Dict[str, Any]]:
        if not self.governance_events_path.exists():
            return []

        try:
            with self.governance_events_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError):
            return []

        if not isinstance(payload, list):
            return []

        return [event for event in payload if isinstance(event, dict)][:50]

    def _connect_governance_store(self) -> sqlite3.Connection:
        self.governance_events_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(self.governance_events_path))
        connection.execute(
            """
            create table if not exists governance_events (
                event_sequence integer primary key,
                event_id text not null unique,
                action_code text not null,
                target_type text not null,
                target_id text not null,
                actor text not null,
                created_at text not null,
                previous_hash text not null,
                event_hash text not null,
                event_json text not null
            )
            """
        )
        connection.execute(
            """
            create index if not exists idx_governance_events_target
            on governance_events(target_type, target_id)
            """
        )
        return connection

    def _load_sqlite_governance_events(self) -> List[Dict[str, Any]]:
        if not self.governance_events_path.exists():
            return []

        try:
            with self._connect_governance_store() as connection:
                rows = connection.execute(
                    """
                    select event_json
                    from governance_events
                    order by event_sequence desc
                    limit 50
                    """
                ).fetchall()
        except sqlite3.Error:
            return []

        events = []
        for row in rows:
            try:
                event = json.loads(row[0])
            except (TypeError, json.JSONDecodeError):
                continue
            if isinstance(event, dict):
                events.append(event)
        return events

    def _persist_governance_events(self) -> None:
        if self.governance_events_path.suffix == ".json":
            self._persist_json_governance_events()
            return

        self._persist_sqlite_governance_events()

    def _persist_json_governance_events(self) -> None:
        self.governance_events_path.parent.mkdir(parents=True, exist_ok=True)
        with self.governance_events_path.open("w", encoding="utf-8") as handle:
            json.dump(self.governance_events[:50], handle, indent=2)

    def _persist_sqlite_governance_events(self) -> None:
        with self._connect_governance_store() as connection:
            for event in self.governance_events[:50]:
                connection.execute(
                    """
                    insert or replace into governance_events (
                        event_sequence,
                        event_id,
                        action_code,
                        target_type,
                        target_id,
                        actor,
                        created_at,
                        previous_hash,
                        event_hash,
                        event_json
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        int(event["event_sequence"]),
                        event["event_id"],
                        event["action_code"],
                        event["target_type"],
                        event["target_id"],
                        event.get("actor") or "system",
                        event["created_at"],
                        event["previous_hash"],
                        event["event_hash"],
                        json.dumps(event, sort_keys=True),
                    ),
                )

    def _load_automation_schedules(self) -> List[Dict[str, Any]]:
        if not self.automation_schedules_path.exists():
            return []

        try:
            with self.automation_schedules_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError):
            return []

        if not isinstance(payload, list):
            return []

        return [item for item in payload if isinstance(item, dict)][:50]

    def _persist_automation_schedules(self) -> None:
        self.automation_schedules_path.parent.mkdir(parents=True, exist_ok=True)
        with self.automation_schedules_path.open("w", encoding="utf-8") as handle:
            json.dump(self.automation_schedules[:50], handle, indent=2, sort_keys=True)

    def _schedule_id(self, template_id: str, filters: Dict[str, Any]) -> str:
        scope = "::".join(
            [
                str(filters.get("country") or "ALL"),
                str(filters.get("geography") or "EU27_AVG"),
                str(filters.get("sector") or "ALL"),
                str(filters.get("period") or "latest"),
            ]
        )
        return f"{template_id}::{scope}"

    def _governance_event_hash(self, event: Dict[str, Any]) -> str:
        hash_payload = {
            key: value
            for key, value in event.items()
            if key != "event_hash"
        }
        encoded = json.dumps(hash_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def _next_governance_sequence(self) -> int:
        sequences = [
            int(event["event_sequence"])
            for event in self.governance_events
            if str(event.get("event_sequence", "")).isdigit()
        ]
        return (max(sequences) + 1) if sequences else (len(self.governance_events) + 1)

    def _latest_governance_hash(self) -> str:
        sequenced_events = [
            event
            for event in self.governance_events
            if str(event.get("event_sequence", "")).isdigit() and event.get("event_hash")
        ]
        if not sequenced_events:
            return "GENESIS"
        latest = max(sequenced_events, key=lambda event: int(event["event_sequence"]))
        return str(latest["event_hash"])

    def _governance_integrity(self) -> Dict[str, Any]:
        sequenced_events = sorted(
            [
                event
                for event in self.governance_events
                if str(event.get("event_sequence", "")).isdigit()
            ],
            key=lambda event: int(event["event_sequence"]),
        )
        previous_hash = "GENESIS"
        verified = True
        break_event_id = None
        for event in sequenced_events:
            expected_hash = self._governance_event_hash(event)
            if event.get("previous_hash") != previous_hash or event.get("event_hash") != expected_hash:
                verified = False
                break_event_id = event.get("event_id")
                break
            previous_hash = str(event.get("event_hash"))

        return {
            "verified": verified,
            "event_count": len(self.governance_events),
            "latest_hash": self._latest_governance_hash(),
            "break_event_id": break_event_id,
            "storage_path": str(self.governance_events_path),
        }

    def _governance_state_for_target(self, target_type: str, target_id: str) -> Dict[str, Any]:
        matching_events = [
            event
            for event in self.governance_events
            if event.get("target_type") == target_type and event.get("target_id") == target_id
        ]
        if not matching_events:
            return {
                "state": "pending_review",
                "latest_event": None,
                "event_count": 0,
                "requires_reason_to_change": True,
            }

        latest_event = max(
            matching_events,
            key=lambda event: int(event.get("event_sequence") or 0),
        )
        state_by_action = {
            "review_required": "pending_review",
            "approved": "approved",
            "overridden": "overridden",
            "reversed": "reversed",
            "exported": "exported",
        }
        return {
            "state": state_by_action.get(latest_event.get("action_code"), "pending_review"),
            "latest_event": latest_event,
            "event_count": len(matching_events),
            "requires_reason_to_change": latest_event.get("action_code") in {"overridden", "reversed"},
        }

    def _connect(self) -> duckdb.DuckDBPyConnection:
        if self._modeled_database_ready():
            return duckdb.connect(database=str(self.analytics_db_path), read_only=True)

        connection = duckdb.connect(database=":memory:")
        self._prepare_connection(connection)
        return connection

    def _modeled_database_ready(self) -> bool:
        required_tables = {
            "dim_geography",
            "dim_sector",
            "fct_labour_market_region_sector",
            "mart_workforce_command_center",
        }
        available = self._available_tables()
        return required_tables.issubset(available)

    def _available_tables(self) -> set[str]:
        if not self.analytics_db_path.exists():
            return set()

        try:
            with duckdb.connect(database=str(self.analytics_db_path), read_only=True) as connection:
                rows = connection.execute("show tables").fetchall()
        except duckdb.Error:
            return set()

        return {row[0] for row in rows}

    def _prepare_connection(self, connection: duckdb.DuckDBPyConnection) -> None:
        self._create_raw_view(connection, "raw_job_vacancy_rate", "job_vacancy_rate.parquet")
        self._create_raw_view(connection, "raw_unemployment_rate", "unemployment_rate.parquet")
        self._create_raw_view(connection, "raw_employment_rate", "employment_rate.parquet")
        self._create_raw_view(connection, "raw_gender_pay_gap_sector", "gender_pay_gap_sector.parquet")
        self._create_raw_view(
            connection,
            "raw_labour_market_flows",
            "labour_market_flows.parquet",
            optional_sql="""
                select
                    cast(null as varchar) as freq,
                    cast(null as varchar) as freq_label,
                    cast(null as varchar) as unit,
                    cast(null as varchar) as unit_label,
                    cast(null as varchar) as s_adj,
                    cast(null as varchar) as s_adj_label,
                    cast(null as varchar) as indic_em,
                    cast(null as varchar) as indic_em_label,
                    cast(null as varchar) as sex,
                    cast(null as varchar) as sex_label,
                    cast(null as varchar) as geo,
                    cast(null as varchar) as geo_label,
                    cast(null as varchar) as time,
                    cast(null as double) as value
                where false
            """,
        )
        self._create_raw_view(
            connection,
            "raw_labour_market_slack",
            "labour_market_slack.parquet",
            optional_sql="""
                select
                    cast(null as varchar) as freq,
                    cast(null as varchar) as freq_label,
                    cast(null as varchar) as s_adj,
                    cast(null as varchar) as s_adj_label,
                    cast(null as varchar) as wstatus,
                    cast(null as varchar) as wstatus_label,
                    cast(null as varchar) as sex,
                    cast(null as varchar) as sex_label,
                    cast(null as varchar) as age,
                    cast(null as varchar) as age_label,
                    cast(null as varchar) as unit,
                    cast(null as varchar) as unit_label,
                    cast(null as varchar) as geo,
                    cast(null as varchar) as geo_label,
                    cast(null as varchar) as time,
                    cast(null as double) as value
                where false
            """,
        )

        connection.execute(
            f"""
            create or replace temp view seed_metric_registry as
            select * from read_csv_auto('{escape_path(self.seed_dir / "reference" / "ref_metric_registry.csv")}', header=true)
            """
        )
        connection.execute(
            f"""
            create or replace temp view seed_data_sources as
            select * from read_csv_auto('{escape_path(self.seed_dir / "reference" / "ref_data_sources.csv")}', header=true)
            """
        )
        connection.execute(
            f"""
            create or replace temp view seed_governance_actions as
            select * from read_csv_auto('{escape_path(self.seed_dir / "governance" / "ref_governance_actions.csv")}', header=true)
            """
        )

        connection.execute(
            """
            create or replace temp view stg_eurostat__employment_rate as
            select
                geo as region_code,
                geo_label as region_label,
                cast(time as varchar) as period_code,
                'year' as period_type,
                indic_em as indicator_code,
                sex as sex_code,
                age as age_code,
                unit as unit_code,
                cast(value as double) as metric_value
            from raw_employment_rate
            where geo is not null
              and cast(value as double) is not null
            """
        )
        connection.execute(
            """
            create or replace temp view stg_eurostat__unemployment_rate as
            select
                geo as region_code,
                geo_label as region_label,
                cast(time as varchar) as period_code,
                'year' as period_type,
                sex as sex_code,
                age as age_code,
                unit as unit_code,
                cast(value as double) as metric_value
            from raw_unemployment_rate
            where geo is not null
              and cast(value as double) is not null
            """
        )
        connection.execute(
            """
            create or replace temp view stg_eurostat__job_vacancy_rate as
            select
                geo as region_code,
                geo_label as region_label,
                cast(time as varchar) as period_code,
                'quarter' as period_type,
                nace_r2 as sector_code,
                nace_r2_label as sector_label,
                indic_em as indicator_code,
                sizeclas as size_class_code,
                s_adj as seasonal_adjustment_code,
                cast(value as double) as metric_value
            from raw_job_vacancy_rate
            where geo is not null
              and nace_r2 is not null
              and cast(value as double) is not null
            """
        )
        connection.execute(
            """
            create or replace temp view stg_eurostat__gender_pay_gap_sector as
            select
                geo as region_code,
                geo_label as region_label,
                cast(time as varchar) as period_code,
                'year' as period_type,
                nace_r2 as sector_code,
                nace_r2_label as sector_label,
                unit as unit_code,
                cast(value as double) as metric_value
            from raw_gender_pay_gap_sector
            where geo is not null
              and nace_r2 is not null
              and cast(value as double) is not null
            """
        )
        connection.execute(
            """
            create or replace temp view stg_eurostat__labour_market_flows as
            select
                geo as region_code,
                geo_label as region_label,
                cast(time as varchar) as period_code,
                'quarter' as period_type,
                indic_em as indicator_code,
                indic_em_label as indicator_label,
                sex as sex_code,
                unit as unit_code,
                s_adj as seasonal_adjustment_code,
                cast(value as double) as metric_value
            from raw_labour_market_flows
            where geo is not null
              and cast(value as double) is not null
            """
        )
        connection.execute(
            """
            create or replace temp view stg_eurostat__labour_market_slack as
            select
                geo as region_code,
                geo_label as region_label,
                cast(time as varchar) as period_code,
                'quarter' as period_type,
                wstatus as slack_status_code,
                wstatus_label as slack_status_label,
                sex as sex_code,
                age as age_code,
                unit as unit_code,
                s_adj as seasonal_adjustment_code,
                cast(value as double) as metric_value
            from raw_labour_market_slack
            where geo is not null
              and cast(value as double) is not null
            """
        )
        connection.execute(
            """
            create or replace temp view dim_geography as
            with region_codes as (
                select distinct region_code, region_label from stg_eurostat__employment_rate
                union
                select distinct region_code, region_label from stg_eurostat__unemployment_rate
                union
                select distinct region_code, region_label from stg_eurostat__job_vacancy_rate
                union
                select distinct region_code, region_label from stg_eurostat__gender_pay_gap_sector
                union
                select distinct region_code, region_label from stg_eurostat__labour_market_flows
                union
                select distinct region_code, region_label from stg_eurostat__labour_market_slack
            )
            select
                region_code as geo_id,
                region_code as nuts_code,
                case
                    when length(region_code) = 4 then 2
                    when length(region_code) = 5 then 3
                    when length(region_code) = 2 then 0
                    else null
                end as nuts_level,
                substring(region_code, 1, 2) as country_code,
                max(region_label) as region_name,
                case
                    when length(region_code) = 4 then true
                    when length(region_code) = 5 then false
                    else true
                end as has_full_coverage
            from region_codes
            where region_code is not null
            group by 1, 2, 3, 4, 6
            """
        )
        connection.execute(
            """
            create or replace temp view dim_sector as
            with sector_codes as (
                select distinct sector_code, sector_label from stg_eurostat__job_vacancy_rate
                union
                select distinct sector_code, sector_label from stg_eurostat__gender_pay_gap_sector
            )
            select
                sector_code as sector_id,
                sector_code,
                max(sector_label) as sector_name
            from sector_codes
            where sector_code is not null
            group by 1, 2
            """
        )
        connection.execute(
            """
            create or replace temp view fct_labour_market_region_sector as
            with employment as (
                select
                    region_code,
                    null as sector_code,
                    period_code,
                    period_type,
                    'employment_rate' as signal_name,
                    metric_value as signal_value
                from stg_eurostat__employment_rate
                where indicator_code = 'EMP_LFS'
                  and sex_code = 'T'
                  and age_code = 'Y20-64'
                  and unit_code = 'PC_POP'
            ),
            unemployment as (
                select
                    region_code,
                    null as sector_code,
                    period_code,
                    period_type,
                    'unemployment_rate' as signal_name,
                    metric_value as signal_value
                from stg_eurostat__unemployment_rate
                where sex_code = 'T'
                  and age_code = 'Y15-74'
                  and unit_code = 'PC_ACT'
            ),
            vacancies_ranked as (
                select
                    region_code,
                    sector_code,
                    period_code,
                    period_type,
                    'job_vacancy_rate' as signal_name,
                    metric_value as signal_value,
                    row_number() over (
                        partition by region_code, sector_code, period_code
                        order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
                    ) as adjustment_rank
                from stg_eurostat__job_vacancy_rate
                where indicator_code = 'JVR'
                  and size_class_code = 'TOTAL'
                  and seasonal_adjustment_code in ('SA', 'NSA')
            ),
            vacancies as (
                select region_code, sector_code, period_code, period_type, signal_name, signal_value
                from vacancies_ranked
                where adjustment_rank = 1
            ),
            pay_gap as (
                select
                    region_code,
                    sector_code,
                    period_code,
                    period_type,
                    'gender_pay_gap' as signal_name,
                    metric_value as signal_value
                from stg_eurostat__gender_pay_gap_sector
                where unit_code = 'PC'
            ),
            flows_to_employment_ranked as (
                select
                    region_code,
                    null as sector_code,
                    period_code,
                    period_type,
                    'labour_flow_to_employment' as signal_name,
                    metric_value as signal_value,
                    row_number() over (
                        partition by region_code, period_code
                        order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
                    ) as adjustment_rank
                from stg_eurostat__labour_market_flows
                where indicator_code = 'U_E'
                  and sex_code = 'T'
                  and unit_code = 'PC_UNE'
                  and seasonal_adjustment_code in ('SA', 'NSA')
            ),
            flows_to_employment as (
                select region_code, sector_code, period_code, period_type, signal_name, signal_value
                from flows_to_employment_ranked
                where adjustment_rank = 1
            ),
            flows_to_inactivity_ranked as (
                select
                    region_code,
                    null as sector_code,
                    period_code,
                    period_type,
                    'labour_flow_to_inactivity' as signal_name,
                    metric_value as signal_value,
                    row_number() over (
                        partition by region_code, period_code
                        order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
                    ) as adjustment_rank
                from stg_eurostat__labour_market_flows
                where indicator_code = 'U_I'
                  and sex_code = 'T'
                  and unit_code = 'PC_UNE'
                  and seasonal_adjustment_code in ('SA', 'NSA')
            ),
            flows_to_inactivity as (
                select region_code, sector_code, period_code, period_type, signal_name, signal_value
                from flows_to_inactivity_ranked
                where adjustment_rank = 1
            ),
            employment_continuity_ranked as (
                select
                    region_code,
                    null as sector_code,
                    period_code,
                    period_type,
                    'employment_continuity' as signal_name,
                    metric_value as signal_value,
                    row_number() over (
                        partition by region_code, period_code
                        order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
                    ) as adjustment_rank
                from stg_eurostat__labour_market_flows
                where indicator_code = 'E_E'
                  and sex_code = 'T'
                  and unit_code = 'PC_EMP'
                  and seasonal_adjustment_code in ('SA', 'NSA')
            ),
            employment_continuity as (
                select region_code, sector_code, period_code, period_type, signal_name, signal_value
                from employment_continuity_ranked
                where adjustment_rank = 1
            ),
            labour_slack_rate_ranked as (
                select
                    region_code,
                    null as sector_code,
                    period_code,
                    period_type,
                    'labour_market_slack_rate' as signal_name,
                    metric_value as signal_value,
                    row_number() over (
                        partition by region_code, period_code
                        order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
                    ) as adjustment_rank
                from stg_eurostat__labour_market_slack
                where slack_status_code = 'SLACK'
                  and sex_code = 'T'
                  and age_code = 'Y15-74'
                  and unit_code = 'PC_ELF'
                  and seasonal_adjustment_code in ('SA', 'NSA')
            ),
            labour_slack_rate as (
                select region_code, sector_code, period_code, period_type, signal_name, signal_value
                from labour_slack_rate_ranked
                where adjustment_rank = 1
            )
            select
                concat_ws('::', region_code, coalesce(sector_code, 'all'), period_code, signal_name) as signal_id,
                region_code as geo_id,
                sector_code as sector_id,
                period_code,
                period_type,
                signal_name,
                signal_value
            from (
                select * from employment
                union all
                select * from unemployment
                union all
                select * from vacancies
                union all
                select * from pay_gap
                union all
                select * from flows_to_employment
                union all
                select * from flows_to_inactivity
                union all
                select * from employment_continuity
                union all
                select * from labour_slack_rate
            ) signals
            """
        )

    def _create_raw_view(
        self,
        connection: duckdb.DuckDBPyConnection,
        view_name: str,
        filename: str,
        optional_sql: Optional[str] = None,
    ) -> None:
        file_path = self.data_dir / filename
        if not file_path.exists():
            if optional_sql:
                connection.execute(f"create or replace temp view {view_name} as {optional_sql}")
                return
            raise FileNotFoundError(f"Expected data file is missing: {file_path}")

        connection.execute(
            f"""
            create or replace temp view {view_name} as
            select * from read_parquet('{escape_path(file_path)}')
            """
        )

    def _query(self, sql: str, params: Optional[Iterable[Any]] = None) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            result = connection.execute(sql, params or []).fetchall()
            columns = [desc[0] for desc in connection.description]
        return [dict(zip(columns, row)) for row in result]

    def _scalar(self, sql: str, params: Optional[Iterable[Any]] = None) -> Any:
        rows = self._query(sql, params)
        if not rows:
            return None
        return next(iter(rows[0].values()))

    def _source(self, source_id: str) -> Dict[str, Any]:
        source = self.data_sources.get(source_id, {})
        return {
            "source_id": source_id,
            "source_name": source.get("source_name", source_id),
            "source_version": source.get("source_version", "unknown"),
            "coverage_notes": source.get("coverage_notes", ""),
        }

    def _build_provenance(
        self,
        source_id: str,
        metric_id: str,
        formula_version: str,
        human_review_required: bool,
    ) -> Dict[str, Any]:
        source = self._source(source_id)
        return {
            **source,
            "metric_id": metric_id,
            "formula_version": formula_version,
            "human_review_required": human_review_required,
        }

    def _internal_asset_paths(self) -> Dict[str, Path]:
        return {
            "payroll_snapshot": self.internal_data_dir / "payroll_snapshot.parquet",
            "job_architecture": self.internal_data_dir / "job_architecture.parquet",
        }

    def _internal_manifest_path(self) -> Path:
        return self.internal_data_dir.parent / "internal_meta" / "manifest.json"

    def _internal_manifest_assets(self) -> Dict[str, Dict[str, Any]]:
        manifest_path = self._internal_manifest_path()
        if not manifest_path.exists():
            return {}

        try:
            with manifest_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError):
            return {}

        assets = payload.get("assets", [])
        if not isinstance(assets, list):
            return {}

        return {
            asset["asset_type"]: asset
            for asset in assets
            if isinstance(asset, dict) and asset.get("asset_type")
        }

    def _internal_claim_trust_status(self) -> Dict[str, Any]:
        assets = self._internal_manifest_assets()
        required_assets = ["internal_payroll_snapshot", "internal_job_architecture"]
        trusted_assets = [
            asset_type
            for asset_type in required_assets
            if assets.get(asset_type, {}).get("trusted_for_company_claims") is True
        ]
        untrusted_assets = sorted(set(required_assets) - set(trusted_assets))

        return {
            "trusted": not untrusted_assets,
            "trusted_assets": trusted_assets,
            "untrusted_assets": untrusted_assets,
            "manifest_path": str(self._internal_manifest_path()),
        }

    def _build_internal_data_status(self) -> Dict[str, Any]:
        if not self._modeled_database_ready():
            return {
                "available": False,
                "snapshot_date": None,
                "sources": [],
                "missing_assets": [],
                "supported_scope": "country",
                "note": (
                    "Phase 3 company-aware benchmarking now depends on the modeled analytics database. "
                    "Run the internal dbt models before expecting company-aware benchmark output."
                ),
            }

        required_internal_tables = {
            "stg_internal__payroll_snapshot",
            "stg_internal__job_architecture",
            "fct_internal_pay_snapshot",
            "dim_worker_category",
            "mart_internal_market_pay_benchmark",
        }
        available_tables = self._available_tables()
        missing_tables = sorted(required_internal_tables - available_tables)
        if missing_tables:
            return {
                "available": False,
                "snapshot_date": None,
                "sources": [],
                "missing_assets": [],
                "supported_scope": "country",
                "missing_tables": missing_tables,
                "note": (
                    "The modeled internal benchmark tables are not all present in the analytics database yet. "
                    "Re-run the internal dbt models to materialize the company-aware mart."
                ),
            }

        summary = self._query(
            """
            select
                (select max(snapshot_date) from fct_internal_pay_snapshot) as snapshot_date,
                (select count(*) from stg_internal__payroll_snapshot) as payroll_record_count,
                (select count(*) from stg_internal__job_architecture) as job_architecture_record_count,
                (select count(*) from fct_internal_pay_snapshot) as pay_snapshot_count,
                (select count(*) from dim_worker_category) as worker_category_count,
                (select count(*) from mart_internal_market_pay_benchmark) as benchmark_row_count,
                (select count(distinct country_code) from fct_internal_pay_snapshot) as country_count
            """
        )[0]

        snapshot_date = summary["snapshot_date"]
        payroll_record_count = int(summary["payroll_record_count"] or 0)
        job_architecture_record_count = int(summary["job_architecture_record_count"] or 0)
        pay_snapshot_count = int(summary["pay_snapshot_count"] or 0)
        worker_category_count = int(summary["worker_category_count"] or 0)
        benchmark_row_count = int(summary["benchmark_row_count"] or 0)
        country_count = int(summary["country_count"] or 0)
        sources = [
            {
                "source_id": "internal_payroll_snapshot",
                "record_count": payroll_record_count,
            },
            {
                "source_id": "internal_job_architecture",
                "record_count": job_architecture_record_count,
            },
        ]
        optional_source_tables = [
            ("internal_hris_workforce_snapshot", "stg_internal__hris_workforce_snapshot"),
            ("internal_ats_requisition_snapshot", "stg_internal__ats_requisition_snapshot"),
            ("internal_learning_skill_snapshot", "stg_internal__learning_skill_snapshot"),
        ]
        optional_sources = []
        for source_id, table_name in optional_source_tables:
            if table_name not in available_tables:
                optional_sources.append(
                    {"source_id": source_id, "record_count": 0, "available": False, "status": "not_modeled"}
                )
                continue
            count_value = int(self._scalar(f"select count(*) from {table_name}") or 0)
            optional_sources.append(
                {
                    "source_id": source_id,
                    "record_count": count_value,
                    "available": count_value > 0,
                    "status": "loaded" if count_value > 0 else "empty",
                }
            )
        sources.extend(optional_sources)
        if (
            payroll_record_count == 0
            or job_architecture_record_count == 0
            or pay_snapshot_count == 0
            or worker_category_count == 0
            or benchmark_row_count == 0
        ):
            return {
                "available": False,
                "snapshot_date": str(snapshot_date) if snapshot_date is not None else None,
                "sources": sources,
                "missing_assets": [],
                "supported_scope": "country",
                "country_count": country_count,
                "benchmark_row_count": benchmark_row_count,
                "optional_sources": optional_sources,
                "note": (
                    "The internal dbt models are present, but the modeled company benchmark mart does not yet contain "
                    "usable rows. Load real company inputs and rebuild the internal models to activate company-aware benchmarking."
                ),
            }

        trust_status = self._internal_claim_trust_status()
        return {
            "available": trust_status["trusted"],
            "snapshot_date": str(snapshot_date) if snapshot_date is not None else None,
            "sources": sources,
            "missing_assets": [],
            "supported_scope": "country",
            "country_count": country_count,
            "benchmark_row_count": benchmark_row_count,
            "optional_sources": optional_sources,
            "trust": trust_status,
            "note": (
                "The internal dbt mart is populated with trusted company inputs. Company-aware benchmarking currently "
                "stays at country scope and uses modeled internal pay, worker-category, and optional HRIS/ATS/skills inputs when real files are loaded."
                if trust_status["trusted"]
                else (
                    "The internal dbt mart contains local sample or untrusted internal rows. Company-specific claims are disabled "
                    "until the internal preparation flow is run with --trust-company-data for real employer exports."
                )
            ),
        }

    def _build_company_benchmark(
        self,
        filters: FilterState,
        observed_metrics: Dict[str, Dict[str, Any]],
        internal_data_status: Dict[str, Any],
    ) -> Dict[str, Any]:
        def unavailable(reason: str) -> Dict[str, Any]:
            return {
                "id": "internal_market_pay_gap_benchmark",
                "title": "Internal pay gap vs market signal",
                "available": False,
                "confidence": "low",
                "coverage_status": "unavailable",
                "evidence_basis": "external",
                "note": reason,
                "unavailable_reason": reason,
                "worker_category": None,
                "internal_value": None,
                "market_value": None,
                "delta": None,
                "delta_label": "Unavailable",
                "headcount": 0,
                "female_count": 0,
                "male_count": 0,
                "provenance": [],
            }

        if not internal_data_status.get("available"):
            return unavailable(internal_data_status.get("note", "Company-aware benchmarking is not available."))

        if filters.geography == "EU27_AVG" or len(filters.geography) != 2:
            return unavailable(
                "Company-aware benchmarking currently requires a country-level scope such as DE or FR."
            )

        params: List[Any] = [filters.geography]
        sector_clause = ""
        if filters.sector != "ALL":
            sector_clause = "and starts_with(upper(coalesce(representative_nace_code, '')), upper(?))"
            params.append(filters.sector)

        rows = self._query(
            f"""
            select
                worker_category_id,
                worker_category_label,
                headcount,
                female_count,
                male_count,
                round(cast(internal_gender_pay_gap as double), 1) as internal_pay_gap,
                round(cast(market_gender_pay_gap as double), 1) as market_pay_gap,
                round(cast(gap_to_market as double), 1) as gap_to_market,
                cast(snapshot_date as varchar) as snapshot_date,
                market_sector_id,
                market_period_code,
                representative_nace_code
            from mart_internal_market_pay_benchmark
            where upper(country_code) = upper(?)
              and market_benchmark_available = true
              {sector_clause}
            order by headcount desc, abs(internal_pay_gap) desc
            limit 1
            """,
            params,
        )
        row = rows[0] if rows else None

        if row is None:
            return unavailable(
                "The modeled internal benchmark mart does not have a benchmarkable worker category for this scope yet."
            )

        internal_value = float(row["internal_pay_gap"])
        market_value = float(row["market_pay_gap"])
        delta = round(float(row["gap_to_market"]), 1)
        market_metric_config = OBSERVED_METRIC_CONFIG["gender_pay_gap"]
        return {
            "id": "internal_market_pay_gap_benchmark",
            "title": "Internal pay gap vs market signal",
            "available": True,
            "confidence": "medium",
            "coverage_status": "directional",
            "evidence_basis": "blended",
            "note": (
                "The internal figure comes from the modeled company benchmark mart for the selected worker category, "
                "paired with the latest modeled external market pay-gap comparator for that country. Treat this as a "
                "directional benchmark, not a regulatory pay-equity determination."
            ),
            "worker_category": {
                "id": row["worker_category_id"],
                "label": row["worker_category_label"],
            },
            "internal_value": internal_value,
            "market_value": market_value,
            "delta": delta,
            "delta_label": format_signed_delta(delta, "%"),
            "headcount": int(row["headcount"]),
            "female_count": int(row["female_count"]),
            "male_count": int(row["male_count"]),
            "snapshot_date": row["snapshot_date"],
            "market_period_code": row["market_period_code"],
            "market_sector_id": row["market_sector_id"],
            "representative_nace_code": row["representative_nace_code"],
            "provenance": [
                self._build_provenance("internal_payroll_snapshot", "internal_pay_gap", "internal-v1", True),
                self._build_provenance("internal_job_architecture", "worker_category_mapping", "internal-v1", False),
                self._build_provenance(
                    market_metric_config["source_id"],
                    "gender_pay_gap",
                    market_metric_config["formula_version"],
                    market_metric_config["human_review_required"],
                ),
            ],
        }

    def _build_pay_transparency_simulation(
        self,
        filters: FilterState,
        internal_data_status: Dict[str, Any],
    ) -> Dict[str, Any]:
        metric_config = OBSERVED_METRIC_CONFIG["gender_pay_gap"]

        def unavailable(reason: str) -> Dict[str, Any]:
            return {
                "id": "pay_transparency_category_review",
                "title": "Pay transparency category review",
                "available": False,
                "confidence": "low",
                "coverage_status": "unavailable",
                "evidence_basis": "external",
                "formula_version": "pay-transparency-review-v1",
                "thresholds": {
                    "observed_gap_pct": 5.0,
                    "unresolved_review_pct": 10.0,
                    "market_delta_pct": 2.0,
                },
                "summary": {
                    "category_count": 0,
                    "observed_gap_count": 0,
                    "justified_difference_count": 0,
                    "unresolved_review_item_count": 0,
                    "max_internal_gap": None,
                },
                "review_items": [],
                "top_review_items": [],
                "governance_target": {
                    "target_type": "compliance_simulation",
                    "target_id": "pay_transparency_category_review",
                },
                "provenance": [],
                "note": reason,
                "unavailable_reason": reason,
            }

        if not internal_data_status.get("available"):
            return unavailable(internal_data_status.get("note", "Pay-transparency simulation requires trusted internal data."))

        if filters.geography == "EU27_AVG" or len(filters.geography) != 2:
            return unavailable("Pay-transparency simulation currently requires a country-level scope such as DE or FR.")

        params: List[Any] = [filters.geography]
        sector_clause = ""
        if filters.sector != "ALL":
            sector_clause = "and starts_with(upper(coalesce(representative_nace_code, '')), upper(?))"
            params.append(filters.sector)

        rows = self._query(
            f"""
            select
                worker_category_id,
                coalesce(worker_category_label, worker_category_id) as worker_category_label,
                headcount,
                female_count,
                male_count,
                round(cast(internal_gender_pay_gap as double), 1) as internal_pay_gap,
                round(cast(market_gender_pay_gap as double), 1) as market_pay_gap,
                round(cast(gap_to_market as double), 1) as gap_to_market,
                cast(snapshot_date as varchar) as snapshot_date,
                market_sector_id,
                market_period_code,
                representative_nace_code,
                market_benchmark_available
            from mart_internal_market_pay_benchmark
            where upper(country_code) = upper(?)
              and internal_gender_pay_gap is not null
              {sector_clause}
            order by abs(internal_gender_pay_gap) desc, headcount desc
            """,
            params,
        )

        if not rows:
            return unavailable(
                "The internal benchmark mart does not contain category-level pay-gap rows for this scope yet."
            )

        thresholds = {
            "observed_gap_pct": 5.0,
            "unresolved_review_pct": 10.0,
            "market_delta_pct": 2.0,
        }
        review_items = []
        for row in rows:
            internal_gap = float(row["internal_pay_gap"])
            market_gap = float(row["market_pay_gap"]) if row["market_pay_gap"] is not None else None
            market_delta = float(row["gap_to_market"]) if row["gap_to_market"] is not None else None
            absolute_gap = abs(internal_gap)
            absolute_delta = abs(market_delta) if market_delta is not None else 0.0

            if absolute_gap >= thresholds["unresolved_review_pct"] or absolute_delta >= thresholds["market_delta_pct"]:
                review_state = "unresolved_review_item"
                review_label = "Unresolved review item"
                priority = "high" if absolute_gap >= thresholds["unresolved_review_pct"] else "medium"
                rationale = (
                    "Internal category gap or gap-to-market exceeds the review threshold and requires documented human review."
                )
            elif absolute_gap >= thresholds["observed_gap_pct"]:
                review_state = "observed_gap"
                review_label = "Observed gap"
                priority = "medium"
                rationale = "A category-level pay gap is observed, but it is below the unresolved review threshold."
            else:
                review_state = "justified_difference"
                review_label = "No unresolved gap"
                priority = "low"
                rationale = (
                    "The observed category gap is below the review threshold. Any formal justification still belongs in the governance record."
                )

            review_items.append(
                {
                    "id": f"pay_transparency_category_review:{row['worker_category_id']}",
                    "worker_category": {
                        "id": row["worker_category_id"],
                        "label": row["worker_category_label"],
                    },
                    "headcount": int(row["headcount"] or 0),
                    "female_count": int(row["female_count"] or 0),
                    "male_count": int(row["male_count"] or 0),
                    "internal_gap": internal_gap,
                    "market_gap": market_gap,
                    "gap_to_market": market_delta,
                    "snapshot_date": row["snapshot_date"],
                    "market_period_code": row["market_period_code"],
                    "market_sector_id": row["market_sector_id"],
                    "representative_nace_code": row["representative_nace_code"],
                    "review_state": review_state,
                    "review_label": review_label,
                    "priority": priority,
                    "rationale": rationale,
                    "evidence_basis": "blended" if row["market_benchmark_available"] else "internal",
                    "governance_target": {
                        "target_type": "pay_transparency_category",
                        "target_id": f"pay_transparency_category_review:{row['worker_category_id']}",
                    },
                }
            )

        for item in review_items:
            target = item["governance_target"]
            item["human_review"] = self._governance_state_for_target(
                target["target_type"],
                target["target_id"],
            )

        summary = {
            "category_count": len(review_items),
            "observed_gap_count": sum(1 for item in review_items if item["review_state"] == "observed_gap"),
            "justified_difference_count": sum(1 for item in review_items if item["review_state"] == "justified_difference"),
            "unresolved_review_item_count": sum(
                1 for item in review_items if item["review_state"] == "unresolved_review_item"
            ),
            "max_internal_gap": max(abs(item["internal_gap"]) for item in review_items),
            "approved_count": sum(1 for item in review_items if item["human_review"]["state"] == "approved"),
            "overridden_count": sum(1 for item in review_items if item["human_review"]["state"] == "overridden"),
            "reversed_count": sum(1 for item in review_items if item["human_review"]["state"] == "reversed"),
        }
        summary["pending_review_count"] = max(
            0,
            summary["unresolved_review_item_count"]
            - summary["approved_count"]
            - summary["overridden_count"],
        )
        evidence_basis = "blended" if any(item["evidence_basis"] == "blended" for item in review_items) else "internal"
        coverage_status = "review_required" if summary["pending_review_count"] else "monitored"
        workflow_state = "requires_human_review" if summary["pending_review_count"] else "reviewed_or_monitored"
        provenance = [
            self._build_provenance("internal_payroll_snapshot", "internal_pay_gap", "internal-v1", True),
            self._build_provenance("internal_job_architecture", "worker_category_mapping", "internal-v1", False),
            self._build_provenance(
                metric_config["source_id"],
                "gender_pay_gap",
                metric_config["formula_version"],
                metric_config["human_review_required"],
            ),
        ]

        return {
            "id": "pay_transparency_category_review",
            "title": "Pay transparency category review",
            "available": True,
            "confidence": "medium",
            "coverage_status": coverage_status,
            "evidence_basis": evidence_basis,
            "formula_version": "pay-transparency-review-v1",
            "thresholds": thresholds,
            "summary": summary,
            "review_items": review_items,
            "top_review_items": sorted(
                review_items,
                key=lambda item: (
                    item["human_review"]["state"] != "pending_review",
                    {"high": 0, "medium": 1, "low": 2}.get(item["priority"], 3),
                    -abs(item["internal_gap"]),
                ),
            )[:3],
            "workflow": {
                "state": workflow_state,
                "human_oversight_required": bool(summary["pending_review_count"]),
                "allowed_actions": list(self.governance_actions.values()),
                "reason_required_actions": [
                    action["action_code"]
                    for action in self.governance_actions.values()
                    if action["requires_reason"]
                ],
            },
            "governance_target": {
                "target_type": "compliance_simulation",
                "target_id": "pay_transparency_category_review",
            },
            "provenance": provenance,
            "note": (
                "This Phase 4 simulation classifies modeled worker-category pay gaps into observed gaps, "
                "low-risk monitored differences, and unresolved review items. It is a review workflow, not an automated HR decision."
            ),
        }

    def _all_geographies(self) -> List[Dict[str, Any]]:
        rows = self._query(
            """
            select geo_id, region_name, country_code, nuts_level
            from dim_geography
            where country_code is not null
            order by country_code, region_name
            """
        )
        return [
            {
                "id": row["geo_id"],
                "label": row["region_name"],
                "country_code": row["country_code"],
                "nuts_level": row["nuts_level"],
            }
            for row in rows
        ]

    def _all_sectors(self) -> List[Dict[str, Any]]:
        rows = self._query(
            """
            select sector_id, sector_name
            from dim_sector
            order by sector_name
            """
        )
        return [
            {"id": row["sector_id"], "label": row["sector_name"]}
            for row in rows
            if row["sector_id"] not in AGGREGATE_SECTORS
        ]

    def _all_years(self) -> List[str]:
        rows = self._query(
            """
            select distinct period_code
            from fct_labour_market_region_sector
            where period_type = 'year'
            order by period_code desc
            """
        )
        return [row["period_code"] for row in rows]

    def _resolved_metric_sector_id(self, metric_id: str, filters: FilterState) -> Optional[str]:
        config = OBSERVED_METRIC_CONFIG[metric_id]
        if not config["default_sector"]:
            return None
        return config["default_sector"] if filters.sector == "ALL" else filters.sector

    def _resolved_metric_sector_label(self, metric_id: str, filters: FilterState) -> str:
        sector_id = self._resolved_metric_sector_id(metric_id, filters)
        if sector_id is None:
            return "Whole labour market"
        if filters.sector != "ALL":
            return filters.sector_label
        return self._sector_label(sector_id)

    def _scope_coverage(
        self,
        filters: FilterState,
        *,
        has_data: bool,
        sector_grain: bool = False,
    ) -> Dict[str, Any]:
        if not has_data:
            return {
                "status": "unavailable",
                "grain": "country",
                "note": "No observed data is available for the current filter state.",
            }

        if filters.geography == "EU27_AVG":
            return {
                "status": "partial",
                "grain": "country",
                "note": (
                    "EU-wide scope is shown as a proxy average across country observations because the marts "
                    "do not yet expose an official EU aggregate row."
                ),
            }

        if sector_grain:
            return {
                "status": "full",
                "grain": "country-sector",
                "note": "Observed sector-grain coverage is live for the current country scope.",
            }

        return {
            "status": "full",
            "grain": "country",
            "note": "Observed country-level coverage is live for the current scope.",
        }

    def _grain_statuses(self) -> List[Dict[str, Any]]:
        rows = self._query(
            """
            select nuts_level, count(*) as geography_count
            from dim_geography
            group by 1
            """
        )
        counts = {row["nuts_level"]: int(row["geography_count"]) for row in rows}
        country_count = counts.get(0, 0)
        nuts2_count = counts.get(2, 0)
        nuts3_count = counts.get(3, 0)

        return [
            {
                "id": "country",
                "label": "Country-level",
                "status": "live" if country_count else "unavailable",
                "geography_count": country_count,
                "note": f"{country_count} country geographies are available in the current signal set."
                if country_count
                else "No country-level geography coverage is available.",
            },
            {
                "id": "nuts2",
                "label": "NUTS 2",
                "status": "live" if nuts2_count else "blocked",
                "geography_count": nuts2_count,
                "note": f"{nuts2_count} NUTS 2 regions are modeled and ready for comparison."
                if nuts2_count
                else "The active Phase 2 signals do not yet expose NUTS 2 coverage in the marts.",
            },
            {
                "id": "nuts3",
                "label": "NUTS 3",
                "status": "live" if nuts3_count else "blocked",
                "geography_count": nuts3_count,
                "note": f"{nuts3_count} NUTS 3 regions are modeled and ready for comparison."
                if nuts3_count
                else "NUTS 3 remains unavailable for the current comparative intelligence layer.",
            },
        ]

    def _comparison_tone(self, metric_id: str, delta: Optional[float]) -> str:
        if delta is None:
            return "neutral"

        if abs(delta) < 0.15:
            return "neutral"

        desired_direction = OBSERVED_METRIC_CONFIG[metric_id]["desired_direction"]
        if desired_direction == "up":
            return "good" if delta > 0 else "watch"
        return "good" if delta < 0 else "watch"

    def _comparison_confidence(
        self,
        benchmark_status: str,
        observation_count: int,
        expected_count: int,
        min_common_metrics: int = 0,
    ) -> str:
        if observation_count <= 0:
            return "low"

        coverage_ratio = observation_count / expected_count if expected_count else 1.0
        if benchmark_status == "official":
            return "high" if coverage_ratio >= 1.0 else "medium"

        if coverage_ratio >= 0.85 and min_common_metrics >= 3:
            return "high"
        if coverage_ratio >= 0.5:
            return "medium"
        return "low"

    def _comparison_gap_label(self, delta: Optional[float], unit: str) -> str:
        if delta is None:
            return "Unavailable"
        if abs(delta) < 0.05:
            return "In line"
        direction = "above" if delta > 0 else "below"
        suffix = " pts" if unit == "%" else ""
        return f"{abs(delta):.1f}{suffix} {direction}"

    def _aggregate_confidence(self, confidences: Iterable[str]) -> str:
        normalized = [confidence for confidence in confidences if confidence]
        if not normalized:
            return "low"
        if "low" in normalized:
            return "low"
        if "medium" in normalized:
            return "medium"
        return "high"

    def _effective_benchmark_status(self, benchmark_status: str, available: bool) -> str:
        return benchmark_status if available else "unavailable"

    def _format_label_list(self, labels: List[str]) -> str:
        if not labels:
            return ""
        if len(labels) == 1:
            return labels[0]
        if len(labels) == 2:
            return f"{labels[0]} and {labels[1]}"
        return f"{', '.join(labels[:-1])}, and {labels[-1]}"

    def _comparison_metric_sets(
        self,
        metrics: List[Dict[str, Any]],
        benchmark_id: str,
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, str]]]:
        available = []
        unavailable = []

        for metric in metrics:
            comparison = metric.get("comparisons", {}).get(benchmark_id, {})
            if comparison.get("available"):
                available.append(metric)
                continue

            unavailable.append(
                {
                    "id": metric["id"],
                    "title": metric["title"],
                    "reason": comparison.get("explanation")
                    or (comparison.get("notes") or [f"{metric['title']} is unavailable for this benchmark."])[0],
                }
            )

        return available, unavailable

    def _country_metric_snapshot(
        self,
        metric_id: str,
        filters: FilterState,
        period_code: str,
    ) -> List[Dict[str, Any]]:
        config = OBSERVED_METRIC_CONFIG[metric_id]
        sector_id = self._resolved_metric_sector_id(metric_id, filters)
        if sector_id is None:
            sector_clause = "and f.sector_id is null"
            params: List[Any] = [config["signal_name"], period_code]
        else:
            sector_clause = "and f.sector_id = ?"
            params = [config["signal_name"], period_code, sector_id]

        return self._query(
            f"""
            select
                f.geo_id,
                g.region_name as geography_label,
                f.period_code,
                round(cast(f.signal_value as double), 2) as value
            from fct_labour_market_region_sector f
            inner join dim_geography g
                on f.geo_id = g.geo_id
            where f.signal_name = ?
              and f.period_code = ?
              and length(f.geo_id) = 2
              {sector_clause}
            order by g.region_name
            """,
            params,
        )

    def _metric_value_at_scope(
        self,
        signal_name: str,
        geography: str,
        period_code: str,
        sector_id: Optional[str] = None,
    ) -> Optional[float]:
        conditions = ["signal_name = ?", "period_code = ?"]
        params: List[Any] = [signal_name, period_code]

        if sector_id is None:
            conditions.append("sector_id is null")
        else:
            conditions.append("sector_id = ?")
            params.append(sector_id)

        if geography == "EU27_AVG":
            conditions.append("length(geo_id) = 2")
            where_clause = " and ".join(conditions)
            return self._scalar(
                f"""
                select round(avg(cast(signal_value as double)), 2) as value
                from fct_labour_market_region_sector
                where {where_clause}
                """,
                params,
            )

        conditions.append("geo_id = ?")
        params.append(geography)
        where_clause = " and ".join(conditions)
        return self._scalar(
            f"""
            select round(max(cast(signal_value as double)), 2) as value
            from fct_labour_market_region_sector
            where {where_clause}
            """,
            params,
        )

    def _build_peer_group(
        self,
        filters: FilterState,
        observed_metrics: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        if filters.geography == "EU27_AVG" or len(filters.geography) != 2:
            return {
                "available": False,
                "benchmark_status": "proxy",
                "confidence": "low",
                "label": COMPARISON_BENCHMARKS["peer"]["label"],
                "members": [],
                "notes": ["Peer-country comparisons require a specific country selection."],
                "methodology": "Nearest-country peer baskets are built from comparable observed market signals.",
            }

        label_lookup = {row["id"]: row["label"] for row in self._all_geographies() if row["id"] != "EU27_AVG"}
        distance_map: Dict[str, List[float]] = {}
        available_feature_count = 0

        for metric_id, metric in observed_metrics.items():
            period_code = metric.get("period")
            if not period_code:
                continue

            snapshot = self._country_metric_snapshot(metric_id, filters, period_code)
            values = [float(row["value"]) for row in snapshot if row["value"] is not None]
            target_row = next((row for row in snapshot if row["geo_id"] == filters.geography), None)
            if target_row is None or len(values) < 4:
                continue

            mean_value = sum(values) / len(values)
            variance = sum((value - mean_value) ** 2 for value in values) / len(values)
            standard_deviation = math.sqrt(variance) or 1.0
            target_z_score = (float(target_row["value"]) - mean_value) / standard_deviation
            available_feature_count += 1

            for row in snapshot:
                candidate_geo = row["geo_id"]
                if candidate_geo == filters.geography or row["value"] is None:
                    continue
                candidate_z_score = (float(row["value"]) - mean_value) / standard_deviation
                distance_map.setdefault(candidate_geo, []).append(abs(target_z_score - candidate_z_score))

        min_common_metrics = 2 if available_feature_count >= 2 else 1
        scored_candidates = []
        for candidate_geo, contributions in distance_map.items():
            if len(contributions) < min_common_metrics:
                continue
            scored_candidates.append(
                {
                    "geo_id": candidate_geo,
                    "label": label_lookup.get(candidate_geo, candidate_geo),
                    "distance": round(sum(contributions) / len(contributions), 3),
                    "common_metric_count": len(contributions),
                }
            )

        scored_candidates.sort(key=lambda item: (-item["common_metric_count"], item["distance"], item["label"]))
        members = scored_candidates[:3]
        confidence = self._comparison_confidence(
            "proxy",
            len(members),
            3,
            min_common_metrics=min((member["common_metric_count"] for member in members), default=0),
        )

        notes = []
        if members:
            notes.append(
                "Peer countries are chosen by nearest observed labour-market profile across the currently available comparable metrics."
            )
        else:
            notes.append("Not enough comparable country metrics are available to build a peer basket.")

        return {
            "available": bool(members),
            "benchmark_status": "proxy",
            "confidence": confidence,
            "label": COMPARISON_BENCHMARKS["peer"]["label"],
            "members": members,
            "notes": notes,
            "methodology": "Peer baskets are a proxy benchmark derived from the nearest comparable country profiles.",
        }

    def _resolve_comparison_targets(
        self,
        filters: FilterState,
        benchmark_geography: Optional[str] = None,
        benchmark_sector: Optional[str] = None,
    ) -> Dict[str, Any]:
        all_geographies = self._all_geographies()
        country_geographies = [row for row in all_geographies if len(row["id"]) == 2]
        all_sectors = self._all_sectors()

        requested_geography = (benchmark_geography or "").strip()
        requested_sector = (benchmark_sector or "").strip()

        market_options = []
        market_status = "blocked"
        market_notes: List[str] = []
        if filters.geography == "EU27_AVG" or len(filters.geography) != 2:
            market_notes.append("Choose a specific country to activate direct market-to-market comparisons.")
        else:
            market_options = [
                {"id": row["id"], "label": row["label"]}
                for row in country_geographies
                if row["id"] != filters.geography
            ]
            if market_options:
                market_status = "ready" if requested_geography in {row["id"] for row in market_options} else "needs_selection"
                market_notes.append("Direct market comparisons use same-period observed country values, not proxy EU averages.")
            else:
                market_notes.append("No alternative country benchmark is available in the current marts.")

        selected_market = next((row for row in market_options if row["id"] == requested_geography), None)

        sector_options = []
        sector_status = "blocked"
        sector_notes: List[str] = []
        if filters.sector == "ALL":
            sector_notes.append("Pick a specific sector to activate sector-versus-sector comparisons.")
        else:
            sector_options = [
                {"id": row["id"], "label": row["label"]}
                for row in all_sectors
                if row["id"] != filters.sector
            ]
            if sector_options:
                sector_status = "ready" if requested_sector in {row["id"] for row in sector_options} else "needs_selection"
                sector_notes.append(
                    "Sector comparisons are live only for metrics with sector-grain support, so whole-market metrics stay unavailable."
                )
            else:
                sector_notes.append("No alternative sector benchmark is available in the current marts.")

        selected_sector = next((row for row in sector_options if row["id"] == requested_sector), None)

        return {
            "market": {
                "id": "market",
                "label": COMPARISON_BENCHMARKS["market"]["label"],
                "status": market_status,
                "selected": selected_market,
                "options": market_options,
                "notes": market_notes,
            },
            "sector": {
                "id": "sector",
                "label": COMPARISON_BENCHMARKS["sector"]["label"],
                "status": sector_status,
                "selected": selected_sector,
                "options": sector_options,
                "notes": sector_notes,
            },
        }

    def _comparison_unavailable(
        self,
        benchmark_id: str,
        reason: str,
    ) -> Dict[str, Any]:
        meta = COMPARISON_BENCHMARKS[benchmark_id]
        return {
            "id": benchmark_id,
            "label": meta["label"],
            "available": False,
            "benchmark_status": "unavailable",
            "confidence": "low",
            "coverage_status": "unavailable",
            "benchmark_value": None,
            "benchmark_period": None,
            "delta": None,
            "gap_label": "Unavailable",
            "tone": "neutral",
            "observation_count": 0,
            "expected_count": 0,
            "selected_target": None,
            "notes": [reason],
            "explanation": reason,
            "evidence_bundle": None,
        }

    def _build_metric_comparisons(
        self,
        metric: Dict[str, Any],
        filters: FilterState,
        peer_group: Dict[str, Any],
        comparison_targets: Dict[str, Any],
    ) -> Dict[str, Dict[str, Any]]:
        metric_id = metric["id"]
        unit = metric.get("unit", "%")
        config = OBSERVED_METRIC_CONFIG[metric_id]

        prior_period = self._comparison_unavailable(
            "prior_period",
            f"No earlier {metric['title'].lower()} period is available for this filter state.",
        )
        if metric.get("previous_value") is not None and metric.get("previous_period"):
            prior_delta = round(float(metric["value"]) - float(metric["previous_value"]), 2)
            prior_period = {
                "id": "prior_period",
                "label": COMPARISON_BENCHMARKS["prior_period"]["label"],
                "available": True,
                "benchmark_status": "official",
                "confidence": "high",
                "coverage_status": "full",
                "benchmark_value": float(metric["previous_value"]),
                "benchmark_period": metric["previous_period"],
                "delta": prior_delta,
                "gap_label": self._comparison_gap_label(prior_delta, unit),
                "tone": self._comparison_tone(metric_id, prior_delta),
                "observation_count": 1,
                "expected_count": 1,
                "notes": [
                    f"Compared against the immediately preceding {metric.get('period_type', 'period')} for the same geography and sector scope."
                ],
                "explanation": (
                    f"{metric['title']} is {abs(prior_delta):.1f} pts "
                    f"{'higher' if prior_delta > 0 else 'lower' if prior_delta < 0 else 'in line'} "
                    f"than the prior period ({metric['previous_period']})."
                ),
                "evidence_bundle": {
                    "title": f"{metric['title']} vs prior period",
                    "summary": "Official same-scope comparison against the immediately preceding period.",
                    "evidence": [
                        {"label": "Current value", "value": f"{metric['value']:.1f}{unit}"},
                        {"label": "Prior-period value", "value": f"{metric['previous_value']:.1f}{unit}"},
                        {"label": "Gap", "value": format_signed_delta(prior_delta, unit)},
                        {"label": "Comparison period", "value": metric["previous_period"]},
                    ],
                    "provenance": [metric["provenance"]],
                    "review_required": metric["provenance"]["human_review_required"],
                    "governance_target": {"target_type": "comparison", "target_id": f"{metric_id}:prior_period"},
                },
            }

        eu_benchmark = self._comparison_unavailable(
            "eu",
            "EU benchmark comparison is unavailable for the synthetic EU27 market-average selection.",
        )
        if filters.geography != "EU27_AVG":
            snapshot = self._country_metric_snapshot(metric_id, filters, metric["period"])
            values = [float(row["value"]) for row in snapshot if row["value"] is not None]
            if values:
                benchmark_value = round(sum(values) / len(values), 2)
                delta = round(float(metric["value"]) - benchmark_value, 2)
                confidence = self._comparison_confidence("proxy", len(values), 27, min_common_metrics=3)
                eu_benchmark = {
                    "id": "eu",
                    "label": COMPARISON_BENCHMARKS["eu"]["label"],
                    "available": True,
                    "benchmark_status": "proxy",
                    "confidence": confidence,
                    "coverage_status": "full" if len(values) >= 24 else "partial",
                    "benchmark_value": benchmark_value,
                    "benchmark_period": metric["period"],
                    "delta": delta,
                    "gap_label": self._comparison_gap_label(delta, unit),
                    "tone": self._comparison_tone(metric_id, delta),
                    "observation_count": len(values),
                    "expected_count": 27,
                    "notes": [
                        "The current service models the EU benchmark as an average across country observations because an official EU aggregate row is not present in the marts."
                    ],
                    "explanation": (
                        f"{filters.geography_label} is {abs(delta):.1f} pts "
                        f"{'above' if delta > 0 else 'below' if delta < 0 else 'in line with'} "
                        f"the EU27 proxy average for {metric['title'].lower()} in {metric['period']}."
                    ),
                    "evidence_bundle": {
                        "title": f"{metric['title']} vs EU27 proxy average",
                        "summary": "Proxy benchmark against the modeled EU27 country-average comparison basis.",
                        "evidence": [
                            {"label": "Current value", "value": f"{metric['value']:.1f}{unit}"},
                            {"label": "EU27 proxy average", "value": f"{benchmark_value:.1f}{unit}"},
                            {"label": "Gap", "value": format_signed_delta(delta, unit)},
                            {"label": "Country observations", "value": f"{len(values)} / 27"},
                        ],
                        "provenance": [metric["provenance"]],
                        "review_required": metric["provenance"]["human_review_required"],
                        "governance_target": {"target_type": "comparison", "target_id": f"{metric_id}:eu"},
                    },
                }

        peer_benchmark = self._comparison_unavailable(
            "peer",
            "Peer-country comparison is unavailable until a country-level peer basket can be constructed.",
        )
        if peer_group.get("available"):
            snapshot = self._country_metric_snapshot(metric_id, filters, metric["period"])
            value_lookup = {row["geo_id"]: float(row["value"]) for row in snapshot if row["value"] is not None}
            peer_values = [
                value_lookup[member["geo_id"]]
                for member in peer_group["members"]
                if member["geo_id"] in value_lookup
            ]
            if peer_values:
                benchmark_value = round(sum(peer_values) / len(peer_values), 2)
                delta = round(float(metric["value"]) - benchmark_value, 2)
                min_common_metrics = min(
                    (member["common_metric_count"] for member in peer_group["members"]),
                    default=0,
                )
                confidence = self._comparison_confidence(
                    "proxy",
                    len(peer_values),
                    max(len(peer_group["members"]), 1),
                    min_common_metrics=min_common_metrics,
                )
                peer_benchmark = {
                    "id": "peer",
                    "label": COMPARISON_BENCHMARKS["peer"]["label"],
                    "available": True,
                    "benchmark_status": "proxy",
                    "confidence": confidence,
                    "coverage_status": "full" if len(peer_values) == len(peer_group["members"]) else "partial",
                    "benchmark_value": benchmark_value,
                    "benchmark_period": metric["period"],
                    "delta": delta,
                    "gap_label": self._comparison_gap_label(delta, unit),
                    "tone": self._comparison_tone(metric_id, delta),
                    "observation_count": len(peer_values),
                    "expected_count": len(peer_group["members"]),
                    "notes": [
                        f"Peer basket members: {', '.join(member['label'] for member in peer_group['members'])}."
                    ],
                    "explanation": (
                        f"{filters.geography_label} is {abs(delta):.1f} pts "
                        f"{'above' if delta > 0 else 'below' if delta < 0 else 'in line with'} "
                        f"its peer-country basket on {metric['title'].lower()} in {metric['period']}."
                    ),
                    "evidence_bundle": {
                        "title": f"{metric['title']} vs peer-country basket",
                        "summary": "Proxy benchmark against the nearest comparable peer-country basket.",
                        "evidence": [
                            {"label": "Current value", "value": f"{metric['value']:.1f}{unit}"},
                            {"label": "Peer basket average", "value": f"{benchmark_value:.1f}{unit}"},
                            {"label": "Gap", "value": format_signed_delta(delta, unit)},
                            {"label": "Peer members", "value": ", ".join(member["label"] for member in peer_group["members"])},
                        ],
                        "provenance": [metric["provenance"]],
                        "review_required": metric["provenance"]["human_review_required"],
                        "governance_target": {"target_type": "comparison", "target_id": f"{metric_id}:peer"},
                    },
                }

        market_target = comparison_targets["market"]
        market_benchmark = self._comparison_unavailable(
            "market",
            market_target["notes"][0],
        )
        if market_target.get("selected"):
            target = market_target["selected"]
            target_value = self._metric_value_at_scope(
                config["signal_name"],
                target["id"],
                metric["period"],
                sector_id=self._resolved_metric_sector_id(metric_id, filters),
            )
            if target_value is not None:
                delta = round(float(metric["value"]) - float(target_value), 2)
                market_benchmark = {
                    "id": "market",
                    "label": target["label"],
                    "available": True,
                    "benchmark_status": "official",
                    "confidence": "high",
                    "coverage_status": "full",
                    "benchmark_value": float(target_value),
                    "benchmark_period": metric["period"],
                    "delta": delta,
                    "gap_label": self._comparison_gap_label(delta, unit),
                    "tone": self._comparison_tone(metric_id, delta),
                    "observation_count": 1,
                    "expected_count": 1,
                    "selected_target": target,
                    "notes": [
                        f"Direct market benchmark against {target['label']} using the same observed period and sector scope."
                    ],
                    "explanation": (
                        f"{filters.geography_label} is {abs(delta):.1f} pts "
                        f"{'above' if delta > 0 else 'below' if delta < 0 else 'in line with'} "
                        f"{target['label']} on {metric['title'].lower()} in {metric['period']}."
                    ),
                    "evidence_bundle": {
                        "title": f"{metric['title']} vs {target['label']}",
                        "summary": "Observed same-period comparison between two country markets.",
                        "evidence": [
                            {"label": "Current market", "value": f"{filters.geography_label} ({metric['value']:.1f}{unit})"},
                            {"label": "Benchmark market", "value": f"{target['label']} ({float(target_value):.1f}{unit})"},
                            {"label": "Gap", "value": format_signed_delta(delta, unit)},
                            {"label": "Comparison period", "value": metric["period"]},
                        ],
                        "provenance": [metric["provenance"]],
                        "review_required": metric["provenance"]["human_review_required"],
                        "governance_target": {"target_type": "comparison", "target_id": f"{metric_id}:market"},
                    },
                }
            else:
                market_benchmark = self._comparison_unavailable(
                    "market",
                    f"{metric['title']} is unavailable for {target['label']} in {metric['period']} for the current sector scope.",
                )

        sector_target = comparison_targets["sector"]
        sector_benchmark = self._comparison_unavailable(
            "sector",
            sector_target["notes"][0],
        )
        if config["default_sector"] is None:
            sector_benchmark = self._comparison_unavailable(
                "sector",
                f"{metric['title']} is only modeled at whole-market grain, so sector-versus-sector comparison is not live yet.",
            )
        elif sector_target.get("selected"):
            target = sector_target["selected"]
            target_value = self._metric_value_at_scope(
                config["signal_name"],
                filters.geography,
                metric["period"],
                sector_id=target["id"],
            )
            if target_value is not None:
                delta = round(float(metric["value"]) - float(target_value), 2)
                sector_benchmark = {
                    "id": "sector",
                    "label": target["label"],
                    "available": True,
                    "benchmark_status": "official",
                    "confidence": "high",
                    "coverage_status": "full",
                    "benchmark_value": float(target_value),
                    "benchmark_period": metric["period"],
                    "delta": delta,
                    "gap_label": self._comparison_gap_label(delta, unit),
                    "tone": self._comparison_tone(metric_id, delta),
                    "observation_count": 1,
                    "expected_count": 1,
                    "selected_target": target,
                    "notes": [
                        f"Direct sector benchmark against {target['label']} within {filters.geography_label} using the same observed period."
                    ],
                    "explanation": (
                        f"{filters.sector_label} is {abs(delta):.1f} pts "
                        f"{'above' if delta > 0 else 'below' if delta < 0 else 'in line with'} "
                        f"{target['label']} on {metric['title'].lower()} in {filters.geography_label}."
                    ),
                    "evidence_bundle": {
                        "title": f"{metric['title']} vs {target['label']}",
                        "summary": "Observed same-period comparison between two sectors in the same geography.",
                        "evidence": [
                            {"label": "Current sector", "value": f"{filters.sector_label} ({metric['value']:.1f}{unit})"},
                            {"label": "Benchmark sector", "value": f"{target['label']} ({float(target_value):.1f}{unit})"},
                            {"label": "Gap", "value": format_signed_delta(delta, unit)},
                            {"label": "Comparison geography", "value": filters.geography_label},
                        ],
                        "provenance": [metric["provenance"]],
                        "review_required": metric["provenance"]["human_review_required"],
                        "governance_target": {"target_type": "comparison", "target_id": f"{metric_id}:sector"},
                    },
                }
            else:
                sector_benchmark = self._comparison_unavailable(
                    "sector",
                    f"{metric['title']} is unavailable for {target['label']} in {filters.geography_label} for {metric['period']}.",
                )

        return {
            "prior_period": prior_period,
            "eu": eu_benchmark,
            "peer": peer_benchmark,
            "market": market_benchmark,
            "sector": sector_benchmark,
        }

    def resolve_filters(
        self,
        country: str = "ALL",
        geography: str = "EU27_AVG",
        sector: str = "ALL",
        period: str = "latest",
    ) -> tuple[FilterState, Dict[str, Any]]:
        geographies = self._all_geographies()
        sectors = self._all_sectors()
        years = self._all_years()
        country_options = [{"id": "ALL", "label": "All countries"}] + [
            {"id": row["country_code"], "label": row["country_code"]}
            for row in geographies
        ]
        seen_countries = set()
        unique_country_options = []
        for option in country_options:
            if option["id"] in seen_countries:
                continue
            seen_countries.add(option["id"])
            unique_country_options.append(option)
        country_options = unique_country_options

        if country != "ALL" and country not in {option["id"] for option in country_options}:
            country = "ALL"

        geography_options = [{"id": "EU27_AVG", "label": "EU27 proxy market average", "country_code": "EU"}]
        if country == "ALL":
            geography_options.extend(geographies)
        else:
            geography_options.extend([row for row in geographies if row["country_code"] == country])

        allowed_geography_ids = {row["id"] for row in geography_options}
        if geography not in allowed_geography_ids:
            geography = "EU27_AVG" if country == "ALL" else next(
                (row["id"] for row in geography_options if row["id"] != "EU27_AVG"),
                "EU27_AVG",
            )

        geography_label = next(
            (row["label"] for row in geography_options if row["id"] == geography),
            "EU27 proxy market average",
        )
        if geography != "EU27_AVG":
            country = geography[:2]

        sector_options = [{"id": "ALL", "label": "All sectors"}] + sectors
        if sector not in {row["id"] for row in sector_options}:
            sector = "ALL"
        sector_label = next((row["label"] for row in sector_options if row["id"] == sector), "All sectors")

        period_options = [{"id": "latest", "label": "Latest available"}] + [
            {"id": year, "label": year} for year in years
        ]
        if period not in {row["id"] for row in period_options}:
            period = "latest"

        return (
            FilterState(
                country=country,
                geography=geography,
                geography_label=geography_label,
                sector=sector,
                sector_label=sector_label,
                period=period,
            ),
            {
                "country_options": country_options,
                "geography_options": geography_options,
                "sector_options": sector_options,
                "period_options": period_options,
                "supported_grains": self._grain_statuses(),
            },
        )

    def _resolve_signal_period(
        self,
        signal_name: str,
        requested_period: str,
        sector_id: Optional[str] = None,
    ) -> Optional[str]:
        sector_clause = ""
        params: List[Any] = [signal_name]
        if sector_id:
            sector_clause = "and sector_id = ?"
            params.append(sector_id)

        rows = self._query(
            f"""
            select distinct period_code
            from fct_labour_market_region_sector
            where signal_name = ?
              {sector_clause}
            """,
            params,
        )
        periods = sorted((row["period_code"] for row in rows), key=period_sort_key)
        if not periods:
            return None
        if requested_period == "latest":
            return periods[-1]

        matching_years = [period for period in periods if period.startswith(requested_period)]
        if matching_years:
            return matching_years[-1]

        earlier_periods = [period for period in periods if period_sort_key(period) <= period_sort_key(requested_period)]
        return earlier_periods[-1] if earlier_periods else periods[-1]

    def _fetch_series(
        self,
        signal_name: str,
        geography: str,
        sector_id: Optional[str] = None,
        max_period: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        conditions = ["signal_name = ?"]
        params: List[Any] = [signal_name]

        if sector_id:
            conditions.append("sector_id = ?")
            params.append(sector_id)
        else:
            conditions.append("sector_id is null")

        if max_period:
            conditions.append("period_code <= ?")
            params.append(max_period)

        where_clause = " and ".join(conditions)
        if geography == "EU27_AVG":
            rows = self._query(
                f"""
                select
                    period_code,
                    period_type,
                    avg(signal_value) as value
                from fct_labour_market_region_sector
                where {where_clause}
                group by 1, 2
                order by 1
                """,
                params,
            )
        else:
            rows = self._query(
                f"""
                select
                    period_code,
                    period_type,
                    max(signal_value) as value
                from fct_labour_market_region_sector
                where {where_clause}
                  and geo_id = ?
                group by 1, 2
                order by 1
                """,
                [*params, geography],
            )

        return [
            {
                "period": row["period_code"],
                "period_type": row["period_type"],
                "value": round(float(row["value"]), 2),
            }
            for row in rows
            if row["value"] is not None
        ]

    def _build_metric(self, metric_id: str, filters: FilterState) -> Optional[Dict[str, Any]]:
        config = OBSERVED_METRIC_CONFIG[metric_id]
        sector_id = self._resolved_metric_sector_id(metric_id, filters)
        sector_label = self._resolved_metric_sector_label(metric_id, filters)

        series = self._fetch_series(
            config["signal_name"],
            filters.geography,
            sector_id=sector_id,
            max_period=self._resolve_signal_period(config["signal_name"], filters.period, sector_id),
        )
        if not series:
            return None

        latest = series[-1]
        previous = series[-2] if len(series) > 1 else None
        delta = round(latest["value"] - previous["value"], 2) if previous else None
        review_required = config["human_review_required"]
        provenance = self._build_provenance(
            config["source_id"],
            metric_id,
            config["formula_version"],
            review_required,
        )

        evidence_items = [
            {"label": "Geography", "value": filters.geography_label},
            {"label": "Sector scope", "value": sector_label},
            {"label": "Observed period", "value": latest["period"]},
            {"label": "Observed value", "value": f"{latest['value']:.1f}{config['unit']}"},
        ]

        return {
            "id": metric_id,
            "title": config["title"],
            "value": latest["value"],
            "unit": config["unit"],
            "period": latest["period"],
            "period_type": latest["period_type"],
            "delta": delta,
            "previous_value": previous["value"] if previous else None,
            "previous_period": previous["period"] if previous else None,
            "series_points": len(series),
            "sector_scope_label": sector_label,
            "definition": config["definition"],
            "provenance": provenance,
            "evidence_summary": [item["value"] for item in evidence_items],
            "evidence_bundle": {
                "title": config["title"],
                "summary": config["definition"],
                "evidence": evidence_items,
                "provenance": [provenance],
                "review_required": review_required,
                "governance_target": {"target_type": "metric", "target_id": metric_id},
            },
        }

    def _semantic_metric_template(
        self,
        metric_id: str,
        value: Optional[float],
        filters: FilterState,
        provenance_source_id: str,
        evidence: List[Dict[str, str]],
        implementation_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        registry = self.metric_registry[metric_id]
        review_required = parse_bool(registry.get("human_review_required"))
        provenance = self._build_provenance(
            provenance_source_id,
            metric_id,
            registry.get("formula_version", "1.0"),
            review_required,
        )
        return {
            "id": metric_id,
            "title": registry["metric_name"],
            "value": value,
            "unit": "score" if value is not None else "status",
            "period": filters.period,
            "definition": registry["definition"],
            "implementation_status": implementation_status or registry.get("implementation_status", "live"),
            "notes": registry.get("notes", ""),
            "provenance": provenance,
            "evidence_summary": [item["value"] for item in evidence],
            "evidence_bundle": {
                "title": registry["metric_name"],
                "summary": registry["definition"],
                "evidence": evidence,
                "provenance": [provenance],
                "review_required": review_required,
                "governance_target": {"target_type": "semantic_metric", "target_id": metric_id},
            },
        }

    def _latest_signal_value(
        self,
        signal_name: str,
        geography: str,
        period: str,
        sector_id: Optional[str] = None,
    ) -> Optional[float]:
        resolved_period = self._resolve_signal_period(signal_name, period, sector_id)
        if not resolved_period:
            return None
        series = self._fetch_series(signal_name, geography, sector_id=sector_id, max_period=resolved_period)
        if not series:
            return None
        return float(series[-1]["value"])

    def _build_modeled_semantic_metrics(self, filters: FilterState) -> Optional[List[Dict[str, Any]]]:
        if "mart_semantic_metrics" not in self._available_tables():
            return None

        sector_id = "ALL" if filters.sector == "ALL" else filters.sector
        if filters.geography == "EU27_AVG":
            rows = self._query(
                """
                select
                    metric_id,
                    round(avg(metric_value), 1) as metric_value,
                    any_value(primary_source_id) as primary_source_id,
                    any_value(implementation_status) as implementation_status,
                    any_value(evidence_summary) as evidence_summary
                from mart_semantic_metrics
                where sector_id = ?
                group by 1
                order by metric_id
                """,
                [sector_id],
            )
            if not rows and sector_id != "ALL":
                rows = self._query(
                    """
                    select
                        metric_id,
                        round(avg(metric_value), 1) as metric_value,
                        any_value(primary_source_id) as primary_source_id,
                        any_value(implementation_status) as implementation_status,
                        any_value(evidence_summary) as evidence_summary
                    from mart_semantic_metrics
                    where sector_id = 'ALL'
                    group by 1
                    order by metric_id
                    """
                )
        else:
            rows = self._query(
                """
                select
                    metric_id,
                    metric_value,
                    primary_source_id,
                    implementation_status,
                    evidence_summary
                from mart_semantic_metrics
                where geo_id = ?
                  and sector_id = ?
                order by metric_id
                """,
                [filters.geography, sector_id],
            )
            if not rows and sector_id != "ALL":
                rows = self._query(
                    """
                    select
                        metric_id,
                        metric_value,
                        primary_source_id,
                        implementation_status,
                        evidence_summary
                    from mart_semantic_metrics
                    where geo_id = ?
                      and sector_id = 'ALL'
                    order by metric_id
                    """,
                    [filters.geography],
                )

        if not rows:
            return None

        metrics = []
        for row in rows:
            evidence = [
                {"label": "Selected geography", "value": filters.geography_label},
                {"label": "Sector scope", "value": filters.sector_label},
                {"label": "Modeled basis", "value": row["evidence_summary"]},
            ]
            metrics.append(
                self._semantic_metric_template(
                    row["metric_id"],
                    float(row["metric_value"]) if row["metric_value"] is not None else None,
                    filters,
                    row["primary_source_id"],
                    evidence,
                    implementation_status=row["implementation_status"],
                )
            )

        metric_order = {
            "hiring_pressure_index": 0,
            "labour_resilience": 1,
            "equity_risk_score": 2,
            "transition_readiness": 3,
        }
        return sorted(metrics, key=lambda metric: metric_order.get(metric["id"], 99))

    def _build_semantic_metrics(self, observed_metrics: Dict[str, Dict[str, Any]], filters: FilterState) -> List[Dict[str, Any]]:
        modeled_metrics = self._build_modeled_semantic_metrics(filters)
        if modeled_metrics is not None:
            return modeled_metrics

        vacancy_rate = float(observed_metrics.get("vacancy_rate", {}).get("value", 0.0))
        unemployment_rate = float(observed_metrics.get("unemployment_rate", {}).get("value", 0.0))
        employment_rate = float(observed_metrics.get("employment_rate", {}).get("value", 0.0))
        pay_gap = max(float(observed_metrics.get("gender_pay_gap", {}).get("value", 0.0)), 0.0)
        labour_slack_rate = self._latest_signal_value("labour_market_slack_rate", filters.geography, filters.period)
        flow_to_employment = self._latest_signal_value("labour_flow_to_employment", filters.geography, filters.period)
        flow_to_inactivity = self._latest_signal_value("labour_flow_to_inactivity", filters.geography, filters.period)
        employment_continuity = self._latest_signal_value("employment_continuity", filters.geography, filters.period)

        hiring_pressure_index = vacancy_rate * 11 + max(0, 9 - unemployment_rate) * 4
        if labour_slack_rate is not None:
            hiring_pressure_index += max(0, 12 - labour_slack_rate) * 2.8
        if flow_to_employment is not None:
            hiring_pressure_index += flow_to_employment * 0.9
        if flow_to_inactivity is not None:
            hiring_pressure_index += flow_to_inactivity * 0.6

        labour_resilience = employment_rate * 0.95 - unemployment_rate * 3.8
        if employment_continuity is not None:
            labour_resilience += employment_continuity * 0.3

        hiring_pressure_index = clamp_score(hiring_pressure_index)
        labour_resilience = clamp_score(labour_resilience)
        equity_risk_score = clamp_score(pay_gap * 5.5)

        hiring_evidence = [
            {"label": "Selected geography", "value": filters.geography_label},
            {"label": "Vacancy rate input", "value": f"{vacancy_rate:.1f}%"},
            {"label": "Unemployment proxy input", "value": f"{unemployment_rate:.1f}%"},
        ]
        if flow_to_employment is not None:
            hiring_evidence.append({"label": "Unemployed to employment flow", "value": f"{flow_to_employment:.1f}%"})
        if flow_to_inactivity is not None:
            hiring_evidence.append({"label": "Unemployed to inactivity flow", "value": f"{flow_to_inactivity:.1f}%"})
        if labour_slack_rate is not None:
            hiring_evidence.append({"label": "Labour slack rate", "value": f"{labour_slack_rate:.1f}%"})

        resilience_evidence = [
            {"label": "Selected geography", "value": filters.geography_label},
            {"label": "Employment input", "value": f"{employment_rate:.1f}%"},
            {"label": "Unemployment input", "value": f"{unemployment_rate:.1f}%"},
        ]
        if employment_continuity is not None:
            resilience_evidence.append({"label": "Employment continuity flow", "value": f"{employment_continuity:.1f}%"})

        metrics = [
            self._semantic_metric_template(
                "hiring_pressure_index",
                float(hiring_pressure_index),
                filters,
                "eurostat_jvs",
                hiring_evidence,
            ),
            self._semantic_metric_template(
                "labour_resilience",
                float(labour_resilience),
                filters,
                "eurostat_lfs",
                resilience_evidence,
            ),
            self._semantic_metric_template(
                "equity_risk_score",
                float(equity_risk_score),
                filters,
                "eurostat_lfs",
                [
                    {"label": "Selected geography", "value": filters.geography_label},
                    {"label": "Sector scope", "value": filters.sector_label},
                    {"label": "Pay-gap input", "value": f"{pay_gap:.1f}%"},
                ],
            ),
            self._semantic_metric_template(
                "transition_readiness",
                None,
                filters,
                "esco_taxonomy",
                [
                    {"label": "Status", "value": "Planned"},
                    {"label": "Dependency", "value": "ESCO taxonomy and skills-demand inputs still need ingestion"},
                ],
            ),
        ]
        return metrics

    def _ranking_period(self, signal_name: str, requested_period: str) -> Optional[str]:
        return self._resolve_signal_period(signal_name, requested_period, None)

    def _fetch_sector_ranking(self, signal_name: str, geography: str, period: str, selected_sector: str = "ALL") -> List[Dict[str, Any]]:
        if geography == "EU27_AVG":
            rows = self._query(
                """
                select
                    sector_id,
                    max(period_code) as period_code,
                    avg(signal_value) as value
                from fct_labour_market_region_sector
                where signal_name = ?
                  and period_code = ?
                  and sector_id is not null
                group by 1
                order by value desc
                """,
                [signal_name, period],
            )
        else:
            rows = self._query(
                """
                select
                    sector_id,
                    max(period_code) as period_code,
                    max(signal_value) as value
                from fct_labour_market_region_sector
                where signal_name = ?
                  and period_code = ?
                  and sector_id is not null
                  and geo_id = ?
                group by 1
                order by value desc
                """,
                [signal_name, period, geography],
            )

        normalized = [
            {
                "sector_code": row["sector_id"],
                "sector_label": self._sector_label(row["sector_id"]),
                "value": round(float(row["value"]), 2),
                "period": row["period_code"],
            }
            for row in rows
            if row["sector_id"] not in AGGREGATE_SECTORS and row["value"] is not None
        ]
        if selected_sector != "ALL":
            normalized = [row for row in normalized if row["sector_code"] == selected_sector]
        return normalized[:8]

    def _sector_label(self, sector_id: Optional[str]) -> str:
        if not sector_id:
            return "All sectors"
        rows = self._query("select sector_name from dim_sector where sector_id = ?", [sector_id])
        return rows[0]["sector_name"] if rows else sector_id

    def _build_charts(self, filters: FilterState) -> Dict[str, Any]:
        unemployment_max = self._resolve_signal_period("unemployment_rate", filters.period)
        employment_max = self._resolve_signal_period("employment_rate", filters.period)
        vacancy_period = self._ranking_period("job_vacancy_rate", filters.period)
        pay_gap_period = self._ranking_period("gender_pay_gap", filters.period)

        unemployment_series = self._fetch_series(
            "unemployment_rate",
            filters.geography,
            max_period=unemployment_max,
        )
        employment_series = self._fetch_series(
            "employment_rate",
            filters.geography,
            max_period=employment_max,
        )
        vacancy_ranking = self._fetch_sector_ranking(
            "job_vacancy_rate",
            filters.geography,
            vacancy_period or self._ranking_period("job_vacancy_rate", "latest") or "",
            filters.sector,
        )
        pay_gap_ranking = self._fetch_sector_ranking(
            "gender_pay_gap",
            filters.geography,
            pay_gap_period or self._ranking_period("gender_pay_gap", "latest") or "",
            filters.sector,
        )

        return {
            "unemployment_trend": {
                "series": unemployment_series,
                "provenance": self._build_provenance("eurostat_lfs", "unemployment_rate", "observed-v1", False),
                "coverage": self._scope_coverage(filters, has_data=bool(unemployment_series)),
            },
            "employment_trend": {
                "series": employment_series,
                "provenance": self._build_provenance("eurostat_lfs", "employment_rate", "observed-v1", False),
                "coverage": self._scope_coverage(filters, has_data=bool(employment_series)),
            },
            "vacancy_by_sector": {
                "series": vacancy_ranking,
                "provenance": self._build_provenance("eurostat_jvs", "vacancy_rate", "observed-v1", False),
                "coverage": self._scope_coverage(filters, has_data=bool(vacancy_ranking), sector_grain=True),
            },
            "pay_gap_by_sector": {
                "series": pay_gap_ranking,
                "provenance": self._build_provenance("eurostat_lfs", "gender_pay_gap", "observed-v1", True),
                "coverage": self._scope_coverage(filters, has_data=bool(pay_gap_ranking), sector_grain=True),
            },
        }

    def _build_intelligence(
        self,
        filters: FilterState,
        observed_metrics: Dict[str, Dict[str, Any]],
        semantic_metrics: Dict[str, Dict[str, Any]],
        charts: Dict[str, Any],
        comparisons: Dict[str, Any],
    ) -> Dict[str, Any]:
        def metric_value(metric_id: str) -> Optional[float]:
            value = observed_metrics.get(metric_id, {}).get("value")
            return float(value) if value is not None else None

        def metric_provenance(metric_id: str, source_id: str, formula_version: str, review_required: bool) -> Dict[str, Any]:
            metric = observed_metrics.get(metric_id)
            if metric and metric.get("provenance"):
                return metric["provenance"]
            return self._build_provenance(source_id, metric_id, formula_version, review_required)

        def format_percentage(value: Optional[float]) -> str:
            return f"{value:.1f}%" if value is not None else "Unavailable"

        hiring_pressure = int((semantic_metrics.get("hiring_pressure_index") or {}).get("value") or 0)
        labour_resilience = int((semantic_metrics.get("labour_resilience") or {}).get("value") or 0)
        equity_risk = int((semantic_metrics.get("equity_risk_score") or {}).get("value") or 0)

        vacancy_rate = metric_value("vacancy_rate")
        employment_rate = metric_value("employment_rate")
        unemployment_rate = metric_value("unemployment_rate")
        pay_gap = metric_value("gender_pay_gap")

        top_vacancy = charts["vacancy_by_sector"]["series"][0] if charts["vacancy_by_sector"]["series"] else None
        top_gap = charts["pay_gap_by_sector"]["series"][0] if charts["pay_gap_by_sector"]["series"] else None

        active_benchmark = comparisons.get("selected_benchmark", {})
        active_benchmark_label = (
            (active_benchmark.get("selected_target") or {}).get("label")
            or active_benchmark.get("label")
            or "the active benchmark"
        )
        active_benchmark_lead = active_benchmark.get("lead_metric")
        benchmark_context = None
        if active_benchmark.get("availability") == "available" and active_benchmark_lead:
            benchmark_context_parts = [
                f"Active benchmark basis: {active_benchmark_label}.",
                (
                    f"{active_benchmark_lead['title']} is {active_benchmark_lead['gap_label'].lower()} "
                    f"{active_benchmark_label}."
                ),
            ]
            if active_benchmark.get("coverage_note"):
                benchmark_context_parts.append(active_benchmark["coverage_note"])
            benchmark_context = {
                "id": active_benchmark.get("id"),
                "label": active_benchmark.get("label"),
                "target_label": active_benchmark_label,
                "summary": " ".join(benchmark_context_parts),
                "confidence": active_benchmark.get("confidence", "medium"),
                "coverage_status": active_benchmark.get("coverage_status", "unavailable"),
                "coverage_note": active_benchmark.get("coverage_note"),
                "applicable_metric_count": active_benchmark.get("applicable_metric_count", 0),
                "total_metric_count": active_benchmark.get("total_metric_count", 0),
                "available_metrics": active_benchmark.get("available_metrics", []),
                "unavailable_metrics": active_benchmark.get("unavailable_metrics", []),
                "lead_metric": active_benchmark_lead,
            }

        if hiring_pressure >= 70 and labour_resilience >= 65:
            headline = "The market looks resilient, but hiring pressure is intensifying."
        elif equity_risk >= 70:
            headline = "The clearest external risk signal is pay-equity pressure."
        elif labour_resilience < 55:
            headline = "Labour resilience is softening and needs closer review."
        else:
            headline = "Conditions are stable overall, with a few hotspots worth acting on first."

        summary_parts = [
            f"{filters.geography_label} shows {format_percentage(employment_rate)} employment and {format_percentage(unemployment_rate)} unemployment.",
        ]
        if top_vacancy:
            summary_parts.append(f"Hiring pressure is strongest in {top_vacancy['sector_label']}.")
        elif vacancy_rate is not None:
            summary_parts.append(f"Observed vacancy intensity is {vacancy_rate:.1f}%.")
        else:
            summary_parts.append("Vacancy benchmarks are limited for this filter state.")
        if top_gap:
            summary_parts.append(f"Pay-gap pressure is most visible in {top_gap['sector_label']}.")
        elif pay_gap is not None:
            summary_parts.append(f"Observed market pay gap is {pay_gap:.1f}%.")
        else:
            summary_parts.append("Pay-gap benchmarks are limited for this filter state.")
        if benchmark_context:
            summary_parts.append(benchmark_context["summary"])
        summary = " ".join(summary_parts)

        def bundle(title: str, summary_text: str, evidence: List[Dict[str, str]], provenance: List[Dict[str, Any]], target_id: str, review_required: bool = False) -> Dict[str, Any]:
            return {
                "title": title,
                "summary": summary_text,
                "evidence": evidence,
                "provenance": provenance,
                "review_required": review_required,
                "governance_target": {"target_type": "insight", "target_id": target_id},
            }

        signals = [
            {
                "id": "signal_hiring_pressure",
                "title": "Hiring pressure",
                "tone": "watch" if hiring_pressure >= 70 else "neutral" if hiring_pressure >= 45 else "good",
                "detail": (
                    f"Vacancy intensity is {format_percentage(vacancy_rate)} and the tightest sector is {top_vacancy['sector_label']}."
                    if top_vacancy
                    else (
                        f"Vacancy intensity is {vacancy_rate:.1f}%."
                        if vacancy_rate is not None
                        else "Vacancy benchmarks are limited for this filter state, so the score leans on the remaining market signals."
                    )
                ),
                "evidence_bundle": bundle(
                    "Hiring pressure",
                    "Grounded summary of the current labour-demand environment.",
                    [
                        {"label": "Hiring pressure index", "value": f"{hiring_pressure}/100"},
                        {"label": "Observed vacancy rate", "value": format_percentage(vacancy_rate)},
                        {"label": "Leading vacancy hotspot", "value": top_vacancy["sector_label"] if top_vacancy else "Unavailable"},
                    ],
                    [
                        (semantic_metrics.get("\1") or {}).get("provenance", {}),
                        metric_provenance("vacancy_rate", "eurostat_jvs", "observed-v1", False),
                    ],
                    "signal_hiring_pressure",
                ),
            },
            {
                "id": "signal_labour_resilience",
                "title": "Labour resilience",
                "tone": "good" if labour_resilience >= 70 else "neutral" if labour_resilience >= 45 else "watch",
                "detail": f"Employment is {format_percentage(employment_rate)} and unemployment is {format_percentage(unemployment_rate)}.",
                "evidence_bundle": bundle(
                    "Labour resilience",
                    "Combined labour-market strength for the selected geography.",
                    [
                        {"label": "Labour resilience", "value": f"{labour_resilience}/100"},
                        {"label": "Employment", "value": format_percentage(employment_rate)},
                        {"label": "Unemployment", "value": format_percentage(unemployment_rate)},
                    ],
                    [
                        (semantic_metrics.get("\1") or {}).get("provenance", {}),
                        metric_provenance("employment_rate", "eurostat_lfs", "observed-v1", False),
                        metric_provenance("unemployment_rate", "eurostat_lfs", "observed-v1", False),
                    ],
                    "signal_labour_resilience",
                ),
            },
            {
                "id": "signal_equity_risk",
                "title": "Pay equity pressure",
                "tone": "watch" if equity_risk >= 70 else "neutral" if equity_risk >= 45 else "good",
                "detail": (
                    f"Market pay gap is {pay_gap:.1f}% and the widest hotspot is {top_gap['sector_label']}."
                    if top_gap
                    else (
                        f"Market pay gap is {pay_gap:.1f}%."
                        if pay_gap is not None
                        else "Pay-gap benchmarks are limited for this filter state."
                    )
                ),
                "evidence_bundle": bundle(
                    "Pay equity pressure",
                    "Market-level pay-gap pressure for the selected geography and sector scope.",
                    [
                        {"label": "Equity risk score", "value": f"{equity_risk}/100"},
                        {"label": "Observed pay gap", "value": format_percentage(pay_gap)},
                        {"label": "Leading pay-gap hotspot", "value": top_gap["sector_label"] if top_gap else "Unavailable"},
                    ],
                    [
                        (semantic_metrics.get("\1") or {}).get("provenance", {}),
                        metric_provenance("gender_pay_gap", "eurostat_lfs", "observed-v1", True),
                    ],
                    "signal_equity_risk",
                    review_required=True,
                ),
            },
        ]

        recommendations = []
        if benchmark_context and active_benchmark_lead:
            benchmark_priority = (
                "high"
                if active_benchmark_lead.get("tone") == "watch" and active_benchmark.get("confidence") != "low"
                else "medium"
            )
            benchmark_title = (
                f"Investigate the gap versus {active_benchmark_label}"
                if active_benchmark_lead.get("tone") == "watch"
                else f"Use {active_benchmark_label} as the benchmark check"
            )
            benchmark_detail_parts = [
                (
                    f"{active_benchmark_lead['title']} is {active_benchmark_lead['gap_label'].lower()} "
                    f"{active_benchmark_label}. Treat that as the first external benchmark check before "
                    "changing hiring, mobility, or pay decisions."
                )
            ]
            if benchmark_context.get("coverage_status") == "partial" and benchmark_context.get("coverage_note"):
                benchmark_detail_parts.append(benchmark_context["coverage_note"])

            benchmark_evidence = [
                {"label": "Benchmark basis", "value": active_benchmark_label},
                {
                    "label": "Comparable metrics",
                    "value": (
                        f"{benchmark_context['applicable_metric_count']} / "
                        f"{benchmark_context['total_metric_count']}"
                    ),
                },
                {
                    "label": "Lead gap",
                    "value": f"{active_benchmark_lead['title']} ({active_benchmark_lead['gap_label']})",
                },
            ]
            if benchmark_context.get("unavailable_metrics"):
                benchmark_evidence.append(
                    {
                        "label": "Excluded metrics",
                        "value": self._format_label_list(
                            [item["title"] for item in benchmark_context["unavailable_metrics"]]
                        ),
                    }
                )

            lead_metric = observed_metrics.get(active_benchmark_lead["id"], {})
            lead_provenance = [lead_metric["provenance"]] if lead_metric.get("provenance") else []

            recommendations.append(
                {
                    "id": "recommendation_benchmark",
                    "title": benchmark_title,
                    "priority": benchmark_priority,
                    "detail": " ".join(benchmark_detail_parts),
                    "review_required": bool(lead_metric.get("provenance", {}).get("human_review_required")),
                    "evidence_bundle": bundle(
                        benchmark_title,
                        "Benchmark-led recommendation grounded in the currently selected comparison basis.",
                        benchmark_evidence,
                        lead_provenance,
                        "recommendation_benchmark",
                        review_required=bool(lead_metric.get("provenance", {}).get("human_review_required")),
                    ),
                }
            )
        if top_vacancy:
            recommendations.append(
                {
                    "id": "recommendation_hiring_focus",
                    "title": f"Focus hiring analysis on {top_vacancy['sector_label']}",
                    "priority": "high" if hiring_pressure >= 70 else "medium",
                    "detail": (
                        f"{top_vacancy['sector_label']} has the strongest vacancy signal at {top_vacancy['value']:.1f}%. "
                        "Investigate talent supply, compensation competitiveness, and channel mix there first."
                    ),
                    "review_required": True,
                    "evidence_bundle": bundle(
                        f"Focus hiring analysis on {top_vacancy['sector_label']}",
                        "This recommendation is grounded in current vacancy pressure.",
                        [
                            {"label": "Hiring pressure index", "value": f"{hiring_pressure}/100"},
                            {"label": "Top vacancy sector", "value": f"{top_vacancy['sector_label']} ({top_vacancy['value']:.1f}%)"},
                            {"label": "Selected geography", "value": filters.geography_label},
                        ],
                        [
                            (semantic_metrics.get("\1") or {}).get("provenance", {}),
                            charts["vacancy_by_sector"]["provenance"],
                        ],
                        "recommendation_hiring_focus",
                        review_required=True,
                    ),
                }
            )
        elif filters.geography != "EU27_AVG":
            recommendations.append(
                {
                    "id": "recommendation_benchmark",
                    "title": "Benchmark decisions against the EU27 market context",
                    "priority": "medium",
                    "detail": (
                        "Use the current market evidence as a benchmark before changing hiring, mobility, or pay strategy."
                    ),
                    "review_required": False,
                    "evidence_bundle": bundle(
                        "Benchmark against market context",
                        "Encourages evidence-based decision review using the current external benchmark.",
                        [
                            {"label": "Geography", "value": filters.geography_label},
                            {"label": "Employment rate", "value": format_percentage(employment_rate)},
                            {"label": "Unemployment rate", "value": format_percentage(unemployment_rate)},
                        ],
                        [
                            metric_provenance("employment_rate", "eurostat_lfs", "observed-v1", False),
                            metric_provenance("unemployment_rate", "eurostat_lfs", "observed-v1", False),
                        ],
                        "recommendation_benchmark",
                    ),
                }
            )
        if top_gap:
            recommendations.append(
                {
                    "id": "recommendation_equity_review",
                    "title": f"Review pay-equity risk in {top_gap['sector_label']}",
                    "priority": "high" if equity_risk >= 70 else "medium",
                    "detail": (
                        f"{top_gap['sector_label']} shows the widest market pay gap at {top_gap['value']:.1f}%. "
                        "Use this as a benchmark for internal pay-review readiness."
                    ),
                    "review_required": True,
                    "evidence_bundle": bundle(
                        f"Review pay-equity risk in {top_gap['sector_label']}",
                        "Grounded in observed market pay-gap signals.",
                        [
                            {"label": "Equity risk score", "value": f"{equity_risk}/100"},
                            {"label": "Top pay-gap sector", "value": f"{top_gap['sector_label']} ({top_gap['value']:.1f}%)"},
                            {"label": "Selected geography", "value": filters.geography_label},
                        ],
                        [
                            (semantic_metrics.get("\1") or {}).get("provenance", {}),
                            charts["pay_gap_by_sector"]["provenance"],
                        ],
                        "recommendation_equity_review",
                        review_required=True,
                    ),
                }
            )

        watchlist = [
            {
                "id": "watch_hiring_hotspot",
                "label": "Tightest hiring market",
                "tone": "watch",
                "value": top_vacancy["sector_label"] if top_vacancy else "Unavailable",
                "detail": f"{top_vacancy['value']:.1f}% vacancy rate in the latest quarter." if top_vacancy else "No vacancy hotspot available.",
                "evidence_bundle": bundle(
                    "Tightest hiring market",
                    "Current top sector hotspot from the vacancy ranking.",
                    [
                        {"label": "Selected geography", "value": filters.geography_label},
                        {"label": "Current hotspot", "value": top_vacancy["sector_label"] if top_vacancy else "Unavailable"},
                    ],
                    [charts["vacancy_by_sector"]["provenance"]],
                    "watch_hiring_hotspot",
                ),
            },
            {
                "id": "watch_equity_hotspot",
                "label": "Largest pay-gap hotspot",
                "tone": "watch" if equity_risk >= 70 else "neutral",
                "value": top_gap["sector_label"] if top_gap else "Unavailable",
                "detail": f"{top_gap['value']:.1f}% gap in the latest annual release." if top_gap else "No pay-gap hotspot available.",
                "evidence_bundle": bundle(
                    "Largest pay-gap hotspot",
                    "Current top market pay-gap sector for the selected geography.",
                    [
                        {"label": "Selected geography", "value": filters.geography_label},
                        {"label": "Current hotspot", "value": top_gap["sector_label"] if top_gap else "Unavailable"},
                    ],
                    [charts["pay_gap_by_sector"]["provenance"]],
                    "watch_equity_hotspot",
                    review_required=True,
                ),
            },
        ]

        return {
            "headline": headline,
            "summary": summary,
            "benchmark_context": benchmark_context,
            "scores": [
                {
                    "label": metric["title"],
                    "score": metric["value"],
                    "tone": "neutral" if metric["id"] == "transition_readiness" else (
                        "watch" if metric["id"] != "labour_resilience" and metric["value"] is not None and metric["value"] >= 70
                        else "good" if metric["id"] == "labour_resilience" and metric["value"] is not None and metric["value"] >= 70
                        else "neutral"
                    ),
                    "detail": metric["notes"] or metric["definition"],
                    "provenance": metric["provenance"],
                }
                for metric in semantic_metrics.values()
            ],
            "signals": signals,
            "recommendations": recommendations[:3],
            "watchlist": watchlist,
        }

    def _build_comparative_intelligence(
        self,
        filters: FilterState,
        observed_metrics: Dict[str, Dict[str, Any]],
        benchmark_geography: Optional[str] = None,
        benchmark_sector: Optional[str] = None,
    ) -> Dict[str, Any]:
        peer_group = self._build_peer_group(filters, observed_metrics)
        comparison_targets = self._resolve_comparison_targets(filters, benchmark_geography, benchmark_sector)
        metrics = []

        for metric_id in OBSERVED_METRIC_IDS:
            metric = observed_metrics.get(metric_id)
            if not metric:
                continue
            metric["comparisons"] = self._build_metric_comparisons(metric, filters, peer_group, comparison_targets)
            scope_coverage = self._scope_coverage(
                filters,
                has_data=metric.get("value") is not None,
                sector_grain=OBSERVED_METRIC_CONFIG[metric["id"]]["default_sector"] is not None,
            )
            metric["coverage"] = {
                **scope_coverage,
                "sector_scope": metric.get("sector_scope_label", "Whole labour market"),
                "notes": [
                    scope_coverage["note"],
                    "Observed values are grounded in the current country-level marts.",
                    "Benchmark confidence drops when the comparison basis is proxy-derived or sparse.",
                    "Direct sector comparisons only appear for metrics with live sector-grain support.",
                ],
            }
            metrics.append(metric)

        if comparison_targets["market"]["status"] == "ready":
            default_benchmark = "market"
        elif comparison_targets["sector"]["status"] == "ready":
            default_benchmark = "sector"
        else:
            default_benchmark = "eu" if filters.geography != "EU27_AVG" else "prior_period"
        benchmark_options = []
        for benchmark_id, meta in COMPARISON_BENCHMARKS.items():
            available_metrics, unavailable_metrics = self._comparison_metric_sets(metrics, benchmark_id)
            available = [metric["comparisons"][benchmark_id] for metric in available_metrics]
            target = comparison_targets.get(benchmark_id, {})
            comparable_metric_titles = [metric["title"] for metric in available_metrics]
            unavailable_titles = [item["title"] for item in unavailable_metrics]
            is_available = bool(available)
            if available and not unavailable_metrics:
                coverage_note = f"All {len(metrics)} observed metrics are currently comparable on this basis."
            elif available:
                unavailable_verb = "remains" if len(unavailable_titles) == 1 else "remain"
                coverage_note = (
                    f"{len(available_metrics)} of {len(metrics)} observed metrics are currently comparable on this basis. "
                    f"{self._format_label_list(unavailable_titles)} {unavailable_verb} unavailable."
                )
            else:
                coverage_note = "No observed metrics are currently comparable on this basis."

            lead_metric = None
            if available_metrics:
                lead_source = max(
                    available_metrics,
                    key=lambda item: abs(float(item["comparisons"][benchmark_id]["delta"] or 0)),
                )
                lead_comparison = lead_source["comparisons"][benchmark_id]
                lead_metric = {
                    "id": lead_source["id"],
                    "title": lead_source["title"],
                    "delta": lead_comparison["delta"],
                    "gap_label": lead_comparison["gap_label"],
                    "tone": lead_comparison["tone"],
                    "unit": lead_source["unit"],
                }

            benchmark_options.append(
                {
                    "id": benchmark_id,
                    "label": meta["label"],
                    "availability": "available" if is_available else "unavailable",
                    "benchmark_status": self._effective_benchmark_status(meta["benchmark_status"], is_available),
                    "confidence": self._aggregate_confidence(item["confidence"] for item in available),
                    "coverage_status": (
                        "unavailable"
                        if not available
                        else "partial"
                        if unavailable_metrics or any(item["coverage_status"] != "full" for item in available)
                        else "full"
                    ),
                    "selected_target": available[0].get("selected_target") if available else target.get("selected"),
                    "applicable_metric_count": len(available),
                    "total_metric_count": len(metrics),
                    "available_metrics": comparable_metric_titles,
                    "unavailable_metrics": unavailable_metrics,
                    "coverage_note": coverage_note,
                    "lead_metric": lead_metric,
                    "description": (
                        f"{available[0]['notes'][0]} {coverage_note}"
                        if available
                        else (target.get("notes", [f"{meta['label']} is unavailable for the current filter state."])[0])
                    ),
                }
            )

        selected_benchmark = next(
            (option for option in benchmark_options if option["id"] == default_benchmark),
            benchmark_options[0] if benchmark_options else {},
        )

        eu_employment = observed_metrics.get("employment_rate", {}).get("comparisons", {}).get("eu")
        eu_unemployment = observed_metrics.get("unemployment_rate", {}).get("comparisons", {}).get("eu")
        peer_vacancy = observed_metrics.get("vacancy_rate", {}).get("comparisons", {}).get("peer")
        prior_gap = observed_metrics.get("gender_pay_gap", {}).get("comparisons", {}).get("prior_period")
        market_employment = observed_metrics.get("employment_rate", {}).get("comparisons", {}).get("market")
        sector_vacancy = observed_metrics.get("vacancy_rate", {}).get("comparisons", {}).get("sector")

        summary_parts = []
        active_benchmark_label = (
            (selected_benchmark.get("selected_target") or {}).get("label")
            or selected_benchmark.get("label")
            or "the active benchmark"
        )
        if selected_benchmark.get("availability") == "available" and selected_benchmark.get("lead_metric"):
            lead_metric = selected_benchmark["lead_metric"]
            summary_parts.append(
                f"Active benchmark basis is {active_benchmark_label}; {lead_metric['title']} is {lead_metric['gap_label'].lower()}."
            )
            if selected_benchmark.get("coverage_status") == "partial" and selected_benchmark.get("coverage_note"):
                summary_parts.append(selected_benchmark["coverage_note"])

        if (
            default_benchmark != "market"
            and market_employment
            and market_employment.get("available")
            and market_employment.get("selected_target")
        ):
            summary_parts.append(
                f"Against {market_employment['selected_target']['label']}, employment rate is {market_employment['gap_label'].lower()}."
            )
        if (
            default_benchmark != "sector"
            and sector_vacancy
            and sector_vacancy.get("available")
            and sector_vacancy.get("selected_target")
        ):
            summary_parts.append(
                f"{filters.sector_label} vacancy pressure is {sector_vacancy['gap_label'].lower()} {sector_vacancy['selected_target']['label']}."
            )
        if default_benchmark != "eu" and eu_employment and eu_employment.get("available"):
            summary_parts.append(
                f"{filters.geography_label} sits {eu_employment['gap_label'].lower()} the EU27 proxy average on employment rate."
            )
        if default_benchmark != "eu" and eu_unemployment and eu_unemployment.get("available"):
            summary_parts.append(
                f"Unemployment is {eu_unemployment['gap_label'].lower()} the EU27 proxy average."
            )
        if default_benchmark != "peer" and peer_vacancy and peer_vacancy.get("available"):
            summary_parts.append(
                f"Vacancy pressure is {peer_vacancy['gap_label'].lower()} the peer-country basket."
            )
        if default_benchmark != "prior_period" and prior_gap and prior_gap.get("available"):
            summary_parts.append(
                f"The gender pay gap is {prior_gap['gap_label'].lower()} the prior period."
            )
        if not summary_parts:
            summary_parts.append(
                "Comparative intelligence is only partially available for this filter state because one or more benchmark bases are missing."
            )

        notes = [
            "Country-level EU, peer-country, and prior-period benchmark comparisons are live in Phase 2.",
            "EU and peer benchmarks remain proxy constructs until official EU aggregates and deeper regional coverage are modeled.",
            "Direct market-to-market comparisons are live only for country selections supported by the current marts.",
            "Sector-to-sector comparisons are live only for vacancy rate and gender pay gap because those are the current sector-grain signals.",
        ]
        if not any(grain["id"] == "nuts2" and grain["status"] == "live" for grain in self._grain_statuses()):
            notes.append("NUTS 2 comparative rollout is still blocked by source coverage in the active signal set.")

        confidence = selected_benchmark.get("confidence", "medium")
        if filters.geography == "EU27_AVG":
            confidence = self._aggregate_confidence(
                metric["comparisons"]["prior_period"]["confidence"]
                for metric in metrics
                if metric["comparisons"]["prior_period"]["available"]
            )

        return {
            "default_benchmark": default_benchmark,
            "benchmark_options": benchmark_options,
            "confidence": confidence,
            "coverage_status": "partial" if any(option["benchmark_status"] == "proxy" for option in benchmark_options) else "full",
            "summary": " ".join(summary_parts),
            "notes": notes,
            "peer_group": peer_group,
            "targets": comparison_targets,
            "selected_benchmark": selected_benchmark,
        }

    def _comparison_option(
        self,
        comparison_layer: Dict[str, Any],
        benchmark_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        options = comparison_layer.get("benchmark_options", [])
        if benchmark_id:
            return next((item for item in options if item["id"] == benchmark_id), {})
        return comparison_layer.get("selected_benchmark", options[0] if options else {})

    def _comparison_basis_context(
        self,
        comparison_layer: Dict[str, Any],
        benchmark_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        option = self._comparison_option(comparison_layer, benchmark_id)
        if not option:
            return None

        selected_target = option.get("selected_target") or {}
        option_id = option.get("id")
        target_label = selected_target.get("label") or option.get("label") or "Benchmark"
        analyst_label = option.get("label") or "Benchmark"

        if option_id == "market" and selected_target:
            analyst_label = f"Selected market ({target_label})"
        elif option_id == "sector" and selected_target:
            analyst_label = f"Selected sector ({target_label})"
        elif option_id == "eu":
            analyst_label = "EU27 proxy average"
        elif option_id == "peer":
            analyst_label = "Peer-country basket"
        elif option_id == "prior_period":
            analyst_label = "Prior period"

        return {
            "id": option_id,
            "label": option.get("label") or analyst_label,
            "analyst_label": analyst_label,
            "target_label": target_label,
            "availability": option.get("availability", "unavailable"),
            "benchmark_status": option.get("benchmark_status", "unavailable"),
            "confidence": option.get("confidence", "low"),
            "coverage_status": option.get("coverage_status", "unavailable"),
            "coverage_note": option.get("coverage_note", ""),
            "description": option.get("description", ""),
            "applicable_metric_count": option.get("applicable_metric_count", 0),
            "total_metric_count": option.get("total_metric_count", 0),
            "available_metrics": option.get("available_metrics", []),
            "unavailable_metrics": option.get("unavailable_metrics", []),
            "selected_target": selected_target or None,
        }

    def _comparison_limitations(self, benchmark_context: Optional[Dict[str, Any]]) -> List[str]:
        if not benchmark_context:
            return [
                "Claims are grounded in the current country-level marts, and NUTS 2 remains blocked until the active data and model layers support it."
            ]

        limitations = [
            "Claims are grounded in the current country-level marts, and NUTS 2 remains blocked until the active data and model layers support it."
        ]

        benchmark_id = benchmark_context.get("id")
        if benchmark_id == "eu":
            limitations.append(
                "The EU benchmark is a proxy average across country observations because the marts do not yet expose an official EU aggregate row."
            )
        elif benchmark_id == "peer":
            limitations.append(
                "Peer-country baskets are proxy constructs built from the nearest comparable country profiles across the currently observed metrics."
            )
        elif benchmark_id == "market":
            limitations.append(
                "Direct market comparisons are same-period country-to-country checks within the current marts, not regional or NUTS 2 comparisons."
            )
        elif benchmark_id == "sector":
            limitations.append(
                "Sector-versus-sector answers only cover metrics with live sector-grain support, so whole-market metrics remain excluded."
            )
        elif benchmark_id == "prior_period":
            limitations.append(
                "Prior-period answers compare the same country-level scope against the immediately preceding observed period."
            )

        coverage_note = (benchmark_context.get("coverage_note") or "").strip()
        if coverage_note:
            limitations.append(coverage_note)

        return limitations

    def _benchmark_citation_sentence(self, benchmark_context: Optional[Dict[str, Any]]) -> str:
        if not benchmark_context:
            return ""

        applicable_metric_count = benchmark_context.get("applicable_metric_count", 0)
        total_metric_count = benchmark_context.get("total_metric_count", 0)
        metric_scope = (
            f" across {applicable_metric_count} of {total_metric_count} observed metrics"
            if total_metric_count
            else ""
        )
        citation = (
            f"Benchmark basis: {benchmark_context['analyst_label']}. "
            f"Benchmark status is {benchmark_context['benchmark_status']}, confidence is {benchmark_context['confidence']}, "
            f"and coverage is {benchmark_context['coverage_status']}{metric_scope}."
        )

        coverage_note = (benchmark_context.get("coverage_note") or "").strip()
        coverage_is_metric_limited = benchmark_context.get("applicable_metric_count", 0) < benchmark_context.get(
            "total_metric_count",
            0,
        )
        if coverage_note and (benchmark_context.get("coverage_status") == "unavailable" or coverage_is_metric_limited):
            citation = f"{citation} Coverage limit: {coverage_note}"

        return citation

    def _build_copilot_contract(self, overview: Dict[str, Any]) -> Dict[str, Any]:
        provenance_items = [
            item.get("provenance")
            for item in [*overview.get("metrics", []), *overview.get("semantic_metrics", [])]
            if item.get("provenance")
        ]
        source_ids = sorted(
            {
                provenance.get("source_id")
                for provenance in provenance_items
                if provenance.get("source_id")
            }
        )
        review_metric_ids = sorted(
            {
                provenance.get("metric_id")
                for provenance in provenance_items
                if provenance.get("human_review_required")
            }
        )
        benchmark = self._comparison_basis_context(overview.get("comparisons", {}))

        return {
            "status": "live",
            "contract_version": "phase-5-grounded-copilot-v1",
            "mode": "retrieval_bounded",
            "approved_retrieval_boundaries": [
                "observed_metrics",
                "semantic_metrics",
                "comparisons",
                "intelligence",
                "internal_data_status",
                "company_benchmark",
                "pay_transparency",
                "governance_events",
            ],
            "blocked_behaviors": [
                "No unsupported formulas in prompts.",
                "No autonomous employment decisions.",
                "No company-specific claims unless trusted internal marts are active.",
                "No sensitive workflow action without a governance event and human approval.",
            ],
            "answer_requirements": [
                "evidence",
                "provenance",
                "confidence",
                "review_context",
                "coverage_limits",
            ],
            "semantic_sources": source_ids,
            "active_benchmark_basis": benchmark,
            "review_context": {
                "human_review_metric_ids": review_metric_ids,
                "governance_integrity": overview["governance"]["integrity"],
                "recent_event_count": len(overview["governance"].get("recent_events", [])),
            },
        }

    def _build_executive_brief(self, overview: Dict[str, Any]) -> Dict[str, Any]:
        filters = overview["filters"]["applied"]
        prior_context = self._comparison_basis_context(overview.get("comparisons", {}), "prior_period")
        prior_changes = []
        for metric in overview.get("metrics", []):
            comparison = metric.get("comparisons", {}).get("prior_period", {})
            if not comparison.get("available"):
                continue
            prior_changes.append(
                {
                    "metric_id": metric["id"],
                    "title": metric["title"],
                    "current_value": metric.get("value"),
                    "unit": metric.get("unit"),
                    "delta": comparison.get("delta"),
                    "delta_label": format_signed_delta(comparison.get("delta"), metric.get("unit", "%")),
                    "benchmark_period": comparison.get("benchmark_period"),
                    "tone": comparison.get("tone", "neutral"),
                    "provenance": metric.get("provenance"),
                }
            )
        prior_changes.sort(key=lambda item: abs(float(item["delta"] or 0)), reverse=True)

        top_recommendations = overview.get("intelligence", {}).get("recommendations", [])[:3]
        evidence = [
            {"label": metric["title"], "value": f"{metric['value']:.1f}{metric['unit']}"}
            for metric in overview.get("metrics", [])
            if metric.get("value") is not None
        ][:4]
        provenance = [
            metric["provenance"]
            for metric in overview.get("metrics", [])[:3]
            if metric.get("provenance")
        ]

        return {
            "status": "ready",
            "brief_type": "executive_workforce_brief",
            "brief_version": "phase-5-brief-v1",
            "title": f"{filters['geography_label']} workforce brief",
            "cadence_options": [
                {
                    "id": "weekly_executive_update",
                    "label": "Weekly executive update",
                    "schedule_hint": "Monday 09:00 local time",
                    "requires_approval": False,
                },
                {
                    "id": "monthly_compliance_pack",
                    "label": "Monthly compliance evidence pack",
                    "schedule_hint": "First business day 09:00 local time",
                    "requires_approval": True,
                },
            ],
            "summary": {
                "headline": overview["intelligence"]["headline"],
                "body": overview["intelligence"]["summary"],
                "confidence": overview.get("comparisons", {}).get("confidence", "medium"),
            },
            "what_changed": {
                "basis": prior_context,
                "items": prior_changes[:4],
            },
            "why_it_matters": [
                {
                    "title": recommendation["title"],
                    "priority": recommendation["priority"],
                    "detail": recommendation["detail"],
                    "review_required": recommendation.get("review_required", False),
                }
                for recommendation in top_recommendations
            ],
            "evidence": evidence,
            "provenance": provenance,
            "governance_target": {
                "target_type": "brief",
                "target_id": f"executive_brief::{filters['geography']}::{filters['sector']}::{filters['period']}",
            },
        }

    def _build_workflow_automation(self, overview: Dict[str, Any]) -> Dict[str, Any]:
        semantic_by_id = {metric["id"]: metric for metric in overview.get("semantic_metrics", [])}
        filters = overview["filters"]["applied"]
        alerts: List[Dict[str, Any]] = []

        def semantic_score(metric_id: str) -> Optional[float]:
            value = semantic_by_id.get(metric_id, {}).get("value")
            return float(value) if value is not None else None

        hiring_pressure = semantic_score("hiring_pressure_index")
        equity_risk = semantic_score("equity_risk_score")
        labour_resilience = semantic_score("labour_resilience")

        if hiring_pressure is not None and hiring_pressure >= 70:
            alerts.append(
                {
                    "id": "alert_hiring_pressure",
                    "title": "Hiring pressure threshold crossed",
                    "severity": "high",
                    "threshold": "hiring_pressure_index >= 70",
                    "current_value": round(hiring_pressure),
                    "recommended_handoff": "Open a recruiter-capacity and channel-mix review.",
                    "requires_approval": True,
                    "evidence_bundle": semantic_by_id["hiring_pressure_index"].get("evidence_bundle"),
                    "governance_target": {"target_type": "workflow_alert", "target_id": "alert_hiring_pressure"},
                }
            )
        if equity_risk is not None and equity_risk >= 70:
            alerts.append(
                {
                    "id": "alert_equity_risk",
                    "title": "Pay-equity risk threshold crossed",
                    "severity": "high",
                    "threshold": "equity_risk_score >= 70",
                    "current_value": round(equity_risk),
                    "recommended_handoff": "Prepare a pay-equity evidence pack for human review.",
                    "requires_approval": True,
                    "evidence_bundle": (semantic_by_id.get("equity_risk_score") or {}).get("evidence_bundle"),
                    "governance_target": {"target_type": "workflow_alert", "target_id": "alert_equity_risk"},
                }
            )
        if labour_resilience is not None and labour_resilience < 55:
            alerts.append(
                {
                    "id": "alert_labour_resilience",
                    "title": "Labour resilience watch threshold crossed",
                    "severity": "medium",
                    "threshold": "labour_resilience < 55",
                    "current_value": round(labour_resilience),
                    "recommended_handoff": "Attach the labour-resilience brief to workforce planning review.",
                    "requires_approval": False,
                    "evidence_bundle": semantic_by_id["labour_resilience"].get("evidence_bundle"),
                    "governance_target": {"target_type": "workflow_alert", "target_id": "alert_labour_resilience"},
                }
            )

        pay_transparency = overview.get("pay_transparency", {})
        if pay_transparency.get("available") and pay_transparency.get("summary", {}).get("unresolved_review_item_count", 0) > 0:
            alerts.append(
                {
                    "id": "alert_pay_transparency_review",
                    "title": "Pay-transparency review items need approval",
                    "severity": "high",
                    "threshold": "unresolved_review_item_count > 0",
                    "current_value": pay_transparency["summary"]["unresolved_review_item_count"],
                    "recommended_handoff": "Route unresolved category review items to compliance/legal review.",
                    "requires_approval": True,
                    "evidence_bundle": {
                        "title": pay_transparency["title"],
                        "summary": pay_transparency["note"],
                        "evidence": [
                            {
                                "label": "Unresolved review items",
                                "value": str(pay_transparency["summary"]["unresolved_review_item_count"]),
                            },
                            {"label": "Formula version", "value": pay_transparency["formula_version"]},
                        ],
                        "provenance": pay_transparency.get("provenance", []),
                        "governance_target": pay_transparency.get("governance_target"),
                    },
                    "governance_target": pay_transparency.get("governance_target"),
                }
            )

        handoffs = [
            {
                "id": "handoff_executive_brief",
                "title": "Generate executive brief",
                "status": "ready",
                "approval_checkpoint": "Analyst reviews generated brief before distribution.",
                "target_audience": "executive_leadership",
                "governance_target": {
                    "target_type": "workflow_handoff",
                    "target_id": f"executive_brief::{filters['geography']}::{filters['sector']}",
                },
            },
            {
                "id": "handoff_evidence_pack",
                "title": "Export evidence pack",
                "status": "ready",
                "approval_checkpoint": "Export is logged to the governance hash chain.",
                "target_audience": "people_analytics_compliance",
                "governance_target": {
                    "target_type": "workflow_handoff",
                    "target_id": f"evidence_pack::{filters['geography']}::{filters['sector']}",
                },
            },
            {
                "id": "handoff_compliance_review",
                "title": "Route sensitive review items",
                "status": "ready" if pay_transparency.get("available") else "blocked",
                "approval_checkpoint": "Compliance/legal reviewer must approve, override, or reverse each sensitive item.",
                "target_audience": "legal_compliance_review",
                "blocked_reason": None if pay_transparency.get("available") else pay_transparency.get("note"),
                "governance_target": {
                    "target_type": "workflow_handoff",
                    "target_id": f"compliance_review::{filters['geography']}::{filters['sector']}",
                },
            },
        ]

        scheduled_briefs = [
            {
                "id": "weekly_executive_update",
                "label": "Weekly executive update",
                "status": "configured_template",
                "cadence": "weekly",
                "output": "executive_workforce_brief",
                "approval_required": False,
                "default_rrule": "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0",
            },
            {
                "id": "monthly_compliance_evidence_pack",
                "label": "Monthly compliance evidence pack",
                "status": "configured_template",
                "cadence": "monthly",
                "output": "compliance_evidence_pack",
                "approval_required": True,
                "default_rrule": "FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0",
            },
        ]
        active_scope = {
            "country": filters["country"],
            "geography": filters["geography"],
            "sector": filters["sector"],
            "period": filters["period"],
        }
        configured_schedules = [
            schedule
            for schedule in self.automation_schedules
            if schedule.get("filters") == active_scope
        ]

        return {
            "status": "live",
            "automation_version": "phase-5-workflow-v1",
            "policy": {
                "autonomous_decisions_allowed": False,
                "sensitive_actions_require_human_approval": True,
                "governance_events_required": True,
            },
            "alerts": alerts,
            "scheduled_briefs": scheduled_briefs,
            "configured_schedules": configured_schedules,
            "handoffs": handoffs,
        }

    def configure_automation_schedule(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        template_id = str(payload.get("template_id") or "").strip()
        if template_id not in {"weekly_executive_update", "monthly_compliance_evidence_pack"}:
            raise ValueError(f"Unsupported schedule template: {template_id}")

        request_filters = {
            "country": payload.get("country") or "ALL",
            "geography": payload.get("geography") or "EU27_AVG",
            "sector": payload.get("sector") or "ALL",
            "period": payload.get("period") or "latest",
        }
        overview = self.build_overview(**request_filters)
        filters = {
            key: overview["filters"]["applied"][key]
            for key in ["country", "geography", "sector", "period"]
        }
        template = next(
            item for item in overview["automation"]["scheduled_briefs"] if item["id"] == template_id
        )
        approved = bool(payload.get("approved"))
        if template.get("approval_required") and not approved:
            raise ValueError(f"Schedule template {template_id} requires human approval.")

        schedule = {
            "schedule_id": self._schedule_id(template_id, filters),
            "template_id": template_id,
            "label": template["label"],
            "status": "active",
            "cadence": template["cadence"],
            "rrule": payload.get("rrule") or template["default_rrule"],
            "output": template["output"],
            "approval_required": template["approval_required"],
            "approved": approved or not template["approval_required"],
            "filters": filters,
            "created_by": (payload.get("actor") or "dashboard_user").strip() or "dashboard_user",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_generated_at": None,
            "governance_target": {
                "target_type": "automation_schedule",
                "target_id": self._schedule_id(template_id, filters),
            },
        }
        remaining = [
            item
            for item in self.automation_schedules
            if item.get("schedule_id") != schedule["schedule_id"]
        ]
        self.automation_schedules = [schedule, *remaining][:50]
        self._persist_automation_schedules()
        self.record_governance_event(
            {
                "action_code": "approved",
                "target_type": "automation_schedule",
                "target_id": schedule["schedule_id"],
                "actor": schedule["created_by"],
                "context": {
                    "template_id": template_id,
                    "rrule": schedule["rrule"],
                    "filters": filters,
                },
            }
        )
        return schedule

    def build_scheduled_output(self, schedule_id: str) -> Dict[str, Any]:
        schedule = next(
            (item for item in self.automation_schedules if item.get("schedule_id") == schedule_id),
            None,
        )
        if not schedule:
            raise ValueError(f"Unknown automation schedule: {schedule_id}")
        if schedule.get("status") != "active":
            raise ValueError(f"Automation schedule is not active: {schedule_id}")

        filters = schedule["filters"]
        if schedule["output"] == "executive_workforce_brief":
            output = self.build_overview(**filters)["brief"]
            output_type = "brief"
        elif schedule["output"] == "compliance_evidence_pack":
            output = self.build_evidence_pack(**filters)
            output_type = "evidence_pack"
        else:
            raise ValueError(f"Unsupported scheduled output: {schedule['output']}")

        generated_at = datetime.now(timezone.utc).isoformat()
        schedule["last_generated_at"] = generated_at
        self._persist_automation_schedules()
        self.record_governance_event(
            {
                "action_code": "exported",
                "target_type": "scheduled_output",
                "target_id": schedule_id,
                "actor": "automation_runner",
                "context": {
                    "output_type": output_type,
                    "filters": filters,
                },
            }
        )
        return {
            "generated_at": generated_at,
            "schedule": schedule,
            "output_type": output_type,
            "output": output,
            "governance": self.build_governance_payload(),
        }

    def ingest_uploaded_payroll(
        self,
        csv_bytes: bytes,
    ) -> Dict[str, Any]:
        """
        Validates a payroll CSV upload, converts to parquet, updates the manifest.
        Returns a summary dict. Raises ValueError for validation failures.
        """
        import io
        import json
        from datetime import datetime, timezone

        import pandas as pd

        REQUIRED_COLUMNS = {
            "employee_id", "job_code", "country_code",
            "worker_category_id", "gender", "base_salary",
            "currency", "snapshot_date",
        }
        VALID_GENDERS = {"female", "male", "non_binary"}

        try:
            df = pd.read_csv(io.BytesIO(csv_bytes))
        except Exception as e:
            raise ValueError(f"Could not parse CSV: {e}") from e

        missing = REQUIRED_COLUMNS - set(df.columns.str.lower())
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

        # Normalise column names to lowercase
        df.columns = df.columns.str.lower()

        if len(df) < 10:
            raise ValueError(f"Upload must contain at least 10 employees. Got {len(df)}.")

        # Validate gender
        invalid_genders = set(df["gender"].str.lower().unique()) - VALID_GENDERS
        if invalid_genders:
            raise ValueError(
                f"Invalid gender values: {invalid_genders}. Must be: female, male, non_binary"
            )

        # Validate salary
        df["base_salary"] = pd.to_numeric(df["base_salary"], errors="coerce")
        if df["base_salary"].isna().any() or (df["base_salary"] <= 0).any():
            raise ValueError("base_salary must be a positive number for all rows.")

        # Validate snapshot_date
        try:
            df["snapshot_date"] = pd.to_datetime(df["snapshot_date"]).dt.date
        except Exception as e:
            raise ValueError(f"snapshot_date could not be parsed as a date: {e}") from e

        if (pd.to_datetime(df["snapshot_date"]) > pd.Timestamp.now()).any():
            raise ValueError("snapshot_date cannot be in the future.")

        # Validate country_code
        if not df["country_code"].str.len().eq(2).all():
            raise ValueError("country_code must be a 2-letter ISO code for all rows.")

        # Rename base_salary → base_pay_amount to match existing pipeline
        df = df.rename(columns={"base_salary": "base_pay_amount", "currency": "pay_currency"})

        # Add pipeline-required columns with defaults
        if "employment_status" not in df.columns:
            df["employment_status"] = "active"
        if "version" not in df.columns:
            df["version"] = "uploaded-v1"
        if "job_title" not in df.columns:
            df["job_title"] = df["job_code"]

        # Warnings
        warnings = []
        job_arch_path = self.internal_data_dir / "job_architecture.parquet"
        if job_arch_path.exists():
            import pyarrow.parquet as pq
            arch_df = pq.read_table(job_arch_path).to_pandas()
            known_codes = set(arch_df["job_code"])
            unknown_codes = set(df["job_code"]) - known_codes
            if unknown_codes:
                warnings.append(
                    f"{len(unknown_codes)} job_codes not in job architecture — "
                    f"those rows will have no NACE/ESCO mapping: {sorted(unknown_codes)[:5]}"
                )

        # Write parquet
        out_path = self.internal_data_dir / "payroll_snapshot.parquet"
        df.to_parquet(out_path, index=False)

        # Update manifest
        manifest_path = self._internal_manifest_path()
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "assets": [
                {
                    "asset_type": "internal_payroll_snapshot",
                    "version": "uploaded-v1",
                    "record_count": len(df),
                    "output": str(out_path),
                    "trusted_for_company_claims": True,
                },
            ],
        }
        # Preserve other assets if manifest already exists
        existing = self._internal_manifest_assets()
        for asset_type, asset in existing.items():
            if asset_type != "internal_payroll_snapshot":
                manifest["assets"].append(asset)

        with manifest_path.open("w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        snapshot_date = str(df["snapshot_date"].max())
        record_count = len(df)

        return {
            "status": "accepted",
            "record_count": record_count,
            "snapshot_date": snapshot_date,
            "validation": {
                "passed": True,
                "warnings": warnings,
            },
            "dbt_run": "pending",
        }

    def _build_egapro_peer_benchmark(
        self,
        filters: FilterState,
    ) -> Dict[str, Any]:
        """Returns Égapro sector peer benchmark when country=FR and mart available."""
        def unavailable(reason: str) -> Dict[str, Any]:
            return {"available": False, "note": reason}

        if filters.country != "FR":
            return unavailable("Égapro peer benchmark is only available for France.")

        if "mart_egapro_sector_benchmark" not in self._available_tables():
            return unavailable("Égapro benchmark mart not yet built. Run dbt to generate it.")

        # Map sector filter to NACE section
        nace_section = filters.sector[:1] if filters.sector and filters.sector != "ALL" else "J"

        rows = self._query(
            """
            select
                year,
                nace_section,
                size_band,
                company_count,
                round(p25_score) as p25_score,
                round(p50_score) as p50_score,
                round(p75_score) as p75_score,
                round(mean_score, 1) as mean_score,
                round(p50_pay_gap_score) as p50_pay_gap_score
            from mart_egapro_sector_benchmark
            where nace_section = ?
              and year = (select max(year) from mart_egapro_sector_benchmark where nace_section = ?)
            order by size_band
            limit 10
            """,
            [nace_section, nace_section],
        )

        if not rows:
            return unavailable(
                f"No Égapro benchmark data available for NACE section {nace_section}."
            )

        # Return the largest available size band or the first row
        row = rows[0]

        return {
            "available": True,
            "year": int(row["year"]),
            "nace_section": row["nace_section"],
            "size_band": row["size_band"],
            "company_count": int(row["company_count"]),
            "p25_score": int(row["p25_score"]),
            "p50_score": int(row["p50_score"]),
            "p75_score": int(row["p75_score"]),
            "mean_score": float(row["mean_score"]),
            "note": (
                f"Based on {int(row['company_count'])} French companies in NACE section "
                f"{row['nace_section']} ({row['size_band']} employees), {int(row['year'])} Égapro data."
            ),
            "source_id": "egapro",
            "all_size_bands": rows,
        }

    def build_overview(
        self,
        country: str = "ALL",
        geography: str = "EU27_AVG",
        sector: str = "ALL",
        period: str = "latest",
        benchmark_geography: Optional[str] = None,
        benchmark_sector: Optional[str] = None,
    ) -> Dict[str, Any]:
        filters, options = self.resolve_filters(country, geography, sector, period)
        observed_metrics_list = [
            self._build_metric(metric_id, filters)
            for metric_id in OBSERVED_METRIC_IDS
        ]
        observed_metrics = {metric["id"]: metric for metric in observed_metrics_list if metric}
        comparisons = self._build_comparative_intelligence(
            filters,
            observed_metrics,
            benchmark_geography=benchmark_geography,
            benchmark_sector=benchmark_sector,
        )
        semantic_metrics_list = self._build_semantic_metrics(observed_metrics, filters)
        semantic_metrics = {metric["id"]: metric for metric in semantic_metrics_list}
        charts = self._build_charts(filters)
        intelligence = self._build_intelligence(filters, observed_metrics, semantic_metrics, charts, comparisons)
        internal_data = self._build_internal_data_status()
        company_benchmark = self._build_company_benchmark(filters, observed_metrics, internal_data)
        pay_transparency = self._build_pay_transparency_simulation(filters, internal_data)
        missing_observed_metric_ids = [
            metric_id
            for metric_id in OBSERVED_METRIC_IDS
            if metric_id not in observed_metrics
        ]
        notes = [
            "Phase 2 comparative intelligence is complete for country-level EU, peer-country, direct market, sector, and prior-period benchmarks.",
            "Current live geography coverage remains country-level; NUTS 2 and NUTS 3 stay blocked until the active signal set expands beyond country coverage.",
        ]
        if missing_observed_metric_ids:
            missing_titles = [
                OBSERVED_METRIC_CONFIG[metric_id]["title"]
                for metric_id in missing_observed_metric_ids
            ]
            notes.append(
                f"Some observed metrics are unavailable for this filter state: {', '.join(missing_titles)}."
            )
        def append_note_once(note: Optional[str]) -> None:
            if note and note not in notes:
                notes.append(note)

        append_note_once(internal_data["note"])
        if company_benchmark.get("available"):
            notes.append(
                f"Company-aware preview is active for {company_benchmark['worker_category']['label']} "
                f"using {company_benchmark['evidence_basis']} evidence."
            )
        else:
            append_note_once(company_benchmark["note"])
        if pay_transparency.get("available"):
            unresolved_count = pay_transparency["summary"]["unresolved_review_item_count"]
            notes.append(
                f"Phase 4 pay-transparency simulation is active with {unresolved_count} unresolved category review items."
            )
        else:
            append_note_once(pay_transparency["note"])

        overview = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "filters": {
                "applied": {
                    "country": filters.country,
                    "geography": filters.geography,
                    "geography_label": filters.geography_label,
                    "sector": filters.sector,
                    "sector_label": filters.sector_label,
                    "period": filters.period,
                },
                "options": options,
                "notes": notes,
            },
            "metrics": list(observed_metrics.values()),
            "comparisons": comparisons,
            "semantic_metrics": semantic_metrics_list,
            "charts": charts,
            "intelligence": intelligence,
            "internal_data": internal_data,
            "company_benchmark": company_benchmark,
            "pay_transparency": pay_transparency,
            "governance": self.build_governance_payload(),
        }
        overview["egapro_peer_benchmark"] = self._build_egapro_peer_benchmark(filters)
        overview["copilot"] = self._build_copilot_contract(overview)
        overview["brief"] = self._build_executive_brief(overview)
        overview["automation"] = self._build_workflow_automation(overview)
        return overview

    def answer_question(
        self,
        question: str,
        country: str = "ALL",
        geography: str = "EU27_AVG",
        sector: str = "ALL",
        period: str = "latest",
        benchmark_geography: Optional[str] = None,
        benchmark_sector: Optional[str] = None,
    ) -> Dict[str, Any]:
        overview = self.build_overview(
            country,
            geography,
            sector,
            period,
            benchmark_geography=benchmark_geography,
            benchmark_sector=benchmark_sector,
        )
        prompt = question.strip()
        normalized = prompt.lower()
        observed = {metric["id"]: metric for metric in overview["metrics"]}
        semantic = {metric["id"]: metric for metric in overview["semantic_metrics"]}
        top_vacancy = overview["charts"]["vacancy_by_sector"]["series"][0] if overview["charts"]["vacancy_by_sector"]["series"] else None
        top_gap = overview["charts"]["pay_gap_by_sector"]["series"][0] if overview["charts"]["pay_gap_by_sector"]["series"] else None
        comparison_layer = overview.get("comparisons", {})
        active_benchmark_context = self._comparison_basis_context(comparison_layer)
        internal_data = overview.get("internal_data", {})
        company_benchmark = overview.get("company_benchmark", {})
        pay_transparency = overview.get("pay_transparency", {})

        def observed_value(metric_id: str) -> Optional[float]:
            value = observed.get(metric_id, {}).get("value")
            return float(value) if value is not None else None

        def observed_display(metric_id: str, unit: str = "%") -> str:
            value = observed_value(metric_id)
            if value is None:
                return "Unavailable"
            return f"{value:.1f}{unit}"

        def observed_provenance(metric_id: str, source_id: str, formula_version: str, review_required: bool) -> Dict[str, Any]:
            metric = observed.get(metric_id)
            if metric and metric.get("provenance"):
                return metric["provenance"]
            return self._build_provenance(source_id, metric_id, formula_version, review_required)

        def response(
            category: str,
            confidence: str,
            answer: str,
            evidence: List[Dict[str, str]],
            provenance: List[Dict[str, Any]],
            follow_ups: Optional[List[str]] = None,
            benchmark_context: Optional[Dict[str, Any]] = None,
            limitations: Optional[List[str]] = None,
            evidence_basis: str = "external",
            coverage_override: Optional[Dict[str, Any]] = None,
            include_benchmark_citation: bool = True,
        ) -> Dict[str, Any]:
            resolved_benchmark = benchmark_context if benchmark_context is not None else active_benchmark_context
            citation = self._benchmark_citation_sentence(resolved_benchmark) if include_benchmark_citation else ""
            resolved_limitations = limitations if limitations is not None else self._comparison_limitations(resolved_benchmark)
            answer_text = f"{answer} {citation}".strip() if citation else answer
            resolved_coverage = coverage_override or {
                "status": resolved_benchmark.get("coverage_status", "unavailable")
                if resolved_benchmark
                else "unavailable",
                "summary": resolved_benchmark.get("coverage_note", "") if resolved_benchmark else "",
                "applicable_metric_count": resolved_benchmark.get("applicable_metric_count", 0)
                if resolved_benchmark
                else 0,
                "total_metric_count": resolved_benchmark.get("total_metric_count", 0)
                if resolved_benchmark
                else 0,
            }
            return {
                "question": prompt,
                "category": category,
                "confidence": confidence,
                "answer": answer_text,
                "evidence": evidence,
                "provenance": provenance,
                "follow_ups": follow_ups or comparison_follow_ups(),
                "benchmark_basis": resolved_benchmark,
                "coverage": resolved_coverage,
                "limitations": resolved_limitations,
                "applied_filters": overview["filters"]["applied"],
                "evidence_basis": evidence_basis,
                "internal_data_available": bool(internal_data.get("available")),
            }

        def comparison_follow_ups() -> List[str]:
            follow_ups: List[str] = []
            market_target = comparison_layer.get("targets", {}).get("market", {}).get("selected")
            sector_target = comparison_layer.get("targets", {}).get("sector", {}).get("selected")
            if market_target:
                follow_ups.append(f"How does this market compare with {market_target['label']}?")
            if sector_target and overview["filters"]["applied"]["sector"] != "ALL":
                follow_ups.append(
                    f"How does {overview['filters']['applied']['sector_label']} compare with {sector_target['label']}?"
                )
            follow_ups.extend(SUGGESTED_QUESTIONS)

            deduped = []
            seen = set()
            for item in follow_ups:
                if item in seen:
                    continue
                seen.add(item)
                deduped.append(item)
            return deduped

        def available_comparison_metrics(benchmark_id: str) -> List[Dict[str, Any]]:
            return [
                metric
                for metric in overview["metrics"]
                if metric.get("comparisons", {}).get(benchmark_id, {}).get("available")
            ]

        def top_comparison_gap(benchmark_id: str) -> Optional[Dict[str, Any]]:
            comparable = available_comparison_metrics(benchmark_id)
            if not comparable:
                return None
            return max(
                comparable,
                key=lambda metric: abs(float(metric["comparisons"][benchmark_id]["delta"] or 0)),
            )

        if any(
            keyword in normalized
            for keyword in [
                "scheduled brief",
                "schedule brief",
                "recurring brief",
                "executive update",
                "workflow",
                "handoff",
                "automation",
                "alerts",
                "alert",
            ]
        ):
            automation = overview["automation"]
            brief = overview["brief"]
            alert_count = len(automation.get("alerts", []))
            handoff_ready_count = len(
                [handoff for handoff in automation.get("handoffs", []) if handoff.get("status") == "ready"]
            )
            top_alert = automation["alerts"][0] if automation.get("alerts") else None
            return response(
                "automation",
                brief["summary"]["confidence"],
                (
                    f"Phase 5 automation is live in human-approved mode with {alert_count} active alerts, "
                    f"{len(automation['scheduled_briefs'])} scheduled-brief templates, and "
                    f"{handoff_ready_count} ready workflow handoffs. "
                    f"{top_alert['title'] + ' is the first alert to review.' if top_alert else 'No threshold alert is currently active.'}"
                ),
                [
                    {"label": "Active alerts", "value": str(alert_count)},
                    {"label": "Scheduled brief templates", "value": str(len(automation["scheduled_briefs"]))},
                    {"label": "Ready handoffs", "value": str(handoff_ready_count)},
                    {
                        "label": "Sensitive approval policy",
                        "value": "Human approval required",
                    },
                ],
                brief["provenance"],
                [
                    "Generate the executive summary.",
                    "What alerts are active?",
                    "What should HR leaders do next?",
                ],
                limitations=[
                    "Automation prepares briefs, alerts, and handoffs only; it does not execute employment decisions.",
                    "Sensitive workflow steps must be approved and logged through governance events.",
                ],
                include_benchmark_citation=False,
                coverage_override={
                    "status": "full",
                    "summary": "Workflow automation is bounded by the current evidence and governance contracts.",
                    "applicable_metric_count": len(overview["metrics"]),
                    "total_metric_count": len(overview["metrics"]),
                },
            )

        if any(
            keyword in normalized
            for keyword in [
                "pay transparency",
                "transparency exposure",
                "compliance simulation",
                "compliance simulator",
                "unresolved review",
                "review item",
                "category review",
            ]
        ):
            if pay_transparency.get("available"):
                summary = pay_transparency["summary"]
                top_item = pay_transparency["top_review_items"][0] if pay_transparency["top_review_items"] else None
                top_sentence = (
                    f" The highest-priority category is {top_item['worker_category']['label']} with a "
                    f"{top_item['internal_gap']:.1f}% internal gap."
                    if top_item
                    else ""
                )
                return response(
                    "compliance",
                    pay_transparency.get("confidence", "medium"),
                    (
                        f"The Phase 4 pay-transparency simulation reviewed {summary['category_count']} worker categories "
                        f"and found {summary['unresolved_review_item_count']} unresolved review items, "
                        f"{summary['observed_gap_count']} observed gaps, and "
                        f"{summary['justified_difference_count']} monitored low-risk differences."
                        f"{top_sentence}"
                    ),
                    [
                        {"label": "Unresolved review items", "value": str(summary["unresolved_review_item_count"])},
                        {"label": "Observed gaps", "value": str(summary["observed_gap_count"])},
                        {"label": "Formula version", "value": pay_transparency["formula_version"]},
                    ],
                    pay_transparency["provenance"],
                    [
                        "Which worker category deserves closer pay review?",
                        "Export the evidence pack.",
                        "Is this answer based on internal data, market data, or both?",
                    ],
                    limitations=[
                        pay_transparency["note"],
                        "The simulation does not decide whether a difference is legally justified; that requires documented human review.",
                    ],
                    evidence_basis=pay_transparency["evidence_basis"],
                    include_benchmark_citation=False,
                    coverage_override={
                        "status": pay_transparency["coverage_status"],
                        "summary": pay_transparency["note"],
                        "applicable_metric_count": summary["category_count"],
                        "total_metric_count": summary["category_count"],
                    },
                )

            return response(
                "compliance",
                "low",
                "The pay-transparency simulation is not active because trusted internal category-level pay data is not available for this scope.",
                [
                    {"label": "Simulation status", "value": "Unavailable"},
                    {"label": "Current basis", "value": pay_transparency.get("evidence_basis", "external")},
                ],
                [metric["provenance"] for metric in overview["metrics"][:2]],
                [
                    "How does this market compare to the EU benchmark?",
                    "What limits this comparison?",
                ],
                limitations=[pay_transparency.get("note", "Trusted internal data is required.")],
                evidence_basis=pay_transparency.get("evidence_basis", "external"),
                include_benchmark_citation=False,
                coverage_override={
                    "status": "unavailable",
                    "summary": pay_transparency.get("note", ""),
                    "applicable_metric_count": 0,
                    "total_metric_count": 1,
                },
            )

        if any(
            keyword in normalized
            for keyword in [
                "our pay",
                "internal pay",
                "company pay",
                "our compensation",
                "worker category",
                "pay review",
                "internal benchmark",
            ]
        ):
            if company_benchmark.get("available"):
                return response(
                    "company",
                    company_benchmark.get("confidence", "medium"),
                    (
                        f"For {company_benchmark['worker_category']['label']}, the internal pay gap is "
                        f"{company_benchmark['internal_value']:.1f}% versus a market pay-gap signal of "
                        f"{company_benchmark['market_value']:.1f}% for {overview['filters']['applied']['geography_label']} "
                        f"and {overview['filters']['applied']['sector_label']}. "
                        f"That is a {company_benchmark['delta_label']} gap to market."
                    ),
                    [
                        {"label": "Worker category", "value": company_benchmark["worker_category"]["label"]},
                        {"label": "Internal pay gap", "value": f"{company_benchmark['internal_value']:.1f}%"},
                        {"label": "Market pay-gap signal", "value": f"{company_benchmark['market_value']:.1f}%"},
                        {"label": "In-scope headcount", "value": str(company_benchmark["headcount"])},
                    ],
                    company_benchmark["provenance"],
                    [
                        "Is this answer based on internal data, market data, or both?",
                        "What should HR leaders do next?",
                        "What limits this comparison?",
                    ],
                    limitations=[
                        company_benchmark["note"],
                        "No company-specific claim is made unless the modeled internal benchmark mart is populated.",
                    ],
                    evidence_basis=company_benchmark["evidence_basis"],
                    include_benchmark_citation=False,
                    coverage_override={
                        "status": company_benchmark["coverage_status"],
                        "summary": company_benchmark["note"],
                        "applicable_metric_count": 1,
                        "total_metric_count": 1,
                    },
                )

            return response(
                "company",
                "low",
                "The modeled internal benchmark mart is not populated yet, so I cannot make a company-specific pay claim.",
                [
                    {"label": "Internal data status", "value": "Not modeled"},
                    {"label": "Current basis", "value": "External market data only"},
                ],
                [metric["provenance"] for metric in overview["metrics"][:2]],
                [
                    "Is this answer based on internal data, market data, or both?",
                    "How does this market compare to the EU benchmark?",
                    "What should HR leaders do next?",
                ],
                limitations=[
                    internal_data.get("note", "Internal data is not currently available."),
                    "Company-aware benchmarking is blocked until the internal dbt mart contains usable benchmark rows.",
                ],
                evidence_basis="external",
                include_benchmark_citation=False,
                coverage_override={
                    "status": "unavailable",
                    "summary": internal_data.get("note", ""),
                    "applicable_metric_count": 0,
                    "total_metric_count": 1,
                },
            )

        if any(
            keyword in normalized
            for keyword in [
                "based on internal data",
                "based on market data",
                "based on internal",
                "based on market",
                "internal data or market data",
                "internal or blended",
                "blended evidence",
            ]
        ):
            if company_benchmark.get("available"):
                return response(
                    "company",
                    company_benchmark.get("confidence", "medium"),
                    (
                        "This company-aware answer is currently based on blended evidence: "
                        "the modeled internal company benchmark mart plus the modeled external market pay-gap comparator."
                    ),
                    [
                        {"label": "Evidence basis", "value": company_benchmark["evidence_basis"]},
                        {"label": "Internal data status", "value": "Loaded"},
                        {"label": "Snapshot date", "value": company_benchmark.get("snapshot_date") or "Unknown"},
                    ],
                    company_benchmark["provenance"],
                    evidence_basis=company_benchmark["evidence_basis"],
                    include_benchmark_citation=False,
                    coverage_override={
                        "status": company_benchmark["coverage_status"],
                        "summary": company_benchmark["note"],
                        "applicable_metric_count": 1,
                        "total_metric_count": 1,
                    },
                    limitations=[company_benchmark["note"]],
                )

            return response(
                "company",
                "low",
                "The current answers are external-only because the internal company benchmark mart is not populated yet.",
                [
                    {"label": "Evidence basis", "value": "external"},
                    {"label": "Internal data status", "value": "Not modeled"},
                ],
                [metric["provenance"] for metric in overview["metrics"][:2]],
                evidence_basis="external",
                include_benchmark_citation=False,
                coverage_override={
                    "status": "unavailable",
                    "summary": internal_data.get("note", ""),
                    "applicable_metric_count": 0,
                    "total_metric_count": 1,
                },
                limitations=[internal_data.get("note", "Internal data is not currently available.")],
            )

        def comparison_provenance(benchmark_id: str) -> List[Dict[str, Any]]:
            comparable = available_comparison_metrics(benchmark_id)
            if comparable:
                return [metric["provenance"] for metric in comparable[:3]]
            return [metric["provenance"] for metric in overview["metrics"][:2]]

        def merged_limitations(
            benchmark_context: Optional[Dict[str, Any]],
            extras: Optional[List[str]] = None,
        ) -> List[str]:
            limitations = self._comparison_limitations(benchmark_context)
            for item in extras or []:
                if item and item not in limitations:
                    limitations.append(item)
            return limitations

        def prior_period_change_story() -> Dict[str, Any]:
            comparable = available_comparison_metrics("prior_period")
            worsening: List[Dict[str, Any]] = []
            improving: List[Dict[str, Any]] = []

            for metric in comparable:
                comparison = metric["comparisons"]["prior_period"]
                delta = float(comparison["delta"] or 0)
                desired_direction = OBSERVED_METRIC_CONFIG[metric["id"]]["desired_direction"]
                worsening_score = delta if desired_direction == "down" else -delta
                row = {
                    "metric": metric,
                    "comparison": comparison,
                    "worsening_score": worsening_score,
                    "abs_delta": abs(delta),
                }
                if worsening_score > 0:
                    worsening.append(row)
                elif worsening_score < 0:
                    improving.append(row)

            worsening.sort(key=lambda item: (item["worsening_score"], item["abs_delta"]), reverse=True)
            improving.sort(key=lambda item: (abs(item["worsening_score"]), item["abs_delta"]), reverse=True)

            return {
                "comparable": comparable,
                "worsening": worsening,
                "improving": improving,
                "lead_worsening": worsening[0] if worsening else None,
                "lead_change": max(
                    comparable,
                    key=lambda metric: abs(float(metric["comparisons"]["prior_period"]["delta"] or 0)),
                ) if comparable else None,
            }

        def benchmark_from_question() -> str:
            market_target = comparison_layer.get("targets", {}).get("market", {}).get("selected")
            sector_target = comparison_layer.get("targets", {}).get("sector", {}).get("selected")
            market_terms = ["selected market", "other market", "another market", "market vs market", "country vs country"]
            sector_terms = ["selected sector", "other sector", "another sector", "sector vs sector"]
            if market_target:
                market_terms.extend([market_target["label"].lower(), market_target["id"].lower()])
            if sector_target:
                sector_terms.extend([sector_target["label"].lower(), sector_target["id"].lower()])
            if any(keyword in normalized for keyword in ["eu benchmark", "eu27", "european benchmark"]):
                return "eu"
            if any(keyword in normalized for keyword in ["peer", "similar"]):
                return "peer"
            if any(keyword in normalized for keyword in ["prior period", "changed", "change", "worsening"]):
                return "prior_period"
            if any(keyword in normalized for keyword in sector_terms):
                return "sector"
            if any(keyword in normalized for keyword in market_terms):
                return "market"
            return comparison_layer.get("default_benchmark", "eu")

        if any(
            keyword in normalized
            for keyword in [
                "compared to what",
                "compare to what",
                "comparison basis",
                "benchmark basis",
                "what am i comparing",
                "what are we comparing against",
            ]
        ):
            benchmark_id = benchmark_from_question()
            benchmark_context = self._comparison_basis_context(comparison_layer, benchmark_id)
            excluded_metrics = (
                self._format_label_list([item["title"] for item in benchmark_context.get("unavailable_metrics", [])])
                if benchmark_context
                else ""
            )
            answer_parts = []
            if benchmark_context:
                answer_parts.append(
                    f"The active comparison basis is {benchmark_context['analyst_label']}."
                )
                if benchmark_context.get("description"):
                    answer_parts.append(benchmark_context["description"])
                if excluded_metrics:
                    answer_parts.append(f"Excluded metrics: {excluded_metrics}.")
            else:
                answer_parts.append("The active comparison basis could not be resolved for this filter state.")

            evidence = (
                [
                    {"label": "Benchmark basis", "value": benchmark_context["analyst_label"]},
                    {"label": "Benchmark status", "value": benchmark_context["benchmark_status"]},
                    {
                        "label": "Comparable metrics",
                        "value": f"{benchmark_context['applicable_metric_count']} / {benchmark_context['total_metric_count']}",
                    },
                    {"label": "Excluded metrics", "value": excluded_metrics or "None"},
                ]
                if benchmark_context
                else [{"label": "Benchmark basis", "value": "Unavailable"}]
            )

            return response(
                "comparison",
                benchmark_context.get("confidence", "low") if benchmark_context else "low",
                " ".join(answer_parts),
                evidence,
                comparison_provenance(benchmark_id),
                [
                    item
                    for item in [
                        "How confident is this benchmark?",
                        "What limits this comparison?",
                        comparison_follow_ups()[0] if comparison_follow_ups() else None,
                    ]
                    if item
                ],
                benchmark_context=benchmark_context,
            )

        if any(keyword in normalized for keyword in ["summary", "brief", "overview", "what's happening", "whats happening"]):
            return response(
                "summary",
                active_benchmark_context.get("confidence", "high") if active_benchmark_context else "high",
                f"{overview['intelligence']['headline']} {overview['intelligence']['summary']}",
                [
                    {"label": metric["title"], "value": f"{metric['value']:.1f}{metric['unit']}" if metric.get("value") is not None else "Unavailable"}
                    for metric in overview["metrics"]
                ],
                [metric["provenance"] for metric in overview["metrics"][:3]],
            )

        if any(keyword in normalized for keyword in ["how confident", "confidence", "can i trust", "trust this benchmark"]):
            benchmark_id = benchmark_from_question()
            benchmark_context = self._comparison_basis_context(comparison_layer, benchmark_id)
            confidence = benchmark_context.get("confidence", "low") if benchmark_context else "low"
            confidence_reason = (
                benchmark_context.get("coverage_note")
                or benchmark_context.get("description")
                or "The current benchmark metadata does not expose a stronger confidence rationale."
            ) if benchmark_context else "The current benchmark metadata does not expose a stronger confidence rationale."
            return response(
                "comparison",
                confidence,
                (
                    f"The current confidence on {benchmark_context['analyst_label']} is {confidence}. "
                    f"{confidence_reason}"
                ) if benchmark_context else "The current benchmark confidence could not be resolved for this filter state.",
                [
                    {"label": "Benchmark basis", "value": benchmark_context["analyst_label"]},
                    {"label": "Benchmark status", "value": benchmark_context["benchmark_status"]},
                    {
                        "label": "Comparable metrics",
                        "value": f"{benchmark_context['applicable_metric_count']} / {benchmark_context['total_metric_count']}",
                    },
                    {"label": "Coverage status", "value": benchmark_context["coverage_status"]},
                ] if benchmark_context else [{"label": "Benchmark confidence", "value": "Unavailable"}],
                comparison_provenance(benchmark_id),
                benchmark_context=benchmark_context,
            )

        if any(keyword in normalized for keyword in ["why changed", "why did this change", "why has this changed"]):
            prior_context = self._comparison_basis_context(comparison_layer, "prior_period")
            story = prior_period_change_story()
            lead_change = story["lead_change"]
            if lead_change:
                lead_comparison = lead_change["comparisons"]["prior_period"]
                worsening = story["worsening"][:2]
                improving = story["improving"][:1]
                movement_parts = []
                if worsening:
                    movement_parts.append(
                        "The biggest worsening moves are "
                        + self._format_label_list(
                            [
                                f"{item['metric']['title']} ({format_signed_delta(item['comparison']['delta'], item['metric']['unit'])})"
                                for item in worsening
                            ]
                        )
                        + "."
                    )
                if improving:
                    movement_parts.append(
                        "The clearest offsetting move is "
                        + self._format_label_list(
                            [
                                f"{item['metric']['title']} ({format_signed_delta(item['comparison']['delta'], item['metric']['unit'])})"
                                for item in improving
                            ]
                        )
                        + "."
                    )

                active_context_note = ""
                if active_benchmark_context and active_benchmark_context.get("id") != "prior_period":
                    active_context_note = (
                        f" The active external benchmark remains {active_benchmark_context['analyst_label']}, "
                        "but that benchmark frames the current level rather than explaining the period-over-period move."
                    )

                return response(
                    "comparison",
                    prior_context.get("confidence", "high") if prior_context else "high",
                    (
                        f"The clearest observed change versus {lead_comparison['benchmark_period']} is {lead_change['title']} "
                        f"at {format_signed_delta(lead_comparison['delta'], lead_change['unit'])}. "
                        f"{' '.join(movement_parts)}"
                        " This is a descriptive read of concurrent observed metric moves, not a causal diagnosis."
                        f"{active_context_note}"
                    ).strip(),
                    [
                        {
                            "label": "Largest change",
                            "value": f"{lead_change['title']} ({format_signed_delta(lead_comparison['delta'], lead_change['unit'])})",
                        },
                        *[
                            {
                                "label": "Worsening move",
                                "value": f"{item['metric']['title']} ({format_signed_delta(item['comparison']['delta'], item['metric']['unit'])})",
                            }
                            for item in worsening
                        ],
                        *[
                            {
                                "label": "Offsetting move",
                                "value": f"{item['metric']['title']} ({format_signed_delta(item['comparison']['delta'], item['metric']['unit'])})",
                            }
                            for item in improving
                        ],
                    ][:4],
                    [metric["provenance"] for metric in story["comparable"][:3]],
                    [
                        "What is worsening fastest?",
                        "Compared to what?",
                        "How confident is this benchmark?",
                    ],
                    benchmark_context=prior_context,
                    limitations=merged_limitations(
                        prior_context,
                        [
                            "This explanation describes concurrent metric movement in the current marts and does not infer underlying causes.",
                        ],
                    ),
                )
            return response(
                "comparison",
                prior_context.get("confidence", "low") if prior_context else "low",
                "There is not enough prior-period coverage in the current filter state to explain what changed.",
                [{"label": "Prior-period coverage", "value": "Unavailable"}],
                comparison_provenance("prior_period"),
                benchmark_context=prior_context,
                limitations=merged_limitations(
                    prior_context,
                    [
                        "This explanation describes concurrent metric movement in the current marts and does not infer underlying causes.",
                    ],
                ),
            )

        if any(keyword in normalized for keyword in ["what limits", "coverage limit", "coverage limits", "coverage", "what is excluded", "what is unavailable"]):
            benchmark_id = benchmark_from_question()
            benchmark_context = self._comparison_basis_context(comparison_layer, benchmark_id)
            excluded_metrics = (
                self._format_label_list([item["title"] for item in benchmark_context.get("unavailable_metrics", [])])
                if benchmark_context
                else ""
            )
            limit_answer = (
                f"{benchmark_context['analyst_label']} currently has {benchmark_context['coverage_status']} coverage. "
                f"{benchmark_context.get('coverage_note') or 'No additional coverage note is available.'}"
            ) if benchmark_context else "The current comparison limits could not be resolved for this filter state."
            if excluded_metrics:
                limit_answer = f"{limit_answer} Excluded metrics: {excluded_metrics}."
            return response(
                "comparison",
                benchmark_context.get("confidence", "low") if benchmark_context else "low",
                limit_answer,
                [
                    {"label": "Coverage status", "value": benchmark_context["coverage_status"]},
                    {
                        "label": "Comparable metrics",
                        "value": f"{benchmark_context['applicable_metric_count']} / {benchmark_context['total_metric_count']}",
                    },
                    {"label": "Excluded metrics", "value": excluded_metrics or "None"},
                ] if benchmark_context else [{"label": "Coverage status", "value": "Unavailable"}],
                comparison_provenance(benchmark_id),
                benchmark_context=benchmark_context,
            )

        if any(keyword in normalized for keyword in ["why is this worsening", "why is this getting worse", "why worsening"]):
            prior_context = self._comparison_basis_context(comparison_layer, "prior_period")
            story = prior_period_change_story()
            lead_worsening = story["lead_worsening"]
            if lead_worsening:
                comparison = lead_worsening["comparison"]
                supporting = [
                    item for item in story["worsening"][1:3]
                    if item["metric"]["id"] != lead_worsening["metric"]["id"]
                ]
                offsetting = story["improving"][:1]
                detail_parts = [
                    (
                        f"The strongest worsening move versus {comparison['benchmark_period']} is "
                        f"{lead_worsening['metric']['title']} ({format_signed_delta(comparison['delta'], lead_worsening['metric']['unit'])})."
                    )
                ]
                if supporting:
                    detail_parts.append(
                        "Other worsening signals moving in the same direction are "
                        + self._format_label_list(
                            [
                                f"{item['metric']['title']} ({format_signed_delta(item['comparison']['delta'], item['metric']['unit'])})"
                                for item in supporting
                            ]
                        )
                        + "."
                    )
                if offsetting:
                    detail_parts.append(
                        "The clearest offsetting move is "
                        + self._format_label_list(
                            [
                                f"{item['metric']['title']} ({format_signed_delta(item['comparison']['delta'], item['metric']['unit'])})"
                                for item in offsetting
                            ]
                        )
                        + "."
                    )
                detail_parts.append(
                    "This is a descriptive view of what moved together in the current marts, not a causal explanation."
                )

                return response(
                    "comparison",
                    prior_context.get("confidence", "high") if prior_context else "high",
                    " ".join(detail_parts),
                    [
                        {
                            "label": "Worsening fastest",
                            "value": f"{lead_worsening['metric']['title']} ({format_signed_delta(comparison['delta'], lead_worsening['metric']['unit'])})",
                        },
                        *[
                            {
                                "label": "Supporting worsening move",
                                "value": f"{item['metric']['title']} ({format_signed_delta(item['comparison']['delta'], item['metric']['unit'])})",
                            }
                            for item in supporting
                        ],
                        *[
                            {
                                "label": "Offsetting move",
                                "value": f"{item['metric']['title']} ({format_signed_delta(item['comparison']['delta'], item['metric']['unit'])})",
                            }
                            for item in offsetting
                        ],
                    ][:4],
                    [metric["provenance"] for metric in story["comparable"][:3]],
                    [
                        "What changed versus the prior period?",
                        "Compared to what?",
                        "What limits this comparison?",
                    ],
                    benchmark_context=prior_context,
                    limitations=merged_limitations(
                        prior_context,
                        [
                            "This explanation describes concurrent metric movement in the current marts and does not infer underlying causes.",
                        ],
                    ),
                )
            return response(
                "comparison",
                prior_context.get("confidence", "medium") if prior_context else "medium",
                "None of the currently available observed metrics show a clear worsening move to explain.",
                [{"label": "Worsening status", "value": "No clear worsening move"}],
                comparison_provenance("prior_period"),
                benchmark_context=prior_context,
                limitations=merged_limitations(
                    prior_context,
                    [
                        "This explanation describes concurrent metric movement in the current marts and does not infer underlying causes.",
                    ],
                ),
            )

        if any(keyword in normalized for keyword in ["peer countries", "peer country", "most similar", "similar markets", "similar countries"]):
            peer_group = comparison_layer.get("peer_group", {})
            peer_context = self._comparison_basis_context(comparison_layer, "peer")
            if peer_group.get("available"):
                members = peer_group["members"]
                return response(
                    "comparison",
                    peer_group.get("confidence", "medium"),
                    (
                        f"The closest peer-country basket for {overview['filters']['applied']['geography_label']} is "
                        f"{', '.join(member['label'] for member in members)}. "
                        "This is a proxy benchmark built from the nearest comparable labour-market profile across the available observed metrics."
                    ),
                    [
                        {
                            "label": member["label"],
                            "value": f"Similarity distance {member['distance']:.2f} across {member['common_metric_count']} common metrics",
                        }
                        for member in members
                    ],
                    [metric["provenance"] for metric in overview["metrics"][:3]],
                    [
                        "How does this market compare to the EU benchmark?",
                        "What changed versus the prior period?",
                        "How confident is this benchmark?",
                        "What should HR leaders do next?",
                    ],
                    benchmark_context=peer_context,
                )
            return response(
                "comparison",
                "low",
                "There is not enough country-level overlap in the current filter state to construct a trustworthy peer-country basket.",
                [{"label": "Peer status", "value": "Unavailable"}],
                [metric["provenance"] for metric in overview["metrics"][:2]],
                benchmark_context=peer_context,
            )

        if any(keyword in normalized for keyword in ["changed", "change", "prior period", "vs prior", "versus the prior period"]):
            comparable = available_comparison_metrics("prior_period")
            lead = top_comparison_gap("prior_period")
            prior_context = self._comparison_basis_context(comparison_layer, "prior_period")
            if comparable and lead:
                comparison = lead["comparisons"]["prior_period"]
                return response(
                    "comparison",
                    prior_context.get("confidence", "high") if prior_context else "high",
                    (
                        f"The largest prior-period shift is in {lead['title']}, now {format_signed_delta(comparison['delta'], lead['unit'])} "
                        f"versus {comparison['benchmark_period']}. "
                        f"{comparison_layer['summary']}"
                    ),
                    [
                        {
                            "label": metric["title"],
                            "value": (
                                f"{metric['value']:.1f}{metric['unit']} vs {metric['comparisons']['prior_period']['benchmark_value']:.1f}{metric['unit']} "
                                f"({format_signed_delta(metric['comparisons']['prior_period']['delta'], metric['unit'])})"
                            ),
                        }
                        for metric in sorted(
                            comparable,
                            key=lambda item: abs(float(item["comparisons"]["prior_period"]["delta"] or 0)),
                            reverse=True,
                        )[:3]
                    ],
                    [metric["provenance"] for metric in comparable[:3]],
                    [
                        "Which signal is worsening fastest?",
                        "How confident is this benchmark?",
                        "How does this market compare to the EU benchmark?",
                        "Which peer countries look most similar?",
                    ],
                    benchmark_context=prior_context,
                )

        if any(keyword in normalized for keyword in ["worsening fastest", "worsening", "deteriorating fastest"]):
            comparable = available_comparison_metrics("prior_period")
            prior_context = self._comparison_basis_context(comparison_layer, "prior_period")
            worsening = []
            for metric in comparable:
                delta = float(metric["comparisons"]["prior_period"]["delta"] or 0)
                desired_direction = OBSERVED_METRIC_CONFIG[metric["id"]]["desired_direction"]
                worsening_score = delta if desired_direction == "down" else -delta
                if worsening_score > 0:
                    worsening.append((worsening_score, metric))
            if worsening:
                worsening.sort(key=lambda item: item[0], reverse=True)
                lead = worsening[0][1]
                comparison = lead["comparisons"]["prior_period"]
                return response(
                    "comparison",
                    prior_context.get("confidence", "high") if prior_context else "high",
                    (
                        f"{lead['title']} is worsening fastest, moving {format_signed_delta(comparison['delta'], lead['unit'])} "
                        f"against the prior period ({comparison['benchmark_period']})."
                    ),
                    [
                        {
                            "label": metric["title"],
                            "value": format_signed_delta(metric["comparisons"]["prior_period"]["delta"], metric["unit"]),
                        }
                        for _, metric in worsening[:3]
                    ],
                    [metric["provenance"] for _, metric in worsening[:3]],
                    benchmark_context=prior_context,
                )
            return response(
                "comparison",
                prior_context.get("confidence", "medium") if prior_context else "medium",
                "None of the currently available observed metrics show a clear worsening move versus the prior period.",
                [
                    {"label": metric["title"], "value": metric["comparisons"]["prior_period"]["gap_label"]}
                    for metric in comparable
                ],
                [metric["provenance"] for metric in comparable[:3]],
                benchmark_context=prior_context,
            )

        if any(keyword in normalized for keyword in ["compare", "compared", "benchmark", "versus", " vs ", "compared to what", "compare to what"]):
            benchmark_id = benchmark_from_question()
            comparable = available_comparison_metrics(benchmark_id)
            lead = top_comparison_gap(benchmark_id)
            benchmark_context = self._comparison_basis_context(comparison_layer, benchmark_id)
            if comparable and lead:
                lead_comparison = lead["comparisons"][benchmark_id]
                return response(
                    "comparison",
                    benchmark_context.get("confidence", lead_comparison["confidence"]) if benchmark_context else lead_comparison["confidence"],
                    (
                        f"{benchmark_context.get('description', comparison_layer['summary']) if benchmark_context else comparison_layer['summary']} "
                        f"The widest current gap is {lead['title']} at {format_signed_delta(lead_comparison['delta'], lead['unit'])}."
                    ),
                    [
                        {
                            "label": metric["title"],
                            "value": (
                                f"{metric['value']:.1f}{metric['unit']} vs {metric['comparisons'][benchmark_id]['benchmark_value']:.1f}{metric['unit']} "
                                f"({format_signed_delta(metric['comparisons'][benchmark_id]['delta'], metric['unit'])})"
                            ),
                        }
                        for metric in sorted(
                            comparable,
                            key=lambda item: abs(float(item["comparisons"][benchmark_id]["delta"] or 0)),
                            reverse=True,
                        )[:3]
                    ],
                    [metric["provenance"] for metric in comparable[:3]],
                    [
                        "Which peer countries look most similar?",
                        "What changed versus the prior period?",
                        "What limits this comparison?",
                        "What should HR leaders do next?",
                    ],
                    benchmark_context=benchmark_context,
                )
            return response(
                "comparison",
                "low",
                "The current filter state does not have enough benchmark coverage to answer that comparison cleanly.",
                [{"label": "Comparison basis", "value": COMPARISON_BENCHMARKS[benchmark_id]["label"]}],
                [metric["provenance"] for metric in overview["metrics"][:2]],
                benchmark_context=benchmark_context,
            )

        if any(keyword in normalized for keyword in ["vacancy", "hiring", "talent", "recruit"]):
            return response(
                "hiring",
                "high" if top_vacancy else "medium",
                (
                    f"{top_vacancy['sector_label']} is the tightest hiring market at {top_vacancy['value']:.1f}% vacancy rate."
                    if top_vacancy
                    else "The current dataset does not have enough vacancy detail to answer that fully."
                ),
                [
                    {"label": "Hiring pressure index", "value": f"{int(semantic['hiring_pressure_index']['value'])}/100"},
                    {"label": "Top vacancy hotspot", "value": top_vacancy["sector_label"] if top_vacancy else "Unavailable"},
                ],
                [
                    semantic["hiring_pressure_index"]["provenance"],
                    overview["charts"]["vacancy_by_sector"]["provenance"],
                ],
                [
                    "What should HR leaders do next?",
                    "Which sector has the widest pay gap?",
                    "Give me the executive summary.",
                ],
            )

        if any(keyword in normalized for keyword in ["pay gap", "equity", "gender", "compensation"]):
            pay_gap_value = observed_value("gender_pay_gap")
            return response(
                "equity",
                "high" if top_gap else "medium",
                (
                    f"The market gender pay gap is {pay_gap_value:.1f}% and the widest hotspot is {top_gap['sector_label']}."
                    if top_gap
                    else (
                        f"The market gender pay gap is {pay_gap_value:.1f}%."
                        if pay_gap_value is not None
                        else "The current dataset does not have enough pay-gap detail to answer that fully."
                    )
                ),
                [
                    {"label": "Equity risk score", "value": f"{int((semantic.get('equity_risk_score') or {}).get('value') or 0)}/100"},
                    {"label": "Observed pay gap", "value": observed_display("gender_pay_gap")},
                ],
                [
                    (semantic.get("equity_risk_score") or {}).get("provenance", {}),
                    observed_provenance("gender_pay_gap", "eurostat_lfs", "observed-v1", True),
                ],
                [
                    "Why is this flagged for review?",
                    "Which sector needs the closest attention?",
                    "What should HR leaders do next?",
                ],
            )

        if any(keyword in normalized for keyword in ["resilience", "employment", "unemployment", "labour market"]):
            return response(
                "labour",
                "high",
                (
                    f"Labour resilience is {int(semantic['labour_resilience']['value'])}/100 with employment at "
                    f"{observed_display('employment_rate')} and unemployment at {observed_display('unemployment_rate')}."
                ),
                [
                    {"label": "Labour resilience", "value": f"{int(semantic['labour_resilience']['value'])}/100"},
                    {"label": "Employment", "value": observed_display("employment_rate")},
                    {"label": "Unemployment", "value": observed_display("unemployment_rate")},
                ],
                [
                    semantic["labour_resilience"]["provenance"],
                    observed_provenance("employment_rate", "eurostat_lfs", "observed-v1", False),
                    observed_provenance("unemployment_rate", "eurostat_lfs", "observed-v1", False),
                ],
            )

        if any(keyword in normalized for keyword in ["risk", "watch", "priority", "alert"]):
            top_watch = overview["intelligence"]["watchlist"][0] if overview["intelligence"]["watchlist"] else None
            return response(
                "risk",
                "high" if top_watch else "medium",
                top_watch["detail"] if top_watch else "No watchlist item is available for the current filter state.",
                [
                    {"label": item["label"], "value": item["value"]}
                    for item in overview["intelligence"]["watchlist"]
                ],
                [
                    item["evidence_bundle"]["provenance"][0]
                    for item in overview["intelligence"]["watchlist"]
                ],
            )

        if any(keyword in normalized for keyword in ["do next", "recommend", "action", "what should we do"]):
            top_recommendation = overview["intelligence"]["recommendations"][0] if overview["intelligence"]["recommendations"] else None
            return response(
                "action",
                "high" if top_recommendation else "medium",
                top_recommendation["detail"] if top_recommendation else "There is no recommendation available for the current filter state.",
                top_recommendation["evidence_bundle"]["evidence"] if top_recommendation else [],
                top_recommendation["evidence_bundle"]["provenance"] if top_recommendation else [],
                [
                    "Why is that recommendation grounded?",
                    "What is the top hiring risk right now?",
                    "Give me the executive summary.",
                ],
            )

        return response(
            "general",
            "medium",
            "I can answer questions about EU and peer benchmarks, prior-period changes, hiring pressure, labour resilience, pay-gap hotspots, top risks, and recommended next actions using the current market data snapshot.",
            [
                {"label": "Headline", "value": overview["intelligence"]["headline"]},
                {"label": "Comparison summary", "value": overview["comparisons"]["summary"]},
            ],
            [
                *( [overview["metrics"][0]["provenance"]] if overview["metrics"] else [] ),
                *( [overview["semantic_metrics"][0]["provenance"]] if overview["semantic_metrics"] else [] ),
            ],
        )

    def build_governance_payload(self) -> Dict[str, Any]:
        return {
            "available_actions": list(self.governance_actions.values()),
            "event_contract": {
                "required_fields": ["action_code", "target_type", "target_id"],
                "optional_fields": ["reason", "context"],
            },
            "integrity": self._governance_integrity(),
            "export": {
                "format": "json",
                "event_count": len(self.governance_events),
                "includes_hash_chain": True,
            },
            "recent_events": self.governance_events[:10],
            "events": self.governance_events[:50],
        }

    def record_governance_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        action_code = payload["action_code"]
        action = self.governance_actions.get(action_code)
        if not action:
            raise ValueError(f"Unsupported governance action: {action_code}")

        reason = (payload.get("reason") or "").strip()
        if action["requires_reason"] and not reason:
            raise ValueError(f"Action {action_code} requires a reason.")

        sequence = self._next_governance_sequence()
        event = {
            "event_id": f"evt_{sequence:04d}",
            "event_sequence": sequence,
            "action_code": action_code,
            "action_name": action["action_name"],
            "target_type": payload["target_type"],
            "target_id": payload["target_id"],
            "actor": (payload.get("actor") or "local_user").strip() or "local_user",
            "reason": reason or None,
            "context": payload.get("context") or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "previous_hash": self._latest_governance_hash(),
        }
        event["event_hash"] = self._governance_event_hash(event)
        self.governance_events.insert(0, event)
        self.governance_events = self.governance_events[:50]
        self._persist_governance_events()
        return event

    def build_evidence_pack(
        self,
        country: str = "ALL",
        geography: str = "EU27_AVG",
        sector: str = "ALL",
        period: str = "latest",
        benchmark_geography: Optional[str] = None,
        benchmark_sector: Optional[str] = None,
    ) -> Dict[str, Any]:
        overview = self.build_overview(
            country,
            geography,
            sector,
            period,
            benchmark_geography=benchmark_geography,
            benchmark_sector=benchmark_sector,
        )
        return {
            "generated_at": overview["generated_at"],
            "pack_type": "workforceguard_compliance_evidence_pack",
            "pack_version": "phase-4-v1",
            "filters": overview["filters"]["applied"],
            "summary": {
                "headline": overview["intelligence"]["headline"],
                "summary": overview["intelligence"]["summary"],
            },
            "metrics": overview["metrics"],
            "comparisons": overview["comparisons"],
            "semantic_metrics": overview["semantic_metrics"],
            "internal_data": overview["internal_data"],
            "company_benchmark": overview["company_benchmark"],
            "pay_transparency": overview["pay_transparency"],
            "copilot": overview["copilot"],
            "brief": overview["brief"],
            "automation": overview["automation"],
            "compliance_review": {
                "status": overview["pay_transparency"].get("workflow", {}).get("state", "unavailable"),
                "human_oversight_required": overview["pay_transparency"]
                .get("workflow", {})
                .get("human_oversight_required", False),
                "review_items": overview["pay_transparency"].get("review_items", []),
                "governance_integrity": overview["governance"]["integrity"],
                "export_contract": {
                    "audience": "legal_compliance_works_council_review",
                    "contains_person_level_data": False,
                    "contains_category_level_internal_pay_data": bool(overview["pay_transparency"].get("available")),
                    "requires_human_interpretation": True,
                },
            },
            "recommendations": overview["intelligence"]["recommendations"],
            "governance": overview["governance"],
        }


class RepositoryRegistry:
    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self._repositories: Dict[str, "AnalyticsRepository"] = {}

    def get_for_tenant(self, tenant_id: str) -> "AnalyticsRepository":
        if tenant_id not in self._repositories:
            tenant_dir = self.root_dir / "data" / "tenants" / tenant_id
            self._repositories[tenant_id] = AnalyticsRepository(
                root_dir=self.root_dir,
                governance_events_path=tenant_dir / "governance_events.sqlite",
                automation_schedules_path=tenant_dir / "automation_schedules.json",
                internal_data_dir=tenant_dir / "internal",
            )
        return self._repositories[tenant_id]
