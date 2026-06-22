import { describe, expect, it } from 'vitest'
import { resolveAuthErrorMessage } from '../../lib/auth-errors'

describe('resolveAuthErrorMessage', () => {
  it('maps known auth error codes to friendly copy', () => {
    expect(resolveAuthErrorMessage('cancelled')).toMatch(/cancelled/i)
    expect(resolveAuthErrorMessage('sign_in_unavailable')).toMatch(/temporarily unavailable/i)
  })

  it('falls back to a generic message for unknown codes', () => {
    expect(resolveAuthErrorMessage('totally_unknown_code')).toMatch(/could not complete sign-in/i)
  })

  it('returns null when no code is provided', () => {
    expect(resolveAuthErrorMessage(null)).toBeNull()
    expect(resolveAuthErrorMessage(undefined)).toBeNull()
  })
})