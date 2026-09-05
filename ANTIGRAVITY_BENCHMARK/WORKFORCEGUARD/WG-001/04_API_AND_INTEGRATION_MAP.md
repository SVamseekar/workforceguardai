# 04. API and Integration Map: WorkforceGuard AI

> **Benchmark Track:** WG-001
> **Status:** COMPLETE
> **Evidence Standard:** PROVEN / EMPIRICALLY VERIFIED
> **Target System:** [WorkforceGuard-AI](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI)

---

## 1. Complete API Contract Surface

All endpoints are registered in [`dashboard/backend/main.py`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py).

```
Base URL: /api (or root for health/info)
Authentication: Signed HTTP-only cookie `wfg_session`
```

### Route Table

| Path                                 | Method | Auth Dependency   | Role Required | Request Body / Parameters                                                                                                                    | Success Status | Response Shape / Data Contract                                                                                                              |
| ------------------------------------ | ------ | ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/health`                            | GET    | None              | Public        | None                                                                                                                                         | 200            | `{"status": "ok", "service": "...", "generated_at": "..."}`                                                                                 |
| `/`                                  | GET    | None              | Public        | None                                                                                                                                         | 200            | Service status, supported grains, governance actions catalog                                                                                |
| `/api/auth/login/{provider}`         | GET    | None              | Public        | Path: `provider` (`google` \| `microsoft`)                                                                                                   | 302            | HTTP 302 redirect to OAuth authorization URL                                                                                                |
| `/api/auth/callback/{provider}`      | GET    | None              | Public        | Query: `code`, `state`                                                                                                                       | 302            | Sets `wfg_session` cookie; redirects to `/app` (or login error)                                                                             |
| `/api/auth/logout`                   | POST   | None              | Public        | Cookie: `wfg_session`                                                                                                                        | 200            | Deletes session from DB; deletes cookie; `{"status": "logged_out"}`                                                                         |
| `/api/auth/me`                       | GET    | `require_session` | Member (0+)   | None                                                                                                                                         | 200            | `{"user_id": "...", "tenant_id": "...", "role": "...", "email": "...", "linked_providers": [...]}`                                          |
| `/api/overview`                      | GET    | `get_repository`  | Member (0+)   | Query: `country`, `geography`, `sector`, `period`, `benchmark_geography`, `benchmark_sector`                                                 | 200            | Full dashboard payload tree (metrics, semantic scores, comparisons, internal pay gap, copilot)                                              |
| `/api/ask`                           | POST   | `get_repository`  | Member (0+)   | Body: [`AskRequest`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L35) (`question`, filter params) | 200            | `{"question": "...", "category": "...", "confidence": "...", "answer": "...", "evidence": [...], "provenance": [...], "follow_ups": [...]}` |
| `/api/evidence-pack`                 | GET    | `get_repository`  | Member (0+)   | Query: Filter params                                                                                                                         | 200            | Structured compliance evidence pack JSON bundle                                                                                             |
| `/api/brief`                         | GET    | `get_repository`  | Member (0+)   | Query: Filter params                                                                                                                         | 200            | Executive briefing subsection (`overview["brief"]`)                                                                                         |
| `/api/automation`                    | GET    | `get_repository`  | Member (0+)   | Query: Filter params                                                                                                                         | 200            | Automation templates, alerts, and workflow handoffs                                                                                         |
| `/api/automation/schedules`          | POST   | `get_repository`  | Admin (1)     | Body: [`AutomationScheduleRequest`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L54)              | 200            | Created schedule record with schedule ID                                                                                                    |
| `/api/automation/schedules/{id}/run` | GET    | `get_repository`  | Admin (1)     | Path: `schedule_id`                                                                                                                          | 200            | Formatted execution payload for scheduled template                                                                                          |
| `/api/governance-events`             | GET    | `get_repository`  | Member (0+)   | None                                                                                                                                         | 200            | Recent governance events + SHA-256 integrity report                                                                                         |
| `/api/governance-events`             | POST   | `get_repository`  | Admin (1)     | Body: [`GovernanceEventRequest`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L45)                 | 200            | Persisted event with sequence, previous_hash, and event_hash                                                                                |
| `/api/upload/payroll`                | POST   | `get_repository`  | Admin (1)     | Multipart: `file` (.csv, max 10MB)                                                                                                           | 200            | `{"status": "accepted", "record_count": N, "snapshot_date": "...", "validation": {...}, "dbt_run": "triggered"}`                            |
| `/api/upload/job-architecture`       | POST   | `get_repository`  | Admin (1)     | Multipart: `file` (.csv, max 10MB)                                                                                                           | 200            | `{"status": "accepted", "record_count": N, "dbt_run": "triggered"}`                                                                         |
| `/api/research/panel`                | GET    | `get_repository`  | Member (0+)   | Query: `trajectory_group`                                                                                                                    | 200            | Scatter points, time-series trajectories, and finance sector bar metrics                                                                    |
| `/api/egapro-benchmark`              | GET    | `get_repository`  | Member (0+)   | Query: `country`, `sector`, `size_band`, `year`                                                                                              | 200            | French Égapro peer quartiles (P25, P50, P75, mean)                                                                                          |
| `/api/unemployment`                  | GET    | `get_repository`  | Member (0+)   | Query: `geography`, `period`                                                                                                                 | 200            | Time-series array for unemployment chart                                                                                                    |
| `/api/employment`                    | GET    | `get_repository`  | Member (0+)   | Query: `geography`, `period`                                                                                                                 | 200            | Time-series array for employment chart                                                                                                      |
| `/api/vacancies`                     | GET    | `get_repository`  | Member (0+)   | Query: `geography`, `sector`, `period`                                                                                                       | 200            | Bar-series array for vacancy by sector chart                                                                                                |
| `/api/gender_pay_gap`                | GET    | `get_repository`  | Member (0+)   | Query: `geography`, `sector`, `period`                                                                                                       | 200            | Bar-series array for gender pay gap by sector chart                                                                                         |

---

## 2. Request Models & Schemas

Defined in [`dashboard/backend/main.py:L35-L63`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L35-L63):

### 1. `AskRequest`
```python
class AskRequest(BaseModel):
    question: str
    country: str = "ALL"
    geography: str = "EU27_AVG"
    sector: str = "ALL"
    period: str = "latest"
    benchmark_geography: Optional[str] = None
    benchmark_sector: Optional[str] = None
