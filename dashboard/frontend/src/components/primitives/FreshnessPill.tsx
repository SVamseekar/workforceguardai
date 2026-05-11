import { Clock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

const dateFormatter = new Intl.DateTimeFormat('en-IE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

export function FreshnessPill() {
  const queryClient = useQueryClient()

  // Read generated_at from whatever overview query is already cached — no extra network call
  const overviewData = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: ['overview'] })
  const generatedAt = overviewData
    .map(([, data]) => (data as Record<string, unknown>)?.generated_at as string | undefined)
    .find(Boolean)

  if (!generatedAt) {
    return (
      <div className="freshness-pill freshness-pill--loading">
        <Clock size={12} />
        <span>Loading data…</span>
      </div>
    )
  }

  const label = `As of ${dateFormatter.format(new Date(generatedAt))} UTC`

  return (
    <div className="freshness-pill">
      <Clock size={12} />
      <span>{label}</span>
    </div>
  )
}
