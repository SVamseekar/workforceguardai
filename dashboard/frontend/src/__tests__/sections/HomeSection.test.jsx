import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../handlers.js'
import { HomeSection } from '../../components/sections/HomeSection.jsx'

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('HomeSection', () => {
  it('shows loading state initially', () => {
    renderInRouter(<HomeSection />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders Command Centre heading after data loads', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() => expect(screen.getByText('Command Centre')).toBeInTheDocument())
  })

  it('renders a metric card for each metric in the response', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() => {
      expect(screen.getByText('Unemployment rate')).toBeInTheDocument()
      expect(screen.getByText('Employment rate')).toBeInTheDocument()
    })
  })

  it('renders Executive Brief section with headline', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Labour market stable with vacancy pressure')).toBeInTheDocument(),
    )
    expect(screen.getByText('Executive Brief')).toBeInTheDocument()
  })

  it('shows Needs Attention section when watch signals exist', async () => {
    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Needs Attention')).toBeInTheDocument(),
    )
    expect(screen.getByText('Vacancy rate rising in manufacturing')).toBeInTheDocument()
  })

  it('shows error panel when API fails', async () => {
    server.use(
      http.get('/api/overview', () => HttpResponse.json({ detail: 'err' }, { status: 500 })),
    )

    renderInRouter(<HomeSection />)
    await waitFor(() =>
      expect(screen.getByText('Could not load data')).toBeInTheDocument(),
    )
  })
})
