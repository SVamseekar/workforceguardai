import { useEffect } from 'react'

function isInViewport(node: Element) {
  const rect = node.getBoundingClientRect()
  return rect.top < window.innerHeight * 0.92 && rect.bottom > 0
}

function reveal(node: Element) {
  node.classList.add('is-visible')
  // Cascade stagger children after parent becomes visible
  if (node.classList.contains('landing-stagger')) {
    node.querySelectorAll('.landing-stagger__item').forEach((child, i) => {
      const el = child as HTMLElement
      el.style.setProperty('--stagger-i', String(i))
      // Force reflow so transition runs after delay is applied
      requestAnimationFrame(() => {
        child.classList.add('is-visible')
      })
    })
  }
}

/**
 * Observes `.landing-reveal` and `.landing-stagger` nodes.
 * Adds `is-visible` once (no re-hide) so animations play once on enter.
 */
export function useScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll('.landing-reveal, .landing-stagger')
    if (!nodes.length) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      nodes.forEach((node) => reveal(node))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' },
    )

    nodes.forEach((node) => {
      if (isInViewport(node)) {
        reveal(node)
      } else {
        observer.observe(node)
      }
    })

    return () => observer.disconnect()
  }, [])
}
