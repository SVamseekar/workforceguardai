/**
 * Landing copy grounded in local pipeline output (dbt run + Meridian CZ tenant seed).
 * Update when demo scenario or Eurostat panel changes.
 */
export const LANDING_FACTS = {
  market: {
    euMemberStates: 27,
    naceSectors: 13,
    yearRange: '2019–2024',
    dbtModels: 31,
    compositeIndices: [
      'Hiring Pressure Index',
      'Labour Resilience',
      'Equity Risk Score',
      'Transition Readiness',
    ] as const,
  },
  research: {
    eu27UnadjustedGapPct: 11.1,
    employmentGapCorrelation: 0.41,
    panelCountries: 20,
    panelSectors: 11,
    czAllSectorGapPct: 17.5,
    czFinanceSectorGapPct2023: 36.4,
    eu27FinanceSectorGapPct: 24.28,
  },
  directive: {
    transpositionLabel: 'Jun 2026',
    firstReportingLabel: 'Jun 2027',
    jointAssessmentThresholdPct: 5,
    unresolvedReviewThresholdPct: 10,
  },
  demo: {
    tenantName: 'Meridian CZ',
    countryCode: 'CZ',
    sectorCode: 'K',
    payrollRows: 210,
    jobCodes: 9,
    reviewCategories: [
      { label: 'Risk & Compliance', internalGapPct: 14.8, marketGapPct: 17.5, priority: 'high' as const },
      { label: 'Technology', internalGapPct: 10.0, marketGapPct: 17.5, priority: 'high' as const },
      { label: 'Operations', internalGapPct: 7.2, marketGapPct: 17.5, priority: 'medium' as const },
      { label: 'Client Advisory', internalGapPct: 2.3, marketGapPct: 17.5, priority: 'medium' as const },
    ],
    czFinanceSignals: {
      hiringPressureIndex: 80,
      equityRiskScore: 96,
      labourResilience: 98,
    },
  },
} as const

export const LIVE_PROOF_STATS = [
  {
    value: `${LANDING_FACTS.research.eu27UnadjustedGapPct}%`,
    label: 'EU27 unadjusted gender pay gap',
    detail: 'Research panel benchmark — most employers have not mapped their position.',
  },
  {
    value: `${LANDING_FACTS.directive.jointAssessmentThresholdPct}%`,
    label: 'Joint pay assessment trigger',
    detail: 'Directive (EU) 2023/970 when the gap is unjustified by category.',
  },
  {
    value: String(LANDING_FACTS.demo.reviewCategories.length),
    label: 'Meridian CZ categories flagged',
    detail: 'Live demo tenant from seeded payroll (210 rows · 9 job codes).',
  },
  {
    value: `${LANDING_FACTS.research.czFinanceSectorGapPct2023}%`,
    label: 'CZ finance sector gap (Eurostat SES 2023)',
    detail: `HPI ${LANDING_FACTS.demo.czFinanceSignals.hiringPressureIndex} · ERS ${LANDING_FACTS.demo.czFinanceSignals.equityRiskScore} in semantic metrics.`,
  },
] as const
