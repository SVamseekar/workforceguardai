/** Human labels for pay-transparency heat. Never call a sub-5% gap "justified". */

export const REVIEW_STATE_LABELS: Record<string, string> = {
  insufficient_sample: 'Too few people to report',
  below_trigger: 'Below 5% trigger',
  observed_gap: 'Pay gap identified',
  unresolved_review_item: 'Needs review',
  justified_difference: 'Below 5% trigger',
}

export function reviewStateLabel(state: string | undefined | null): string {
  if (!state) return 'Unavailable'
  return REVIEW_STATE_LABELS[state] ?? state.replace(/_/g, ' ')
}

export function reviewStateTone(state: string | undefined | null): 'watch' | 'good' | 'neutral' {
  if (state === 'unresolved_review_item' || state === 'observed_gap') return 'watch'
  if (state === 'below_trigger') return 'good'
  return 'neutral'
}
