import { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions } from '@testing-library/react'
import { AuthProvider } from '../contexts/AuthContext'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

export function renderInRouter(
  ui: ReactNode,
  options?: RenderOptions & { initialEntries?: string[] },
) {
  const { initialEntries = ['/app'], ...renderOptions } = options ?? {}
  const qc = makeQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
    renderOptions,
  )
}
