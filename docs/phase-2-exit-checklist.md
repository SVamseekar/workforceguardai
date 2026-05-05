# Phase 2 Exit Checklist

This checklist is the concrete closure bar for WorkforceGuard Phase 2.

It is intentionally stricter than "the feature exists." The goal is to freeze Phase 2 in a way that gives Phase 3 a stable foundation.

## Closure verdict

- Product behavior: pass
- Data foundation support: pass
- Frontend and backend verification: pass
- Repo and setup hygiene: pass after this closure update
- Governance persistence: pass after this closure update
- NUTS 2 rollout: intentionally deferred and frozen, not a blocker for moving into Phase 3

## Scope that must be true

- `Phase 1` is complete and remains external-data-only.
- `Phase 2` delivers comparative intelligence on top of that foundation.
- `Phase 3` does not start until Phase 2 behavior is stable and documented.

## Exit checklist

- [x] External market datasets are modeled and available through the WorkforceGuard analytics layer.
- [x] The backend serves a curated comparison-aware overview contract.
- [x] The ask flow answers comparison-led questions with explicit benchmark basis.
- [x] Evidence drawers and evidence-pack export are available in the dashboard experience.
- [x] Coverage and confidence states are explicit in the UI instead of implied.
- [x] Benchmark flows exist for EU, peer-country, direct market, sector, and prior-period comparisons.
- [x] Sparse-coverage states degrade gracefully instead of crashing the app.
- [x] Governance actions exist in the product surface.
- [x] Governance events persist locally across backend restarts.
- [x] Backend regression tests pass in the project environment.
- [x] Reference-data preparation tests pass in the project environment.
- [x] Frontend production build succeeds.
- [x] Run instructions and default ports match the actual application behavior.
- [x] Repo-level ignores cover local environments and generated build outputs.

## Evidence for the current verdict

- Phase 2 behavior is implemented in the backend API and tested through `dashboard/backend/tests/test_service.py`.
- The frontend exposes benchmark-aware comparison and analyst-console flows.
- The local project environment passes:
  - `./.venv-data/bin/python -m unittest dashboard/backend/tests/test_service.py`
  - `./.venv-data/bin/python -m unittest tests/test_prepare_reference_data.py`
  - `cd dashboard/frontend && npm run build`

## Frozen limitations

- NUTS 2 is not yet a live supported product path in the current marts and UI behavior.
- Governance persistence is local-file persistence, not a multi-user audit system.
- Phase 2 remains external-data-only and must not be presented as employer-specific intelligence.
- Formal compliance workflows and broad copilot autonomy remain out of scope until later phases.

## What moves to Phase 3

- internal employer data connectors
- worker-category modeling
- role and skill normalization against internal job architecture
- blended internal-vs-market benchmarking
- analyst responses that distinguish external, internal, and blended evidence

## Recommended Phase 3 first slice

1. Pick one internal source path, preferably payroll plus job architecture CSV ingestion.
2. Define one worker-category model that is not title-only.
3. Build one blended mart for internal-vs-market comparison.
4. Extend the UI to label conclusions as `external`, `internal`, or `blended`.
5. Keep all new company-specific claims blocked unless the supporting data path is present.
