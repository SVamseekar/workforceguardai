import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToSection } from '../utils/scrollToSection'

export function useLandingScrollRestore() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (pathname !== '/' && pathname !== '/mission') return
    if (!hash) return
    const id = hash.replace('#', '')
    const timer = window.setTimeout(() => scrollToSection(`#${id}`, 'auto'), 120)
    return () => window.clearTimeout(timer)
  }, [pathname, hash])
}
