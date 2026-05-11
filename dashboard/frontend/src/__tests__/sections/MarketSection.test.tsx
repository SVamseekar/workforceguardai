import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarketSection } from '../../components/sections/MarketSection.jsx'
import { renderInRouter } from '../test-utils'

describe('MarketSection', () => {
  it('shows loading state initially', () => {
    renderInRouter(<MarketSection />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders Market Intelligence heading after data loads', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => expect(screen.getByText('Market Intelligence')).toBeInTheDocument())
  })

  it('renders all 4 chart panel titles', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => {
      expect(screen.getByText('Unemployment trend')).toBeInTheDocument()
      expect(screen.getByText('Vacancy rate by sector')).toBeInTheDocument()
      expect(screen.getByText('Employment trend')).toBeInTheDocument()
      expect(screen.getByText('Gender pay gap by sector')).toBeInTheDocument()
    })
  })

  it('renders Intelligence Signals section', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => expect(screen.getByText('Intelligence Signals')).toBeInTheDocument())
    expect(screen.getByText('Vacancy rate rising in manufacturing')).toBeInTheDocument()
    expect(screen.getByText('Employment stable')).toBeInTheDocument()
  })

  it('renders Recommendations section', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => expect(screen.getByText('Recommendations')).toBeInTheDocument())
    expect(screen.getByText('Monitor manufacturing vacancies')).toBeInTheDocument()
  })

  it('renders Watchlist section', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => expect(screen.getByText('Watchlist')).toBeInTheDocument())
    expect(screen.getByText('Youth unemployment')).toBeInTheDocument()
  })

  it('renders filter bar with Country, Sector, Period dropdowns', async () => {
    renderInRouter(<MarketSection />)
    await waitFor(() => {
      expect(screen.getByText('Country')).toBeInTheDocument()
      expect(screen.getByText('Sector')).toBeInTheDocument()
      expect(screen.getByText('Period')).toBeInTheDocument()
    })
  })
})
