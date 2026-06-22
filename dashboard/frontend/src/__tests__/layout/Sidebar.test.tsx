import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from '../../components/layout/Sidebar.jsx'
import { renderInRouter } from '../test-utils'

const renderSidebar = (initialPath = '/app', onCopilotOpen = vi.fn()) =>
  renderInRouter(<Sidebar onCopilotOpen={onCopilotOpen} />, { initialEntries: [initialPath] })

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
    renderSidebar('/app', onCopilotOpen)
    await user.click(screen.getByRole('button', { name: /AI Analyst/i }))
    expect(onCopilotOpen).toHaveBeenCalledOnce()
  })

  it('marks Home link as active when on /app route', () => {
    renderSidebar('/app')
    const homeLink = screen.getByRole('link', { name: /Home/i })
    expect(homeLink).toHaveClass('sidebar__link--active')
  })

  it('marks Market Intelligence link as active when on /app/market route', () => {
    renderSidebar('/app/market')
    const marketLink = screen.getByRole('link', { name: /Market Intelligence/i })
    expect(marketLink).toHaveClass('sidebar__link--active')
  })

  it('does not mark Home as active when on /app/market route', () => {
    renderSidebar('/app/market')
    const homeLink = screen.getByRole('link', { name: /Home/i })
    expect(homeLink).not.toHaveClass('sidebar__link--active')
  })
})