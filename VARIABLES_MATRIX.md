# EU Variables Matrix (v1)

## Purpose
Map EU report variables to synthetic data generation rules for the four v1 datasets. We keep each dataset schema unchanged and use EU variables as priors to shape distributions and target labels.

## Global EU Context Variables (Priors)
| Variable | Source | Dataset Code | Metric | Use in v1 | Affects Datasets |
|---|---|---|---|---|---|
| Job vacancy rate by sector | Eurostat | jvs_q_nace2 | Vacancy rate (%) | Labor market tightness prior | Turnover, Access |
| Labor market flows | Eurostat | LFS flows | Job mobility rates | Mobility prior | Turnover |
| Gender pay gap | Eurostat | earn_gr_gpgr2, earn_gr_gpgr2ag | Gap by sector/age | Pay equity priors | Turnover, Income |
| Housing cost overburden | Eurostat | TESSI162/164/166 | % >40% income on housing | Housing affordability prior | Housing, Turnover, Income |
| Commuting time | Eurostat | lfso_19 | Commute distribution | Mobility stress prior | Turnover, Housing |
| Job quality index | Eurofound | EWCS2024 | 7 dimensions | Retention risk prior | Turnover |
| Gender equality index | EIGE | GEI2024 | Domain scores | Pay equity context | Turnover, Income |
| Vacancy by occupation/region | EURES | EURES data | Occupation demand | Market competitiveness | Turnover |
| Employment and participation | ILOSTAT | ILO datasets | Employment rates | Macro labor prior | Turnover |

## Dataset Mapping (EU-Synthetic)

### 1) Amazon Employee Access (Role Access)
- Base schema unchanged: ACTION, RESOURCE, MGR_ID, ROLE_ROLLUP_1, ROLE_ROLLUP_2, ROLE_DEPTNAME, ROLE_TITLE, ROLE_FAMILY_DESC, ROLE_FAMILY, ROLE_CODE.
- EU-synthetic rules:
- Use job vacancy rate and labor mobility priors to modulate ACTION class balance (higher mobility -> slightly lower ACTION).
- Preserve categorical cardinalities while re-weighting frequencies to match EU labor tightness priors.
- Validation checks: class balance within EU-informed ranges, stable role hierarchy distributions.

### 2) Employee Turnover Analytics
- Base schema unchanged: satisfaction_level, last_evaluation, number_project, average_montly_hours, time_spend_company, Work_accident, promotion_last_5years, sales, salary, left.
- EU-synthetic rules:
- Use vacancy rate and commuting time priors to shift `left` probability.
- Use gender pay gap priors to set salary-level distribution by demographic flags (if simulated) or overall salary mix.
- Use housing cost overburden to increase turnover risk in high-burden regions.
- Validation checks: turnover rate aligns with EU labor tightness; salary mix consistent with pay gap priors.

### 3) Income Qualification (EU Household Economic Stability)
- Base schema unchanged: all original household features and Target.
- EU-synthetic rules:
- Use EU-SILC housing conditions to shape distributions of overcrowding, bedrooms, wall/roof/floor material proxies.
- Use housing cost overburden to influence Target class balance (higher burden -> higher instability).
- Validation checks: Target prevalence aligns with EU-SILC affordability pressure.

### 4) California Housing (EU Housing Market)
- Base schema unchanged: longitude, latitude, housing_median_age, total_rooms, total_bedrooms, population, households, median_income, ocean_proximity, median_house_value.
- EU-synthetic rules:
- Sample lat/long within EU geographic bounds and map `ocean_proximity` to coastal vs inland ratios.
- Use EU housing cost overburden and price trends as priors for median_house_value distribution.
- Use EU income distributions to shape median_income.
- Validation checks: house price distribution reflects EU affordability priors and regional variance.

## Output Artifacts (v1)
- EU-synthetic datasets (4 files) with unchanged schemas.
- A priors configuration file that records the EU variable targets and ranges used in generation.
- A validation report comparing synthetic distributions to EU priors.

**Last Updated:** 2026-02-03
