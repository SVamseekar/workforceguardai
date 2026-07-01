import type { LucideIcon } from 'lucide-react'
import {
  BarChart2, Bot, GitCompare, MessageSquare, Scale, ShieldCheck,
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
    bullets: ['Country × sector comparison', 'Prior-period and EU-average benchmarks', 'Combined risk quadrant insights'],
  },
  {
    id: 'pay',
    label: 'Pay Analysis',
    icon: Scale,
    headline: 'Payroll blended against EU benchmarks',
    desc: 'Upload payroll and see category-level gender pay gaps ranked by compliance exposure, with threshold flagging for joint pay assessment.',
    screenshot: '/screenshots/pay-analysis.png',
    accentColor: '#f59e0b',
    bullets: ['5% and 10% threshold flagging', 'Internal vs market gap deltas', 'Approve / override / reverse workflow'],
  },
  {
    id: 'govern',
    label: 'Govern & Export',
    icon: ShieldCheck,
    headline: 'Hash-chained audit log and evidence packs',
    desc: 'Every compliance decision is written to a SHA-256 hash-chained governance log with live integrity checks and one-click export.',
    screenshot: '/screenshots/govern-export.png',
    accentColor: '#10b981',
    bullets: ['Tamper-evident event chain', 'Integrity verified on every API call', 'Structured evidence bundle for regulators'],
  },
  {
    id: 'ai',
    label: 'AI Analyst',
    icon: MessageSquare,
    headline: 'Natural-language answers with provenance',
    desc: 'Ask questions about labour markets or your benchmarks; answers include source datasets, benchmark confidence, and coverage notes.',
    screenshot: '/screenshots/ai-analyst.png',
    accentColor: '#c9a84c',
    bullets: ['Grounded evidence, not black-box summaries', 'Benchmark basis selection', 'Refuses when coverage is partial'],
  },
]

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
    question: 'Which worker categories in our payroll need a joint pay assessment under the Directive?',
    answer:
      `${risk.label} (${risk.internalGapPct}% internal gap) and ${tech.label} (${tech.internalGapPct}%) are unresolved_review_item. ${ops.label} is at ${ops.internalGapPct}% — monitor against the ${LANDING_FACTS.directive.unresolvedReviewThresholdPct}% review threshold.`,
    provenance: [
      { label: 'Source', value: 'mart_pay_transparency_category_review' },
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
      { label: 'Dataset', value: 'Eurostat SES · mart_semantic_metrics' },
      { label: 'Countries', value: `${LANDING_FACTS.countrySamples.length} in live sample table` },
      { label: 'Panel', value: `${research.panelCountries} countries · ${research.panelSectors} sectors` },
    ],
    action: 'View Compare narrative',
  },
  {
    persona: 'HR reward · evidence pack',
    question: 'Prepare an evidence bundle for Q1 compliance sign-off.',
    answer:
      `Export bundles category-level gaps for ${demo.reviewCategories.length} worker categories, Eurostat provenance, and governance events. Chain integrity verified on API — ${demo.reviewCategories.length} unresolved items ready for approve/override/reverse.`,
    provenance: [
      { label: 'Governance', value: 'SHA-256 chain · integrity verified' },
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
    action: 'Manifest marked trusted',
  },
  {
    time: 'Step 2',
    title: 'Flag gaps',
    body: 'Categories crossing the 5% Directive threshold surface as review items, ranked by exposure and market delta.',
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
