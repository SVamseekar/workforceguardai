import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { scrollToSection } from '../utils/scrollToSection'

export function useHashNavigation(onNavigate?: () => void) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const onHome = pathname === '/'

  const goToHash = useCallback(
    (targetHash: string, behavior: ScrollBehavior = 'smooth') => {
      const normalized = targetHash.startsWith('#') ? targetHash : `#${targetHash}`
      onNavigate?.()

      if (!onHome) {
        navigate(`/${normalized}`)
        return
      }

      window.history.pushState(null, '', normalized)
      requestAnimationFrame(() => scrollToSection(normalized, behavior))
    },
    [navigate, onHome, onNavigate],
  )

  useEffect(() => {
    if (pathname !== '/' || !hash) return
    const timer = window.setTimeout(() => scrollToSection(hash, 'auto'), 50)
    return () => window.clearTimeout(timer)
  }, [pathname, hash])

  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== '/' || !window.location.hash) return
      requestAnimationFrame(() => scrollToSection(window.location.hash, 'auto'))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return { goToHash, onHome }
}