```

### 2. `GovernanceEventRequest`
```python
class GovernanceEventRequest(BaseModel):
    action_code: str          # approved | overridden | reversed | exported | review_required
    target_type: str          # pay_transparency_category | compliance_simulation | evidence_pack
    target_id: str            # e.g. "pay_transparency_category_review:CAT_01"
    actor: Optional[str] = None
    reason: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
```

### 3. `AutomationScheduleRequest`
```python
class AutomationScheduleRequest(BaseModel):
    template_id: str          # scheduled_executive_brief | scheduled_transparency_pack
    country: str = "ALL"
    geography: str = "EU27_AVG"
    sector: str = "ALL"
    period: str = "latest"
    rrule: Optional[str] = None
    approved: bool = False
    actor: Optional[str] = None
```

---

## 3. Error Contract & Status Code Matrix

Error handling is wrapped by [`guarded()`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L160) and FastAPI exception handlers:

| HTTP Status               | Trigger Condition                                                 | Code Reference                                                                                                                           | Response Payload                                                                |
| ------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **400 Bad Request**       | Missing CSV columns, invalid gender, negative salary, future date | [`service.py:L4080-L4116`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L4080-L4116)        | `{"detail": "Missing required columns: ..."}`                                   |
| **400 Bad Request**       | Non-CSV file uploaded to `/api/upload/*`                          | [`main.py:L561-L564`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L561-L564)                  | `{"detail": "Only CSV files are accepted."}`                                    |
| **401 Unauthorized**      | Missing or corrupted `wfg_session` cookie                         | [`dependencies.py:L24-L28`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/dependencies.py#L24-L28) | `{"detail": "Not authenticated"}` or `{"detail": "Session expired or invalid"}` |
| **401 Unauthorized**      | Expired session timestamp in PostgreSQL                           | [`dependencies.py:L45`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/dependencies.py#L45)         | `{"detail": "Session expired or invalid"}`                                      |
| **403 Forbidden**         | Non-admin user calling admin routes (`require_role("admin")`)     | [`dependencies.py:L59-L60`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/auth/dependencies.py#L59-L60) | `{"detail": "Requires admin role"}`                                             |
| **404 Not Found**         | Missing parquet file or unknown resource in `AnalyticsRepository` | [`main.py:L163-L164`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L163-L164)                  | `{"detail": "<FileNotFoundError message>"}`                                     |
| **413 Payload Too Large** | Uploaded file size exceeds 10MB                                   | [`main.py:L567-L571`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L567-L571)                  | `{"detail": "File too large. Maximum upload size is 10MB."}`                    |
| **500 Internal Error**    | Uncaught exceptions, DuckDB lock contention timeout               | [`main.py:L167-L168`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/main.py#L167-L168)                  | `{"detail": "<error string>"}`                                                  |

---

## 4. The "AI Analyst" Reality & Execution Contract

The endpoint `POST /api/ask` is evaluated by [`AnalyticsRepository.answer_question()`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/backend/service.py#L4833-L5730).

### Keyword Dispatch Matrix
The engine parses the incoming `question` string into lowercase and tests membership across sequential branches:

```
normalized = prompt.lower()
  │
  ├─► Automation & Handoffs: ("scheduled brief", "workflow", "automation", "alerts", ...)
  │     └─► Synthesizes Phase 5 alerts, handoffs, and scheduled template count.
  │
  ├─► Pay Transparency Simulation: ("pay transparency", "transparency exposure", "compliance simulation", ...)
  │     └─► Reviews worker category counts, unresolved items, observed gaps, max gap.
  │
  ├─► Internal Company Pay: ("our pay", "internal pay", "company pay", "worker category", ...)
  │     └─► Compares internal worker category gap vs. Eurostat sector signal.
  │
  ├─► Evidence Basis: ("based on internal", "based on market", "blended evidence", ...)
  │     └─► Explains whether answer uses internal data, external market, or blended evidence.
  │
  ├─► Benchmark Basis: ("compared to what", "compare to what", "benchmark basis", ...)
  │     └─► Details the active comparison basis (EU, peer basket, prior period, market, sector).
  │
  ├─► Limitations & Caveats: ("what limits this comparison", "limitations", "assumptions", ...)
  │     └─► Returns specific analytical limitations for the selected comparison.
  │
  ├─► Prior Period Shifts: ("what changed", "prior period", "worsening fastest", ...)
  │     └─► Ranks metrics by worsening delta against prior statistical period.
  │
  ├─► EU Benchmark: ("how does this market compare to the eu benchmark", "eu benchmark", ...)
  │     └─► Summarizes gaps across all comparable metrics against EU27 average.
  │
  ├─► Recommendations: ("what should hr leaders do next", "recommendations", "actions", ...)
  │     └─► Formulates prioritized HR action list based on observed risk metrics.
  │
  └─► Metric Inquiries: ("vacancy", "pay gap", "resilience", "hiring pressure", "transition readiness")
        └─► Returns exact scalar values, rankings, and source citations.
```

### Deterministic Response Contract
The response guarantees the following JSON contract:
```json
{
  "question": "How does this market compare to the EU benchmark?",
  "category": "comparison",
  "confidence": "high",
  "answer": "Compared to the EU27 proxy average, this market has a 3.1% higher vacancy rate and a 1.4% lower gender pay gap.",
  "evidence": [
    { "label": "Job vacancy rate", "value": "4.2% vs 1.1% (EU)" },
    { "label": "Gender pay gap", "value": "12.8% vs 14.2% (EU)" }
  ],
  "provenance": [
    {
      "source_id": "eurostat_jvs",
      "metric_id": "job_vacancy_rate",
      "formula_version": "jvs-v1",
      "human_review_required": false
    }
  ],
  "follow_ups": [
    "Which peer countries look most similar?",
    "What changed versus the prior period?",
    "What limits this comparison?"
  ],
  "benchmark_basis": {
    "id": "eu",
    "label": "EU27 proxy average",
    "benchmark_status": "proxy",
    "applicable_metric_count": 4,
    "total_metric_count": 4
  },
  "coverage": {
    "status": "full",
    "summary": "All 4 core metrics available in EU27 benchmark.",
    "applicable_metric_count": 4,
    "total_metric_count": 4
  },
  "limitations": [
    "EU27 average is a proxy aggregate and does not account for national collective bargaining structures."
  ],
  "applied_filters": {
    "country": "DE",
    "geography": "DE",
    "sector": "ALL",
    "period": "latest"
  },
  "evidence_basis": "external",
  "internal_data_available": false
}
```

---

## 5. Frontend-Backend Integration Points

### Query Invalidation Lifecycle
Managed by [`dashboard/frontend/src/hooks/useOverviewData.ts`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/hooks/useOverviewData.ts):
- **Query Key**: `['overview', { country, geography, sector, period, benchmark_geography, benchmark_sector }]`.
- **Invalidation Triggers**:
  - `governanceMutation.onSuccess`: Invalidates `['overview']` to immediately reflect recorded category decisions (`approved`, `overridden`, `reversed`).
  - `uploadPayrollMutation.onSuccess`: Invalidates `['overview']` to trigger re-fetching of internal company benchmarks.
  - `scheduleMutation.onSuccess`: Invalidates `['overview']` to display newly created automation workflows.

### Filter URL State Synchronization
[`dashboard/frontend/src/components/sections/PayAnalysisSection.tsx:L38-L48`](file:///Users/souravamseekarmarti/Projects/WorkforceGuard-AI/dashboard/frontend/src/components/sections/PayAnalysisSection.tsx#L38-L48):
- When navigating to Pay Analysis, an effect hook synchronizes `geography` with `country` and resets `sector` to `ALL`:
  ```typescript
  useEffect(() => {
    const needsGeoSync = filters.country !== 'ALL' && filters.geography !== filters.country
    const needsSectorReset = filters.sector !== 'ALL'
    if (needsGeoSync || needsSectorReset) {
      setFilters({
        ...filters,
        geography: filters.country !== 'ALL' ? filters.country : filters.geography,
        sector: 'ALL',
      })
    }
  }, [filters.country])
  ```
- This ensures the DuckDB query against `mart_internal_market_pay_benchmark` receives the country code required to match internal employer rows against country-level Eurostat comparators.
