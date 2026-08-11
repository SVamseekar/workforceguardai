import { useRef } from 'react'
import { useCountUp } from '../hooks/useCountUp'

type AnimatedStatValueProps = {
  /** Full display string as authored in facts, e.g. "10.9%", "5%", "10" */
  display: string
  className?: string
}

/**
 * Parses a simple numeric display string and animates the digits on scroll-in.
 * Falls back to static text when the value is non-numeric (e.g. "Jun 2026").
 */
export function AnimatedStatValue({ display, className }: AnimatedStatValueProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const parsed = parseDisplay(display)

  const animated = useCountUp({
    end: parsed?.end ?? 0,
    decimals: parsed?.decimals ?? 0,
    prefix: parsed?.prefix ?? '',
    suffix: parsed?.suffix ?? '',
    duration: 1500,
    rootRef: ref,
  })

  if (!parsed) {
    return (
      <span ref={ref} className={className}>
        {display}
      </span>
    )
  }

  return (
    <span ref={ref} className={className}>
      {animated}
    </span>
  )
}

function parseDisplay(display: string): {
  end: number
  decimals: number
  prefix: string
  suffix: string
} | null {
  // Only animate clean numeric displays (e.g. "10.9%", "+0.44", "5%").
  // Skip date-like / mixed labels such as "Jun 2026".
  const trimmed = display.trim()
  if (/[A-Za-z]/.test(trimmed.replace(/[eE]/g, ''))) return null

  const match = trimmed.match(/^([^0-9.+-]*)([+-]?\d+(?:\.\d+)?)(.*)$/)
  if (!match) return null
  const [, prefix, num, suffix] = match
  if (num.includes('.')) {
    const decimals = num.split('.')[1]?.length ?? 0
    return { end: Number(num), decimals, prefix, suffix }
  }
  return { end: Number(num), decimals: 0, prefix, suffix }
}
