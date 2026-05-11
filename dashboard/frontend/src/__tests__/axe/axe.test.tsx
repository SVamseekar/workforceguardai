import { waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import axe from 'axe-core'
import { renderInRouter } from '../test-utils'
import { HomeSection } from '../../components/sections/HomeSection'
import { MarketSection } from '../../components/sections/MarketSection'
import { PayAnalysisSection } from '../../components/sections/PayAnalysisSection'
import { GovernSection } from '../../components/sections/GovernSection'

const CRITICAL_IMPACTS = ['critical', 'serious'] as const

async function runAxe(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  })
  return results.violations.filter((v) =>
    CRITICAL_IMPACTS.includes(v.impact as typeof CRITICAL_IMPACTS[number]),
  )
}

describe('Accessibility — zero serious/critical violations (WCAG 2.1 AA)', () => {
  it('HomeSection has no serious or critical axe violations', async () => {
    const { container } = renderInRouter(<HomeSection />)
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')).toBeNull()
    })
    const violations = await runAxe(container)
    expect(
      violations,
      violations.map((v) => `${v.id}: ${v.description}`).join('\n'),
    ).toHaveLength(0)
  })

  it('MarketSection has no serious or critical axe violations', async () => {
    const { container } = renderInRouter(<MarketSection />)
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')).toBeNull()
    })
    const violations = await runAxe(container)
    expect(
      violations,
      violations.map((v) => `${v.id}: ${v.description}`).join('\n'),
    ).toHaveLength(0)
  })

  it('PayAnalysisSection has no serious or critical axe violations', async () => {
    const { container } = renderInRouter(<PayAnalysisSection />)
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')).toBeNull()
    })
    const violations = await runAxe(container)
    expect(
      violations,
      violations.map((v) => `${v.id}: ${v.description}`).join('\n'),
    ).toHaveLength(0)
  })

  it('GovernSection has no serious or critical axe violations', async () => {
    const { container } = renderInRouter(<GovernSection />)
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')).toBeNull()
    })
    const violations = await runAxe(container)
    expect(
      violations,
      violations.map((v) => `${v.id}: ${v.description}`).join('\n'),
    ).toHaveLength(0)
  })
})
