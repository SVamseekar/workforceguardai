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
    eu27UnadjustedGapPct: 10.9,
    eu27FinanceSectorGapPct: 25.0,
    employmentGapCorrelation: 0.44,
    panelCountries: 27,
    panelSectors: 11,
  },
  directive: {
    transpositionLabel: 'Jun 2026',
    firstReportingLabel: 'Jun 2027',
    jointAssessmentThresholdPct: 5,
    unresolvedReviewThresholdPct: 10,
  },
  // Synced from data/paper_exports/ via scripts/sync_landing_facts.py
  countrySamples: [
    { code: 'CZ', name: 'Czechia', employmentRatePct: 82.9, financeGpgPct: 35.6, hpi: 93, ers: 99, period: '2024' },
    { code: 'HU', name: 'Hungary', employmentRatePct: 81.1, financeGpgPct: 40.3, hpi: 88, ers: 90, period: '2024' },
    { code: 'FR', name: 'France', employmentRatePct: 75.4, financeGpgPct: 31.7, hpi: 67, ers: 67, period: '2024' },
    { code: 'EE', name: 'Estonia', employmentRatePct: 81.7, financeGpgPct: 28.0, hpi: 69, ers: 100, period: '2024' },
    { code: 'DE', name: 'Germany', employmentRatePct: 81.1, financeGpgPct: 26.0, hpi: 98, ers: 81, period: '2024' },
    { code: 'IT', name: 'Italy', employmentRatePct: 67.6, financeGpgPct: 21.8, hpi: 71, ers: 34, period: '2024' },
    { code: 'NL', name: 'Netherlands', employmentRatePct: 83.4, financeGpgPct: 21.8, hpi: 100, ers: 56, period: '2024' },
    { code: 'SE', name: 'Sweden', employmentRatePct: 81.8, financeGpgPct: 21.1, hpi: 56, ers: 58, period: '2024' },
    { code: 'IE', name: 'Ireland', employmentRatePct: 80.2, financeGpgPct: 21.7, hpi: 79, ers: 44, period: '2022' },
    { code: 'ES', name: 'Spain', employmentRatePct: 72.4, financeGpgPct: 12.2, hpi: 48, ers: 39, period: '2024' },
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
    label: 'Countries in live example',
    detail: `Sample of ${LANDING_FACTS.market.euMemberStates} member states · ${LANDING_FACTS.market.compositeIndices.length} composite indices.`,
  },
] as const
