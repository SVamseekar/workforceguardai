export const LANDING_NAV_OFFSET = 72

export function scrollToSection(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.replace(/^#/, '')
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior, block: 'start' })
}

export function focusContactForm() {
  window.setTimeout(() => {
    document.querySelector<HTMLInputElement>('.demo-form input[autocomplete="given-name"]')?.focus()
  }, 450)
}
