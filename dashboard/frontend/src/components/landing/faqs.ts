import { RESEARCH_PAPER_LABEL } from './site'
import { LANDING_FACTS } from './landingFacts'

const { market, research } = LANDING_FACTS

export const FAQS = [
  {
    q: 'Does WorkforceGuard say my company is Directive-compliant?',
    a: 'No. Pay-gap heat flags unadjusted hourly gaps in the worker categories you mapped. It is not a legal determination. Counsel in the member state decides what is unexplained, equal value, and reportable.',
  },
  {
    q: 'What is pay-gap heat?',
    a: 'A category-level review map: hourly conversion, mean and median, base vs variable pay, quartile female shares, and small-cell suppression (fewer than 5 women or 5 men). Gaps at 5% and 10% are review flags — never auto-justified differences.',
  },
  {
    q: 'Who maps equal-value job groups?',
    a: 'You do. Upload a job-architecture file that assigns each job code to a worker category. The calculator does not invent equal-value groups.',
  },
  {
    q: 'What happens to uploaded payroll data?',
    a: 'Payroll stays in a tenant-isolated layer, separate from public EU benchmarks, until you run company-specific comparisons. A live tenant is optional; diagnostic work can also be run with you in the room.',
  },
  {
    q: 'Is the methodology published?',
    a: `Yes — ${RESEARCH_PAPER_LABEL} documents a ${research.panelCountries}-country, ${research.panelSectors}-sector Eurostat panel (${market.yearRange}) with open methodology.`,
  },
  {
    q: 'How do I reach support?',
    a: 'Email workforceguardai@souravamseekar.com for a walkthrough, technical questions, or GDPR requests. We aim to reply within one business day.',
  },
]
