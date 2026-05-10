import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { CopilotPanel } from '../../components/layout/CopilotPanel.jsx'

const renderPanel = (onClose = vi.fn()) =>
  render(
    <MemoryRouter>
      <CopilotPanel onClose={onClose} />
    </MemoryRouter>,
  )

describe('CopilotPanel', () => {
  it('renders AI Analyst heading', () => {
    renderPanel()
    expect(screen.getByText('AI Analyst')).toBeInTheDocument()
    expect(screen.getByText('Ask about this view')).toBeInTheDocument()
  })

  it('renders all 6 suggested questions', () => {
    renderPanel()
    expect(screen.getByText('How does this market compare to the EU average?')).toBeInTheDocument()
    expect(screen.getByText('Which peer countries look most similar?')).toBeInTheDocument()
    expect(screen.getByText('What changed versus the prior period?')).toBeInTheDocument()
    expect(screen.getByText('Which signal is worsening fastest?')).toBeInTheDocument()
    expect(screen.getByText('How confident is this benchmark?')).toBeInTheDocument()
    expect(screen.getByText('What limits this comparison?')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPanel(onClose)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPanel(onClose)
    await user.click(screen.getByRole('button', { name: /Close AI Analyst/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('submits typed question and shows API response', async () => {
    const user = userEvent.setup()
    renderPanel()

    const input = screen.getByPlaceholderText('Ask a question about the current data…')
    await user.type(input, 'What is the unemployment rate?')
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(screen.getByText('Unemployment is 6.2%.')).toBeInTheDocument(),
    )
    expect(screen.getByText('Response')).toBeInTheDocument()
  })

  it('hides suggested questions after response received', async () => {
    const user = userEvent.setup()
    renderPanel()

    const input = screen.getByPlaceholderText('Ask a question about the current data…')
    await user.type(input, 'test question')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByText('Response')).toBeInTheDocument())
    expect(screen.queryByText('How does this market compare to the EU average?')).not.toBeInTheDocument()
  })

  it('shows follow-up question buttons from API response', async () => {
    const user = userEvent.setup()
    renderPanel()

    const input = screen.getByPlaceholderText('Ask a question about the current data…')
    await user.type(input, 'test')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByText('What changed?')).toBeInTheDocument())
  })

  it('submits question when suggested question chip clicked', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByText('Which peer countries look most similar?'))

    await waitFor(() =>
      expect(screen.getByText('Unemployment is 6.2%.')).toBeInTheDocument(),
    )
  })
})
