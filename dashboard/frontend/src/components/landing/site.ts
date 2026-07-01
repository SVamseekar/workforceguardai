export const SITE_URL = 'https://workforceguardai.souravamseekar.com'
export const SUPPORT_EMAIL = 'workforceguardai@souravamseekar.com'
export const RESEARCH_PAPER_URL = 'https://mpra.ub.uni-muenchen.de/129330/'
export const RESEARCH_PAPER_LABEL = 'MPRA Paper No. 129330'

export const OPEN_CONTACT_EVENT = 'workforceguard:open-contact'

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
