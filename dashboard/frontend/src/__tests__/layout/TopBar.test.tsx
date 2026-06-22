import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TopBar } from '../../components/layout/TopBar.jsx'
import { renderInRouter } from '../test-utils'

describe('TopBar', () => {
  it('renders WorkforceGuard logo image', async () => {
    renderInRouter(<TopBar theme="dark" onToggleTheme={() => {}} />)
    expect(await screen.findByRole('img', { name: 'WorkforceGuard' })).toBeInTheDocument()
  })

  it('renders company name WorkforceGuard AI', async () => {
    renderInRouter(<TopBar theme="dark" onToggleTheme={() => {}} />)
    expect(await screen.findByText('WorkforceGuard AI')).toBeInTheDocument()
  })

  it('shows default context when no URL params set', async () => {
    renderInRouter(<TopBar theme="dark" onToggleTheme={() => {}} />, { initialEntries: ['/app'] })
    expect(await screen.findByText('All countries · All sectors · Latest')).toBeInTheDocument()
  })

  it('shows context from URL query params when present', async () => {
    renderInRouter(<TopBar theme="dark" onToggleTheme={() => {}} />, {
      initialEntries: ['/app?country=FR&sector=C&period=2023'],
    })
    expect(await screen.findByText('FR · C · 2023')).toBeInTheDocument()
  })

  it('shows sign out when authenticated', async () => {
    renderInRouter(<TopBar theme="dark" onToggleTheme={() => {}} />)
    expect(await screen.findByRole('button', { name: /Sign out/i })).toBeInTheDocument()
  })
})