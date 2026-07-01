import { useEffect } from 'react'

function isInViewport(node: Element) {
  const rect = node.getBoundingClientRect()
  return rect.top < window.innerHeight * 0.92 && rect.bottom > 0
}

export function useScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll('.landing-reveal')
    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    nodes.forEach((node) => {
      if (isInViewport(node)) {
        node.classList.add('is-visible')
      } else {
        observer.observe(node)
      }
    })

    return () => observer.disconnect()
  }, [])
}
