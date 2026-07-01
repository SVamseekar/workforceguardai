/** Landing figures sourced from Eurostat SES/LFS and composite index metrics. */
export const LANDING_FACTS = {
  market: {
    euMemberStates: 27,
    naceSectors: 13,
    yearRange: '2019–2024',
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
  countrySamples: [
    { code: 'CZ', name: 'Czechia', employmentRatePct: 82.3, financeGpgPct: 36.4, hpi: 80, ers: 96, period: '2023' },
    { code: 'HU', name: 'Hungary', employmentRatePct: 81.1, financeGpgPct: 34.7, hpi: 96, ers: 93, period: '2023' },
    { code: 'FR', name: 'France', employmentRatePct: 75.1, financeGpgPct: 32.1, hpi: 59, ers: 70, period: '2023' },
    { code: 'EE', name: 'Estonia', employmentRatePct: 81.8, financeGpgPct: 27.6, hpi: 71, ers: 90, period: '2023' },
    { code: 'DE', name: 'Germany', employmentRatePct: 81.3, financeGpgPct: 26.1, hpi: 96, ers: 92, period: '2023' },
    { code: 'IT', name: 'Italy', employmentRatePct: 66.3, financeGpgPct: 23.0, hpi: 60, ers: 18, period: '2023' },
    { code: 'NL', name: 'Netherlands', employmentRatePct: 83.5, financeGpgPct: 22.6, hpi: 100, ers: 63, period: '2023' },
    { code: 'SE', name: 'Sweden', employmentRatePct: 81.9, financeGpgPct: 22.4, hpi: 53, ers: 58, period: '2023' },
    { code: 'IE', name: 'Ireland', employmentRatePct: 79.1, financeGpgPct: 21.7, hpi: 85, ers: 46, period: '2022' },
    { code: 'ES', name: 'Spain', employmentRatePct: 70.5, financeGpgPct: 14.1, hpi: 43, ers: 49, period: '2023' },
  ] as const,
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

export type CountrySample = (typeof LANDING_FACTS.countrySamples)[number]

export function countrySample(code: CountrySample['code']) {
  const row = LANDING_FACTS.countrySamples.find((c) => c.code === code)
  if (!row) throw new Error(`Missing country sample: ${code}`)
  return row
}

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
    detail: 'Eurostat SES NACE K — more than double the all-sector average.',
  },
  {
    value: String(LANDING_FACTS.countrySamples.length),
    label: 'Countries in exposure chart',
    detail: `${LANDING_FACTS.market.compositeIndices.length} composite indices · ${LANDING_FACTS.market.yearRange}.`,
  },
] as const
