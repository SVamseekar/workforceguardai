import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ResearchSection } from '../../components/sections/ResearchSection'

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        panel: {
          countries: 27,
          sectors: 6,
          year_range: '2019–2025',
          employment_gpg_correlation: 0.47,
          eu27_gpg_mean: 10.9,
          eu27_finance_gpg_mean: 25.0,
        },
        figures: {
          tightness_gpg_scatter: {
            title: 'Employment rate vs gender pay gap',
            points: [{ geo_id: 'DE', country_label: 'Germany', employment_rate: 81.1, gender_pay_gap: 14.8, finance_gpg: 26.0, period: '2024' }],
            correlation: 0.47,
          },
          risk_quadrant: {
            title: 'HPI vs ERS',
            points: [{ geo_id: 'DE', country_label: 'Germany', hpi: 98, ers: 81, finance_gpg: 26.0 }],
          },
          sector_heatmap: {
            sectors: [{ id: 'K', label: 'Finance (K)' }],
            cells: [{ geo_id: 'DE', country_label: 'Germany', sector_id: 'K', sector_label: 'Finance (K)', gender_pay_gap: 26.0 }],
          },
          finance_vs_overall: {
            rows: [{ geo_id: 'DE', country_label: 'Germany', overall_gpg: 14.8, finance_gpg: 26.0, finance_premium_pp: 11.2 }],
          },
          employment_trajectories: {
            group_id: 'fast_recovery',
            group_label: 'Fast recoverers',
            note: 'Recovery note',
            groups: [
              { id: 'fast_recovery', label: 'Fast recoverers' },
              { id: 'deteriorating', label: 'Deteriorating (2023–2024)' },
            ],
            series: [{ geo_id: 'HR', country_label: 'Croatia', series: [{ period: '2019', value: 66.4 }, { period: '2024', value: 73.6 }] }],
          },
        },
        insights: [
          {
            id: 'finance_risk',
            title: 'Finance sector concentration',
            summary: 'NACE K shows the largest gaps.',
            detail: 'Detail text',
            countries: ['CZ', 'DE'],
          },
        ],
      },
    }),
  },
}))

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ResearchSection />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ResearchSection', () => {
  it('renders research summary and insight accordion', async () => {
    renderSection()
    expect(await screen.findByText(/Paper findings — live from the warehouse/i)).toBeInTheDocument()
    expect(screen.getByText(/Panel mean GPG/i)).toBeInTheDocument()
    expect(screen.getByText(/Finance sector concentration/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fast recoverers/i })).toBeInTheDocument()
  })
})
