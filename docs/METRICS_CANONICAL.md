# WorkforceGuard AI — Canonical Metrics

**Last updated:** 2026-07-08
**Use for:** CV, pitch deck, portfolio, landing page, README, paper abstract.

Regenerate landing constants after paper export changes:

```bash
python scripts/sync_landing_facts.py
```

---

## Platform scope

| Metric | Value | Source |
|--------|-------|--------|
| Eurostat datasets | **16** (LFS, JVS, SES) | `scripts/pull_eu_data.py` |
| EU member states (live) | **27** | DuckDB `dim_geography` |
| NACE sectors (dashboard filters) | **13** | `landingFacts.market.naceSectors` |
| NACE sectors (research SES panel) | **11** | Paper methodology |
| Year range (marketing) | **2019–2024** | Panel exports; warehouse has 2025 rows |
| dbt models | **~31** | `docs/paper/system_description.md` (run `dbt ls` on deploy) |
| Composite indices | **4** — HPI, LR, ERS, TR | `mart_semantic_metrics.sql` |
| Governance | **SHA-256** hash-chained events | `service.py` + SQLite store |
| Live URL | https://workforceguardai.souravamseekar.com | Production |
| Research preprint | [MPRA 129330](https://mpra.ub.uni-muenchen.de/129330/) | Citation |

---

## Research statistics (export-backed)

| Metric | Value | Source |
|--------|-------|--------|
| Panel countries | **27** | `data/paper_exports/panel_country_year.csv` |
| Employment–GPG correlation | **r ≈ +0.44** | Latest paired panel (`B-S_X_O` sector) |
| EU27 all-sector GPG (panel mean) | **10.9%** | Panel export / `landingFacts.ts` |
| EU27 finance GPG (panel mean) | **25.0%** | `table3_sector_heterogeneity.csv` |
| Combined Risk Quadrant | **HPI × ERS** | Paper + `/app/research` |

**Narrative (public):** Cross-sectionally, higher employment associates with higher GPG (r ≈ +0.44); panel fixed-effects find no significant within-country employment effect — tightness alone does not close gaps.

---

## Directive (EU) 2023/970

| Item | Date / value |
|------|----------------|
| Transposition deadline | **7 June 2026** |
| First reporting (≥250 employees) | **June 2027** (2026 data) |
| Reporting (≥100 employees) | **2031** |
| Observed gap threshold (product) | **5%** |
| Unresolved review threshold | **10%** |
| Market delta threshold | **2%** |

---

## Do not claim (unless substantiated)

- 7 ML models, 94.7% accuracy, AUC 0.855, 912K test set, 32,769 training, 99.5% recall — **not in WG repo**
- “28-model dbt pipeline” — stale; use multi-layer or ~31
- “20-country panel” in body copy — use **27** (paper title may retain “20-Country” with footnote)
- “Peer-reviewed” for MPRA/SSRN — use **working paper**
- README “May 2026” as Directive deadline — wrong

---

## Unified copy block

> WorkforceGuard AI ingests **16 Eurostat datasets** across **27 EU member states** and **13 NACE sectors** (dashboard; **11-sector** SES research panel). **dbt + DuckDB** computes **HPI, LR, ERS, TR** with a **SHA-256 hash-chained** governance log. Research panel (**2019–2024**): **r ≈ +0.44** employment–GPG correlation; finance gap **~25%** vs all-sector **~10.9%**. Directive transposition **7 June 2026**; reporting **June 2027** (250+).
