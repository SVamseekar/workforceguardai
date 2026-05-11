import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ToneChip } from '../../components/primitives/ToneChip.jsx'
import { MetricCard } from '../../components/primitives/MetricCard.jsx'
import { ProvenanceBadge } from '../../components/primitives/ProvenanceBadge.jsx'
import { StatusBadge } from '../../components/primitives/StatusBadge.jsx'

describe('ToneChip', () => {
  it('renders children text', () => {
    render(<ToneChip tone="good">Good</ToneChip>)
    expect(screen.getByText('Good')).toBeInTheDocument()
  })

  it('applies good CSS modifier for tone=good', () => {
    const { container } = render(<ToneChip tone="good">Good</ToneChip>)
    expect(container.firstChild).toHaveClass('tone-chip--good')
  })

  it('applies watch CSS modifier for tone=watch', () => {
    const { container } = render(<ToneChip tone="watch">Watch</ToneChip>)
    expect(container.firstChild).toHaveClass('tone-chip--watch')
  })

  it('falls back to neutral CSS modifier for unknown tone', () => {
    const { container } = render(<ToneChip tone="unknown">Neutral</ToneChip>)
    expect(container.firstChild).toHaveClass('tone-chip--neutral')
  })
})

describe('MetricCard', () => {
  const metric = {
    id: 'unemployment',
    title: 'Unemployment rate',
    value: 6.2,
    delta: -0.4,
    unit: '%',
    tone: 'good',
    period: 'Q4 2024',
  }

  it('renders title and formatted value', () => {
    render(<MetricCard metric={metric} />)
    expect(screen.getByText('Unemployment rate')).toBeInTheDocument()
    expect(screen.getByText('6.2%')).toBeInTheDocument()
  })

  it('renders formatted negative delta with pts vs prior period', () => {
    render(<MetricCard metric={metric} />)
    expect(screen.getByText('-0.4 pts vs prior period')).toBeInTheDocument()
  })

  it('renders "Planned" when value is null', () => {
    render(<MetricCard metric={{ ...metric, value: null }} />)
    expect(screen.getByText('Planned')).toBeInTheDocument()
  })

  it('renders "No prior period" when delta is null', () => {
    render(<MetricCard metric={{ ...metric, delta: null }} />)
    expect(screen.getByText('No prior period')).toBeInTheDocument()
  })

  it('formats score unit as X/100', () => {
    render(<MetricCard metric={{ ...metric, value: 78, unit: 'score' }} />)
    expect(screen.getByText('78/100')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<MetricCard metric={metric} onClick={onClick} />)
    await user.click(screen.getByRole('article'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders View evidence button when onOpenEvidence provided', async () => {
    const user = userEvent.setup()
    const onOpenEvidence = vi.fn()
    render(<MetricCard metric={metric} onOpenEvidence={onOpenEvidence} />)
    await user.click(screen.getByRole('button', { name: 'View evidence' }))
    expect(onOpenEvidence).toHaveBeenCalledWith(metric)
  })

  it('renders provenance badge with translated source label', () => {
    render(
      <MetricCard
        metric={{ ...metric, provenance: [{ source_id: 'eurostat_lfs' }] }}
      />,
    )
    expect(screen.getByText('Eurostat Labour Force Survey')).toBeInTheDocument()
    expect(screen.queryByText('eurostat_lfs')).not.toBeInTheDocument()
  })
})

describe('ProvenanceBadge', () => {
  it('renders nothing when provenance is empty', () => {
    const { container } = render(<ProvenanceBadge provenance={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('translates eurostat_lfs to full label', () => {
    render(<ProvenanceBadge provenance={[{ source_id: 'eurostat_lfs' }]} />)
    expect(screen.getByText('Eurostat Labour Force Survey')).toBeInTheDocument()
    expect(screen.queryByText('eurostat_lfs')).not.toBeInTheDocument()
  })

  it('translates internal_payroll to Company payroll data', () => {
    render(<ProvenanceBadge provenance={[{ source_id: 'internal_payroll' }]} />)
    expect(screen.getByText('Company payroll data')).toBeInTheDocument()
  })

  it('falls back to raw source_id when unknown', () => {
    render(<ProvenanceBadge provenance={[{ source_id: 'custom_source' }]} />)
    expect(screen.getByText('custom_source')).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it('translates observed_gap to "Pay gap identified"', () => {
    render(<StatusBadge status="observed_gap" />)
    expect(screen.getByText('Pay gap identified')).toBeInTheDocument()
    expect(screen.queryByText('observed_gap')).not.toBeInTheDocument()
  })

  it('translates unresolved_review_item to "Needs review"', () => {
    render(<StatusBadge status="unresolved_review_item" />)
    expect(screen.getByText('Needs review')).toBeInTheDocument()
  })

  it('translates justified_difference to "Documented difference"', () => {
    render(<StatusBadge status="justified_difference" />)
    expect(screen.getByText('Documented difference')).toBeInTheDocument()
  })

  it('translates blended to "Evidence source: Combined"', () => {
    render(<StatusBadge status="blended" />)
    expect(screen.getByText('Evidence source: Combined')).toBeInTheDocument()
  })

  it('translates low to "Limited data — treat with caution"', () => {
    render(<StatusBadge status="low" />)
    expect(screen.getByText('Limited data — treat with caution')).toBeInTheDocument()
  })

  it('renders unknown status as-is', () => {
    render(<StatusBadge status="some_unknown_status" />)
    expect(screen.getByText('some_unknown_status')).toBeInTheDocument()
  })
})
