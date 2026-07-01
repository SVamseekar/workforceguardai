export const LANDING_NAV_OFFSET = 72

export function scrollToSection(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.replace(/^#/, '')
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior, block: 'start' })
  return true
}

export function scrollToSectionWhenReady(
  hash: string,
  behavior: ScrollBehavior = 'auto',
  attempts = 16,
  intervalMs = 50,
) {
  const id = hash.replace(/^#/, '')
  const tryScroll = (remaining: number) => {
    if (scrollToSection(hash, behavior)) {
      if (id === 'contact') focusContactForm()
      return
    }
    if (remaining > 0) {
      window.setTimeout(() => tryScroll(remaining - 1), intervalMs)
    }
  }
  tryScroll(attempts)
}

export function focusContactForm() {
  window.setTimeout(() => {
    document.querySelector<HTMLInputElement>('.demo-form input[autocomplete="given-name"]')?.focus()
  }, 450)
}
