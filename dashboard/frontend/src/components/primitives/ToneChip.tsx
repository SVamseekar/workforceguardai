import type { ReactNode } from 'react'

const TONE_META: Record<string, string> = {
  good: 'tone-chip--good',
  neutral: 'tone-chip--neutral',
  watch: 'tone-chip--watch',
}

export function ToneChip({ tone, children }: { tone: string; children?: ReactNode }) {
  return (
    <span className={`tone-chip ${TONE_META[tone] ?? TONE_META.neutral}`}>
      {children}
    </span>
  )
}
