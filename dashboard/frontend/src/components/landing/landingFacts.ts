/**
 * Landing copy grounded in local pipeline output (dbt run + demo tenant seed).
 * EU-wide figures are used on the public page; country-specific demo data lives
 * under `demo` and appears only in the analyst demo section.
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
    eu27FinanceSectorGapPct: 24.28,
    employmentGapCorrelation: 0.41,
    panelCountries: 20,
    panelSectors: 11,
  },
  directive: {
    transpositionLabel: 'Jun 2026',
    firstReportingLabel: 'Jun 2027',
    jointAssessmentThresholdPct: 5,
    unresolvedReviewThresholdPct: 10,
  },
  /** Seeded demo tenant — referenced only in the analyst demo theater. */
  demo: {
    tenantLabel: 'Sample tenant',
    payrollRows: 210,
    jobCodes: 9,
    reviewCategories: [
      { label: 'Risk & Compliance', internalGapPct: 14.8, marketGapPct: 17.5, priority: 'high' as const },
      { label: 'Technology', internalGapPct: 10.0, marketGapPct: 17.5, priority: 'high' as const },
      { label: 'Operations', internalGapPct: 7.2, marketGapPct: 17.5, priority: 'medium' as const },
      { label: 'Client Advisory', internalGapPct: 2.3, marketGapPct: 17.5, priority: 'medium' as const },
    ],
  },
} as const

export const LIVE_PROOF_STATS = [
  {
    value: `${LANDING_FACTS.research.eu27UnadjustedGapPct}%`,
    label: 'EU27 unadjusted gender pay gap',
    detail: 'Research panel benchmark across member states.',
  },
  {
    value: `${LANDING_FACTS.directive.jointAssessmentThresholdPct}%`,
    label: 'Joint pay assessment trigger',
    detail: 'Directive (EU) 2023/970 when the gap is unjustified by category.',
  },
  {
    value: `${LANDING_FACTS.research.eu27FinanceSectorGapPct}%`,
    label: 'EU27 finance sector gap',
    detail: 'Eurostat SES — more than double the all-sector EU27 average.',
  },
  {
    value: String(LANDING_FACTS.market.euMemberStates),
    label: 'Member states in pipeline',
    detail: `${LANDING_FACTS.market.compositeIndices.length} composite indices · ${LANDING_FACTS.market.yearRange} Eurostat panel.`,
  },
] as const
