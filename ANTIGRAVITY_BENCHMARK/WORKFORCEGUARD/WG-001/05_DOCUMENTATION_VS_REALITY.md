# 05. Documentation vs. Reality: WorkforceGuard AI

> **Benchmark Track:** WG-001
> **Status:** COMPLETE
> **Evidence Standard:** PROVEN / EMPIRICALLY VERIFIED
> **Target System:** [WorkforceGuard-AI](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI)

---

## 1. Systematic Audit Matrix

| Feature / Claim Area           | Documentation / README Claim                                                                                                                                                                                                                               | Source Code Reality                                                                                                                                                                                                                                                                                                                                                                                                                 | Status & Classification                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **AI Analyst**                 | *"Benchmark-aware analyst — ask natural-language questions; the copilot answers with grounded evidence, provenance citations, and benchmark context..."* ([README.md:L39](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/README.md#L39))     | **Zero Machine Learning or LLM Integration**. It is an ~900-line keyword-matching and string templating Python function ([`service.py:L4833-L5730`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L4833-L5730)).                                                                                                                                                                        | **PROVEN** (Discrepancy in naming/representation; factual in execution) |
| **Database Architecture**      | *"Served via DuckDB at query time, no database server required."* ([README.md:L65](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/README.md#L65))                                                                                            | **Requires PostgreSQL 16**. The backend strictly imports `asyncpg` and fails on startup or authentication without a PostgreSQL database ([`main.py:L114`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L114), [`auth/db.py:L21`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/db.py#L21)). SQLite is also required for audit logs.                 | **PROVEN** (Direct Documentation Mismatch)                              |
| **Evidence Pack Export**       | *"Compliance evidence pack — one-click export of all metrics, provenance, and governance events as a structured bundle ready for regulatory filing."* ([README.md:L43](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/README.md#L43))        | **JSON Payload Only**. The export (`GET /api/evidence-pack`) produces a single JSON file. There is no PDF, XML, or XBRL generation for statutory filing bodies.                                                                                                                                                                                                                                                                     | **PROVEN** (Scope Clarification)                                        |
| **Hash-Chained Governance**    | *"Audit events are chained by SHA-256 so any tampering is detectable. The chain integrity status is shown in the dashboard and verified on every API call."* ([README.md:L89](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/README.md#L89)) | **True SHA-256 Chain, but Truncated to 50 Events**. Both SQLite loader and persistence functions enforce `LIMIT 50` / `[:50]` ([`service.py:L316`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L316), [`L346`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L346)). The verification loop only validates the latest 50 events in memory. | **PROVEN** (Hidden Boundary)                                            |
| **Non-Binary Gender Handling** | Upload contract permits `gender in ('female', 'male', 'non_binary')` ([`service.py:L4076`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L4076)).                                                              | In the dbt modeling layer, [`fct_internal_pay_snapshot.sql:L5`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/internal/fct_internal_pay_snapshot.sql#L5) filters `where gender in ('female', 'male')`. Non-binary employees are silently omitted from pay gap calculations.                                                                                                                   | **PROVEN** (Subtle Functional Dropping)                                 |
| **dbt Pipeline Execution**     | Documentation suggests integrated real-time analytical pipeline upon upload.                                                                                                                                                                               | The dbt invocation in `upload_payroll` is executed via `subprocess.Popen` with `stdout=DEVNULL, stderr=DEVNULL` ([`main.py:L537-L553`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L537-L553)). Failures in dbt runs are silent, and DuckDB write locking blocks concurrent readers.                                                                                                     | **PROVEN** (Runtime Hazard)                                             |

---

## 2. In-Depth Discrepancy Analysis

### Finding 1: The "AI Analyst" Reality
- **The Claim**:
  The README describes a "Benchmark-aware analyst" where users "ask natural-language questions; the copilot answers with grounded evidence, provenance citations, and benchmark context". In contemporary software engineering, "AI Analyst" and "copilot" strongly denote an LLM-backed agent (e.g. GPT-4, Claude, Gemini).
- **The Reality**:
  Inspection of the entire codebase shows **zero dependencies on any LLM or GenAI SDK** (no `openai`, `anthropic`, `google-generativeai`, `langchain`, or `transformers` in [`dashboard/backend/requirements.txt`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/requirements.txt)).
  Instead, [`AnalyticsRepository.answer_question()`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L4833) performs sequential string matching against lowercase keyword tuples:
  ```python
  if any(keyword in normalized for keyword in ["scheduled brief", "workflow", "automation", "alerts"]):
      ...
  if any(keyword in normalized for keyword in ["pay transparency", "compliance simulation", ...]):
      ...
  if any(keyword in normalized for keyword in ["our pay", "internal pay", "company pay", ...]):
      ...
  ```
- **Architectural Trade-off**:
  While the naming is marketing-heavy, the implementation is **rigorously deterministic**:
  - **Zero hallucination risk**: Answers are mathematically bound to live query results.
  - **Auditability**: Every generated sentence maps to deterministic templates with fixed confidence scoring.
  - **Limitation**: Any question falling outside the predefined keyword branches lands in a canned fallback message.

---

### Finding 2: Database Server Requirement
- **The Claim**:
  README.md line 65 states: *"Served via DuckDB at query time, no database server required."*
- **The Reality**:
  The system **strictly requires a running PostgreSQL database server**.
  In [`dashboard/backend/main.py:L114`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L114) and [`dashboard/backend/auth/db.py:L21`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/db.py#L21):
  ```python
  if _pool is None:
      database_url = os.environ["DATABASE_URL"]
      _pool = await asyncpg.create_pool(database_url, min_size=1, max_size=10)
  ```
  If `DATABASE_URL` is missing or if PostgreSQL is unreachable:
  - Startup lifespan fails during migration check if `DATABASE_URL` is set.
  - The first authenticated API call to `require_session` attempts to acquire a connection from `get_pool()` and throws a fatal `KeyError: 'DATABASE_URL'` or `ConnectionRefusedError`.
  Furthermore, the governance log requires **SQLite** via `sqlite3.connect(governance_events_path)`.

---

### Finding 3: The 50-Event Audit Log Truncation
- **The Claim**:
  The system advertises an immutable, legally defensible audit log where *"every decision (approve, override, reverse, export) is written to a SQLite-backed hash-chained event log for legal-grade evidence packs"*, and *"verified on every API call"*.
- **The Reality**:
  The cryptographic SHA-256 hash chaining is genuine, but **the repository truncates the chain to 50 events**:
  1. [`service.py:L316`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L316):
     ```python
     rows = connection.execute(
         """
         select event_json from governance_events
         order by event_sequence desc
         limit 50
         """
     ).fetchall()
     ```
  2. [`service.py:L346`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L346):
     ```python
     for event in self.governance_events[:50]:
         connection.execute(...)
     ```
  3. [`service.py:L435-L454`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L435-L454):
     `_governance_integrity()` only iterates over `self.governance_events`. Once a tenant exceeds 50 events, events 1 through $N-50$ are neither loaded into memory nor included in the cryptographic integrity check. The genesis check (`previous_hash == "GENESIS"`) only passes if the first loaded event is sequence 1; once sequence 1 falls off the 50-event window, the chain verification logic assumes an unanchored state.

---

### Finding 4: Silent Exclusion of Non-Binary Employees
- **The Claim**:
  The upload validation contract ([`service.py:L4076`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L4076)) explicitly accepts `non_binary`:
  ```python
  VALID_GENDERS = {"female", "male", "non_binary"}
  ```
- **The Reality**:
  In the dbt mart model [`fct_internal_pay_snapshot.sql:L4-L6`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/internal/fct_internal_pay_snapshot.sql#L4-L6):
  ```sql
  with payroll as (
      select *
      from {{ ref('stg_internal__payroll_snapshot') }}
      where employment_status in ('active', 'employed')
        and gender in ('female', 'male')
        and base_pay_amount > 0
  )
  ```
  Employees identified as `non_binary` are completely dropped by the `gender in ('female', 'male')` clause. They do not appear in category headcount, female count, male count, or average pay calculations. While Eurostat's unadjusted GPG definition is strictly binary ($(\bar{w}_m - \bar{w}_f)/\bar{w}_m$), dropping non-binary employees without notification or reporting is a hidden functional omission.

---

### Finding 5: Background dbt Invocation & Error Swallowing
- **The Claim**:
  The system claims responsive, connected payroll processing where uploading a payroll CSV immediately enables benchmarking and pay transparency reviews.
- **The Reality**:
  In [`dashboard/backend/main.py:L537-L553`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L537-L553):
  ```python
  subprocess.Popen(
      [
          "dbt",
          "run",
          "--project-dir", str(analytics_dir),
          "--profiles-dir", str(analytics_dir),
          "--select", "tag:internal",
          "--vars", f'{{"tenant_schema": "{repo.tenant_schema}"}}',
      ],
      cwd=str(root_dir),
      env=dbt_env,
      stdout=subprocess.DEVNULL,
      stderr=subprocess.DEVNULL,
  )
  result["dbt_run"] = "triggered"
  ```
  1. **Silent Failures**: Both stdout and stderr are discarded to `DEVNULL`. If dbt compilation fails (syntax error, missing macro, locked database, missing dbt binary), the upload API returns HTTP 200 with `"dbt_run": "triggered"`. The user has no indication that the internal marts failed to build.
  2. **Concurrency Hazard**: While dbt executes, it holds an exclusive write lock on `workforceguard_analytics.duckdb`. Any concurrent API query that runs during this compilation window has only a 3-second retry loop ([`service.py:L520-L536`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L520-L536)) before crashing with HTTP 500.
