import { useEffect, type RefObject } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/**
 * Tracks pointer position relative to `ref` and writes CSS variables
 * `--spot-x` / `--spot-y` (percent) for glow / tilt effects.
 */
export function usePointerSpotlight(ref: RefObject<HTMLElement | null>) {
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return

    let raf = 0
    let pendingX = 50
    let pendingY = 50

    const flush = () => {
      raf = 0
      el.style.setProperty('--spot-x', `${pendingX}%`)
      el.style.setProperty('--spot-y', `${pendingY}%`)
    }

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pendingX = ((event.clientX - rect.left) / rect.width) * 100
      pendingY = ((event.clientY - rect.top) / rect.height) * 100
      if (!raf) raf = requestAnimationFrame(flush)
    }

    const onLeave = () => {
      pendingX = 50
      pendingY = 40
      if (!raf) raf = requestAnimationFrame(flush)
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref, reduced])
}
