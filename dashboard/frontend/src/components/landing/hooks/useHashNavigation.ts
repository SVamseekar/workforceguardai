import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HASH_ROUTE_MAP } from '../site'

function normalizeHash(hash: string) {
  return hash.startsWith('#') ? hash : `#${hash}`
}

export function useHashNavigation(onNavigate?: () => void) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()

  const goToHash = useCallback(
    (targetHash: string) => {
      onNavigate?.()
      const route = HASH_ROUTE_MAP[normalizeHash(targetHash)]
      if (route) {
        navigate(route)
        return
      }
      navigate('/')
    },
    [navigate, onNavigate],
  )

  useEffect(() => {
    if (!hash) return
    const route = HASH_ROUTE_MAP[normalizeHash(hash)]
    if (route && pathname !== route) {
      navigate(route, { replace: true })
    }
  }, [hash, navigate, pathname])

  return { goToHash, onHome: pathname === '/' }
}
