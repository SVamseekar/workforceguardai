# 07. Evidence Ledger: WorkforceGuard AI

> **Benchmark Track:** WG-001
> **Status:** COMPLETE
> **Evidence Standard:** PROVEN / EMPIRICALLY VERIFIED / STRONGLY INFERRED / UNKNOWN
> **Target System:** [WorkforceGuard-AI](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI)

---

### LEDGER ENTRY 01
- **ID:** EV-01
- **CATEGORY:** Architecture / AI Implementation
- **CLAIM:** The "AI Analyst" copilot does not invoke any Large Language Model or neural network; it is a deterministic Python keyword matcher.
- **EVIDENCE:** Grepping backend dependencies shows zero GenAI or LLM SDKs (no `openai`, `anthropic`, `google-generativeai`, `langchain`). `service.py:answer_question()` evaluates queries using lowercase string token membership across fixed domain tuples.
- **FILE:** [`dashboard/backend/service.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py)
- **LINE/RANGE:** 4833–5730
- **HOW VERIFIED:** PROVEN (Static code inspection and codebase grep).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** None. No dynamic code loading, remote HTTP calls, or external AI inference gateways exist in the repository.
- **IMPACT:** Guarantees deterministic, zero-hallucination compliance responses, but restricts interactive queries strictly to mapped keywords.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 02
- **ID:** EV-02
- **CATEGORY:** Runtime / Database Dependencies
- **CLAIM:** The application strictly requires a running PostgreSQL 16 database server to function; the README claim of "no database server required" is false.
- **EVIDENCE:** `dashboard/backend/auth/db.py` imports `asyncpg` and reads `os.environ["DATABASE_URL"]`. The `require_session` dependency queries PostgreSQL on every authenticated request. Running backend tests without Postgres fails immediately with `PermissionError` or connection errors.
- **FILE:** [`dashboard/backend/auth/db.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/db.py) and [`dashboard/backend/auth/dependencies.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/dependencies.py)
- **LINE/RANGE:** `db.py:4-24`, `dependencies.py:30-42`
- **HOW VERIFIED:** EMPIRICALLY VERIFIED (Failed pytest execution when Postgres port 5432 was unreachable in sandbox).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** The README description was written during early development before multi-tenancy and authentication were added to the stack.
- **IMPACT:** Deployments without a provisioned PostgreSQL instance crash immediately on startup.
- **REQUIRES RUNTIME PROOF:** Yes (demonstrated by test execution).
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 03
- **ID:** EV-03
- **CATEGORY:** Governance / Cryptographic Audit
- **CLAIM:** Audit events are chained with SHA-256 hashes, but the chain is truncated to the latest 50 events in memory and persistence.
- **EVIDENCE:** `_load_sqlite_governance_events()` executes `order by event_sequence desc limit 50`. `_persist_sqlite_governance_events()` writes `self.governance_events[:50]`. `_governance_integrity()` evaluates the loaded subset starting from `"GENESIS"`.
- **FILE:** [`dashboard/backend/service.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py)
- **LINE/RANGE:** 305–330, 344–375, 435–461
- **HOW VERIFIED:** PROVEN (Direct code analysis of SQL queries and array slices).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** The limit was intended as a UI pagination buffer, but was inadvertently applied to the storage persistence and cryptographic verification loop.
- **IMPACT:** Tenants exceeding 50 audit events will experience broken chain verification states ("Chain break detected") because Event 1 drops out of the verification window.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 04
- **ID:** EV-04
- **CATEGORY:** Tenant Isolation / DuckDB Architecture
- **CLAIM:** Internal payroll data is isolated inside DuckDB schemas named `tenant_<sanitized_uuid>`, with runtime assertions preventing leakage into `main`.
- **EVIDENCE:** `AnalyticsRepository._connect()` executes `set search_path = '{self.tenant_schema},main'`. It also executes `_assert_main_has_no_internal_tables()`, querying `information_schema.tables` and raising a `RuntimeError` if any internal table exists in `main`.
- **FILE:** [`dashboard/backend/service.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py)
- **LINE/RANGE:** 495–553
- **HOW VERIFIED:** PROVEN (Direct code inspection of schema isolation logic).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** None. The mechanism explicitly guards against accidental fallthrough in DuckDB's search path.
- **IMPACT:** Ensures strict isolation in a shared database file, but causes a hard denial-of-service crash if a stray dbt run creates internal models in `main`.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 05
- **ID:** EV-05
- **CATEGORY:** Concurrency / Concurrency Failures
- **CLAIM:** Uploading payroll triggers a background dbt execution that locks DuckDB, risking HTTP 500 errors for concurrent readers due to a short 3-second retry loop.
- **EVIDENCE:** `upload_payroll` spawns `dbt run` using `subprocess.Popen`. DuckDB locks the database file during writes. `_connect_with_lock_retry` retries 10 times with 0.3s delay (total 3.0s) before re-raising `duckdb.IOException`.
- **FILE:** [`dashboard/backend/main.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py) and [`dashboard/backend/service.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py)
- **LINE/RANGE:** `main.py:537-553`, `service.py:520-536`
- **HOW VERIFIED:** PROVEN (Static analysis of sleep timings and subprocess execution).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** None.
- **IMPACT:** In multi-tenant environments, one tenant uploading a file can cause intermittent 500 errors for other tenants browsing the dashboard if dbt compilation takes $> 3.0$ seconds.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 06
- **ID:** EV-06
- **CATEGORY:** Data Modeling / Inclusivity & Calculation
- **CLAIM:** While the payroll upload validator accepts `gender = 'non_binary'`, the dbt modeling layer silently excludes non-binary employees from pay gap calculations.
- **EVIDENCE:** In `service.py:ingest_uploaded_payroll`, `VALID_GENDERS` includes `non_binary`. In `analytics/models/marts/internal/fct_internal_pay_snapshot.sql`, the query explicitly filters `where gender in ('female', 'male')`.
- **FILE:** [`dashboard/backend/service.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py) and [`analytics/models/marts/internal/fct_internal_pay_snapshot.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/internal/fct_internal_pay_snapshot.sql)
- **LINE/RANGE:** `service.py:4076`, `fct_internal_pay_snapshot.sql:4-6`
- **HOW VERIFIED:** PROVEN (Direct code comparison between validation schema and SQL query).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** Eurostat's unadjusted gender pay gap formula is mathematically binary ($(\bar{w}_m - \bar{w}_f)/\bar{w}_m$), so non-binary wages cannot be factored into the ratio without a separate non-binary metric definition.
- **IMPACT:** Employers with non-binary employees have those records silently dropped from headcount, average wages, and category gap figures.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** Yes (Directive 2023/970 reporting guidance regarding non-binary gender categories).

---

### LEDGER ENTRY 07
- **ID:** EV-07
- **CATEGORY:** Compliance / Simulation Logic
- **CLAIM:** Category-level pay differences are evaluated against the EU Pay Transparency Directive Article 9 threshold ($\ge 5\%$ gap).
- **EVIDENCE:** `service.py:_build_pay_transparency_simulation` sets thresholds `observed_gap_pct: 5.0` and `unresolved_review_pct: 10.0`. Gaps $\ge 5\%$ are flagged as `observed_gap` (medium priority); gaps $\ge 10\%$ or market delta $\ge 2\%$ are flagged as `unresolved_review_item` (high priority).
- **FILE:** [`dashboard/backend/service.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py)
- **LINE/RANGE:** 1441–1473
- **HOW VERIFIED:** PROVEN (Direct inspection of simulation threshold mapping).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** None.
- **IMPACT:** Directly enforces the statutory criteria of Article 9(1) of Directive (EU) 2023/970 regarding joint pay assessments.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** Yes (formal legal interpretation of objective justification standards).

