# Surface and Metrics

All numbers below were counted or read directly from the repository at the time of writing (not carried over from the stale `WORKFORCEGUARD_AI_REFERENCE.md`, which undercounts the current backend surface). Where a number comes from a specific committed doc (e.g., `docs/METRICS_CANONICAL.md`) rather than a direct count, that's noted.

## API surface

**22 HTTP routes** in `dashboard/backend/main.py`, including:

- **Auth**: `GET /api/auth/login/{provider}`, `GET /api/auth/callback/{provider}`, `POST /api/auth/logout`, `GET /api/auth/me`
- **Core intelligence**: `GET /api/overview` (the primary command-centre payload), `POST /api/ask` (analyst console), `GET /api/evidence-pack`, `GET /api/research/panel` (public research-panel data)
- **Automation**: `GET /api/brief`, `GET /api/automation`, `POST /api/automation/schedules`, `GET /api/automation/schedules/{schedule_id}/run`
- **Governance**: `POST /api/governance-events`, `GET /api/governance-events`
- **Convenience chart endpoints**: `GET /api/unemployment`, `GET /api/employment`, `GET /api/vacancies`, `GET /api/gender_pay_gap`
- **Company benchmarking**: `GET /api/egapro-benchmark`, `POST /api/upload/payroll`, `POST /api/upload/job-architecture`
- Root (`/`) and `/health`

CORS is env-driven (`CORS_ALLOWED_ORIGINS`), validated at startup — not a wildcard, per current `main.py`.

## Data pipeline surface

- **16 Eurostat datasets** configured in `configs/eu_sources.yaml` (LFS, JVS, SES families) — job vacancy rate, unemployment, long-term unemployment, employment rate, labour market flows/slack, gender pay gap by sector and by age, poverty/exclusion risk, median income, Gini coefficient, three housing-overburden variants, GDP per capita, commuting time.
- **27 EU member states** covered (`dim_geography`), per `docs/METRICS_CANONICAL.md`.
- **13 NACE sectors** exposed as dashboard filters; the **research panel specifically uses 11 sectors** (a narrower, methodology-driven subset — these two sector counts are both correct and refer to different surfaces, per `docs/METRICS_CANONICAL.md`).
- **~31 dbt models** (staging + core/internal/reference marts), confirmed by direct count of `.sql` files under `analytics/models/`.
- **Country-specific company data ingestion**: EGAPRO France (`scripts/ingest_egapro.py`, converts an XLSX index of ~138k French company gender-equality scores, 2018–2025, to Parquet) and UK Gender Pay Gap Service data (`scripts/ingest_uk_gpg.py`, converts a 2024 CSV of UK company disclosures).
- **ESCO reference layer**: occupation hierarchy (v1.2.1), skills (with digital/green skill indicators), occupation-skill relations, and an ESCO↔NACE crosswalk.

## Composite indices (the metrics registry)

Four registered metrics, computed in `mart_semantic_metrics.sql`, driven by `analytics/seeds/reference/ref_metric_registry.csv`:

| Metric | Formula version | Human review required | Implementation status |
|---|---|---|---|
| Hiring Pressure Index (HPI) | 1.2 | Yes | proxy_live |
| Labour Resilience (LR) | 1.1 | No | live |
| Equity Risk Score (ERS) | 1.0 | Yes | proxy_live |
| Transition Readiness (TR) | 0.2 | Yes | proxy_live — explicitly "in development" |

All four are clamped to a [0, 100] scale.

## Compliance/governance surface

- **5 governance actions** (`review_required`, `approved`, `overridden`, `reversed`, `exported`), two of which (`overridden`, `reversed`) require a reason — defined in a seed CSV, not application code.
- **SHA-256 hash-chained** governance event log, with an internal integrity-verification routine run on read.
- **3 pay-transparency review states** (`justified_difference`, `observed_gap`, `unresolved_review_item`) with thresholds stored in mart output: 5% (observed-gap threshold), 10% (unresolved-review threshold), 2% (market-delta threshold) — matching the Directive's own 5% justification trigger.

## Frontend surface

- TypeScript + React Router, organized into routed sections: Home, Market, Compare, Pay Analysis, Govern, Research — plus a landing/marketing site (hero, product tour, demo-request flow, mission/privacy/terms/refunds pages) separate from the authenticated app.
- Auth UI: login screen, `AuthContext`, session-gated shell (sidebar, top bar, slide-in copilot panel).
- **25 frontend test files** under `src/__tests__/` (sections, layout, primitives, hooks, landing, auth, shared components, an accessibility/axe test, and a copy-standards guard test). A commit message in the history states the suite reached "92 tests, 0 failed" at completion of that test-infrastructure work.

## Backend test surface

- **16 backend test files** under `dashboard/backend/tests/`, covering: the core `AnalyticsRepository`/service logic, auth DB, OAuth routes and redirects, session cookies, tenant-schema isolation, repository registry (multi-tenant), route authorization, startup guards, and the tenant-migration script.
- **4 test files** at repo root (`tests/`), covering data-preparation scripts (France public-company data, internal company data, reference data, demo-tenant seeding).

## CI surface

