import type { LucideIcon } from 'lucide-react'
import {
  BarChart2, GitCompare, Scale, ShieldCheck, Sparkles,
} from 'lucide-react'
import { countrySample, LANDING_FACTS } from './landingFacts'

export type ProductTourTab = {
  id: string
  label: string
  icon: LucideIcon
  headline: string
  desc: string
  screenshot: string
  accentColor: string
  bullets: string[]
}

export const PRODUCT_TOUR_TABS: ProductTourTab[] = [
  {
    id: 'home',
    label: 'Command Centre',
    icon: BarChart2,
    headline: 'Signal scores and an executive brief in one view',
    desc: 'Composite Hiring Pressure, Labour Resilience, and Equity Risk scores with an AI-written brief and live EU market indicators.',
    screenshot: '/screenshots/command-centre.png',
    accentColor: '#2dd4bf',
    bullets: ['EU27 signal scores with provenance', 'AI executive brief for leadership', 'Handoffs to pay review and evidence export'],
  },
  {
    id: 'market',
    label: 'Market Intelligence',
    icon: BarChart2,
    headline: 'EU labour-market trends with source citations',
    desc: 'Employment, unemployment, vacancy, and gender pay gap charts across member states and NACE sectors — sourced from Eurostat.',
    screenshot: '/screenshots/market-intelligence.png',
    accentColor: '#3b82f6',
    bullets: ['LFS, JVS, and SES datasets', 'Country and sector filters', 'Freshness and formula version on every metric'],
  },
  {
    id: 'compare',
    label: 'Compare',
    icon: GitCompare,
    headline: 'Side-by-side benchmarking with narrative synthesis',
    desc: 'Delta tables across countries and sectors with auto-generated narrative comparing your selection to EU averages or peers.',
    screenshot: '/screenshots/compare.png',
    accentColor: '#8b5cf6',
    bullets: ['Country × sector comparison', 'Prior-period and EU-average benchmarks', 'Peer-country similarity baskets'],
  },
  {
    id: 'pay',
    label: 'Pay Analysis',
    icon: Scale,
    headline: 'Pay-gap heat against EU benchmarks',
    desc: 'Upload job architecture and payroll to see category-level unadjusted hourly gaps, small-n suppression, and 5% / 10% review flags.',
    screenshot: '/screenshots/pay-analysis.png',
    accentColor: '#f59e0b',
    bullets: ['Hourly mean and median heat', 'Sector-matched market comparator', 'Approve / override / reverse log'],
  },
  {
    id: 'govern',
    label: 'Govern & Export',
    icon: ShieldCheck,
    headline: 'Hash-chained audit log and evidence packs',
    desc: 'Review decisions are written to a SHA-256 hash-chained governance log with live integrity checks and one-click export for counsel.',
    screenshot: '/screenshots/govern-export.png',
    accentColor: '#10b981',
    bullets: ['Tamper-evident event chain', 'Integrity verified on every API call', 'Evidence bundle for reviewers — not a filing'],
  },
]

export const AI_ANALYST_HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'Grounded evidence',
    detail: 'Answers cite Eurostat datasets and benchmark confidence — never black-box summaries.',
  },
  {
    icon: GitCompare,
    title: 'Inherits your filters',
    detail: 'Country, sector, and payroll context from the dashboard flow into every response.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest coverage',
    detail: 'Refuses to answer when data is partial and tells you what is missing.',
  },
] as const

export const MARKET_INTELLIGENCE_SCOPE = [
  { label: 'Market Intelligence', detail: 'Live Eurostat panels with country × sector filters', active: true },
  { label: 'Compare', detail: 'Peer-country similarity baskets and side-by-side deltas' },
  { label: 'Pay Analysis', detail: 'Payroll heat with 5% / 10% review flags and small-n suppression' },
  { label: 'Govern & Export', detail: 'Tamper-evident audit log and evidence bundles' },
] as const

export type AnalystDemoScene = {
  persona: string
  question: string
  answer: string
  provenance: { label: string; value: string }[]
  action?: string
}

const { demo, research } = LANDING_FACTS
const [risk, tech, ops] = demo.reviewCategories

export const ANALYST_DEMO_SCENES: AnalystDemoScene[] = [
  {
    persona: 'Compliance lead',
    question: 'Which worker categories in our payroll show the most pay-gap heat?',
    answer:
      `${risk.label} (${risk.internalGapPct}% internal gap) and ${tech.label} (${tech.internalGapPct}%) need review. ${ops.label} is at ${ops.internalGapPct}% — watch against the ${LANDING_FACTS.directive.unresolvedReviewThresholdPct}% review flag. This is not a joint pay assessment.`,
    provenance: [
      { label: 'Source', value: 'Pay transparency review' },
      { label: 'Demo tenant', value: `${demo.payrollRows} payroll rows · ${demo.jobCodes} job codes` },
      { label: 'Confidence', value: 'High — trusted payroll + job architecture' },
    ],
    action: 'Open Pay Transparency Review',
  },
  {
    persona: 'People analytics',
    question: 'How does the EU27 finance sector gender pay gap compare to the all-sector average?',
    answer:
      `EU27 NACE K averages ${research.eu27FinanceSectorGapPct}% vs ${research.eu27UnadjustedGapPct}% all-sector. Sample: Hungary ${countrySample('HU').financeGpgPct}%, France ${countrySample('FR').financeGpgPct}%, Netherlands ${countrySample('NL').financeGpgPct}% (HPI ${countrySample('NL').hpi}), Spain ${countrySample('ES').financeGpgPct}%.`,
    provenance: [
      { label: 'Dataset', value: 'Eurostat Structure of Earnings Survey' },
      { label: 'Countries', value: `${LANDING_FACTS.countrySamples.length} in exposure chart` },
      { label: 'Panel', value: `${research.panelCountries} countries · ${research.panelSectors} sectors` },
    ],
    action: 'View Compare narrative',
  },
  {
    persona: 'HR reward · evidence pack',
    question: 'Prepare an evidence bundle for Q1 review with counsel.',
    answer:
      `Export bundles category-level heat for ${demo.reviewCategories.length} worker categories, Eurostat provenance, and governance events. Chain integrity verified on API. Counsel still decides what is unexplained.`,
    provenance: [
      { label: 'Governance', value: 'Tamper-evident audit log' },
      { label: 'Export', value: 'JSON evidence bundle' },
      { label: 'Review queue', value: `${demo.reviewCategories.length} categories · tenant-isolated` },
    ],
    action: 'Export evidence pack',
  },
]

export const WORKFLOW_STEPS = [
  {
    time: 'Step 1',
    title: 'Upload payroll',
    body: 'CSV upload with job codes mapped to worker categories. Payroll stays tenant-isolated from the public EU reference layer.',
    action: 'Admin promotes trusted assets',
  },
  {
    time: 'Step 2',
    title: 'Flag gaps',
    body: 'Categories crossing 5% and 10% unadjusted hourly flags surface for review, ranked by heat and market delta.',
    action: '2 unresolved · 1 observed',
  },
  {
    time: 'Step 3',
    title: 'Review & decide',
    body: 'Compliance teams approve, override, or reverse each item with evidence and benchmark context attached.',
    action: 'Hash-chained governance log',
  },
  {
    time: 'Step 4',
    title: 'Export evidence',
    body: 'One-click bundle of metrics, provenance, and governance events — ready for regulatory filing.',
    action: 'Evidence pack export',
  },
]