---

### LEDGER ENTRY 08
- **ID:** EV-08
- **CATEGORY:** Algorithms / Statistical Benchmarking
- **CLAIM:** Peer country baskets are dynamically calculated using standardized Z-score Euclidean distance across available Eurostat indicators.
- **EVIDENCE:** `_build_peer_group()` computes mean and standard deviation for all macro metrics, calculates $Z = (x - \mu)/\sigma$, computes mean absolute Z-score difference across common metrics, and picks the top 3 nearest countries.
- **FILE:** [`dashboard/backend/service.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py)
- **LINE/RANGE:** 1882–1965
- **HOW VERIFIED:** PROVEN (Mathematical verification of Z-score algorithm).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** None.
- **IMPACT:** Provides a statistically robust, objective peer basket rather than hardcoded geopolitical groupings.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 09
- **ID:** EV-09
- **CATEGORY:** Data Extraction / Eurostat API
- **CLAIM:** Public Eurostat data is extracted as JSON-stat and unrolled into flat tabular frames using NumPy multidimensional unravelling.
- **EVIDENCE:** `scripts/pull_eu_data.py` calls `jsonstat_to_frame()`, which computes multi-index coordinates using `np.unravel_index(indices, sizes).T`.
- **FILE:** [`scripts/pull_eu_data.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/pull_eu_data.py)
- **LINE/RANGE:** 87–131
- **HOW VERIFIED:** PROVEN (Direct inspection of matrix transposition code).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** None.
- **IMPACT:** Handles sparse and dense JSON-stat response formats without third-party JSON-stat library dependencies.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 10
- **ID:** EV-10
- **CATEGORY:** Lifecycle / Startup Invariants
- **CLAIM:** The backend refuses to boot if legacy unmigrated data exists at root paths `data/internal` or `data/governance_events.sqlite`.
- **EVIDENCE:** `main.py` calls `_assert_legacy_data_already_migrated()`, checking for non-gitkeep files in `data/internal` or root SQLite/JSON files. Raises `RuntimeError` unless `WORKFORCEGUARD_SKIP_MIGRATION_CHECK=1`.
- **FILE:** [`dashboard/backend/main.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py)
- **LINE/RANGE:** 69–102
- **HOW VERIFIED:** PROVEN (Direct code analysis of pre-boot assertions).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** Added to force administrators to run `migrate_to_tenant.py` when upgrading from single-tenant to multi-tenant layout.
- **IMPACT:** Prevents silent data loss or unserved legacy files, but causes startup failures if unmigrated test files are left in root directories.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 11
- **ID:** EV-11
- **CATEGORY:** Authentication / Multi-Tenant Onboarding
- **CLAIM:** First-time OAuth login automatically provisions an isolated tenant matching the user's email domain and assigns `role = 'admin'`.
- **EVIDENCE:** In `main.py:auth_callback`, if `memberships` is empty and `oauth_auto_provision_enabled()` is true, the handler creates a tenant using `email.split("@")[1]` and registers the user as admin.
- **FILE:** [`dashboard/backend/main.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py)
- **LINE/RANGE:** 214–224
- **HOW VERIFIED:** PROVEN (Code inspection of OAuth callback provisioning).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** None.
- **IMPACT:** Enables friction-free zero-touch enterprise onboarding, but risks accidental tenant splintering if multiple users with different domain aliases sign in independently.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 12
- **ID:** EV-12
- **CATEGORY:** Compliance / Evidence Pack Format
- **CLAIM:** The compliance evidence pack produced by the platform is a JSON document, not a formatted regulatory PDF or XBRL file.
- **EVIDENCE:** `AnalyticsRepository.build_evidence_pack()` returns a nested Python dictionary containing filters, metrics, comparisons, reviews, and governance integrity metadata. The frontend serializes this to a JSON Blob for download.
- **FILE:** [`dashboard/backend/service.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py) and [`dashboard/frontend/src/hooks/useOverviewData.ts`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/hooks/useOverviewData.ts)
- **LINE/RANGE:** `service.py:5962-6014`, `useOverviewData.ts:121-139`
- **HOW VERIFIED:** PROVEN (Inspection of API return payload and frontend download handler).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** None.
- **IMPACT:** The JSON format is machine-readable and auditable, but requires external client tooling to render into human-readable legal briefs for works councils.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** Yes (regulatory authority requirements for filing formats).

---

### LEDGER ENTRY 13
- **ID:** EV-13
- **CATEGORY:** Security / CORS Validation
- **CLAIM:** CORS origins are validated against a strict regex on module import; malformed origins crash the process immediately.
- **EVIDENCE:** `main.py` matches each origin against `_VALID_ORIGIN_PATTERN` and raises `RuntimeError` if an origin contains trailing slashes or wildcards.
- **FILE:** [`dashboard/backend/main.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py)
- **LINE/RANGE:** 137–150
- **HOW VERIFIED:** PROVEN (Direct inspection of startup regex and exception handler).
- **CONFIDENCE:** PROVEN
- **ALTERNATIVE EXPLANATION:** Defense-in-depth against permissive CORS misconfigurations.
- **IMPACT:** Prevents deployment with insecure wildcard CORS, but causes instant boot crashes on formatting typos.
- **REQUIRES RUNTIME PROOF:** No.
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.

