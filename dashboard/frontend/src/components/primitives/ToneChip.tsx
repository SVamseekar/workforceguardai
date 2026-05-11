const TONE_META = {
  good: 'tone-chip--good',
  neutral: 'tone-chip--neutral',
  watch: 'tone-chip--watch',
}

export function ToneChip({ tone, children }) {
  return (
    <span className={`tone-chip ${TONE_META[tone] ?? TONE_META.neutral}`}>
      {children}
    </span>
  )
}
