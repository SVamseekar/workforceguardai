# 01. System Reconstruction: WorkforceGuard AI

> **Benchmark Track:** WG-001
> **Status:** COMPLETE
> **Evidence Standard:** PROVEN / EMPIRICALLY VERIFIED
> **Target System:** [WorkforceGuard-AI](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI)

---

## 1. Executive Definition: What the Product Actually Is

WorkforceGuard AI is an **on-premises/hybrid analytical platform for EU Pay Transparency Directive (Directive 2023/970) compliance simulation, labour-market competitive intelligence, and auditable human governance**.

It combines:
1. **Official Macro Labour Intelligence**: Pre-aggregated Eurostat Labour Force Survey (LFS) and Job Vacancy Statistics (JVS) datasets covering 27 EU member states and NACE Rev. 2 industry sectors from 2019 to 2024.
2. **Occupational & Taxonomy Mapping**: European Skills, Competences, and Occupations (ESCO v1.2) taxonomy linking jobs, digital skills, green skills, and NACE industry codes.
3. **Internal Employer Payroll Ingestion & Simulation**: A tenant-isolated pipeline accepting internal employer payroll snapshots (minimum 10 employees) and job architectures to calculate unadjusted gender pay gaps by worker category and evaluate them against EU Pay Transparency Directive Article 9 review thresholds (specifically the $\ge 5\%$ gap criterion).
4. **Peer Benchmarking**: External market comparators (Eurostat sector averages, statistical Z-score peer-country baskets, and French Égapro corporate gender equity quartiles).
5. **Deterministic "AI Analyst"**: A zero-hallucination, keyword-parsed, rule-based analytics synthesis engine that returns structured, evidence-backed narrative answers with data provenance citations.
6. **Tamper-Evident Governance Ledger**: A per-tenant SQLite store maintaining a SHA-256 hash-chained event log recording human administrative decisions (approvals, overrides, reversals, and exports) under human-in-the-loop compliance requirements.
7. **Compliance Evidence Pack**: A cryptographically verifiable JSON artifact packaging all applied filters, source vintages, raw indicators, comparison deltas, category gap reviews, and governance audit proofs for legal and works-council submission.

---

## 2. Who the Real Users Are

