import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from '../../components/layout/Sidebar.jsx'

const renderSidebar = (initialPath = '/', onCopilotOpen = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar onCopilotOpen={onCopilotOpen} />
    </MemoryRouter>,
  )

describe('Sidebar', () => {
  it('renders all 5 nav links', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Market Intelligence/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Compare/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pay Analysis/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Govern & Export/i })).toBeInTheDocument()
  })

  it('renders AI Analyst button', () => {
    renderSidebar()
    expect(screen.getByRole('button', { name: /AI Analyst/i })).toBeInTheDocument()
  })

  it('calls onCopilotOpen when AI Analyst button clicked', async () => {
    const user = userEvent.setup()
    const onCopilotOpen = vi.fn()
    renderSidebar('/', onCopilotOpen)
    await user.click(screen.getByRole('button', { name: /AI Analyst/i }))
    expect(onCopilotOpen).toHaveBeenCalledOnce()
  })

  it('marks Home link as active when on / route', () => {
    renderSidebar('/')
    const homeLink = screen.getByRole('link', { name: /Home/i })
    expect(homeLink).toHaveClass('sidebar__link--active')
  })

  it('marks Market Intelligence link as active when on /market route', () => {
    renderSidebar('/market')
    const marketLink = screen.getByRole('link', { name: /Market Intelligence/i })
    expect(marketLink).toHaveClass('sidebar__link--active')
  })

  it('does not mark Home as active when on /market route', () => {
    renderSidebar('/market')
    const homeLink = screen.getByRole('link', { name: /Home/i })
    expect(homeLink).not.toHaveClass('sidebar__link--active')
  })
})
