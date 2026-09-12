# Institutional bargaining as a conditioning variable (issue #87)

**Date:** 2026-09-12
**Primary result:** not confirmed. Do not add a product composite or research view.

## Question

The existing EU27 panel finds a *cross-sectional* employment–GPG correlation
(r ≈ +0.44) and a *within-country* two-way FE null: tightness alone does not
close gender pay gaps. Issue #87 asks whether that within-country null is an
average over two regimes — high collective-bargaining coverage, where tightness
might compress gaps, and low coverage, where it does not.

The literature motivation is Vaccaro, Wydra-Somaggio and Homrighausen (2024):
Germany's pay-transparency law reduced the gender pay gap only in establishments
with works councils and/or collective bargaining coverage.

## Identification (why a time-invariant BargCov is usable)

OECD/AIAS ICTWSS v2.0 is **not** an annual 2019–2024 EU27 panel. Most member
states' latest AdjCov year sits in 2008–2019. PR1 documented that as a
feasibility finding (`ictwss_eu27_coverage_profile.md`).

That does **not** block a two-way FE *interaction*. Treat BargCov as a
time-invariant country trait (latest available pre-2019 AdjCov). Country fixed
effects absorb the BargCov main effect. The interaction is identified from
within-country employment-rate variation times cross-country BargCov:

```
GPG_it = β1 EmpRate_it + β2 (EmpRate_it × BargCov_i) + γ_i + δ_t + ε_it
```

Standard errors are clustered by country. β2 is the pre-specified test.

Spain is missing from the ICTWSS v2.0 AdjCov/AdjCov_hist export (the v2.0
revision dropped pre-2021 Spain rows). The 80.1% figure is the 2018 OECD/AIAS
vintage via Eurofound's Working Life Country Profile (November 2024). Four
countries (Austria, Belgium, France, Italy) are modelled AdjCov in ICTWSS
rather than directly measured; they are retained for EU27 comparability.

## Pre-specified decision rule

- **Primary:** continuous interaction (Model 6). Confirm institutional gating
  only if p < 0.05 on β2.
- **Secondary:** binary above/below-median split (Model 6b) and split-sample
  slopes. Reported honestly. A significant binary cut **does not** override a
  primary null — median splits of continuous variables are cutpoint-sensitive,
  and each half has only 13–14 country clusters.

`institutional_gating_confirmed()` in
`scripts/bargaining_coverage_interaction.py` implements that rule in code.

## Results (reproducible)

Run: `python scripts/bargaining_coverage_interaction.py`

Tables:

- `table_model6_interaction.csv`
- `table_model6b_binary_split_interaction.csv`
- `table_model6_split_sample.csv`

| Spec | Coefficient of interest | SE | p | N |
|------|-------------------------|----|---|---|
| Model 6: EmpRate × BargCov (primary) | −0.0029 | 0.0026 | **0.280** | 159 / 27 countries |
| Model 6b: difference in slopes, above − below median (secondary) | −0.421 | 0.182 | 0.022 | 159 / 27; median AdjCov = 52.4% |
| Split sample, above-median BargCov | EmpRate β = −0.345 | 0.167 | 0.043 | 84 / 14 |
| Split sample, below-median BargCov | EmpRate β = 0.564 | 0.411 | 0.175 | 75 / 13 |

On the pre-specified test, the tightness–gap null is **not** institutionally
gated. The binary split is directionally consistent with competitive
equalisation operating only where coverage is high, but it disagrees with the
primary continuous test and is too thin for a product claim.

**`institutional_gating_confirmed = False`.**

## Product implication

No dashboard composite. No research-view toggle. No metric-registry row. Product
claims stay gated on the primary null. The binary-split pattern is a candidate
for a later paper revision with a longer panel or firm-level bargaining data,
not a live WorkforceGuard feature.

## Inputs

- `analytics/research/ictwss_eu27_adjcov.csv` — 27-country AdjCov cross-section,
  one-decimal percents, Spain provenance in `source`/`note`.
- `analytics/research/panel_country_year.csv` — 2019–2024 Eurostat country-year
  panel (employment rate, gender pay gap). Three country-years have missing GPG
  (N = 159 complete cases).
