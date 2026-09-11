# OECD/AIAS ICTWSS — EU27 bargaining-coverage profile (issue #87 PR1)

**Date:** 2026-09-11
**Scope:** Data feasibility only. No econometric specification and no product-facing research view.

## Sources

- OECD/AIAS ICTWSS database **version 2.0**, launched **30 September 2025**: <https://oe.cd/ictwss-20>
- Methodology note (October 2025): *Employer organisations, trade union membership, and collective bargaining coverage*
- OECD policy brief (updated December 2025): *Membership of unions and employers’ organisations, and bargaining coverage*

Raw micro-series were **not** ingested in this pass (OECD Data Explorer requires a signed session). This profile is from the published v2.0 notes and the December 2025 brief.

## Recency and update cadence

- ICTWSS is **not** an annual EU27 panel that is refreshed every calendar year.
- Version 1.1 → 2.0 gap is on the order of **two years** (2023 revision; 2.0 in September 2025).
- The methodology note states a **full database update at the end of 2026**.
- Latest year in v2.0 is **2024 or earlier**, not a complete 2019–2024 annual series for every member state.

## Time variation (honest)

- OECD-wide adjusted coverage: **47% (1985) → 33.6% (2024)** — long-run decline, not a 2019–2024 annual EU27 panel.
- **Only 10 of 27 EU countries** sit above the 80% coverage trigger in Directive (EU) 2022/2041 (v2.0).
- Several EU members report **stale “latest year” values**: e.g. Slovenia 2016 in the database (national 2023/24 figures published 6 October 2025 were **too late for v2.0**); Greece/Ireland ~2017; Estonia ~2021; Finland, Hungary, Latvia, Luxembourg ~2022.
- Coverage is described as **stable in most other European countries**, with notable movement in Germany, Greece, and the Netherlands.

## Implication for a 2019–2024 EU27 interaction term

A true annual EU27 bargaining-coverage panel for 2019–2024 **is not supported** by ICTWSS v2.0:

| Requirement | Supported? |
|-------------|------------|
| All 27 member states | Yes as a cross-section of *latest available* year, not a balanced annual panel |
| Annual observations 2019, 2020, 2021, 2022, 2023, 2024 | **No** — many countries have multi-year gaps |
| Within-country year-to-year identifying variation | **Weak / often null** in the 2019–2024 window for most EU members |

**Recommendation:** do not estimate a panel-interaction regression on this vintage. If a later ICTWSS release (end-2026) fills 2019–2024, re-open PR2. Until then, treat institutional bargaining as a **slow-moving country trait**, not a yearly conditioning variable.

## Null-result stance

This PR documents a **feasibility null**: the public ICTWSS v2.0 release does not provide the annual time variation the original research issue asked for. That is a data finding, not a product feature.
