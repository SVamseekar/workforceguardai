export const SITE_URL = 'https://workforceguardai.souravamseekar.com'

export type NavLink =
  | { kind: 'route'; to: string; label: string }
  | { kind: 'hash'; hash: string; label: string }

export const NAV_LINKS: NavLink[] = [
  { kind: 'route', to: '/mission', label: 'Mission' },
  { kind: 'hash', hash: '#product', label: 'Product' },
  { kind: 'hash', hash: '#compliance', label: 'Compliance' },
  { kind: 'hash', hash: '#research', label: 'Research' },
  { kind: 'hash', hash: '#faq', label: 'FAQ' },
]