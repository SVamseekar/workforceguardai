import type { LucideIcon } from 'lucide-react'
import {
  BarChart2, Bot, GitCompare, MessageSquare, Scale, ShieldCheck,
} from 'lucide-react'

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

export const MARQUEE_ITEMS = [
  'EU27 · 13 NACE sectors · 2019–2024',
  'Directive (EU) 2023/970 compliance mapping',
  'SHA-256 hash-chained governance log',
  'Eurostat LFS · JVS · SES provenance',
  '5% joint pay assessment threshold flagging',
  'One-click compliance evidence export',
  'Payroll separated from public EU layer',
  'Open methodology and research paper',
]

export const ANALYST_DEMO_LINES: string[][] = [
  ['What is Czechia\'s gender pay gap in financial services?', '11.4% unadjusted (Eurostat SES, 2024)', 'Source: eurostat_ses · confidence: high'],
  ['Which categories need review in our CZ payroll?', '2 unresolved · 1 observed gap', 'Routed to Pay Transparency Review'],
  ['Export evidence for Q1 compliance sign-off', 'Bundle ready: metrics + provenance + governance log', 'SHA-256 chain integrity: verified'],
  ['How does our eng_ic gap compare to the EU average?', 'Internal gap 10.3% · EU27 sector avg 11.1%', 'Benchmark: EU average · NACE J'],
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
