export const LANDING_NAV_OFFSET = 72

export function scrollToSection(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.replace(/^#/, '')
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - LANDING_NAV_OFFSET
  window.scrollTo({ top: Math.max(0, top), behavior })
}
