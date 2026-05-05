# EU HR Analytics Research Log

## Scope
This log summarizes EU-focused sources to validate and guide WorkforceGuard AI v1. These sources act as a "think tank" for feature selection, variable ranges, and business framing. We do not ingest gated sources in v1.

## Source of Truth
- `eu_hr_analytics_sources.md` (copied from Downloads on 2026-02-03)

## Priority Sources for v1 (Think-Tank + Validation)

### EU Institutions and Statistical Bodies
| ID | Source | Publisher | Year(s) | Region | Key Variables | Dataset Code | Access | V1 Use |
|---|---|---|---|---|---|---|---|---|
| EU-01 | Labour Market Flow Statistics in the EU | Eurostat (EC) | 2023–2025 | EU-27 + EFTA | Employment transitions, job mobility | LFS flows | Free | Retention risk context |
| EU-02 | Gender Pay Gap Statistics (SES) | Eurostat (EC) | Annual | EU-27 | Unadjusted gender pay gap by sector/age | earn_gr_gpgr2, earn_gr_gpgr2ag | Free | Pay equity priors |
| EU-03 | Job Vacancy Rate by NACE Rev. 2 (Quarterly) | Eurostat (EC) | 2001–2025 | EU-27 + UK + EFTA | Vacancy rate by sector/country | jvs_q_nace2 | Free | Labor market tightness |
| EU-04 | Housing Cost Overburden Rate (EU-SILC) | Eurostat (EC) | Annual | EU-27 + EFTA | % population >40% income on housing | TESSI162, TESSI164, TESSI166 | Free | Housing affordability priors |
| EU-05 | Living Conditions in Europe – Housing | Eurostat (EC) | 2024 | EU-27 | Housing affordability and conditions | EU-SILC | Free | Housing context |
| EU-06 | Commuting Time & Main Place of Work (LFS) | Eurostat (EC) | 2019+ | EU-27 | Commute time distribution, WFH | lfso_19 | Free | Mobility priors |
| EU-07 | Flexibility at Work | Eurostat (EC) | 2018–2019 | EU-27 | Work-time flexibility, leave | LFS | Free | Retention context |
| EU-08 | EWCS 2024 First Findings | Eurofound | 2025 | EU-27 + 7 | Job quality (7 dimensions) | EWCS2024 | Free | Job quality priors |
| EU-09 | Gender Pay Transparency in the EU | Eurofound | 2025 | EU-27 | Pay transparency measures | Policy analysis | Free | Pay equity framing |
| EU-10 | Gender Equality Index 2024 | EIGE | 2024 | EU-27 | Gender equality domains | GEI2024 | Free | Pay equity context |
| EU-11 | Job Vacancy Statistics | EURES (EC/ELA) | Ongoing | EU-31 | Vacancy counts by occupation/region | EURES data | Free | Labor demand priors |
| EU-12 | ILOSTAT Database | ILO | Ongoing | Global + EU | Employment, participation, gaps | ILO datasets | Free | Macro labor priors |

### Consulting and International Benchmarks (Context Only)
| ID | Source | Publisher | Year | Key Variables | Access | V1 Use |
|---|---|---|---|---|---|---|
| C-01 | Global Human Capital Trends 2025 | Deloitte | 2025 | Human sustainability, trust | Gate | Narrative framing |
| C-02 | State of AI 2025 | McKinsey | 2025 | AI adoption, skill gaps | Summary | AI adoption context |
| C-03 | AI at Work 2025 | BCG | 2025 | AI adoption by role | Free | AI adoption context |
| C-04 | The Working Future | Bain | 2022 | Worker motivations, archetypes | Free | Retention framing |
| C-05 | Work Reimagined 2024 | EY | 2024 | GenAI adoption trends | Free | AI adoption context |
| C-06 | Workforce Radar 2024 | PwC | 2024 | Retention drivers | Free | Retention framing |
| C-07 | Mercer Benefits Trends 2024 | Mercer | 2024 | Benefits priorities | Summary | Benefits framing |

## Notes
- EU sources will be used to set synthetic distributions and validate v1 outputs, not as direct ingested datasets unless fully open and programmatically accessible.
- Consulting reports are used for narrative validation only, not for feature ingestion in v1.

**Last Updated:** 2026-02-03