---

### LEDGER ENTRY 14
- **ID:** EV-14
- **CATEGORY:** Testing / Test Suite Coverage
- **CLAIM:** The repository contains robust automated tests for data ingestion, public data preparation, backend service analytics, and frontend UI components, but auth integration tests require a live PostgreSQL instance.
- **EVIDENCE:** Running `pytest tests/` passed 19/19 tests. Running `npm test` in frontend passed 121/121 tests across 25 suites. Running `pytest dashboard/backend/tests` passed 106 tests but failed 5 auth tests due to missing PostgreSQL network access.
- **FILE:** [`tests/`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/tests), [`dashboard/frontend/src/__tests__/`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/__tests__), [`dashboard/backend/tests/`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/tests)
- **LINE/RANGE:** Entire test directory tree
- **HOW VERIFIED:** EMPIRICALLY VERIFIED (Execution of test suites via CLI).
- **CONFIDENCE:** EMPIRICALLY VERIFIED
- **ALTERNATIVE EXPLANATION:** None.
- **IMPACT:** Data logic, calculations, and UI rendering have high regression protection; auth suite requires a running container or CI environment with PostgreSQL service.
- **REQUIRES RUNTIME PROOF:** Yes (demonstrated by CLI test results).
- **REQUIRES LEGAL/EXTERNAL VERIFICATION:** No.
