import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { TopBar } from '../../components/layout/TopBar.jsx'

describe('TopBar', () => {
  it('renders WorkforceGuard logo image', () => {
    render(<MemoryRouter><TopBar /></MemoryRouter>)
    expect(screen.getByAltText('WorkforceGuard')).toBeInTheDocument()
  })

  it('renders company name AeroTech Europe SAS', () => {
    render(<MemoryRouter><TopBar /></MemoryRouter>)
    expect(screen.getByText('AeroTech Europe SAS')).toBeInTheDocument()
  })

  it('shows default context when no URL params set', () => {
    render(<MemoryRouter initialEntries={['/']}><TopBar /></MemoryRouter>)
    expect(screen.getByText('All countries · All sectors · Latest')).toBeInTheDocument()
  })

  it('shows context from URL query params when present', () => {
    render(
      <MemoryRouter initialEntries={['/?country=FR&sector=C&period=2023']}>
        <TopBar />
      </MemoryRouter>,
    )
    expect(screen.getByText('FR · C · 2023')).toBeInTheDocument()
  })
})
