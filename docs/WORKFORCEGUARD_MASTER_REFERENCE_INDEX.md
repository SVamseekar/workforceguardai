# WorkforceGuard AI — Master Reference Index

This document series is the complete technical reference for the WorkforceGuard AI platform.
It covers every file, every component, every API endpoint, and every data model in the repository.

---

## Document Map

| Part | Title | Key Sections |
|------|-------|-------------|
| [Part 1](./WORKFORCEGUARD_MASTER_REFERENCE_PART1.md) | Business Overview, Architecture & Data Strategy | Product capabilities, system topology, data sources, metric registry, governance design, roadmap, known blockers |
| [Part 2](./WORKFORCEGUARD_MASTER_REFERENCE_PART2.md) | Analytics Layer — dbt Project, Staging, Marts, Macros | All 28 dbt models, macros, staging schemas, mart schemas, seed CSVs, ingestion scripts |
| [Part 3](./WORKFORCEGUARD_MASTER_REFERENCE_PART3.md) | Backend API — FastAPI Service, Repository, Endpoints | All 9 API endpoints, AnalyticsRepository methods, response contracts, test suite |
| [Part 4](./WORKFORCEGUARD_MASTER_REFERENCE_PART4.md) | Frontend, Data Assets, Operations, Security & Gap Summary | Overview.jsx component map, CSS design system, data files, git history, security posture, startup, known issues |

---

## Quick Reference

### Ports
- Backend: `http://127.0.0.1:8001`
- Frontend (dev): `http://localhost:5173`

### API Endpoints
- `GET /api/overview` — full command-centre payload
- `POST /api/ask` — analyst console question
- `GET /api/evidence-pack` — exportable compliance pack
- `POST /api/governance-events` — record governance action
- `GET /api/governance-events` — list recent events

### Key Files
- `dashboard/backend/service.py` — `AnalyticsRepository` (4,458 lines, all business logic)
- `dashboard/frontend/src/components/Overview.jsx` — entire product UI (2,187 lines)
- `analytics/models/marts/core/mart_semantic_metrics.sql` — four approved business metrics
- `analytics/models/marts/internal/mart_pay_transparency_category_review.sql` — Phase 4 compliance simulation
- `analytics/seeds/reference/ref_metric_registry.csv` — canonical metric definitions
- `configs/eu_sources.yaml` — 16 Eurostat dataset registry

### Phase Status
- Phase 1 (EU market intelligence): Complete
- Phase 2 (Comparative benchmarking): Complete
- Phase 3 (Company-aware decision support): First slice implemented
- Phase 4 (Compliance and governance suite): Started — pay-transparency simulation live
- Phase 5 (AI copilot and workflow automation): Complete

*Generated: 2026-05-07*
