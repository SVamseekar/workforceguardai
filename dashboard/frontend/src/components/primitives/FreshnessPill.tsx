import { Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

interface FreshnessData {
  pulled_at: string
  source_label?: string
}

async function fetchFreshness(): Promise<FreshnessData> {
  const response = await axios.get(`${API_BASE}/freshness`)
  return response.data
}

const dateFormatter = new Intl.DateTimeFormat('en-IE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

export function FreshnessPill() {
  const { data, isLoading } = useQuery({
    queryKey: ['freshness'],
    queryFn: fetchFreshness,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  if (isLoading || !data) {
    return (
      <div className="freshness-pill freshness-pill--loading">
        <Clock size={12} />
        <span>Checking data freshness…</span>
      </div>
    )
  }

  const label = data.pulled_at
    ? `As of ${dateFormatter.format(new Date(data.pulled_at))} UTC`
    : 'Freshness unknown'

  return (
    <div className="freshness-pill">
      <Clock size={12} />
      <span>{label}</span>
    </div>
  )
}
