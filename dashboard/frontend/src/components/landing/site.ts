export const SITE_URL = 'https://workforceguardai.souravamseekar.com'
export const SUPPORT_EMAIL = 'workforceguardai@souravamseekar.com'
export const RESEARCH_PAPER_URL = 'https://mpra.ub.uni-muenchen.de/129330/'
export const RESEARCH_PAPER_LABEL = 'MPRA Paper No. 129330'

export const SITE_TAGLINE =
  'The compliance intelligence platform for EU employers. Built by analysts. Trusted by HR and compliance leaders.'

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
      { kind: 'hash', hash: '#product-tour', label: 'Product tour' },
      { kind: 'hash', hash: '#compliance', label: 'Compliance mapping' },
      { kind: 'hash', hash: '#demo', label: 'See it live' },
      { kind: 'external', href: RESEARCH_PAPER_URL, label: 'Methodology' },
      { kind: 'hash', hash: '#onboarding', label: 'API & tenant provisioning' },
    ],
  },
  {
    title: 'Company',
    links: [
      { kind: 'route', to: '/mission', label: 'Why WorkforceGuard' },
      { kind: 'hash', hash: '#research', label: 'Research' },
      { kind: 'hash', hash: '#onboarding', label: 'Custom deployment' },
    ],
  },
  {
    title: 'Support',
    links: [
      { kind: 'hash', hash: '#contact', label: 'Contact' },
      { kind: 'hash', hash: '#faq', label: 'FAQ' },
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

export const NAV_LINKS: NavLink[] = [
  { kind: 'hash', hash: '#product-tour', label: 'Product' },
  { kind: 'hash', hash: '#compliance', label: 'Compliance' },
  { kind: 'hash', hash: '#demo', label: 'See it live' },
  { kind: 'hash', hash: '#research', label: 'Research' },
  { kind: 'hash', hash: '#contact', label: 'Contact' },
  { kind: 'hash', hash: '#faq', label: 'FAQ' },
  { kind: 'route', to: '/mission', label: 'Mission' },
]

export const PAGE_SECTIONS = [
  { label: 'Product tour', href: '#product-tour' },
  { label: 'Compliance mapping', href: '#compliance' },
  { label: 'See it live', href: '#demo' },
  { label: 'Research', href: '#research' },
  { label: 'Contact', href: '#contact' },
  { label: 'FAQ', href: '#faq' },
] as const

export function openContactForm() {
  if (window.location.pathname !== '/') {
    window.location.assign('/#contact')
    return
  }
  window.history.pushState(null, '', '#contact')
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  window.dispatchEvent(new CustomEvent(OPEN_CONTACT_EVENT))
}
