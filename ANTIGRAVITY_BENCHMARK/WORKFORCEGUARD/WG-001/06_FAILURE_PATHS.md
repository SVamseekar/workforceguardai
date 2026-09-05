# 06. Failure Paths: WorkforceGuard AI

> **Benchmark Track:** WG-001
> **Status:** COMPLETE
> **Evidence Standard:** PROVEN / EMPIRICALLY VERIFIED
> **Target System:** [WorkforceGuard-AI](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI)

---

## 1. System Failure Matrix

| ID        | Component              | Failure Condition                                                                 | Manifestation / Error                                                                            | Blast Radius                                           | Recovery Mechanism                                                        |
| --------- | ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| **FP-01** | DuckDB Engine          | File lock contention during dbt run exceeds 3.0s                                  | Unhandled `duckdb.IOException: Could not set lock on file` -> HTTP 500                           | All concurrent API requests during upload              | Wait for dbt completion and retry                                         |
| **FP-02** | Background dbt         | dbt run fails due to schema, syntax, or environment error                         | Upload succeeds (HTTP 200), but internal marts remain empty; dbt errors dumped to `DEVNULL`      | Tenant pay analysis and company benchmarks unavailable | Manual CLI dbt run and debugging                                          |
| **FP-03** | Startup Lifecycle      | Legacy unmigrated files present in `data/internal` or `governance_events.sqlite`  | App refuses to boot: `RuntimeError: Found pre-migration data at legacy global path(s)...`        | Full backend service outage on startup                 | Run `migrate_to_tenant.py` or set `WORKFORCEGUARD_SKIP_MIGRATION_CHECK=1` |
| **FP-04** | Tenant Isolation Guard | Operator runs dbt without `tenant_schema` var, creating internal tables in `main` | `RuntimeError: Internal-tagged table(s) found in the shared 'main' schema: ...` on first request | Immediate worker crash for all tenants                 | Drop internal tables from `main` in DuckDB                                |
| **FP-05** | Configuration / Boot   | `CORS_ALLOWED_ORIGINS` contains trailing slash, wildcard, or invalid URI shape    | `RuntimeError: CORS_ALLOWED_ORIGINS contains invalid entries...`                                 | Immediate process exit on startup                      | Fix CORS environment variable string                                      |
| **FP-06** | Auth / Sessions        | PostgreSQL unavailable, network down, or `DATABASE_URL` missing                   | `KeyError: 'DATABASE_URL'` or `asyncpg.exceptions.CannotConnectNowError`                         | Total outage of all authenticated endpoints            | Restore PostgreSQL and check credentials                                  |
| **FP-07** | In-Memory Fallback     | DuckDB database missing and raw Parquet files missing from `data/eu_raw`          | `duckdb.CatalogException: Table with name ... does not exist` -> HTTP 404/500                    | Dashboard completely blank                             | Run `scripts/pull_eu_data.py` to generate Parquet files                   |
| **FP-08** | Governance Chain       | Tenant exceeds 50 governance events                                               | Sequence 1 drops off the 50-item window; `_governance_integrity()` evaluates unanchored chain    | Dashboard displays "Chain break detected"              | Manually adjust query limit or increase persistence buffer                |
| **FP-09** | Upstream Eurostat API  | Eurostat API returns HTTP 4xx/5xx or changes JSON-stat schema                     | `RuntimeError: HTTP {code} for {url}` or `ValueError: JSON-stat missing id/size dimensions`      | Public data pull halts; fails logged in `errors.json`  | Re-run ingestion when Eurostat API recovers                               |

---

## 2. In-Depth Failure Path Traces

### FP-01: DuckDB Write Lock Contention on Upload
- **Location**: [`dashboard/backend/main.py:L583`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L583) and [`dashboard/backend/service.py:L520-L536`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L520-L536).
- **Trigger**: An admin user uploads a payroll CSV via `/api/upload/payroll`.
- **Sequence**:
  1. `upload_payroll` calls `_trigger_tenant_internal_dbt()`, which starts a background subprocess:
     ```bash
     dbt run --project-dir analytics --profiles-dir analytics --select tag:internal --vars '{"tenant_schema": "tenant_<id>"}'
     ```
  2. `dbt-duckdb` opens `data/workforceguard_analytics.duckdb` in read-write mode, obtaining an **exclusive OS file lock**.
  3. While dbt is compiling and running (typically 4 to 12 seconds), a user navigates to `/app` or changes a filter, causing frontend to call `GET /api/overview`.
  4. FastAPI worker calls `AnalyticsRepository._connect()`, invoking `_connect_with_lock_retry()`:
     ```python
     attempts = 10
     delay_seconds = 0.3
     for attempt in range(attempts):
         try:
             return duckdb.connect(database=str(self.analytics_db_path), read_only=True)
         except duckdb.IOException as error:
             if "Could not set lock on file" not in str(error) or attempt == attempts - 1:
                 raise
             time.sleep(delay_seconds)
     ```
  5. The loop sleeps $10 \times 0.3 = 3.0$ seconds. Because dbt takes $> 3.0$ seconds to run, the 10th attempt raises `duckdb.IOException("Could not set lock on file ...")`.
  6. The error is intercepted by `guarded()` and converted into an unhandled HTTP 500 error returned to the client.

---

