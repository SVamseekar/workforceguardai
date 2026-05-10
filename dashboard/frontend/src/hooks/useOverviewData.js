import { startTransition, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

function buildQueryParams(filters) {
  return {
    country: filters.country,
    geography: filters.geography,
    sector: filters.sector,
    period: filters.period,
    benchmark_geography: filters.benchmark_geography,
    benchmark_sector: filters.benchmark_sector,
  }
}

export function useOverviewData() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState({
    country: searchParams.get('country') ?? 'ALL',
    geography: searchParams.get('geography') ?? 'EU27_AVG',
    sector: searchParams.get('sector') ?? 'ALL',
    period: searchParams.get('period') ?? 'latest',
    benchmark_geography: searchParams.get('benchmark_geography') ?? '',
    benchmark_sector: searchParams.get('benchmark_sector') ?? '',
  })

  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [notice, setNotice] = useState(null)

  const requestFilters = useMemo(
    () => ({
      country: filters.country,
      geography: filters.geography,
      sector: filters.sector,
      period: filters.period,
      benchmark_geography: filters.benchmark_geography,
      benchmark_sector: filters.benchmark_sector,
    }),
    [
      filters.country,
      filters.geography,
      filters.sector,
      filters.period,
      filters.benchmark_geography,
      filters.benchmark_sector,
    ],
  )

  // Sync filter state to URL query params
  useEffect(() => {
    const params = {}
    if (filters.country !== 'ALL') params.country = filters.country
    if (filters.geography !== 'EU27_AVG') params.geography = filters.geography
    if (filters.sector !== 'ALL') params.sector = filters.sector
    if (filters.period !== 'latest') params.period = filters.period
    if (filters.benchmark_geography) params.benchmark_geography = filters.benchmark_geography
    if (filters.benchmark_sector) params.benchmark_sector = filters.benchmark_sector
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  useEffect(() => {
    if (!notice) return undefined
    const timeoutId = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setLoading(true)
      setError('')

      try {
        const response = await axios.get(`${API_BASE}/overview`, {
          params: buildQueryParams(requestFilters),
        })

        if (!cancelled) {
          startTransition(() => {
            setOverview(response.data)
            const nextApplied = response.data.filters?.applied
            if (nextApplied) {
              const nextComparisonTargets = response.data.comparisons?.targets ?? {}
              const nextRequestState = {
                country: nextApplied.country,
                geography: nextApplied.geography,
                sector: nextApplied.sector,
                period: nextApplied.period,
                benchmark_geography: nextComparisonTargets.market?.selected?.id ?? '',
                benchmark_sector: nextComparisonTargets.sector?.selected?.id ?? '',
              }
              if (JSON.stringify(requestFilters) !== JSON.stringify(nextRequestState)) {
                setFilters(nextRequestState)
              }
            }
          })
        }
      } catch (requestError) {
        if (!cancelled) {
          if (axios.isAxiosError(requestError)) {
            if (requestError.response?.status >= 500) {
              setError('The API hit an internal error. Try a different filter state or check the backend logs.')
            } else if (requestError.response?.status) {
              setError(`The API rejected this request with status ${requestError.response.status}.`)
            } else {
              setError('Could not reach the analytics API.')
            }
          } else {
            setError('Could not load analytics from the API.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOverview()
    return () => { cancelled = true }
  }, [requestFilters])

  async function exportEvidencePack() {
    setExporting(true)
    try {
      const response = await axios.get(`${API_BASE}/evidence-pack`, {
        params: buildQueryParams(requestFilters),
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
    } catch {
      setNotice({ type: 'error', message: 'Evidence pack export failed.' })
    } finally {
      setExporting(false)
    }
  }

  async function recordGovernanceAction(actionCode, targetType, targetId, reason) {
    setActionLoading(true)
    try {
      await axios.post(`${API_BASE}/governance-events`, {
        action_code: actionCode,
        target_type: targetType,
        target_id: targetId,
        actor: 'dashboard-user',
        reason: reason ?? null,
      })
      const response = await axios.get(`${API_BASE}/overview`, {
        params: buildQueryParams(requestFilters),
      })
      startTransition(() => setOverview(response.data))
      setNotice({ type: 'success', message: 'Decision recorded.' })
    } catch {
      setNotice({ type: 'error', message: 'Failed to record decision.' })
    } finally {
      setActionLoading(false)
    }
  }

  async function scheduleBrief(template) {
    setScheduleLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/automation/schedules`, {
        template_id: template.id,
        ...buildQueryParams(requestFilters),
        approved: false,
        actor: 'dashboard-user',
      })
      setNotice({ type: 'success', message: `Workflow "${template.label}" scheduled.` })
      return response.data
    } catch {
      setNotice({ type: 'error', message: 'Failed to schedule workflow.' })
      return null
    } finally {
      setScheduleLoading(false)
    }
  }

  return {
    filters,
    setFilters,
    overview,
    loading,
    error,
    exporting,
    actionLoading,
    scheduleLoading,
    notice,
    setNotice,
    exportEvidencePack,
    recordGovernanceAction,
    scheduleBrief,
  }
}
