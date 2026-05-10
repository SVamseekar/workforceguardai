import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChartPanel } from '../../components/shared/ChartPanel.jsx'

describe('ChartPanel', () => {
  it('renders title', () => {
    render(<ChartPanel title="Unemployment trend" sourceId="eurostat_lfs"><div /></ChartPanel>)
    expect(screen.getByText('Unemployment trend')).toBeInTheDocument()
  })

  it('translates eurostat_lfs sourceId to "Eurostat LFS"', () => {
    render(<ChartPanel title="Test" sourceId="eurostat_lfs"><div /></ChartPanel>)
    expect(screen.getByText('Eurostat LFS')).toBeInTheDocument()
    expect(screen.queryByText('eurostat_lfs')).not.toBeInTheDocument()
  })

  it('translates eurostat_jvs to "Eurostat JVS"', () => {
    render(<ChartPanel title="Test" sourceId="eurostat_jvs"><div /></ChartPanel>)
    expect(screen.getByText('Eurostat JVS')).toBeInTheDocument()
  })

  it('shows "Market data" when sourceId is not provided', () => {
    render(<ChartPanel title="Test"><div /></ChartPanel>)
    expect(screen.getByText('Market data')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<ChartPanel title="Test" sourceId="eurostat_lfs"><span>chart here</span></ChartPanel>)
    expect(screen.getByText('chart here')).toBeInTheDocument()
  })
})
