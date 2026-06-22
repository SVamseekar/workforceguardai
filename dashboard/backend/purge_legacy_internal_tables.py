"""
One-time cleanup: drop pre-multi-tenant internal-tagged dbt objects (tables
and views) from the shared DuckDB warehouse's default "main" schema.

Why this is needed: before tenant-scoped dbt schemas existed
(analytics/macros/tenant_schema.sql), every internal-tagged model
(payroll/workforce/pay-gap data) was modeled directly into "main" — the same
schema every tenant's queries still fall back to via DuckDB's search_path
when a table is missing from their own tenant schema. Leaving that legacy
data in "main" means it can still leak to any tenant whose own schema
doesn't (yet) have a given internal-tagged table.

AnalyticsRepository._assert_main_has_no_internal_tables (service.py) now
raises loudly if it ever finds an internal-tagged table in "main" again, so
this script — and the guard it satisfies — should be re-run any time that
error is hit (e.g. after a dbt run was accidentally executed without
--vars '{"tenant_schema": "..."}').

Usage:
    python purge_legacy_internal_tables.py [path/to/workforceguard_analytics.duckdb]

Idempotent: safe to run when there is nothing to clean up.
"""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb

from service import INTERNAL_TAGGED_TABLES


def purge_legacy_internal_objects(db_path: Path) -> list[str]:
    """Drops every INTERNAL_TAGGED_TABLES object found in main, regardless of
    whether dbt materialized it as a table or a view. Returns the names
    actually dropped."""
    dropped: list[str] = []
    connection = duckdb.connect(database=str(db_path))
    try:
        rows = connection.execute(
            "select table_name, table_type from information_schema.tables where table_schema = 'main'"
        ).fetchall()
        present = {name: kind for name, kind in rows}

        for table_name in sorted(INTERNAL_TAGGED_TABLES):
            kind = present.get(table_name)
            if kind is None:
                continue
            if kind == "VIEW":
                connection.execute(f"drop view if exists main.{table_name}")
            else:
                connection.execute(f"drop table if exists main.{table_name} cascade")
            dropped.append(table_name)
    finally:
        connection.close()
    return dropped


if __name__ == "__main__":
    backend_dir = Path(__file__).resolve().parent
    root_dir = backend_dir.parents[1]
    default_path = root_dir / "data" / "workforceguard_analytics.duckdb"
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_path

    if not db_path.exists():
        print(f"No database found at {db_path}; nothing to do.")
        sys.exit(0)

    dropped = purge_legacy_internal_objects(db_path)
    if dropped:
        print(f"Dropped {len(dropped)} legacy internal-tagged object(s) from main: {', '.join(dropped)}")
    else:
        print("No legacy internal-tagged objects found in main; already clean.")
