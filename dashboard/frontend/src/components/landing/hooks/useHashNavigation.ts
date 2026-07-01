import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { focusContactForm, scrollToSection } from '../utils/scrollToSection'

function normalizeHash(hash: string) {
  return hash.startsWith('#') ? hash : `#${hash}`
}

export function useHashNavigation(onNavigate?: () => void) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const onHome = pathname === '/'

  const goToHash = useCallback(
    (targetHash: string, behavior: ScrollBehavior = 'smooth') => {
      const normalized = normalizeHash(targetHash)
      const hashId = normalized.slice(1)
      onNavigate?.()

      if (!onHome) {
        navigate(`/${normalized}`)
        return
      }

      const scroll = () => {
        scrollToSection(normalized, behavior)
        if (hashId === 'contact') focusContactForm()
      }

      if (hash !== normalized) {
        navigate({ pathname: '/', hash: hashId }, { preventScrollReset: true })
        window.setTimeout(scroll, 60)
        return
      }

      scroll()
    },
    [hash, navigate, onHome, onNavigate],
  )

  useEffect(() => {
    if (pathname !== '/' || !hash) return
    const timer = window.setTimeout(() => {
      scrollToSection(hash, 'auto')
      if (hash.replace(/^#/, '') === 'contact') focusContactForm()
    }, 80)
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
