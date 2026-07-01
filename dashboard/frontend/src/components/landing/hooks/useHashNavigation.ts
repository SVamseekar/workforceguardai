import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { scrollToSection, scrollToSectionWhenReady } from '../utils/scrollToSection'

function normalizeHash(hash: string) {
  return hash.startsWith('#') ? hash : `#${hash}`
}

function hashId(hash: string) {
  return normalizeHash(hash).slice(1)
}

export function useHashNavigation(onNavigate?: () => void) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const onHome = pathname === '/'

  const goToHash = useCallback(
    (targetHash: string, behavior: ScrollBehavior = 'smooth') => {
      const normalized = normalizeHash(targetHash)
      const id = hashId(normalized)
      onNavigate?.()

      if (!onHome) {
        navigate({ pathname: '/', hash: id }, { preventScrollReset: true })
        return
      }

      if (hash !== normalized) {
        navigate({ pathname: '/', hash: id }, { preventScrollReset: true })
        window.setTimeout(() => scrollToSectionWhenReady(normalized, behavior), 60)
        return
      }

      scrollToSectionWhenReady(normalized, behavior)
    },
    [hash, navigate, onHome, onNavigate],
  )

  useEffect(() => {
    if (pathname !== '/' || !hash) return
    scrollToSectionWhenReady(hash, 'auto')
  }, [pathname, hash])

  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== '/' || !window.location.hash) return
      requestAnimationFrame(() => scrollToSectionWhenReady(window.location.hash, 'auto'))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return { goToHash, onHome }
}
