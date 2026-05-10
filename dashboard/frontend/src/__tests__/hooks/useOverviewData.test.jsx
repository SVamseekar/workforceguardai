import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../handlers.js'
import { useOverviewData } from '../../hooks/useOverviewData.js'

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>

describe('useOverviewData', () => {
  it('fetches overview on mount and sets loading false when done', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.overview).not.toBeNull()
    expect(result.current.overview.metrics).toHaveLength(2)
    expect(result.current.error).toBe('')
  })

  it('sets error message when API returns 500', async () => {
    server.use(
      http.get('/api/overview', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    )

    const { result } = renderHook(() => useOverviewData(), { wrapper })

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

    const { result } = renderHook(() => useOverviewData(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toMatch(/Could not/)
  })

  it('uploadPayroll posts file and shows success notice', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const file = new File(['emp_id,salary\n1,50000'], 'payroll.csv', { type: 'text/csv' })

    await act(async () => {
      await result.current.uploadPayroll(file)
    })

    expect(result.current.notice).toEqual({
      type: 'success',
      message: 'Upload accepted — 42 employees loaded.',
    })
  })

  it('uploadPayroll shows error notice on failure', async () => {
    server.use(
      http.post('/api/upload/payroll', () =>
        HttpResponse.json({ detail: 'Invalid columns.' }, { status: 422 }),
      ),
    )

    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' })

    await act(async () => {
      await result.current.uploadPayroll(file)
    })

    expect(result.current.notice).toEqual({
      type: 'error',
      message: 'Invalid columns.',
    })
  })

  it('recordGovernanceAction posts event and shows success notice', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.recordGovernanceAction('approved', 'pay_category', 'cat-1')
    })

    expect(result.current.notice).toEqual({
      type: 'success',
      message: 'Decision recorded.',
    })
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

    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.exportEvidencePack()
    })

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(result.current.notice).toBeNull()

    vi.restoreAllMocks()
  })

  it('scheduleBrief posts schedule and shows success notice', async () => {
    const { result } = renderHook(() => useOverviewData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.scheduleBrief({ id: 'weekly-brief', label: 'Weekly brief' })
    })

    expect(result.current.notice).toEqual({
      type: 'success',
      message: 'Workflow "Weekly brief" scheduled.',
    })
  })
})
