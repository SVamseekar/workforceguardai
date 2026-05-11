import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '../../components/shared/FilterBar.jsx'

const DEFAULT_FILTERS = {
  country: 'ALL',
  sector: 'ALL',
  period: 'latest',
  benchmark_geography: '',
  benchmark_sector: '',
}

const DEFAULT_OPTIONS = {
  countries: [{ id: 'FR', label: 'France' }, { id: 'DE', label: 'Germany' }],
  sectors: [{ id: 'C', label: 'Manufacturing' }],
  periods: [{ id: 'latest', label: 'Latest' }, { id: '2023', label: '2023' }],
  benchmark_geographies: [],
}

describe('FilterBar', () => {
  it('renders Country, Sector, Period labels', () => {
    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={DEFAULT_OPTIONS}
        onFilterChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByText('Sector')).toBeInTheDocument()
    expect(screen.getByText('Period')).toBeInTheDocument()
  })

  it('does not render "Compare against" when benchmark_geographies is empty', () => {
    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={DEFAULT_OPTIONS}
        onFilterChange={vi.fn()}
      />,
    )
    expect(screen.queryByText('Compare against')).not.toBeInTheDocument()
  })

  it('renders "Compare against" label — not "benchmark_geography" — when options provided', () => {
    const optionsWithBenchmark = {
      ...DEFAULT_OPTIONS,
      benchmark_geographies: [{ id: 'DE', label: 'Germany' }, { id: 'FR', label: 'France' }],
    }

    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={optionsWithBenchmark}
        onFilterChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Compare against')).toBeInTheDocument()
    expect(screen.queryByText('benchmark_geography')).not.toBeInTheDocument()
  })

  it('calls onFilterChange with updated country when country select changes', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()

    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={DEFAULT_OPTIONS}
        onFilterChange={onFilterChange}
      />,
    )

    const countrySelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(countrySelect, 'FR')

    expect(onFilterChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, country: 'FR' })
  })

  it('calls onFilterChange with updated period when period select changes', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()

    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        options={DEFAULT_OPTIONS}
        onFilterChange={onFilterChange}
      />,
    )

    const periodSelect = screen.getAllByRole('combobox')[2]
    await user.selectOptions(periodSelect, '2023')

    expect(onFilterChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, period: '2023' })
  })
})
