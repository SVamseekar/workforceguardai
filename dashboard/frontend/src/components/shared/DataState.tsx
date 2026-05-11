import { ReactNode, useState } from 'react'

interface DataStateProps {
  loading: boolean
  error: string
  empty?: boolean
  emptyMessage?: string
  onClearFilters?: () => void
  children: ReactNode
}

function SkeletonMetricCard() {
  return (
    <div className="metric-card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton--eyebrow" />
      <div className="skeleton skeleton--value" />
      <div className="skeleton skeleton--delta" />
      <div className="skeleton skeleton--period" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="panel skeleton-chart" aria-hidden="true">
      <div className="skeleton skeleton--title" />
      <div className="skeleton-chart__bars">
        {[65, 80, 55, 90, 70, 60, 85].map((h, i) => (
          <div key={i} className="skeleton-chart__bar" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="data-state data-state--loading" role="status" aria-label="Loading data">
      <div className="metric-grid">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </div>
      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  )
}

function ErrorState({ error }: { error: string }) {
  const [copied, setCopied] = useState(false)

  // Extract request_id from error string if present (format: "...status NNN...")
  // The API error may include a request_id header — we surface what we have
  const requestId = (() => {
    const match = error.match(/request[_-]?id[:\s]+([a-z0-9-]+)/i)
    return match?.[1] ?? null
  })()

  function copyError() {
    const text = requestId ? `${error}\nRequest ID: ${requestId}` : error
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="data-state data-state--error" role="alert">
      <div className="error-panel">
        <h2>Could not load data</h2>
        <p className="error-panel__message">{error}</p>
        {requestId && (
          <p className="error-panel__request-id">
            Request ID: <code>{requestId}</code>
          </p>
        )}
        <div className="error-panel__actions">
          <button className="error-panel__copy" onClick={copyError}>
            {copied ? 'Copied' : 'Copy error details'}
          </button>
          <a
            className="error-panel__report"
            href="mailto:support@workforceguard.ai?subject=Dashboard+error"
          >
            Report issue
          </a>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message, onClearFilters }: { message: string; onClearFilters?: () => void }) {
  return (
    <div className="data-state data-state--empty">
      <div className="error-panel">
        <h2>No data available</h2>
        <p>{message}</p>
        {onClearFilters && (
          <button className="filter-bar__button" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

export function DataState({ loading, error, empty, emptyMessage, onClearFilters, children }: DataStateProps) {
  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState error={error} />
  if (empty) return <EmptyState message={emptyMessage ?? 'No data matches the current filters.'} onClearFilters={onClearFilters} />
  return <>{children}</>
}
