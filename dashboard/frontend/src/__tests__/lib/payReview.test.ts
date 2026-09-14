import { describe, it, expect } from 'vitest'
import { REVIEW_STATE_LABELS, reviewStateLabel, reviewStateTone } from '../../lib/payReview'

describe('payReview labels', () => {
  it('never calls a sub-5% gap justified', () => {
    expect(reviewStateLabel('below_trigger')).toBe('Below 5% trigger')
    expect(reviewStateLabel('justified_difference')).toBe('Below 5% trigger')
    expect(reviewStateLabel('below_trigger').toLowerCase()).not.toContain('justified')
  })

  it('marks large gaps as review heat', () => {
    expect(REVIEW_STATE_LABELS.unresolved_review_item).toBe('Needs review')
    expect(reviewStateTone('unresolved_review_item')).toBe('watch')
    expect(reviewStateTone('below_trigger')).toBe('good')
  })
})