- GitHub Actions (`.github/workflows/ci.yml`) with **5 jobs**: a path-filter `changes` gate, `secret-scan`, `python`, `frontend`, and `analytics` (dbt compile) — the latter three are path-filtered so unrelated changes (e.g., docs-only PRs) skip them.
- A separate `deploy.yml` runs only after CI passes on `main`.

## Data sources and how they're used

| Source | Used for |
|---|---|
| Eurostat (LFS/JVS/SES + socioeconomic series) | The entire public labour-market layer: observed metrics, composite indices, comparison benchmarks, and the research paper's panel |
| ESCO | Occupation/skill dimensions and digital/green skill-coverage inputs to the Transition Readiness index |
| EGAPRO (France) | Company-level benchmark data surfaced via `GET /api/egapro-benchmark` |
| UK Gender Pay Gap Service | Company-level UK disclosure benchmark data |
| Internal payroll/HRIS/ATS/job-architecture/learning uploads | Company-aware benchmarking and pay-transparency review, gated by a trust manifest |

## Honest current status

**What works, verified in code:**
- Full Eurostat ingestion → dbt → DuckDB → FastAPI → React pipeline is live and running in production (`workforceguardai.souravamseekar.com`).
- Multi-tenant auth (OAuth via Google/Microsoft, Postgres-backed sessions/roles) is implemented, not just planned — this is a meaningful correction to the stale reference doc, which describes zero authentication.
- Per-tenant DuckDB schema isolation is implemented and has its own regression test suite, after at least one documented cross-tenant leak was found and fixed.
- SHA-256 hash-chained governance logging is implemented and integrity-checked on read.
- CORS is env-driven and TLS is terminated at the backend VM — both were explicit findings in `docs/SECURITY_AUDIT.md` (2026-06-22) and appear to have been remediated afterward per subsequent commits.
- CI (GitHub Actions) exists and gates production deploy — contradicting the stale reference doc's "no CI/CD" gap claim.

**What's explicitly early-stage or local-only, per the project's own documents:**
- **Transition Readiness (TR)** is explicitly labeled "in development" in the paper abstract and carries `implementation_status: proxy_live` in the metric registry — not presented as a finished, validated index.
- **Internal/company data is sample or synthetic** in the shipped repo — the internal-data trust gate exists precisely because real customer payroll data isn't what's populating the demo tenants; `docs/IMPLEMENTATION_PLAN.md` (dated 2026-07-01) is itself a forward-looking spec for expanding synthetic demo data (FR + CZ scenarios), not evidence that real customer data pipelines exist yet.
- **Evidence-pack hash-signing and PDF rendering** were, as of the last full internal reference pass, not implemented (raw JSON export only) — this specific gap was not independently re-verified in this pass and should be checked against current `service.py` before being cited as still-true.
- **`docs/SECURITY_AUDIT.md` (2026-06-22) found the backend, at that time, had no authentication on any endpoint** despite the OAuth/session system existing elsewhere in the codebase — i.e., the audit describes a state where auth infrastructure existed but wasn't yet enforced on all routes (or was bypassed via `--allow-unauthenticated` on Cloud Run). Subsequent commits (`fix: require session auth and tenant-scoped repository on every data route`, `fix: gate schedule-run output behind admin role`) appear to close this, but this documentation pack did not re-run the audit to confirm no regressions.
- **The `projects/` directory (Amazon Employee Access, California Housing, Employee Turnover Analytics, Income Qualification) is unrelated portfolio/practice ML work, not part of the WorkforceGuard product** — a clear scope boundary, confirmed by directory contents and by `docs/IMPLEMENTATION_PLAN.md` listing `projects/` under "repo hygiene" items to potentially clean up. As of this pass, the four subfolders are **empty on disk** (no notebooks, data, or code present locally — only empty directories and `.DS_Store` files). `projects/` is listed in `.gitignore` (line 11), so it is not tracked in the repo at all; an earlier commit (`8dcb8bf`, "Add portfolio analytics projects") apparently added content before the ignore rule was introduced, but nothing from it survives in the current working tree or in `git ls-files`. There is no extractable domain or technical content here — this is local scratch space, not shipped or historical project material.
- **The paper's own framing is a working paper, not peer-reviewed** — `docs/METRICS_CANONICAL.md` explicitly lists "'Peer-reviewed' for MPRA/SSRN" under "do not claim (unless substantiated)," and instructs using "working paper" instead.

**Numbers to use carefully (explicit guardrails from the project's own canonical-metrics doc, `docs/METRICS_CANONICAL.md`, last updated 2026-07-08):**
- Use **27-country panel**, not 20-country, in body copy (the paper's own title may retain "20-Country" with a footnote — this is a known internal inconsistency the author is actively managing, not an error to silently "fix").
- Employment–GPG correlation: **r ≈ +0.44** (latest paired panel, `B-S_X_O` sector) — note the abstract draft in `docs/paper-abstract-draft.md` states **r ≈ +0.41** for a 20-country sample; these are two different panel vintages, not a typo — the canonical, current figure per the dedicated metrics doc is +0.44 on 27 countries.
- Do not claim "7 ML models, 94.7% accuracy, AUC 0.855" or similar — the canonical doc explicitly flags these as **not in this repo** (likely confused with another of the author's projects).
- Do not claim "28-model dbt pipeline" — current count is ~31.
