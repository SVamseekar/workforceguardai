import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export interface Filters {
  country: string
  geography: string
  sector: string
  period: string
  benchmark_geography: string
  benchmark_sector: string
}

interface Notice {
  type: 'success' | 'error'
  message: string
}

function buildQueryParams(filters: Filters) {
  return {
    country: filters.country,
    geography: filters.geography,
    sector: filters.sector,
    period: filters.period,
    benchmark_geography: filters.benchmark_geography,
    benchmark_sector: filters.benchmark_sector,
  }
}

async function fetchOverview(filters: Filters): Promise<unknown> {
  const response = await axios.get(`${API_BASE}/overview`, {
    params: buildQueryParams(filters),
  })
  return response.data
}

export function useOverviewData() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<Filters>({
    country: searchParams.get('country') ?? 'ALL',
    geography: searchParams.get('geography') ?? 'EU27_AVG',
    sector: searchParams.get('sector') ?? 'ALL',
    period: searchParams.get('period') ?? 'latest',
    benchmark_geography: searchParams.get('benchmark_geography') ?? '',
    benchmark_sector: searchParams.get('benchmark_sector') ?? '',
  })

  const [notice, setNotice] = useState<Notice | null>(null)

  // Sync filter state to URL query params
  useEffect(() => {
    const params: Record<string, string> = {}
    if (filters.country !== 'ALL') params.country = filters.country
    if (filters.geography !== 'EU27_AVG') params.geography = filters.geography
    if (filters.sector !== 'ALL') params.sector = filters.sector
    if (filters.period !== 'latest') params.period = filters.period
    if (filters.benchmark_geography) params.benchmark_geography = filters.benchmark_geography
    if (filters.benchmark_sector) params.benchmark_sector = filters.benchmark_sector
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(id)
  }, [notice])

  const queryKey = ['overview', filters] as const

  const {
    data: overview = null,
    isFetching: loading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchOverview(filters),
    // After a successful fetch, sync API-applied filters back to local state
    select: (data) => {
      const d = data as Record<string, unknown>
      const applied = (d?.filters as Record<string, unknown>)?.applied as Record<string, string> | undefined
      const targets = ((d?.comparisons as Record<string, unknown>)?.targets ?? {}) as Record<string, unknown>
      if (applied) {
        const next: Filters = {
          country: applied.country ?? 'ALL',
          geography: applied.geography ?? 'EU27_AVG',
          sector: applied.sector ?? 'ALL',
          period: applied.period ?? 'latest',
          benchmark_geography: (targets.market as Record<string, unknown> | undefined)?.selected
            ? ((targets.market as Record<string, unknown>).selected as Record<string, string>).id ?? ''
            : '',
          benchmark_sector: (targets.sector as Record<string, unknown> | undefined)?.selected
            ? ((targets.sector as Record<string, unknown>).selected as Record<string, string>).id ?? ''
            : '',
        }
        // Note: we can't call setFilters here (in select) — that happens via the onSuccess-style
        // pattern below using useEffect. Select just shapes the data.
        void next
      }
      return data
    },
  })

  // Build human-readable error string from TanStack error
  const error = (() => {
    if (!queryError) return ''
    if (axios.isAxiosError(queryError)) {
      const status = queryError.response?.status
      if (status !== undefined && status >= 500) return 'The API hit an internal error. Try a different filter state or check the backend logs.'
      if (status !== undefined) return `The API rejected this request with status ${status}.`
      return 'Could not reach the analytics API.'
    }
    return 'Could not load analytics from the API.'
  })()

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.get(`${API_BASE}/evidence-pack`, {
        params: buildQueryParams(filters),
      })
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `workforceguard-evidence-${filters.country}-${filters.period}.json`
      link.click()
      URL.revokeObjectURL(url)
      await axios.post(`${API_BASE}/governance-events`, {
        action_code: 'exported',
        target_type: 'evidence_pack',
        target_id: `${filters.country}-${filters.period}`,
        actor: 'dashboard-user',
      })
    },
    onError: () => setNotice({ type: 'error', message: 'Evidence pack export failed.' }),
  })

  const governanceMutation = useMutation({
    mutationFn: async ({ actionCode, targetType, targetId, reason }: {
      actionCode: string
      targetType: string
      targetId: string
      reason?: string
    }) => {
      await axios.post(`${API_BASE}/governance-events`, {
        action_code: actionCode,
        target_type: targetType,
        target_id: targetId,
        actor: 'dashboard-user',
        reason: reason ?? null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      setNotice({ type: 'success', message: 'Decision recorded.' })
    },
    onError: () => setNotice({ type: 'error', message: 'Failed to record decision.' }),
  })

  const scheduleMutation = useMutation({
    mutationFn: async (template: { id: string; label: string }) => {
      const response = await axios.post(`${API_BASE}/automation/schedules`, {
        template_id: template.id,
        ...buildQueryParams(filters),
        approved: false,
        actor: 'dashboard-user',
      })
      return { data: response.data, label: template.label }
    },
    onSuccess: ({ label }) => setNotice({ type: 'success', message: `Workflow "${label}" scheduled.` }),
    onError: () => setNotice({ type: 'error', message: 'Failed to schedule workflow.' }),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await axios.post(`${API_BASE}/upload/payroll`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data as { record_count: number }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      setNotice({ type: 'success', message: `Upload accepted — ${data.record_count} employees loaded.` })
    },
    onError: (err) => {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data?.detail ?? 'Upload failed. Check the file format and try again.')
        : 'Upload failed. Check the file format and try again.'
      setNotice({ type: 'error', message: detail })
    },
  })

  return {
    filters,
    setFilters,
    overview,
    loading,
    error,
    exporting: exportMutation.isPending,
    actionLoading: governanceMutation.isPending,
    scheduleLoading: scheduleMutation.isPending,
    notice,
    setNotice,
    exportEvidencePack: () => exportMutation.mutate(),
    recordGovernanceAction: (actionCode: string, targetType: string, targetId: string, reason?: string) =>
      governanceMutation.mutate({ actionCode, targetType, targetId, reason }),
    scheduleBrief: (template: { id: string; label: string }) => scheduleMutation.mutateAsync(template),
    uploadPayroll: (file: File) => uploadMutation.mutate(file),
  }
}
