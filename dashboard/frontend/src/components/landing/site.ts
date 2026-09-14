export const SITE_URL = 'https://workforceguardai.souravamseekar.com'
export const SUPPORT_EMAIL = 'workforceguardai@souravamseekar.com'
/** Placeholder until UptimeRobot public page is provisioned (see deploy/MONITORING.md). */
export const STATUS_PAGE_URL = 'https://stats.uptimerobot.com/'
export const RESEARCH_PAPER_URL = 'https://mpra.ub.uni-muenchen.de/129330/'
export const RESEARCH_PAPER_LABEL = 'MPRA Paper No. 129330'

/** Public "Try the demo" CTA. Default off until magic-link email is a real mailer. */
export const SANDBOX_CTA_ENABLED = import.meta.env.VITE_ENABLE_SANDBOX_CTA === 'true'

export const SITE_TAGLINE =
  'Pay-gap heat for human review. Built on Eurostat. Not a compliance verdict.'

export const OPEN_CONTACT_EVENT = 'workforceguard:open-contact'

export type FooterLink =
  | { kind: 'hash'; hash: string; label: string }
  | { kind: 'route'; to: string; label: string }
  | { kind: 'external'; href: string; label: string }
  | { kind: 'mailto'; subject: string; label: string }

export type FooterSection = {
  title: string
  links: FooterLink[]
}

export const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: 'Platform',
    links: [
      { kind: 'route', to: '/pay-gap-heat', label: 'Pay-gap heat' },
      { kind: 'route', to: '/product', label: 'Product' },
      { kind: 'route', to: '/directive', label: 'Directive mapping' },
      { kind: 'route', to: '/transposition', label: 'Transposition tracker' },
      { kind: 'route', to: '/security', label: 'Trust centre' },
      { kind: 'route', to: '/demo', label: 'See it live' },
      ...(SANDBOX_CTA_ENABLED
        ? [{ kind: 'route' as const, to: '/sandbox', label: 'Try the demo' }]
        : []),
      { kind: 'external', href: RESEARCH_PAPER_URL, label: 'Methodology' },
      { kind: 'route', to: '/onboarding', label: 'Getting started' },
    ],
  },
  {
    title: 'Company',
    links: [
      { kind: 'route', to: '/mission', label: 'Why WorkforceGuard' },
      { kind: 'route', to: '/problem', label: 'The problem' },
      { kind: 'route', to: '/research', label: 'Research' },
    ],
  },
  {
    title: 'Support',
    links: [
      { kind: 'route', to: '/contact', label: 'Contact' },
      { kind: 'route', to: '/faq', label: 'FAQ' },
      { kind: 'external', href: STATUS_PAGE_URL, label: 'Status' },
      { kind: 'mailto', subject: 'WorkforceGuard feedback', label: 'Feedback' },
      { kind: 'route', to: '/privacy', label: 'Privacy' },
      { kind: 'route', to: '/terms', label: 'Terms' },
    ],
  },
]

export const FOOTER_LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/refunds', label: 'Refunds' },
  { to: '/disclaimer', label: 'Disclaimer' },
] as const

export type NavLink =
  | { kind: 'route'; to: string; label: string }
  | { kind: 'hash'; hash: string; label: string }

/** Full set — mobile drawer */
export const NAV_LINKS: NavLink[] = [
  { kind: 'route', to: '/pay-gap-heat', label: 'Pay-gap heat' },
  { kind: 'route', to: '/product', label: 'Product' },
  { kind: 'route', to: '/directive', label: 'Directive' },
  { kind: 'route', to: '/research', label: 'Research' },
  { kind: 'route', to: '/contact', label: 'Contact' },
  { kind: 'route', to: '/transposition', label: 'Transposition' },
  { kind: 'route', to: '/demo', label: 'See it live' },
  { kind: 'route', to: '/faq', label: 'FAQ' },
  { kind: 'route', to: '/mission', label: 'Mission' },
]