Based on authentication models ([`auth/schema.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/schema.sql)), UI components ([`components/sections/`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/sections)), and export contracts ([`service.py:L6005`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L6005)), the actual system is designed for:

1. **Compensation & Benefits / People Analytics Directors**:
   - Model internal compensation against macroeconomic sector standards before regulatory filing deadlines (June 2026 transposition, June 2027 reporting).
   - Test payroll distributions by worker category and job family to identify non-compliant pay differentials.
2. **Legal, Compliance & Works Council Officers**:
   - Review category gaps that exceed the Directive's 5% Article 9 threshold.
   - Attach formal human rationales to justified pay differences (e.g., market rate, seniority, performance) or log action items to remediate unexplained gaps.
   - Download the hash-chained `evidence-pack` for statutory filings or worker representative consultations.
3. **Executive HR Leadership (CHRO / VP People)**:
   - Review executive briefs on labour tightness, hiring pressure, turnover risk, and wage equity across operating jurisdictions.

---

## 3. End-to-End System Pipeline Reconstruction

```
[Eurostat Dissemination API]
           │
           ▼ (HTTP GET / JSON-stat v1.0)
  scripts/pull_eu_data.py
           │
           ▼ (PyArrow Snappy Parquet)
   data/eu_raw/*.parquet ────────┐
                                 │
 [Internal Payroll CSV Upload]   │
           │                     │
           ▼ (Validation/Sanitize)│ (dbt staging views & core marts)
  scripts/prepare_internal_*.py  ├────────────────────────────────► data/workforceguard_analytics.duckdb
           │                     │                                              │
           ▼                     │                                              │
 data/tenants/{id}/internal/     │                                              ▼
    payroll_snapshot.parquet ────┘                                     dashboard/backend/service.py
                                                                       (AnalyticsRepository)
                                                                                │
                                                                 ┌──────────────┴──────────────┐
                                                                 ▼                             ▼
                                                       FastAPI HTTP Routes             Deterministic Analyst
                                                       (dashboard/backend/main.py)     (answer_question())
                                                                 │                             │
                                                                 ▼                             ▼
                                                        React 18 Dashboard             Structured Evidence +
                                                        (dashboard/frontend/src)       Provenance Citations
                                                                 │                             │
                                                                 └──────────────┬──────────────┘
                                                                                ▼
                                                                     Govern & Export System
                                                                     (SQLite SHA-256 Hash Chain)
                                                                                │
                                                                                ▼
                                                                     Compliance Evidence Pack
                                                                     (JSON Bundle /api/evidence-pack)
```

### Stage 1: Public Labour-Market Ingestion
1. **Trigger & Configuration**: [`scripts/pull_eu_data.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/pull_eu_data.py) loads [`configs/eu_sources.yaml`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/configs/eu_sources.yaml).
2. **API Communication**: Queries Eurostat's public statistics API (`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{code}`).
3. **Format Parsing**: Receives JSON-stat format. Dimension discovery dynamically parses categories, and multi-dimensional coordinate unraveling is performed via NumPy array reshaping (`jsonstat_to_frame()`).
4. **Filtering & Standardization**: Filters data for EU27 countries (`geo.eu27`), years 2019–2024, and specific NACE activity codes.
5. **Persistence**: Emits Snappy-compressed Parquet files into `data/eu_raw/{name}.parquet` and updates `data/eu_meta/manifest.json`.

### Stage 2: Reference & Public Company Ingestion
1. **ESCO Reference Data**: [`scripts/prepare_reference_data.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/prepare_reference_data.py) ingests official ESCO v1.2 CSVs (`skills_en.csv`, `occupations_en.csv`, `occupationSkillRelations.csv`), identifies digital/green skill indicators, maps occupations to NACE Rev. 2 sectors, and writes `data/reference/*.parquet`.
2. **French Égapro Index**: [`scripts/ingest_egapro.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/ingest_egapro.py) parses the French Ministry of Labour XLSX release, maps NAF codes to NACE sections, cleans corporate size bands, and writes `data/public_company/egapro_index.parquet`.
3. **UK Gender Pay Gap Data**: [`scripts/ingest_uk_gpg.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/scripts/ingest_uk_gpg.py) standardizes UK Government Equalities Office disclosures into `data/public_company/uk_gpg_*.parquet`.

### Stage 3: Transformation Graph in dbt & DuckDB
1. **Staging Views** (`analytics/models/staging/`):
   - Direct SQL views over Parquet using DuckDB's `read_parquet()` macro (e.g. [`stg_eurostat__gender_pay_gap_sector.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/staging/eurostat/stg_eurostat__gender_pay_gap_sector.sql)).
2. **Core Marts** (`analytics/models/marts/core/`):
   - [`dim_geography.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/core/dim_geography.sql) denormalizes the 27 EU member states plus the `EU27_AVG` aggregate.
   - [`dim_sector.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/core/dim_sector.sql) defines standard NACE sections (`A` through `S`) plus aggregate sections (`B-S`).
   - [`fct_labour_market_region_sector.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/core/fct_labour_market_region_sector.sql) unifies disparate signals into a standardized long-format time series.
   - [`mart_semantic_metrics.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/core/mart_semantic_metrics.sql) joins macro signals with ESCO skill taxonomies to calculate four composite metrics: `hiring_pressure_index`, `labour_resilience`, `equity_risk_score`, and `transition_readiness`.
3. **Tenant-Isolated Internal Marts** (`analytics/models/marts/internal/`):
   - Tagged `+tags: ["internal"]` in [`analytics/dbt_project.yml`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/dbt_project.yml#L39-L46).
   - Routed by [`analytics/macros/tenant_schema.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/macros/tenant_schema.sql) into a per-tenant schema `tenant_<uuid>` whenever `--vars '{"tenant_schema": "..."}'` is supplied.
   - Generates [`fct_internal_pay_snapshot.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/internal/fct_internal_pay_snapshot.sql) and [`mart_internal_market_pay_benchmark.sql`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/analytics/models/marts/internal/mart_internal_market_pay_benchmark.sql), joining internal company pay by worker category against the corresponding Eurostat sector benchmark.

### Stage 4: FastAPI Service & Data Access Layer
1. **Multi-Tenant Routing**: Incoming HTTP requests carry a signed `wfg_session` cookie. FastAPI dependency [`require_session`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/dependencies.py#L21) validates the session against PostgreSQL, extracting `user_id`, `tenant_id`, and `role`.
2. **Tenant Repository Instantiation**: [`RepositoryRegistry.get_for_tenant(tenant_id)`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L6022) initializes or retrieves an [`AnalyticsRepository`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L196) configured with tenant-scoped storage paths.
3. **DuckDB Search Path Isolation**: When connecting to `data/workforceguard_analytics.duckdb`, the repository executes:
   ```sql
   SET search_path = 'tenant_<uuid>,main'
   ```
   Unqualified queries resolve internal tenant tables first, falling back to shared `main` marts for macro market data.
4. **Main Contamination Guard**: The connection verifies that `main` does not contain any tables in `INTERNAL_TAGGED_TABLES` via [`_assert_main_has_no_internal_tables()`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L538), raising an exception if an improper dbt run contaminated the shared namespace.

### Stage 5: Frontend React Dashboard
1. **Shell & Navigation**: [`dashboard/frontend/src/App.tsx`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/App.tsx) wraps authenticated routes `/app/*` with `AuthProvider`, `PrivateAppSeo`, and `AuthGate`.
2. **State & Synchronization**: [`useOverviewData.ts`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/hooks/useOverviewData.ts) queries `/api/overview` using TanStack Query, synchronizing filter states (`country`, `geography`, `sector`, `period`, `benchmark_geography`, `benchmark_sector`) across URL search parameters.
3. **Visualizations**: Renders time-series trends (Recharts), derived score cards, comparative delta tables, compliance review items, and audit logs.

### Stage 6: The AI Analyst & Governance Engine
1. **Copilot Panel**: User queries typed in `CopilotPanel.tsx` post to `/api/ask`.
2. **Deterministic Synthesizer**: [`AnalyticsRepository.answer_question()`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L4833) classifies the prompt via keyword heuristics, pulls live metrics and active benchmark comparisons, computes confidence and coverage limits, and generates an evidence-grounded response with clickable follow-ups.
3. **Governance Action Logging**: When an admin approves, overrides, or reverses a category gap or exports an evidence pack, `POST /api/governance-events` invokes [`AnalyticsRepository.record_governance_event()`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L5918), hashing `{sequence, id, action, target, actor, timestamp, previous_hash, context}` with SHA-256 and appending it to `governance_events.sqlite`.

### Stage 7: Evidence Pack Export
1. **Export Call**: User clicks "Download Evidence Pack" in UI, invoking `GET /api/evidence-pack`.
2. **Payload Bundling**: Backend compiles applied filters, raw/derived metrics, comparative deltas, internal category gaps, Article 9 simulation states, and audit chain verification status into a single structured JSON payload.
3. **Client Download & Audit Stamp**: The frontend triggers a client-side JSON download (`workforceguard-evidence-{country}-{period}.json`) and immediately posts an `exported` action to `/api/governance-events`, sealing the export event into the SHA-256 chain.

---

## 4. Life of Key User Interactions

### Flow A: Viewing the Dashboard (`/app`)
```
User navigates to /app
  │
  ├─► Frontend sends GET /api/overview?country=FR&geography=FR&sector=ALL&period=latest
  │     Cookie: wfg_session=<HMAC-token>
  │
  ├─► Backend (FastAPI):
  │     1. require_session validates HMAC token with itsdangerous (salt='wfg-session')
  │     2. Queries PostgreSQL sessions table for user_id and tenant_id
  │     3. RepositoryRegistry.get_for_tenant(tenant_id) returns cached/new repo
  │     4. Repo connects to DuckDB with read_only=True
  │     5. Runs SET search_path = 'tenant_<id>,main'
  │     6. Executes analytical queries against fct_labour_market, mart_semantic_metrics,
  │        and mart_internal_market_pay_benchmark
  │     7. Assembles JSON overview tree
  │
  └─► Frontend receives JSON, normalizes data via normalizeOverview.ts,
      and renders Command Centre cards, Recharts plots, and status pills.
```

### Flow B: Ingesting Internal Payroll CSV
```
Admin user uploads payroll.csv in UI
  │
  ├─► Frontend sends POST /api/upload/payroll (multipart/form-data)
  │
  ├─► Backend (FastAPI):
  │     1. require_role("admin") checks membership rank in Postgres
  │     2. _read_uploaded_csv enforces MIME type and 10MB limit
  │     3. repo.ingest_uploaded_payroll validates required columns:
  │        [employee_id, job_code, country_code, worker_category_id,
  │         gender, base_salary, currency, snapshot_date]
  │     4. Validates >= 10 employees, numeric salary > 0, dates not in future
  │     5. Converts base_salary -> base_pay_amount
  │     6. Writes Parquet: data/tenants/{tenant_id}/internal/payroll_snapshot.parquet
  │     7. Updates data/tenants/{tenant_id}/internal_meta/manifest.json (trusted_for_company_claims=True)
  │     8. Fires background dbt execution:
  │        subprocess.Popen(["dbt", "run", "--select", "tag:internal",
  │                          "--vars", '{"tenant_schema": "tenant_<id>"}'])
  │
  └─► Frontend receives { status: "accepted", record_count: N, dbt_run: "triggered" }
```

### Flow C: Querying the AI Analyst
```
User asks: "How does this market compare to the EU benchmark?"
  │
  ├─► Frontend posts to /api/ask with question and current filter state
  │
  ├─► Backend repo.answer_question():
  │     1. Calls build_overview() to get current metrics and active benchmark comparisons
  │     2. Checks prompt keywords against normalized patterns
  │     3. Matches domain: "eu benchmark" -> target benchmark 'eu'
  │     4. Evaluates benchmark availability, delta, and confidence
  │     5. Resolves evidence list, source provenance citations, limitations, and follow-ups
  │     6. Builds deterministic response JSON
  │
  └─► Frontend CopilotPanel displays formatted answer, confidence chip,
      and clickable follow-up suggestion chips.
```

### Flow D: Executing a Governance Action
```
Admin clicks "Approve" on pay category review item
  │
  ├─► Frontend posts to /api/governance-events:
  │     { action_code: "approved", target_type: "pay_transparency_category",
  │       target_id: "pay_transparency_category_review:CAT_01", reason: "Market rate justifiable" }
  │
  ├─► Backend repo.record_governance_event():
  │     1. require_role("admin") verifies admin authorization
  │     2. Queries tenant SQLite governance_events for latest sequence and hash
  │     3. Computes next SHA-256 hash chaining from previous_hash
  │     4. Inserts row into governance_events.sqlite
  │
  └─► Frontend receives confirmation, invalidates TanStack ['overview'] query,
      refetches data, and displays updated category state and verified chain pill.
```
