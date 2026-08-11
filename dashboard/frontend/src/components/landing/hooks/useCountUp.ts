import { useEffect, useState, type RefObject } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type UseCountUpOptions = {
  /** Final numeric value to animate toward */
  end: number
  /** Milliseconds for the full animation */
  duration?: number
  /** Decimal places in the displayed number */
  decimals?: number
  /** Element that must enter the viewport before counting starts */
  rootRef?: RefObject<Element | null>
  /** Prefix/suffix applied around the animated digits */
  prefix?: string
  suffix?: string
}

/**
 * Animates a number from 0 → end when `rootRef` enters the viewport.
 * Returns a ready-to-render display string.
 */
export function useCountUp({
  end,
  duration = 1400,
  decimals = 0,
  rootRef,
  prefix = '',
  suffix = '',
}: UseCountUpOptions) {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(reduced ? end : 0)

  useEffect(() => {
    if (reduced) {
      setValue(end)
      return
    }

    let frame = 0
    let started = false
    let observer: IntersectionObserver | null = null
    let cancelled = false

    const run = () => {
      if (started || cancelled) return
      started = true
      const startTs = performance.now()

      const tick = (now: number) => {
        if (cancelled) return
        const t = Math.min(1, (now - startTs) / duration)
        const eased = 1 - (1 - t) ** 3
        setValue(end * eased)
        if (t < 1) {
          frame = requestAnimationFrame(tick)
        } else {
          setValue(end)
        }
      }

      frame = requestAnimationFrame(tick)
    }

    const el = rootRef?.current
    if (!el) {
      run()
      return () => {
        cancelled = true
        cancelAnimationFrame(frame)
      }
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run()
          observer?.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(el)

    return () => {
      cancelled = true
      observer?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [end, duration, rootRef, reduced])

  const formatted =
    decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))

  return `${prefix}${formatted}${suffix}`
}