export const NAV_LINKS_PRIMARY: NavLink[] = [
  { kind: 'route', to: '/pay-gap-heat', label: 'Pay-gap heat' },
  { kind: 'route', to: '/product', label: 'Product' },
  { kind: 'route', to: '/directive', label: 'Directive' },
  { kind: 'route', to: '/research', label: 'Research' },
  { kind: 'route', to: '/contact', label: 'Contact' },
]

export const NAV_LINKS_MORE: NavLink[] = [
  { kind: 'route', to: '/problem', label: 'The problem' },
  { kind: 'route', to: '/transposition', label: 'Transposition' },
  { kind: 'route', to: '/demo', label: 'See it live' },
  { kind: 'route', to: '/onboarding', label: 'Getting started' },
  { kind: 'route', to: '/faq', label: 'FAQ' },
  { kind: 'route', to: '/mission', label: 'Mission' },
  { kind: 'route', to: '/security', label: 'Security' },
]

export const PAGE_SECTIONS = [
  { label: 'Pay-gap heat', href: '/pay-gap-heat' },
  { label: 'Product', href: '/product' },
  { label: 'Directive mapping', href: '/directive' },
  { label: 'See it live', href: '/demo' },
  { label: 'Research', href: '/research' },
  { label: 'Contact', href: '/contact' },
  { label: 'FAQ', href: '/faq' },
] as const

/** Old one-page hashes → dedicated routes. */
export const HASH_ROUTE_MAP: Record<string, string> = {
  '#product-tour': '/product',
  '#product': '/product',
  '#compliance': '/directive',
  '#directive': '/directive',
  '#transposition': '/transposition',
  '#security': '/security',
  '#demo': '/demo',
  '#research': '/research',
  '#contact': '/contact',
  '#faq': '/faq',
  '#onboarding': '/onboarding',
  '#problem': '/problem',
  '#heat': '/pay-gap-heat',
  '#pay-gap-heat': '/pay-gap-heat',
}

export const HUB_PAGES = [
  {
    to: '/pay-gap-heat',
    title: 'Pay-gap heat',
    lede: 'Hourly mean and median, variable pay, quartiles, and small-n suppression. Review flags, not a verdict.',
  },
  {
    to: '/directive',
    title: 'What the Directive asks',
    lede: 'What we calculate versus what only counsel can decide. We never auto-justify a gap.',
  },
  {
    to: '/product',
    title: 'Product',
    lede: 'Command centre, market intelligence, compare, pay analysis, and the governance log.',
  },
  {
    to: '/transposition',
    title: 'Transposition tracker',
    lede: 'Which member states have national pay-transparency law, and which still do not.',
  },
  {
    to: '/research',
    title: 'Research',
    lede: 'Tight labour markets have not closed gender pay gaps — 27-country Eurostat panel.',
  },
  {
    to: '/demo',
    title: 'See it live',
    lede: 'Walk through a sample review the way a people-analytics or reward lead would.',
  },
  {
    to: '/problem',
    title: 'The problem',
    lede: 'Spreadsheets, missing hours, and late 5% triggers. Heat is the first look, not the filing.',
  },
  {
    to: '/onboarding',
    title: 'Getting started',
    lede: 'Walkthrough, job-group mapping, payroll CSV, then heat. Tenant sign-in if you need it.',
  },
  {
    to: '/faq',
    title: 'FAQ',
    lede: 'Compliance claims, payroll handling, equal-value mapping, and how to reach us.',
  },
  {
    to: '/security',
    title: 'Security',
    lede: 'What we protect, tenant isolation, and what we do not yet claim.',
  },
  {
    to: '/mission',
    title: 'Mission',
    lede: 'Make pay gaps visible enough to review, with provenance on every figure.',
  },
  {
    to: '/contact',
    title: 'Contact',
    lede: 'Book a walkthrough for your reporting countries and worker categories.',
  },
] as const

export function openContactForm() {
  if (window.location.pathname !== '/contact') {
    window.location.assign('/contact')
    return
  }
  window.dispatchEvent(new CustomEvent(OPEN_CONTACT_EVENT))
}
