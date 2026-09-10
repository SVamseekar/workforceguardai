export const LANDING_NAV_OFFSET = 72

function isDomAvailable() {
  return typeof document !== 'undefined'
}

/** Hash jumps skip scroll-reveal intersection; show all sections so the page is not blank. */
export function revealAllLandingSections() {
  if (!isDomAvailable()) return
  document.querySelectorAll('.landing-reveal:not(.is-visible)').forEach((el) => {
    el.classList.add('is-visible')
  })
}

export function scrollToSection(hash: string, behavior: ScrollBehavior = 'smooth') {
  if (!isDomAvailable()) return false
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
    if (!isDomAvailable()) return
    if (scrollToSection(hash, behavior)) {
      revealAllLandingSections()
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
    if (!isDomAvailable()) return
    document.querySelector<HTMLInputElement>('.demo-form input[autocomplete="given-name"]')?.focus()
  }, 450)
}
