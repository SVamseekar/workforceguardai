import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, afterEach } from 'vitest'
import axios from 'axios'
import { http, HttpResponse } from 'msw'
import { server } from '../handlers.js'
import { api } from '../../lib/api'
import { useOverviewData } from '../../hooks/useOverviewData'
import { AuthProvider } from '../../contexts/AuthContext'

afterEach(() => {
  vi.restoreAllMocks()
})

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/app']}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('useOverviewData', () => {
  it('fetches overview on mount and sets loading false when done', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper: makeWrapper() })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.overview).not.toBeNull()
    expect((result.current.overview as Record<string, unknown>).metrics).toHaveLength(2)
    expect(result.current.error).toBe('')
  })

  it('sets error message when API returns 500', async () => {
    server.use(
      http.get('/api/overview', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    )

    const { result } = renderHook(() => useOverviewData(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe(
      'The API hit an internal error. Try a different filter state or check the backend logs.',
    )
    expect(result.current.overview).toBeNull()
  })

  it('sets error message when API is unreachable', async () => {
    server.use(
      http.get('/api/overview', () => HttpResponse.error()),
    )

    const { result } = renderHook(() => useOverviewData(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toMatch(/Could not/)
  })

  it('uploadPayroll posts file and shows success notice', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { record_count: 42 } })

    const { result } = renderHook(() => useOverviewData(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const file = new File(['emp_id,salary\n1,50000'], 'payroll.csv', { type: 'text/csv' })

    await act(async () => {
      await result.current.uploadPayroll(file)
    })

    expect(api.post).toHaveBeenCalledWith('/upload/payroll', expect.any(FormData))
    expect(result.current.notice?.type).toBe('success')
    expect(result.current.notice?.message).toBe('Upload accepted — 42 employees loaded.')
  })

  it('uploadPayroll shows error notice on failure', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(
      Object.assign(new axios.AxiosError('Upload rejected'), {
        response: {
          status: 422,
          data: { detail: 'Invalid columns.' },
        },
      }),
    )

    const { result } = renderHook(() => useOverviewData(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' })

    await act(async () => {
      await result.current.uploadPayroll(file).catch(() => undefined)
    })

    expect(result.current.notice?.type).toBe('error')
    expect(result.current.notice?.message).toBe('Invalid columns.')
  })

  it('recordGovernanceAction posts event and shows success notice', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.recordGovernanceAction('approved', 'pay_category', 'cat-1')
    })

    await waitFor(() => expect(result.current.notice?.type).toBe('success'))
    expect(result.current.notice?.message).toBe('Decision recorded.')
  })

  it('exportEvidencePack triggers download link and does not set error', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL

    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })

    const { result } = renderHook(() => useOverviewData(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.exportEvidencePack()
    })

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(clickSpy).toHaveBeenCalled()
    expect(result.current.notice).toBeNull()

    vi.restoreAllMocks()
  })

  it('scheduleBrief posts schedule and shows success notice', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.scheduleBrief({ id: 'weekly-brief', label: 'Weekly brief' })
    })

    await waitFor(() => expect(result.current.notice?.type).toBe('success'))
    expect(result.current.notice?.message).toBe('Workflow "Weekly brief" scheduled.')
  })
})
