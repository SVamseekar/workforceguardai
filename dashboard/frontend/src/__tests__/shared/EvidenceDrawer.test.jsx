import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { EvidenceDrawer } from '../../components/shared/EvidenceDrawer.jsx'

describe('EvidenceDrawer', () => {
  it('renders nothing when evidence is null', () => {
    const { container } = render(<EvidenceDrawer evidence={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders title and summary when evidence provided', () => {
    render(
      <EvidenceDrawer
        evidence={{ title: 'Vacancy signal', summary: 'Vacancies up 0.4 pts.' }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Vacancy signal')).toBeInTheDocument()
    expect(screen.getByText('Vacancies up 0.4 pts.')).toBeInTheDocument()
    expect(screen.getByText('Evidence')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <EvidenceDrawer
        evidence={{ title: 'Test', summary: 'Summary.' }}
        onClose={onClose}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <EvidenceDrawer
        evidence={{ title: 'Test', summary: 'Summary.' }}
        onClose={onClose}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Close evidence panel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders supporting data items', () => {
    render(
      <EvidenceDrawer
        evidence={{
          title: 'Test',
          items: [{ label: 'Rate', value: '6.2%' }, { label: 'Period', value: 'Q4 2024' }],
        }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Supporting data')).toBeInTheDocument()
    expect(screen.getByText('Rate')).toBeInTheDocument()
    expect(screen.getByText('6.2%')).toBeInTheDocument()
  })

  it('renders translated provenance sources', () => {
    render(
      <EvidenceDrawer
        evidence={{
          title: 'Test',
          provenance: [{ source_id: 'eurostat_lfs' }],
        }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByText('Eurostat Labour Force Survey')).toBeInTheDocument()
    expect(screen.queryByText('eurostat_lfs')).not.toBeInTheDocument()
  })

  it('renders action buttons and calls onAction when clicked', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <EvidenceDrawer
        evidence={{
          title: 'Test',
          actions: [{ code: 'approved', label: 'Approve', onAction }],
        }}
        onClose={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onAction).toHaveBeenCalledWith('approved')
  })
})
