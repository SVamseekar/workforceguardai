import type { ReactNode } from 'react'

const SOURCE_LABELS: Record<string, string> = {
  eurostat_lfs: 'Eurostat LFS',
  eurostat_jvs: 'Eurostat JVS',
  eurostat_ses: 'Eurostat SES',
  workforceguard_composite: 'WorkforceGuard composite indices',
}

export function ChartPanel({ title, sourceId, period, children }: { title: string; sourceId?: string; period?: string; children?: ReactNode }) {
  const titleWithPeriod = period ? `${title} · ${period}` : title
  return (
    <div className="panel">
      <div className="panel__header panel__header--tight">
        <div>
          <p className="panel__eyebrow">
            {sourceId ? SOURCE_LABELS[sourceId] ?? sourceId : 'Market data'}
          </p>
          <h2>{titleWithPeriod}</h2>
        </div>
      </div>
      <div className="panel__body panel__body--chart">
        {children}
      </div>
    </div>
  )
}
