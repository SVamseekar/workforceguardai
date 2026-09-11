import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SandboxBanner } from '../../components/sandbox/SandboxBanner'

describe('SandboxBanner', () => {
  it('states the demo is read-only synthetic data', () => {
    render(<SandboxBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/read-only demo with synthetic data/i)
  })
})
