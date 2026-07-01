const NAVBAR_OFFSET = 88

export function scrollToSection(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.replace(/^#/, '')
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET
  window.scrollTo({ top, behavior })
}