### FP-02: Silent dbt Compilation Failure
- **Location**: [`dashboard/backend/main.py:L528-L557`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L528-L557).
- **Trigger**: The dbt environment is missing dependencies, has a malformed SQL profile, encounters invalid CSV column types, or dbt is not on `PATH`.
- **Sequence**:
  1. In `_trigger_tenant_internal_dbt`:
     ```python
     subprocess.Popen(
         [...],
         cwd=str(root_dir),
         env=dbt_env,
         stdout=subprocess.DEVNULL,
         stderr=subprocess.DEVNULL,
     )
     result["dbt_run"] = "triggered"
     ```
  2. dbt crashes immediately with non-zero exit code, writing error stack traces to stderr.
  3. Because stderr is directed to `subprocess.DEVNULL`, the error is discarded without logging.
  4. The HTTP response returns status 200:
     ```json
     {
       "status": "accepted",
       "record_count": 142,
       "validation": { "passed": true, "warnings": [] },
       "dbt_run": "triggered"
     }
     ```
  5. The user checks the dashboard, but `mart_internal_market_pay_benchmark` was never created. The UI indefinitely shows: *"The internal benchmark mart does not contain category-level pay-gap rows for this scope yet."*

---

### FP-03: Startup Halting on Legacy Data Assets
- **Location**: [`dashboard/backend/main.py:L75-L102`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L75-L102).
- **Trigger**: Pre-migration files exist in legacy root paths `data/internal` or `data/governance_events.sqlite`.
- **Sequence**:
  1. On server boot (before lifespan initialization), `_assert_legacy_data_already_migrated()` executes:
     ```python
     def _assert_legacy_data_already_migrated(root_dir: Path) -> None:
         found = []
         internal_dir = root_dir / "data" / "internal"
         if _legacy_internal_dir_has_real_files(internal_dir):
             found.append(str(internal_dir))
         for relative_path in ("data/governance_events.sqlite", "data/automation_schedules.json"):
             path = root_dir / relative_path
             if path.exists():
                 found.append(str(path))
         if found:
             raise RuntimeError("Found pre-migration data at legacy global path(s): ...")
     ```
  2. If any developer left files in `data/internal/`, the entire FastAPI application throws a `RuntimeError` and aborts process boot.
  3. **Workaround**: Must run `python migrate_to_tenant.py ...` or export `WORKFORCEGUARD_SKIP_MIGRATION_CHECK=1`.

---

### FP-04: Fail-Closed Main Schema Contamination
- **Location**: [`dashboard/backend/service.py:L538-L552`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L538-L552).
- **Trigger**: An engineer runs manual `dbt run` locally or in CI without passing `--vars '{"tenant_schema": "..."}'`.
- **Sequence**:
  1. In `analytics/dbt_project.yml`, if `tenant_schema` is not set, but a model override or legacy config builds internal models, internal tables (`dim_worker_category`, `fct_internal_pay_snapshot`, etc.) are written directly to the `main` schema in DuckDB.
  2. A tenant makes any request. `AnalyticsRepository._connect()` runs:
     ```python
     self._assert_main_has_no_internal_tables(connection)
     ```
  3. The query finds internal tables in `main` and throws:
     ```
     RuntimeError: Internal-tagged table(s) found in the shared 'main' schema: dim_worker_category, fct_internal_pay_snapshot... Drop them from 'main' and re-run dbt with --vars '{"tenant_schema": "<schema>"}'
     ```
  4. The worker process crashes, resulting in total denial of service until an engineer connects to DuckDB directly with the CLI and drops the contaminated tables.

---

### FP-05: Strict Regex CORS Boot Failure
- **Location**: [`dashboard/backend/main.py:L137-L149`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L137-L149).
- **Trigger**: An administrator configures `CORS_ALLOWED_ORIGINS` with a trailing slash (e.g. `https://workforceguardai.souravamseekar.com/`) or wildcards (e.g. `https://*.souravamseekar.com`).
- **Sequence**:
  1. `main.py` matches each origin against `_VALID_ORIGIN_PATTERN`:
     ```python
     _VALID_ORIGIN_PATTERN = re.compile(
         r"^https://[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$"
         r"|^http://localhost(?::\d+)?$"
     )
     ```
  2. A trailing slash fails the regex.
  3. `main.py` immediately raises:
     ```python
     raise RuntimeError(
         "CORS_ALLOWED_ORIGINS contains invalid entries: ... Each origin must be an exact https:// origin with no wildcards"
     )
     ```
  4. The container terminates immediately during startup.

---

### FP-06: Truncated Audit Chain Integrity Break
- **Location**: [`dashboard/backend/service.py:L316`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L316) and [`L435-L454`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L435-L454).
- **Trigger**: A tenant records more than 50 governance events.
- **Sequence**:
  1. `_load_sqlite_governance_events()` loads events ordered by `event_sequence desc limit 50`.
  2. For a tenant with 55 events, the in-memory array contains events 6 through 55. Event 1 (the genesis event where `previous_hash = "GENESIS"`) is not loaded.
  3. When `_governance_integrity()` executes:
     ```python
     previous_hash = "GENESIS"
     for event in sequenced_events:
         if event.get("previous_hash") != previous_hash or ...:
             verified = False
             break_event_id = event.get("event_id")
             break
         previous_hash = str(event.get("event_hash"))
     ```
  4. Event 6 expects `previous_hash` to be the hash of Event 5, but `previous_hash` is initialized to `"GENESIS"`.
  5. The integrity check fails on the first iteration, setting `verified = False`.
  6. The dashboard displays a red **"Chain break detected"** indicator, even though no tampering occurred.
